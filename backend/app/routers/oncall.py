import logging
import re
import time
from datetime import date, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user
from app.config import settings
from app.models import User

router = APIRouter()
logger = logging.getLogger("oncall")

_CACHE_TTL = 300
_cache: dict = {"ts": 0.0, "value": None}

_ONCALL_KEYWORDS = {"oncall", "on-call", "on_call", "alert", "dyżur", "dyzur", "duty", "pager"}


class OnCallResponse(BaseModel):
    on_call: Optional[str] = None


def _auth():
    return (settings.caldav_username, settings.caldav_password)


async def _discover_calendar_url(client: httpx.AsyncClient) -> Optional[str]:
    if settings.caldav_calendar_url:
        return settings.caldav_calendar_url

    base_url = settings.caldav_url.rstrip("/") + "/"
    try:
        resp = await client.request(
            "PROPFIND",
            base_url,
            headers={"Depth": "1", "Content-Type": "application/xml"},
            content='<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/></D:prop></D:propfind>',
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("CalDAV PROPFIND failed: %s", exc)
        return None

    pairs = re.findall(
        r"<[Dd]:href>([^<]+)</[Dd]:href>.*?<[Dd]:displayname>([^<]*)</[Dd]:displayname>",
        resp.text,
        re.DOTALL,
    )
    for href, name in pairs:
        normalized = name.lower().replace(" ", "-").replace("_", "-")
        if any(kw in normalized for kw in _ONCALL_KEYWORDS):
            url = href if href.startswith("http") else f"{settings.caldav_url.rstrip('/')}{href}"
            logger.info("Discovered on-call calendar: %s (%s)", url, name)
            return url

    logger.warning("On-call calendar not found via PROPFIND, available: %s", [n for _, n in pairs])
    return None


def _parse_ical_date(val: str) -> date:
    clean = val.strip().replace("Z", "")
    if "T" in clean:
        clean = clean.split("T")[0]
    return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))


def _extract_on_call(ical_text: str, today: date) -> Optional[str]:
    for vevent in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ical_text, re.DOTALL):
        unfolded = re.sub(r"\r?\n[ \t]", "", vevent)

        summary_m = re.search(r"^SUMMARY[^:]*:(.+)$", unfolded, re.MULTILINE)
        start_m = re.search(r"^DTSTART[^:]*:(.+)$", unfolded, re.MULTILINE)
        end_m = re.search(r"^DTEND[^:]*:(.+)$", unfolded, re.MULTILINE)

        if not summary_m or not start_m:
            continue
        try:
            start = _parse_ical_date(start_m.group(1))
            end = _parse_ical_date(end_m.group(1)) if end_m else start + timedelta(days=1)
            if start <= today < end:
                return summary_m.group(1).strip()
        except Exception:
            continue
    return None


async def _fetch_on_call() -> Optional[str]:
    if not settings.caldav_username or not settings.caldav_password:
        logger.debug("CalDAV credentials not configured")
        return None
    if not settings.caldav_url and not settings.caldav_calendar_url:
        logger.debug("CalDAV URL not configured")
        return None

    today = date.today()
    start_str = today.strftime("%Y%m%dT000000Z")
    end_str = (today + timedelta(days=1)).strftime("%Y%m%dT000000Z")

    report_body = (
        '<?xml version="1.0" encoding="utf-8" ?>'
        '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">'
        "<D:prop><C:calendar-data/></D:prop>"
        "<C:filter>"
        '<C:comp-filter name="VCALENDAR">'
        '<C:comp-filter name="VEVENT">'
        f'<C:time-range start="{start_str}" end="{end_str}"/>'
        "</C:comp-filter></C:comp-filter>"
        "</C:filter>"
        "</C:calendar-query>"
    )

    async with httpx.AsyncClient(timeout=10, auth=_auth()) as client:
        cal_url = await _discover_calendar_url(client)
        if not cal_url:
            return None
        try:
            resp = await client.request(
                "REPORT",
                cal_url,
                headers={"Depth": "1", "Content-Type": "application/xml"},
                content=report_body,
            )
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("CalDAV REPORT failed: %s", exc)
            return None

    sections = re.findall(
        r"<\w+:calendar-data[^>]*>(.*?)</\w+:calendar-data>",
        resp.text,
        re.DOTALL,
    )
    for ical in sections:
        ical = ical.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        result = _extract_on_call(ical, today)
        if result:
            logger.info("On-call today: %s", result)
            return result

    logger.info("No on-call event found for %s", today)
    return None


@router.get("", response_model=OnCallResponse)
async def get_on_call(_: User = Depends(get_current_user)):
    now = time.monotonic()
    if _cache["ts"] and now - _cache["ts"] < _CACHE_TTL:
        return OnCallResponse(on_call=_cache["value"])

    value = await _fetch_on_call()
    _cache["ts"] = now
    _cache["value"] = value
    return OnCallResponse(on_call=value)
