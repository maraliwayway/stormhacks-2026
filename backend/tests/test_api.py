from app import db


def test_health_reports_keys_without_values(client):
    body = client.get("/health").json()
    assert body["ok"] is True
    assert set(body) == {"ok", "elevenlabs", "gemini", "voices"}
    assert set(body["voices"]) == {"narrator", "chef", "announcer"}
    assert all(isinstance(v, bool) for v in body["voices"].values())


def test_score_returns_rank_and_sorted_top_ten(client):
    for alt in [12, 80, 45, 3, 99, 60, 7, 33, 21, 5, 70, 1]:
        client.post("/score", json={"name": "ann", "altitude": alt})
    res = client.post("/score", json={"name": "Stephen", "altitude": 50.26, "duration": 41}).json()
    assert res["rank"] == 5  # 99, 80, 70, 60 are higher
    alts = [e["altitude"] for e in res["entries"]]
    assert len(alts) == 10 and alts == sorted(alts, reverse=True)
    assert {"id": res["id"], "name": "Stephen", "altitude": 50.3} in res["entries"]


def test_ties_rank_the_earlier_run_first(client):
    first = client.post("/score", json={"name": "A", "altitude": 40}).json()
    second = client.post("/score", json={"name": "B", "altitude": 40}).json()
    assert (first["rank"], second["rank"]) == (1, 2)


def test_rename_updates_the_run(client):
    run = client.post("/score", json={"altitude": 30}).json()
    assert run["entries"][0]["name"] == db.DEFAULT_NAME
    renamed = client.patch(f"/score/{run['id']}", json={"name": "  Sky   Queen!! <b>"}).json()
    assert renamed["entries"][0]["name"] == "Sky Queen!!"  # tags stripped, cut to 12, trailing space trimmed
    assert client.patch("/score/9999", json={"name": "x"}).status_code == 404


def test_invalid_scores_are_rejected(client):
    assert client.post("/score", json={"altitude": -1}).status_code == 422
    assert client.post("/score", json={"altitude": "high"}).status_code == 422
    assert client.patch("/score/1", json={"name": ""}).status_code == 422


def test_leaderboard_limit_is_clamped(client):
    for alt in range(60):
        client.post("/score", json={"altitude": alt})
    assert len(client.get("/leaderboard").json()["entries"]) == 10
    assert len(client.get("/leaderboard?limit=500").json()["entries"]) == 50
    assert len(client.get("/leaderboard?limit=0").json()["entries"]) == 1


def test_clean_name_falls_back_for_empty_names():
    assert db.clean_name("   ") == db.DEFAULT_NAME
    assert db.clean_name("<<>>") == db.DEFAULT_NAME
    assert db.clean_name("averyveryverylongname") == "averyveryver"
