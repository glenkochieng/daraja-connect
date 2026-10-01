import json

import pytest
from conftest import mentor
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


def test_taxonomy_includes_pride_centre_programmes(client):
    programmes = client.get("/taxonomy").json()["programmes"]
    assert len(programmes) == 20
    assert {"id": "sc_dangerous_goods", "name": "Short Course in Dangerous Goods Regulations", "domain": "cargo"} in programmes


DG_MENTEE = {"mentee_id": "MTE-POOL", "specialisation": "cargo", "years_experience": 1,
             "goals_text": "dangerous goods regulations", "wants_to_learn": ["dangerous_goods"]}


def test_supplied_mentor_pool_replaces_the_default_file(client):
    pool = [
        mentor("POOL-ENG", specialisation="aircraft_maintenance", can_mentor_in=["line_maintenance"]).model_dump(),
        mentor("POOL-DG", specialisation="cargo", expertise_text="dangerous goods regulations",
               can_mentor_in=["dangerous_goods"]).model_dump(),
    ]
    body = client.post("/recommendations", json={"mentee": DG_MENTEE, "mentors": pool, "k": 5}).json()
    assert body["status"] == "ok"
    assert [r["mentor_id"] for r in body["results"]][0] == "POOL-DG"
    assert {r["mentor_id"] for r in body["results"]} <= {"POOL-ENG", "POOL-DG"}


def test_supplied_pool_respects_exclusions_and_filters(client):
    pool = [
        mentor("POOL-DG", can_mentor_in=["dangerous_goods"]).model_dump(),
        mentor("POOL-FULL", can_mentor_in=["dangerous_goods"], current_mentees=3).model_dump(),
        mentor("POOL-OK", can_mentor_in=["dangerous_goods"]).model_dump(),
    ]
    body = client.post("/recommendations",
                       json={"mentee": DG_MENTEE, "mentors": pool, "exclude_mentor_ids": ["POOL-DG"]}).json()
    assert [r["mentor_id"] for r in body["results"]] == ["POOL-OK"]


def test_empty_supplied_pool_means_no_eligible_mentors(client):
    body = client.post("/recommendations", json={"mentee": DG_MENTEE, "mentors": []}).json()
    assert body["status"] == "no_eligible_mentors"


def test_incomplete_profile_is_reported_before_an_empty_pool(client):
    body = client.post("/recommendations", json={"mentee": {"mentee_id": "MTE-EMPTY"}, "mentors": []}).json()
    assert body["status"] == "incomplete_profile"


def test_duplicate_mentor_ids_are_rejected(client):
    pool = [mentor("SAME").model_dump(), mentor("SAME").model_dump()]
    response = client.post("/recommendations", json={"mentee": DG_MENTEE, "mentors": pool})
    assert response.status_code == 422
    assert "Duplicate" in response.json()["detail"]
