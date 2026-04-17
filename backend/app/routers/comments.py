import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Alert, AlertComment, User
from app.schemas import CommentCreate, CommentUpdate, CommentOut

router = APIRouter()


@router.post("/{fingerprint}", response_model=CommentOut)
async def add_comment(
    fingerprint: str,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Alert).where(Alert.fingerprint == fingerprint))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    comment = AlertComment(
        alert_fingerprint=fingerprint,
        author=current_user.display_name,
        body=data.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.get("/{fingerprint}", response_model=list[CommentOut])
async def list_comments(
    fingerprint: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AlertComment)
        .where(AlertComment.alert_fingerprint == fingerprint)
        .order_by(AlertComment.created_at)
    )
    return [CommentOut.model_validate(c) for c in result.scalars().all()]


@router.patch("/id/{comment_id}", response_model=CommentOut)
async def edit_comment(
    comment_id: uuid.UUID,
    data: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(AlertComment).where(AlertComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.body = data.body
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.delete("/id/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(AlertComment).where(AlertComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.delete(comment)
    await db.commit()
