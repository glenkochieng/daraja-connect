import pytest

from daraja.config import MatchingConfig
from daraja.schema import MenteeProfile, MentorProfile


def mentor(mentor_id, **kwargs):
    defaults = dict(user_type="current_staff", specialisation="cargo", years_experience=15,
                    expertise_text="", can_mentor_in=[], is_available=True, max_mentees=3,
                    current_mentees=0, consent_given=True)
    return MentorProfile(mentor_id=mentor_id, **{**defaults, **kwargs})


def mentee(mentee_id="MTE-T1", **kwargs):
    defaults = dict(specialisation="cargo", years_experience=1, goals_text="", wants_to_learn=[])
    return MenteeProfile(mentee_id=mentee_id, **{**defaults, **kwargs})


@pytest.fixture
def config():
    return MatchingConfig(weights={"text": 0.4, "skills": 0.4, "specialisation": 0.2})


@pytest.fixture
def mentors():
    return [
        mentor("M-DG", specialisation="cargo", years_experience=20,
               expertise_text="Recognised specialist in dangerous goods regulations and DGR compliance.",
               can_mentor_in=["dangerous_goods", "cargo_acceptance"]),
        mentor("M-ENG", specialisation="aircraft_maintenance", years_experience=18,
               expertise_text="Deep hands-on expertise in line maintenance and B787 engine borescope inspections.",
               can_mentor_in=["line_maintenance", "engine_maintenance", "fleet_b787"]),
        mentor("M-CAB", specialisation="cabin_services", years_experience=12,
               expertise_text="I currently train others in safety and emergency procedures and Premier World service.",
               can_mentor_in=["safety_emergency_procedures", "premium_cabin_service"]),
    ]
