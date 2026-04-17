import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Boolean, JSON, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    alertname: Mapped[str] = mapped_column(String(256), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    namespace: Mapped[str | None] = mapped_column(String(256), nullable=True)
    labels: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    annotations: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="firing")
    generator_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    cluster_source: Mapped[str] = mapped_column(String(64), nullable=False, default="primary", index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    acks: Mapped[list["AlertAck"]] = relationship(
        "AlertAck", back_populates="alert", cascade="all, delete-orphan", order_by="AlertAck.created_at"
    )
    comments: Mapped[list["AlertComment"]] = relationship(
        "AlertComment", back_populates="alert", cascade="all, delete-orphan", order_by="AlertComment.created_at"
    )


class AlertAck(Base):
    __tablename__ = "alert_acks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_fingerprint: Mapped[str] = mapped_column(
        String(64), ForeignKey("alerts.fingerprint", ondelete="CASCADE"), nullable=False, index=True
    )
    acknowledged_by: Mapped[str] = mapped_column(String(128), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    alert: Mapped["Alert"] = relationship("Alert", back_populates="acks")


class AlertComment(Base):
    __tablename__ = "alert_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_fingerprint: Mapped[str] = mapped_column(
        String(64), ForeignKey("alerts.fingerprint", ondelete="CASCADE"), nullable=False, index=True
    )
    author: Mapped[str] = mapped_column(String(128), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    alert: Mapped["Alert"] = relationship("Alert", back_populates="comments")
