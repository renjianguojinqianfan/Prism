def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_analyze_empty_body(client):
    resp = client.post("/api/analyze", json={"topic": "", "messages": []})
    assert resp.status_code == 200
    assert resp.json() == {"tags": []}
