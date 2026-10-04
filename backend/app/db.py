"""Owner: Dev 3. Ticket: "Leaderboard + score persistence".
SQLite. Every run is saved under a call sign the player can rename afterwards.
"""

import re
import sqlite3
import time
from contextlib import contextmanager

from . import config

NAME_MAX = 12
DEFAULT_NAME = "PIGEON"
_NAME_CHARS = re.compile(r"[^A-Za-z0-9 _.\-!?']")


def clean_name(name: str) -> str:
    """Keeps names printable and short; empty names fall back to the default."""
    cleaned = " ".join(_NAME_CHARS.sub("", name).split())[:NAME_MAX].strip()
    return cleaned or DEFAULT_NAME


@contextmanager
def connect():
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                altitude REAL NOT NULL,
                duration REAL NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            )"""
        )
        c.execute("CREATE INDEX IF NOT EXISTS runs_altitude ON runs (altitude DESC)")


def add_score(name: str, altitude: float, duration: float = 0) -> int:
    with connect() as c:
        cur = c.execute(
            "INSERT INTO runs (name, altitude, duration, created_at) VALUES (?, ?, ?, ?)",
            (clean_name(name), round(float(altitude), 1), round(float(duration), 1), time.time()),
        )
        return int(cur.lastrowid)


def rename(score_id: int, name: str) -> bool:
    with connect() as c:
        cur = c.execute("UPDATE runs SET name = ? WHERE id = ?", (clean_name(name), score_id))
        return cur.rowcount == 1


def rank_of(score_id: int) -> int | None:
    """1-based rank; ties go to the earlier run."""
    with connect() as c:
        row = c.execute("SELECT altitude, created_at FROM runs WHERE id = ?", (score_id,)).fetchone()
        if not row:
            return None
        ahead = c.execute(
            "SELECT COUNT(*) FROM runs WHERE altitude > ? OR (altitude = ? AND created_at < ?)",
            (row["altitude"], row["altitude"], row["created_at"]),
        ).fetchone()[0]
    return int(ahead) + 1


def top_scores(limit: int = 10) -> list[dict]:
    with connect() as c:
        rows = c.execute(
            "SELECT id, name, altitude FROM runs ORDER BY altitude DESC, created_at ASC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]
