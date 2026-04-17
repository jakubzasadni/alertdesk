# alertdesk

A lightweight Alertmanager UI with acknowledgements, threaded comments, and on-call calendar integration.

> **Built for teams that operate Prometheus/Alertmanager and need a simple, self-hosted way to track who's handling what.**

![CI](https://github.com/jakubzasadni/alertdesk/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

## Screenshots

![Alerts table](docs/screenshots/alerts.png)

![Login page](docs/screenshots/login.png)

---

## Features

- **Alert list** — live view of all firing alerts from one or two Alertmanager instances
- **Acknowledge** — ACK an alert with an optional comment; ACKs are persisted and visible to all team members
- **Threaded comments** — leave notes on any alert, visible in the detail drawer
- **On-call widget** — shows today's on-call engineer from any CalDAV calendar (Nextcloud, Google Calendar, etc.)
- **Multiple sources** — optional second Alertmanager instance shown in a separate tab
- **Keycloak SSO** — optional OIDC login via Keycloak; falls back to local username/password
- **Dark / light theme** — per-user preference persisted in the browser
- **Favicon badge** — unread firing count shown on the browser tab when the window is in the background

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  React + Ant Design + Zustand + React Query         │
└──────────────────────┬──────────────────────────────┘
                       │ REST /api/*
┌──────────────────────▼──────────────────────────────┐
│  Backend (FastAPI + SQLAlchemy async)               │
│  • JWT auth (local + Keycloak JWKS)                 │
│  • Background sync loop → Alertmanager API          │
│  • CalDAV on-call reader                            │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
  ┌────────▼──────┐     ┌──────────▼──────────┐
  │  PostgreSQL   │     │  Alertmanager(s)    │
  └───────────────┘     └─────────────────────┘
```

---

## Quick start — Docker Compose

```bash
git clone https://github.com/jakubzasadni/alertdesk
cd alertdesk

# Edit ALERTMANAGER_URL in docker-compose.yml to point at your Alertmanager
docker compose up -d

# Open http://localhost:3000
# Default credentials: admin / admin  ← change immediately
```

---

## Configuration

All backend settings are environment variables (or a `.env` file). See `.env.example` for reference.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://alertdesk:password@localhost:5432/alertdesk` | PostgreSQL connection string |
| `ALERTMANAGER_URL` | `http://localhost:9093` | Primary Alertmanager URL |
| `SECRET_KEY` | *(insecure default)* | JWT signing key — **must be changed in production** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Token lifetime (8h) |
| `SYNC_INTERVAL_SECONDS` | `30` | How often to poll Alertmanager |
| `SOURCE_PRIMARY_LABEL` | `Primary` | Tab label for the primary source |
| **Secondary source** | | |
| `SECONDARY_ALERTMANAGER_URL` | *(empty)* | Optional second Alertmanager URL |
| `SECONDARY_ALERTMANAGER_HOST` | *(empty)* | Override `Host` header for the secondary source |
| `SOURCE_SECONDARY_LABEL` | `Secondary` | Tab label for the secondary source |
| **Keycloak SSO** | | |
| `KEYCLOAK_URL` | *(empty)* | Keycloak base URL, e.g. `https://sso.example.com` |
| `KEYCLOAK_REALM` | *(empty)* | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | `alertdesk` | Keycloak client ID |
| **On-call calendar (CalDAV)** | | |
| `CALDAV_URL` | *(empty)* | CalDAV principal URL (e.g. Nextcloud dav endpoint) |
| `CALDAV_USERNAME` | *(empty)* | CalDAV username |
| `CALDAV_PASSWORD` | *(empty)* | CalDAV password or app token |
| `CALDAV_CALENDAR_URL` | *(empty)* | Direct calendar URL — skips PROPFIND auto-discovery |

### On-call calendar

Alertdesk reads today's on-call engineer from any CalDAV calendar. The event's `SUMMARY` is displayed in the header.

Auto-discovery looks for a calendar whose name contains one of: `oncall`, `on-call`, `alert`, `duty`, `pager`.  
Set `CALDAV_CALENDAR_URL` directly if you want to skip discovery.

**Nextcloud example:**
```env
CALDAV_URL=https://cloud.example.com/remote.php/dav/calendars/myuser/
CALDAV_USERNAME=myuser
CALDAV_PASSWORD=my-app-token
```

---

## Kubernetes — Helm

```bash
helm repo add alertdesk https://jakubzasadni.github.io/alertdesk
helm repo update
helm search repo alertdesk

helm install alertdesk alertdesk/alertdesk \
  --namespace alertdesk --create-namespace \
  --set config.alertmanagerUrl=http://alertmanager.monitoring:9093 \
  --set secret.secretKey=your-random-32-char-secret \
  --set ingress.enabled=true \
  --set ingress.host=alertdesk.example.com
```

Or install from source:

```bash
helm install alertdesk ./helm/alertdesk \
  --namespace alertdesk --create-namespace \
  -f my-values.yaml
```

See [helm/alertdesk/values.yaml](helm/alertdesk/values.yaml) for all available options.

---

## Development

**Requirements:** Docker, Node.js 20+, Python 3.12+

```bash
# Start PostgreSQL
docker compose up postgres -d

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Ant Design 5, Zustand, React Query, Vite |
| Backend | FastAPI, SQLAlchemy (async), asyncpg, python-jose |
| Database | PostgreSQL 16 |
| Auth | JWT (local) + Keycloak OIDC |
| Calendar | CalDAV (iCal REPORT query) |
| Container | Docker, multi-arch (amd64/arm64) |
| Kubernetes | Helm chart with optional Bitnami PostgreSQL subchart |

---

## License

MIT
