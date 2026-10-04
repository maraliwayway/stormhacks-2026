"""Owner: Dev 3. Ticket: "Scaffold backend: FastAPI + WebSocket + env keys".

Run: uvicorn app.main:app --reload --port 8000
The game must work with this server off.
"""

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from . import config, db
from .roast import RunStats, close_client, make_roast, warm_up


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield
    await close_client()


app = FastAPI(title="Flappy Arms API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScoreIn(BaseModel):
    name: str = Field(default=db.DEFAULT_NAME, max_length=40)
    altitude: float = Field(ge=0, le=100_000)
    duration: float = Field(default=0, ge=0, le=86_400)


class RenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)


def score_result(score_id: int) -> dict:
    return {"id": score_id, "rank": db.rank_of(score_id), "entries": db.top_scores()}


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "elevenlabs": bool(config.ELEVENLABS_API_KEY),
        "gemini": bool(config.GEMINI_API_KEY),
        "voices": {persona: bool(v) for persona, v in config.VOICE_IDS.items()},
    }


@app.get("/leaderboard")
def leaderboard(limit: int = 10) -> dict:
    return {"entries": db.top_scores(max(1, min(limit, 50)))}


@app.post("/score")
def post_score(score: ScoreIn) -> dict:
    return score_result(db.add_score(score.name, score.altitude, score.duration))


@app.patch("/score/{score_id}")
def rename_score(score_id: int, body: RenameIn) -> dict:
    if not db.rename(score_id, body.name):
        raise HTTPException(404, "score not found")
    return score_result(score_id)


_background: set[asyncio.Task] = set()  # keeps fire-and-forget tasks alive until they finish


def envelope(type_: str, payload: dict) -> dict:
    return {"type": type_, "ts": int(time.time() * 1000), "payload": payload}


async def handle_message(msg: dict) -> dict | None:
    kind, payload = msg.get("type"), msg.get("payload") or {}
    if kind == "death":
        roast = await make_roast(RunStats.model_validate(payload))
        return envelope("roast", roast) if roast else envelope("roast_fallback", {})
    if kind == "score":
        score = ScoreIn.model_validate(payload)
        return envelope("score_saved", score_result(db.add_score(score.name, score.altitude, score.duration)))
    if kind == "warm":
        # Fire and forget: the client says a run started, so open the API connections before the death roast.
        task = asyncio.create_task(warm_up())
        _background.add(task)
        task.add_done_callback(_background.discard)
        return None
    if kind == "ping":
        return envelope("pong", {})
    return None


@app.websocket("/ws")
async def ws(socket: WebSocket) -> None:
    await socket.accept()
    try:
        while True:
            try:
                msg = await socket.receive_json()
                reply = await handle_message(msg if isinstance(msg, dict) else {})
            except (ValidationError, ValueError) as err:
                reply = envelope("error", {"message": str(err)[:200]})
            if reply:
                await socket.send_json(reply)
    except WebSocketDisconnect:
        pass
