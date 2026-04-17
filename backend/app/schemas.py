import uuid
from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, field_serializer


def _utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    display_name: str


# ─── Acks ─────────────────────────────────────────────────────────────────────

class AckCreate(BaseModel):
    comment: str | None = None
    acknowledged_by: str | None = None  # override; falls back to logged-in user


class AckOut(BaseModel):
    id: uuid.UUID
    alert_fingerprint: str
    acknowledged_by: str
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Comments ─────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    body: str


class CommentUpdate(BaseModel):
    body: str


class CommentOut(BaseModel):
    id: uuid.UUID
    alert_fingerprint: str
    author: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: uuid.UUID
    fingerprint: str
    alertname: str
    severity: str
    namespace: str | None
    labels: dict
    annotations: dict
    starts_at: datetime
    ends_at: datetime | None
    status: str
    generator_url: str | None
    cluster_source: str = "primary"
    first_seen_at: datetime
    last_seen_at: datetime
    acks: list[AckOut] = []
    comments: list[CommentOut] = []

    model_config = {"from_attributes": True}

    @field_serializer("starts_at", "ends_at", "first_seen_at", "last_seen_at")
    def serialize_dt(self, v: datetime | None) -> str | None:
        return _utc_iso(v)


class AlertListItem(BaseModel):
    id: uuid.UUID
    fingerprint: str
    alertname: str
    severity: str
    namespace: str | None
    labels: dict
    annotations: dict
    starts_at: datetime
    ends_at: datetime | None
    status: str
    cluster_source: str = "primary"
    first_seen_at: datetime
    last_seen_at: datetime
    generator_url: str | None
    ack_count: int = 0
    comment_count: int = 0
    last_ack: AckOut | None = None

    model_config = {"from_attributes": True}

    @field_serializer("starts_at", "ends_at", "first_seen_at", "last_seen_at")
    def serialize_dt(self, v: datetime | None) -> str | None:
        return _utc_iso(v)


class AlertsResponse(BaseModel):
    items: list[AlertListItem]
    total: int
