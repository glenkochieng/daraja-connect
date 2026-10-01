"""Profile schemas shared by the recommender, data generator and API.

Mentees are Pride Centre alumni. Mentors are current or former Kenya Airways
employees. Only observable profile fields live here; the synthetic generator's
hidden ("latent") attributes are stored separately and never reach the recommender.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class MentorProfile(BaseModel):
    mentor_id: str
    user_type: Literal["current_staff", "former_staff"]
    role_title: str | None = None
    specialisation: str | None = Field(None, description="Taxonomy domain id, e.g. 'cargo'")
    years_experience: float | None = Field(None, ge=0)
    expertise_text: str = ""
    can_mentor_in: list[str] = Field(default_factory=list, description="Taxonomy topic ids")
    is_available: bool = True
    max_mentees: int = Field(2, ge=0)
    current_mentees: int = Field(0, ge=0)
    consent_given: bool = True

    @field_validator("can_mentor_in")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))


class MenteeProfile(BaseModel):
    mentee_id: str
    user_type: Literal["pride_alumni"] = "pride_alumni"
    pride_programme: str | None = Field(None, description="Pride Centre programme id")
    graduation_year: int | None = None
    specialisation: str | None = Field(None, description="Target taxonomy domain id")
    years_experience: float | None = Field(None, ge=0)
    goals_text: str = ""
    wants_to_learn: list[str] = Field(default_factory=list, description="Taxonomy topic ids")
    consent_given: bool = True

    @field_validator("wants_to_learn")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))


class Recommendation(BaseModel):
    mentor_id: str
    rank: int
    score: float
    block_scores: dict[str, float | None] = Field(description="Per-block similarity; null when the block is missing for this pair")
    reasons: list[str] = Field(default_factory=list)


class RecommendationResult(BaseModel):
    mentee_id: str
    status: Literal["ok", "no_eligible_mentors", "incomplete_profile"]
    config_version: str
    results: list[Recommendation] = Field(default_factory=list)
