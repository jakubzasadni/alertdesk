import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.auth import hash_password
from app.config import settings
from app.database import engine, AsyncSessionLocal, Base
from app.models import User
from app.routers import alerts, acks, comments, auth, oncall
from app.services.alertmanager import AlertManagerSync

logging.basicConfig(level=logging.INFO)


async def seed_admin():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none() is None:
            admin = User(
                username="admin",
                password_hash=hash_password("admin"),
                display_name="Administrator",
            )
            db.add(admin)
            await db.commit()
            logging.getLogger("startup").info("Created default admin user (change password!)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_admin()
    tasks = [asyncio.create_task(AlertManagerSync(source="primary").run())]
    if settings.secondary_alertmanager_url:
        tasks.append(asyncio.create_task(
            AlertManagerSync(
                source="secondary",
                url=settings.secondary_alertmanager_url,
                host_header=settings.secondary_alertmanager_host,
            ).run()
        ))
    yield
    for t in tasks:
        t.cancel()
    for t in tasks:
        try:
            await t
        except asyncio.CancelledError:
            pass
    await engine.dispose()


app = FastAPI(title="Alertdesk API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(acks.router, prefix="/api/acks", tags=["acks"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(oncall.router, prefix="/api/oncall", tags=["oncall"])


@app.get("/health")
async def health():
    return {"status": "ok"}
