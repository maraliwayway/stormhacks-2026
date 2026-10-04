"""Owner: Dev 3. Ticket: "Leaderboard + score persistence".
SQLite by default. Swap for Tiger Data (Postgres) if the stretch ticket is picked up.
"""

import sqlite3
import time
from contextlib import contextmanager

from .config import DB_PATH


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                initials TEXT NOT NULL,
                level TEXT NOT NULL,
                altitude INTEGER NOT NULL,
                created_at REAL NOT NULL
            )"""
        )


def add_score(initials: str, level: str, altitude: int) -> None:
    with connect() as c:
        c.execute(
            "INSERT INTO scores (initials, level, altitude, created_at) VALUES (?, ?, ?, ?)",
            (initials.upper()[:3], level, int(altitude), time.time()),
        )


def top_scores(level: str, limit: int = 10) -> list[dict]:
    with connect() as c:
        rows = c.execute(
            "SELECT initials, altitude FROM scores WHERE level = ? ORDER BY altitude DESC LIMIT ?",
            (level, limit),
        ).fetchall()
    return [dict(r) for r in rows]
