import json

import pytest
from fastapi.testclient import TestClient

from daraja import paths
from daraja.api import create_app


@pytest.fixture
def client(tmp_path, mentors):
    mentors_file = tmp_path / "mentors.json"
    mentors_file.write_text(json.dumps([m.model_dump() for m in mentors]), encoding="utf-8")
    return TestClient(create_app(mentors_path=mentors_file, config_path=paths.DEFAULT_CONFIG))


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["mentors_loaded"] == 3


def test_recommendations(client):
    payload = {"mentee": {"mentee_id": "MTE-API", "specialisation": "cargo", "years_experience": 1,
                          "goals_text": "I need help with dangerous goods regulations",
                          "wants_to_learn": ["dangerous_goods"]}, "k": 2}
    body = client.post("/recommendations", json=payload).json()
    assert body["status"] == "ok"
    assert body["results"][0]["mentor_id"] == "M-DG"
    assert len(body["results"]) == 2
    assert set(body["results"][0]["block_scores"]) == {"text", "skills", "specialisation"}


def test_incomplete_profile_status(client):
    body = client.post("/recommendations", json={"mentee": {"mentee_id": "MTE-EMPTY"}}).json()
    assert body["status"] == "incomplete_profile"
    assert body["results"] == []


def test_unknown_topic_is_rejected(client):
    response = client.post("/recommendations", json={"mentee": {"mentee_id": "X", "wants_to_learn": ["nope"]}})
    assert response.status_code == 422
    assert "nope" in response.json()["detail"]


def test_k_is_bounded(client):
    response = client.post("/recommendations", json={"mentee": {"mentee_id": "X", "goals_text": "cargo"}, "k": 100})
    assert response.status_code == 422


def test_taxonomy_endpoint(client):
    body = client.get("/taxonomy").json()
    assert any(t["id"] == "dangerous_goods" for t in body["topics"])
    assert all(s["id"] != "fleet" for s in body["specialisations"])
