"""Owner: Dev 3. Ticket: "Scaffold backend: FastAPI + WebSocket + env keys".

Run: uvicorn app.main:app --reload --port 8000
The game must work with this server off.
"""

import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config, db
from .roast import make_roast

app = FastAPI(title="Flappy Arms API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    db.init_db()


class ScoreIn(BaseModel):
    initials: str = Field(min_length=1, max_length=3)
    level: str
    altitude: int = Field(ge=0)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "elevenlabs": bool(config.ELEVENLABS_API_KEY),
        "gemini": bool(config.GEMINI_API_KEY),
    }


@app.get("/leaderboard")
def leaderboard(level: str = "kitchen") -> dict:
    return {"level": level, "entries": db.top_scores(level)}


@app.post("/score")
def post_score(score: ScoreIn) -> dict:
    db.add_score(score.initials, score.level, score.altitude)
    return {"ok": True}


def envelope(type_: str, payload: dict) -> dict:
    return {"type": type_, "ts": int(time.time() * 1000), "payload": payload}


@app.websocket("/ws")
async def ws(socket: WebSocket) -> None:
    await socket.accept()
    try:
        while True:
            msg = await socket.receive_json()
            kind, payload = msg.get("type"), msg.get("payload", {})
            if kind == "death":
                roast = await make_roast(payload)
                if roast:
                    await socket.send_json(envelope("roast", roast))
                else:
                    await socket.send_json(envelope("roast_fallback", {}))
            elif kind == "score":
                db.add_score(payload["initials"], payload["level"], payload["altitude"])
                level = payload["level"]
                await socket.send_json(envelope("leaderboard", {"level": level, "entries": db.top_scores(level)}))
    except WebSocketDisconnect:
        pass
