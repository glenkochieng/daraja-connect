"""Offline evaluation: run several recommenders on the same mentees and compare
ranking metrics against relevance labels (simulated or expert-provided)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np
import pandas as pd
from scipy import stats

from daraja.config import MatchingConfig
from daraja.metrics import all_metrics
from daraja.pool import MentorPool
from daraja.recommender import ContentRecommender
from daraja.schema import MenteeProfile, MentorProfile


def eligible_relevance(
    mentees: Sequence[MenteeProfile],
    pool: MentorPool,
    config: MatchingConfig,
    relevance: Mapping[str, Mapping[str, int]],
) -> dict[str, dict[str, int]]:
    """Restrict each mentee's labels to the mentors the filters allow, since no system
    can recommend an ineligible mentor (keeps Recall and NDCG denominators fair)."""
    eligible = pool.eligibility(mentees, config.filters)
    restricted = {}
    for row, mentee in enumerate(mentees):
        labels = relevance.get(mentee.mentee_id, {})
        allowed = {str(pool.ids[c]) for c in np.flatnonzero(eligible[row])}
        restricted[mentee.mentee_id] = {m: g for m, g in labels.items() if m in allowed}
    return restricted


def evaluable_mentees(
    mentees: Sequence[MenteeProfile],
    mentors: Sequence[MentorProfile],
    config: MatchingConfig,
    relevance: Mapping[str, Mapping[str, int]],
    threshold: int = 1,
) -> tuple[list[MenteeProfile], dict[str, dict[str, int]], dict[str, int]]:
    """Mentees with a complete profile and at least one relevant eligible mentor."""
    checker = ContentRecommender(config)
    pool = MentorPool(mentors)
    restricted = eligible_relevance(mentees, pool, config, relevance)
    kept, skipped = [], {"incomplete_profile": 0, "no_relevant_eligible_mentor": 0}
    for mentee in mentees:
        if not checker.is_complete(mentee):
            skipped["incomplete_profile"] += 1
        elif not any(g >= threshold for g in restricted[mentee.mentee_id].values()):
            skipped["no_relevant_eligible_mentor"] += 1
        else:
            kept.append(mentee)
    return kept, restricted, skipped


def score_rankings(
    rankings: Mapping[str, Mapping[str, list[str]]],
    relevance: Mapping[str, Mapping[str, int]],
    k: int,
    threshold: int = 1,
) -> pd.DataFrame:
    """Per-query metrics: one row per (system, mentee)."""
    rows = []
    for system, ranked in rankings.items():
        for mentee_id, items in ranked.items():
            rows.append({"system": system, "mentee_id": mentee_id, **all_metrics(items, relevance[mentee_id], k, threshold)})
    return pd.DataFrame(rows)


def run_evaluation(
    systems: Mapping[str, object],
    mentors: Sequence[MentorProfile],
    mentees: Sequence[MenteeProfile],
    relevance: Mapping[str, Mapping[str, int]],
    config: MatchingConfig,
    k: int = 5,
    threshold: int = 1,
) -> tuple[pd.DataFrame, dict[str, int]]:
    kept, restricted, skipped = evaluable_mentees(mentees, mentors, config, relevance, threshold)
    rankings = {}
    for name, system in systems.items():
        system.fit(mentors)
        rankings[name] = system.rank(kept, k)
    per_query = score_rankings(rankings, restricted, k, threshold)
    skipped["evaluated"] = len(kept)
    return per_query, skipped


def summarise(per_query: pd.DataFrame, order: Sequence[str] | None = None) -> pd.DataFrame:
    metrics = [c for c in per_query.columns if c not in ("system", "mentee_id")]
    rows = []
    for system, group in per_query.groupby("system", sort=False):
        row = {"system": system, "n_mentees": len(group)}
        for metric in metrics:
            values = group[metric].dropna().astype(float)
            mean = values.mean()
            half_width = 1.96 * values.std(ddof=1) / np.sqrt(len(values)) if len(values) > 1 else float("nan")
            row[metric] = mean
            row[f"{metric}_ci95"] = half_width
        rows.append(row)
    summary = pd.DataFrame(rows)
    if order:
        summary["_order"] = summary["system"].map({s: i for i, s in enumerate(order)})
        summary = summary.sort_values("_order").drop(columns="_order")
    return summary.reset_index(drop=True)


def paired_tests(per_query: pd.DataFrame, reference: str, metric: str) -> pd.DataFrame:
    """Two-sided Wilcoxon signed-rank test of `reference` against every other system, paired by mentee."""
    wide = per_query.pivot(index="mentee_id", columns="system", values=metric).astype(float)
    rows = []
    for other in wide.columns:
        if other == reference:
            continue
        pair = wide[[reference, other]].dropna()
        diff = pair[reference] - pair[other]
        if len(pair) == 0 or np.allclose(diff, 0):
            statistic, p_value = float("nan"), 1.0
        else:
            result = stats.wilcoxon(pair[reference], pair[other], zero_method="wilcox", alternative="two-sided")
            statistic, p_value = float(result.statistic), float(result.pvalue)
        rows.append({
            "reference": reference, "compared_with": other, "metric": metric, "n_pairs": len(pair),
            "mean_difference": float(diff.mean()) if len(pair) else float("nan"),
            "wilcoxon_statistic": statistic, "p_value": p_value,
        })
    return pd.DataFrame(rows)
