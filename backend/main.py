from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from dotenv import load_dotenv

# Load .env from backend/ first, then fall back to the project root (../​.env)
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, ".env"))
load_dotenv(os.path.join(_here, "..", ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

from models.schemas import LoginRequest, TokenResponse
from routes import alerts, analyze, events, reports, stream
from services.gemini_service import gemini_service as claude_service

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Auth config ────────────────────────────────────────────────────────────────

SECRET_KEY              = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM               = "HS256"
TOKEN_EXPIRE_MINUTES    = 60 * 24  # 24 h
ADMIN_USERNAME          = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD          = os.getenv("ADMIN_PASSWORD", "admin123")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": subject, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM
    )


# ── Background anomaly detection loop ────────────────────────────────────────

async def _anomaly_loop(app: FastAPI) -> None:
    """Every 5 minutes, pull recent events and ask Claude for anomalies."""
    while True:
        await asyncio.sleep(300)
        try:
            cutoff = datetime.utcnow() - timedelta(minutes=5)
            cursor = app.state.mongodb["events"].find(
                {"timestamp": {"$gte": cutoff}}
            )
            events = await cursor.to_list(length=300)
            if not events:
                continue

            for e in events:
                e["_id"] = str(e["_id"])

            result = await claude_service.analyze_anomalies(events)

            inserts = []
            for anomaly in result.get("anomalies", []):
                doc = {
                    **anomaly,
                    "timestamp": datetime.utcnow(),
                    "resolved": False,
                }
                inserts.append(doc)
                if anomaly.get("severity") == "high":
                    logger.warning("HIGH ALERT: %s", anomaly.get("title"))

            if inserts:
                await app.state.mongodb["alerts"].insert_many(inserts)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Anomaly loop error: %s", exc)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name   = os.getenv("MONGODB_DB",  "site_ops_intel")

    client = AsyncIOMotorClient(mongo_uri)
    app.state.db_client = client
    app.state.mongodb   = client[db_name]

    try:
        await app.state.mongodb.command("ping")
        logger.info("✅  MongoDB connected  (%s / %s)", mongo_uri, db_name)
    except Exception as exc:
        logger.error("❌  MongoDB connection failed: %s", exc)
        raise RuntimeError(f"Cannot connect to MongoDB: {exc}") from exc

    bg_task = asyncio.create_task(_anomaly_loop(app))

    yield

    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass
    client.close()
    logger.info("MongoDB connection closed")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Site Operations Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stream.router,   tags=["stream"])
app.include_router(analyze.router,  prefix="/analyze",  tags=["analyze"])
app.include_router(reports.router,  prefix="/reports",  tags=["reports"])
app.include_router(alerts.router,   prefix="/alerts",   tags=["alerts"])
app.include_router(events.router,   prefix="/events",   tags=["events"])


# ── Auth endpoint ──────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(body.username))


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.utcnow().isoformat()}
