"""Reading and writing profile datasets."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

from daraja import paths
from daraja.schema import MenteeProfile, MentorProfile

LIST_FIELDS = {"can_mentor_in", "wants_to_learn"}


def read_profile_rows(path: str | Path) -> list[dict]:
    """A JSON list of profiles, or a CSV laid out as save_profiles writes it (lists joined with ';')."""
    path = Path(path)
    if path.suffix.lower() != ".csv":
        return json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for record in pd.read_csv(path, dtype=str, keep_default_na=False).to_dict("records"):
        row = {k: v.strip() for k, v in record.items() if v.strip()}  # an empty cell takes the schema default
        for field in LIST_FIELDS & row.keys():
            row[field] = [t.strip() for t in row[field].split(";") if t.strip()]
        row.setdefault("consent_given", False)  # real data: no recorded consent means no consent
        rows.append(row)
    return rows


def load_mentors(path: str | Path = paths.SYNTHETIC_DIR / "mentors.json") -> list[MentorProfile]:
    return [MentorProfile(**row) for row in read_profile_rows(path)]


def load_mentees(path: str | Path = paths.SYNTHETIC_DIR / "mentees.json") -> list[MenteeProfile]:
    return [MenteeProfile(**row) for row in read_profile_rows(path)]


def save_profiles(profiles, json_path: str | Path, csv_path: str | Path | None = None) -> None:
    rows = [p.model_dump() for p in profiles]
    Path(json_path).parent.mkdir(parents=True, exist_ok=True)
    Path(json_path).write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    if csv_path:
        flat = [{k: (";".join(v) if isinstance(v, list) else v) for k, v in row.items()} for row in rows]
        pd.DataFrame(flat).to_csv(csv_path, index=False)


def load_splits(path: str | Path = paths.SYNTHETIC_DIR / "splits.json") -> dict[str, list[str]]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_relevance(path: str | Path = paths.HIDDEN_DIR / "simulated_relevance.csv") -> dict[str, dict[str, int]]:
    """{mentee_id: {mentor_id: grade}} from a CSV with mentee_id, mentor_id, grade columns."""
    frame = pd.read_csv(path, usecols=["mentee_id", "mentor_id", "grade"])
    relevance: dict[str, dict[str, int]] = defaultdict(dict)
    for mentee_id, mentor_id, grade in frame.itertuples(index=False):
        relevance[str(mentee_id)][str(mentor_id)] = int(grade)
    return dict(relevance)


def subset(mentees: list[MenteeProfile], ids: list[str]) -> list[MenteeProfile]:
    wanted = set(ids)
    return [m for m in mentees if m.mentee_id in wanted]
