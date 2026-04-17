from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Alert, AlertAck, AlertComment, User
from app.schemas import AlertOut, AlertsResponse, AlertListItem, AckOut, CommentOut

router = APIRouter()


@router.get("", response_model=AlertsResponse)
async def list_alerts(
    status: str | None = Query(None, description="firing|resolved"),
    severity: str | None = Query(None),
    namespace: str | None = Query(None),
    cluster_source: str | None = Query(None, description="general|tfc"),
    acked: bool | None = Query(None, description="True = only acked, False = only unacked"),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Alert).options(
        selectinload(Alert.acks),
        selectinload(Alert.comments),
    )

    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    if namespace:
        query = query.where(Alert.namespace == namespace)
    if search:
        query = query.where(Alert.alertname.ilike(f"%{search}%"))
    if cluster_source:
        query = query.where(Alert.cluster_source == cluster_source)

    query = query.order_by(Alert.starts_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(query.offset(skip).limit(limit))
    alerts = result.scalars().unique().all()

    items = []
    for alert in alerts:
        if acked is True and not alert.acks:
            continue
        if acked is False and alert.acks:
            continue

        last_ack = AckOut.model_validate(alert.acks[-1]) if alert.acks else None
        items.append(
            AlertListItem(
                id=alert.id,
                fingerprint=alert.fingerprint,
                alertname=alert.alertname,
                severity=alert.severity,
                namespace=alert.namespace,
                labels=alert.labels,
                annotations=alert.annotations,
                starts_at=alert.starts_at,
                ends_at=alert.ends_at,
                status=alert.status,
                first_seen_at=alert.first_seen_at,
                last_seen_at=alert.last_seen_at,
                generator_url=alert.generator_url,
                ack_count=len(alert.acks),
                comment_count=len(alert.comments),
                last_ack=last_ack,
            )
        )

    return AlertsResponse(items=items, total=total)


@router.get("/{fingerprint}", response_model=AlertOut)
async def get_alert(
    fingerprint: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Alert)
        .options(selectinload(Alert.acks), selectinload(Alert.comments))
        .where(Alert.fingerprint == fingerprint)
    )
    alert = result.scalar_one_or_none()
    if alert is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertOut.model_validate(alert)
