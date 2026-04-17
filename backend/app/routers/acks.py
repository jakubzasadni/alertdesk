from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Alert, AlertAck, User
from app.schemas import AckCreate, AckOut

router = APIRouter()


@router.post("/{fingerprint}", response_model=AckOut)
async def acknowledge_alert(
    fingerprint: str,
    data: AckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Alert).where(Alert.fingerprint == fingerprint))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    ack = AlertAck(
        alert_fingerprint=fingerprint,
        acknowledged_by=data.acknowledged_by or current_user.display_name,
        comment=data.comment,
    )
    db.add(ack)
    await db.commit()
    await db.refresh(ack)
    return AckOut.model_validate(ack)


@router.get("/{fingerprint}", response_model=list[AckOut])
async def list_acks(
    fingerprint: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AlertAck)
        .where(AlertAck.alert_fingerprint == fingerprint)
        .order_by(AlertAck.created_at)
    )
    return [AckOut.model_validate(a) for a in result.scalars().all()]


@router.delete("/{fingerprint}", status_code=204)
async def delete_acks(
    fingerprint: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Remove all ACKs for an alert (to allow re-acknowledging)."""
    result = await db.execute(
        select(AlertAck).where(AlertAck.alert_fingerprint == fingerprint)
    )
    for ack in result.scalars().all():
        await db.delete(ack)
    await db.commit()
