import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import Alert

logger = logging.getLogger("alertmanager_sync")


class AlertManagerSync:
    def __init__(self, source: str = "primary", url: str = "", host_header: str = ""):
        self.source = source
        self.url = (url or settings.alertmanager_url).rstrip("/")
        self.host_header = host_header

    async def fetch_alerts(self) -> list[dict]:
        headers = {"Host": self.host_header} if self.host_header else {}
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            resp = await client.get(f"{self.url}/api/v2/alerts", params={"active": "true", "silenced": "false"})
            resp.raise_for_status()
            return resp.json()

    def _parse_alert(self, raw: dict) -> dict:
        labels = raw.get("labels", {})
        starts_at_raw = raw["startsAt"].replace("Z", "+00:00")
        starts_at = datetime.fromisoformat(starts_at_raw).replace(tzinfo=None)
        return {
            "fingerprint": f"{self.source}:{raw['fingerprint']}",
            "alertname": labels.get("alertname", "unknown"),
            "severity": labels.get("severity", "info").lower(),
            "namespace": labels.get("namespace") or labels.get("exported_namespace"),
            "labels": labels,
            "annotations": raw.get("annotations", {}),
            "starts_at": starts_at,
            "ends_at": None,
            "status": "firing",
            "cluster_source": self.source,
            "generator_url": raw.get("generatorURL"),
            "last_seen_at": datetime.utcnow(),
        }

    async def sync(self):
        try:
            raw_alerts = await self.fetch_alerts()
        except Exception as exc:
            logger.warning("Failed to fetch alerts from AlertManager: %s", exc)
            return

        active_fingerprints = {f"{self.source}:{a['fingerprint']}" for a in raw_alerts}

        try:
            async with AsyncSessionLocal() as db:
                async with db.begin():
                    # Upsert firing alerts
                    for raw in raw_alerts:
                        parsed = self._parse_alert(raw)
                        stmt = (
                            insert(Alert)
                            .values(
                                fingerprint=parsed["fingerprint"],
                                alertname=parsed["alertname"],
                                severity=parsed["severity"],
                                namespace=parsed["namespace"],
                                labels=parsed["labels"],
                                annotations=parsed["annotations"],
                                starts_at=parsed["starts_at"],
                                ends_at=None,
                                status="firing",
                                cluster_source=parsed["cluster_source"],
                                generator_url=parsed["generator_url"],
                                first_seen_at=datetime.utcnow(),
                                last_seen_at=datetime.utcnow(),
                            )
                            .on_conflict_do_update(
                                index_elements=["fingerprint"],
                                set_={
                                    "severity": parsed["severity"],
                                    "labels": parsed["labels"],
                                    "annotations": parsed["annotations"],
                                    "status": "firing",
                                    "ends_at": None,
                                    "last_seen_at": func.now(),
                                    # Jeśli alert był resolved i wrócił – reset czasu pojawienia się w panelu
                                    "first_seen_at": case(
                                        (Alert.status == "resolved", func.now()),
                                        else_=Alert.first_seen_at,
                                    ),
                                },
                            )
                        )
                        await db.execute(stmt)

                    # Resolve alerts no longer in AM (tylko dla tego source)
                    result = await db.execute(
                        select(Alert).where(Alert.status == "firing", Alert.cluster_source == self.source)
                    )
                    firing_in_db = result.scalars().all()
                    now = datetime.utcnow()
                    for alert in firing_in_db:
                        if alert.fingerprint not in active_fingerprints:
                            alert.status = "resolved"
                            alert.ends_at = now

            logger.info("Sync done – %d active, %d total in DB", len(raw_alerts), len(firing_in_db))
        except Exception as exc:
            logger.error("Sync DB error: %s", exc, exc_info=True)

    async def run(self):
        while True:
            await self.sync()
            await asyncio.sleep(30)
