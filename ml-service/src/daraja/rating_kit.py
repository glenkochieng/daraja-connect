"""Expert / participant relevance rating kit.

1. build_rating_pool(): for each sampled mentee, pool the top-K mentors from every
   system plus a few random eligible mentors, shuffle them and hide which system
   produced each pair (the blind sheet). The mapping is saved separately (the key).
2. Raters fill in 0/1/2 for each pair using ratings/RATING_GUIDE.md.
3. score_ratings(): check the ratings, measure agreement, aggregate one label per
   pair, and compute each system's metrics on the pooled judgements.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

from daraja.agreement import cohen_kappa, fleiss_kappa, percent_agreement, ratings_to_counts
from daraja.config import MatchingConfig
from daraja.evaluation import score_rankings
from daraja.pool import MentorPool
from daraja.schema import MenteeProfile, MentorProfile
from daraja.vocabulary import Taxonomy

VALID_GRADES = {0, 1, 2}


def _topic_names(taxonomy: Taxonomy, ids: Sequence[str]) -> str:
    return "; ".join(taxonomy.topics[t].name for t in ids if t in taxonomy.topics)


def _domain_name(taxonomy: Taxonomy, domain: str | None) -> str:
    return taxonomy.domains.get(domain, {}).get("name", "") if domain else ""


def build_rating_pool(
    systems: Mapping[str, object],
    mentors: Sequence[MentorProfile],
    mentees: Sequence[MenteeProfile],
    config: MatchingConfig,
    taxonomy: Taxonomy,
    programme_names: Mapping[str, str],
    k: int = 5,
    n_random_extra: int = 2,
    seed: int = 7,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (blind rating sheet, key). Systems must already be fitted on `mentors`."""
    rng = np.random.default_rng(seed)
    pool = MentorPool(mentors)
    eligibility = pool.eligibility(mentees, config.filters)
    rankings = {name: system.rank(mentees, k) for name, system in systems.items()}

    sheet_rows, key_rows = [], []
    pair_counter = 0
    for row, mentee in enumerate(mentees):
        ranks: dict[str, dict[str, int]] = {}
        for name, ranked in rankings.items():
            for position, mentor_id in enumerate(ranked[mentee.mentee_id], start=1):
                ranks.setdefault(mentor_id, {})[name] = position
        pooled = set(ranks)
        extra_candidates = [str(pool.ids[c]) for c in np.flatnonzero(eligibility[row]) if str(pool.ids[c]) not in pooled]
        extras = list(rng.choice(extra_candidates, size=min(n_random_extra, len(extra_candidates)), replace=False)) if extra_candidates else []
        pair_mentors = list(pooled) + [str(e) for e in extras]
        rng.shuffle(pair_mentors)

        for mentor_id in pair_mentors:
            pair_counter += 1
            pair_id = f"P{pair_counter:05d}"
            mentor = pool.mentors[pool.index[mentor_id]]
            sheet_rows.append({
                "pair_id": pair_id,
                "mentee_id": mentee.mentee_id,
                "mentee_programme": programme_names.get(mentee.pride_programme or "", mentee.pride_programme or ""),
                "mentee_target_specialisation": _domain_name(taxonomy, mentee.specialisation),
                "mentee_years_experience": mentee.years_experience,
                "mentee_goals": mentee.goals_text,
                "mentee_wants_to_learn": _topic_names(taxonomy, mentee.wants_to_learn),
                "mentor_id": mentor.mentor_id,
                "mentor_role": mentor.role_title,
                "mentor_specialisation": _domain_name(taxonomy, mentor.specialisation),
                "mentor_years_experience": mentor.years_experience,
                "mentor_expertise": mentor.expertise_text,
                "mentor_can_mentor_in": _topic_names(taxonomy, mentor.can_mentor_in),
                "rating": "",
                "comment": "",
            })
            key_rows.append({
                "pair_id": pair_id, "mentee_id": mentee.mentee_id, "mentor_id": mentor_id,
                "random_extra": mentor_id not in pooled,
                **{f"rank_{name}": ranks.get(mentor_id, {}).get(name) for name in systems},
            })
    return pd.DataFrame(sheet_rows), pd.DataFrame(key_rows)


def read_ratings(files: Sequence[str | Path]) -> pd.DataFrame:
    """Long table (rater_id, pair_id, rating). The rater id is the 'rater_id' column if
    present, otherwise the file name. Raises ValueError listing any invalid ratings."""
    frames, problems = [], []
    for f in files:
        frame = pd.read_csv(f, dtype={"pair_id": str})
        if "rater_id" not in frame.columns:
            frame["rater_id"] = Path(f).stem
        frame = frame[["rater_id", "pair_id", "rating"]].copy()
        numeric = pd.to_numeric(frame["rating"], errors="coerce")
        bad = frame[numeric.isna() | ~numeric.isin(VALID_GRADES)]
        problems += [f"{Path(f).name}: pair {r.pair_id} has rating {r.rating!r}" for r in bad.itertuples()]
        frame["rating"] = numeric
        frames.append(frame)
    if problems:
        raise ValueError("Invalid or missing ratings (use 0, 1 or 2):\n" + "\n".join(problems[:50]))
    ratings = pd.concat(frames, ignore_index=True)
    ratings["rating"] = ratings["rating"].astype(int)
    duplicated = ratings.duplicated(["rater_id", "pair_id"])
    if duplicated.any():
        raise ValueError(f"{int(duplicated.sum())} duplicate (rater, pair) ratings")
    return ratings


def agreement_report(ratings: pd.DataFrame) -> dict:
    wide = ratings.pivot(index="pair_id", columns="rater_id", values="rating").dropna()
    raters = list(wide.columns)
    report = {"n_raters": len(raters), "n_pairs_rated_by_all": int(len(wide))}
    if len(raters) < 2 or wide.empty:
        return report
    pairwise = []
    for a, b in combinations(raters, 2):
        pairwise.append({
            "raters": f"{a} vs {b}",
            "percent_agreement": percent_agreement(wide[a], wide[b]),
            "cohen_kappa_quadratic": cohen_kappa(wide[a].astype(int), wide[b].astype(int), "quadratic"),
        })
    report["pairwise"] = pairwise
    report["fleiss_kappa"] = fleiss_kappa(ratings_to_counts(wide.astype(int).to_numpy()))
    return report


def aggregate_labels(ratings: pd.DataFrame) -> pd.Series:
    """One grade per pair: mean rating rounded half up (so a 1/2 split becomes 2)."""
    mean = ratings.groupby("pair_id")["rating"].mean()
    return np.floor(mean + 0.5).astype(int)


def evaluate_pooled(key: pd.DataFrame, labels: pd.Series, k: int, threshold: int = 1) -> pd.DataFrame:
    """Per-mentee metrics for each system, using only the pooled, judged pairs."""
    key = key[key["pair_id"].isin(labels.index)].copy()
    key["grade"] = key["pair_id"].map(labels)
    systems = [c.removeprefix("rank_") for c in key.columns if c.startswith("rank_")]
    relevance = {m: dict(zip(g["mentor_id"], g["grade"], strict=False)) for m, g in key.groupby("mentee_id")}
    rankings = {}
    for system in systems:
        col = f"rank_{system}"
        rankings[system] = {
            mentee_id: list(group.dropna(subset=[col]).sort_values(col)["mentor_id"])
            for mentee_id, group in key.groupby("mentee_id")
        }
    per_query = score_rankings(rankings, relevance, k, threshold)
    keep = {m for m, rel in relevance.items() if any(g >= threshold for g in rel.values())}
    return per_query[per_query["mentee_id"].isin(keep)].reset_index(drop=True)
