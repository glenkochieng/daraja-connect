"""FastAPI matching service called by the Daraja Connect Node.js/Express backend.

Run:
    uvicorn daraja.api:app --reload --port 8000
    (interactive docs at http://127.0.0.1:8000/docs)

Environment variables:
    DARAJA_MENTORS_PATH   JSON file of mentor profiles (default: data/synthetic/mentors.json)
    DARAJA_CONFIG_PATH    matching config (default: config/matching.tuned.yaml if present, else config/matching.yaml)

This service should only be reachable from the backend (internal network), not from browsers.
In production, replace the JSON mentor file with a read from MongoDB (see load_mentor_profiles).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from daraja import __version__, paths
from daraja.config import load_config
from daraja.data import load_mentors
from daraja.recommender import ContentRecommender
from daraja.schema import MenteeProfile, MentorProfile, RecommendationResult
from daraja.vocabulary import load_taxonomy


class RecommendationRequest(BaseModel):
    mentee: MenteeProfile
    k: int = Field(5, ge=1, le=20)
    exclude_mentor_ids: list[str] = Field(default_factory=list, description="e.g. mentors with an open request from this mentee")


def load_mentor_profiles(path: Path) -> list[MentorProfile]:
    """Swap this for a MongoDB query (e.g. pymongo) when the platform database exists."""
    return load_mentors(path)


def create_app(mentors_path: str | Path | None = None, config_path: str | Path | None = None) -> FastAPI:
    mentors_path = Path(mentors_path or os.environ.get("DARAJA_MENTORS_PATH") or paths.SYNTHETIC_DIR / "mentors.json")
    config_path = Path(config_path or os.environ.get("DARAJA_CONFIG_PATH") or paths.active_config_path())
    taxonomy = load_taxonomy()
    state: dict = {}

    def reload() -> None:
        config = load_config(config_path)
        mentors = load_mentor_profiles(mentors_path)
        state["recommender"] = ContentRecommender(config, taxonomy).fit(mentors)
        state["loaded_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    reload()
    app = FastAPI(
        title="Daraja Connect matching service",
        version=__version__,
        description="Content-based mentor recommendations (TF-IDF and structured-feature cosine similarity).",
    )

    @app.get("/health")
    def health() -> dict:
        rec: ContentRecommender = state["recommender"]
        return {"status": "ok", "mentors_loaded": len(rec.pool), "config_version": rec.config.version,
                "weights": rec.config.weights, "loaded_at": state["loaded_at"]}

    @app.get("/taxonomy")
    def get_taxonomy() -> dict:
        return {
            "specialisations": [{"id": d, "name": taxonomy.domains[d]["name"]} for d in taxonomy.specialisations],
            "topics": [{"id": t.id, "name": t.name, "domain": t.domain} for t in taxonomy.topics.values()],
        }

    @app.post("/recommendations", response_model=RecommendationResult)
    def recommendations(request: RecommendationRequest) -> RecommendationResult:
        mentee = request.mentee
        unknown = taxonomy.validate_topics(mentee.wants_to_learn)
        if unknown:
            raise HTTPException(status_code=422, detail=f"Unknown topic ids in wants_to_learn: {unknown}")
        if mentee.specialisation and mentee.specialisation not in taxonomy.specialisations:
            raise HTTPException(status_code=422, detail=f"Unknown specialisation: {mentee.specialisation}")
        return state["recommender"].recommend(mentee, k=request.k, exclude_mentor_ids=request.exclude_mentor_ids)

    @app.post("/mentors/reload")
    def reload_mentors() -> dict:
        reload()
        return {"status": "reloaded", "mentors_loaded": len(state["recommender"].pool), "loaded_at": state["loaded_at"]}

    return app


app = create_app()
