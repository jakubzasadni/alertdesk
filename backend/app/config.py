from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://alertdesk:password@localhost:5432/alertdesk"
    alertmanager_url: str = "http://localhost:9093"
    secret_key: str = "change-me-in-production-32-chars!!"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8h
    sync_interval_seconds: int = 30

    keycloak_url: str = ""
    keycloak_realm: str = ""
    keycloak_client_id: str = "alertdesk"

    # Optional second Alertmanager source
    secondary_alertmanager_url: str = ""
    secondary_alertmanager_host: str = ""

    # Human-readable tab labels for each source
    source_primary_label: str = "Primary"
    source_secondary_label: str = "Secondary"

    # On-call calendar (CalDAV) — optional
    # For Nextcloud: https://cloud.example.com/remote.php/dav/calendars/<username>/
    caldav_url: str = ""
    caldav_username: str = ""
    caldav_password: str = ""
    caldav_calendar_url: str = ""  # skip PROPFIND auto-discovery if set

    class Config:
        env_file = ".env"


settings = Settings()
