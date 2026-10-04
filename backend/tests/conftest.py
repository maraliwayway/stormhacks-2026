import pytest
from fastapi.testclient import TestClient

from app import config, db
from app.main import app


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    """Every test gets its own SQLite file; the real leaderboard is never touched."""
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    db.init_db()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
