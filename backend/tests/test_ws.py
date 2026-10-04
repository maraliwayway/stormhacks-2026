from app import config

DEATH = {"altitude": 12, "best": 30, "duration": 9, "flapCount": 20, "flapRate": 1.5, "reason": "knife", "level": "kitchen"}


def test_death_without_keys_gets_fallback(client, monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "death", "ts": 0, "payload": DEATH})
        msg = ws.receive_json()
    assert msg["type"] == "roast_fallback" and isinstance(msg["ts"], int)


def test_score_over_ws_returns_rank_and_board(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "score", "ts": 0, "payload": {"name": "WS", "altitude": 77}})
        msg = ws.receive_json()
    assert msg["type"] == "score_saved"
    assert msg["payload"]["rank"] == 1
    assert msg["payload"]["entries"][0]["name"] == "WS"


def test_bad_messages_get_an_error_and_keep_the_socket_open(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text("not json")
        assert ws.receive_json()["type"] == "error"
        ws.send_json({"type": "death", "payload": {"altitude": -5}})
        assert ws.receive_json()["type"] == "error"
        ws.send_json({"type": "ping"})
        assert ws.receive_json()["type"] == "pong"


def test_warm_is_silent_and_never_blocks(client, monkeypatch):
    calls = []

    async def fake_warm():
        calls.append("warm")

    monkeypatch.setattr("app.main.warm_up", fake_warm)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "warm", "payload": {}})
        ws.send_json({"type": "ping"})
        assert ws.receive_json()["type"] == "pong"
    assert calls == ["warm"]
