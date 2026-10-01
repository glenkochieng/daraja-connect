"""Grid search for the block weights and missing-data policy on the VALIDATION split only.

The test split is never used here, so the reported test results are not biased by
these choices.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from itertools import product

import numpy as np
import pandas as pd

from daraja.config import BLOCKS, MISSING_POLICIES, MatchingConfig
from daraja.evaluation import evaluable_mentees, score_rankings
from daraja.recommender import ContentRecommender
from daraja.schema import MenteeProfile, MentorProfile


def weight_grid(step: float = 0.1) -> list[dict[str, float]]:
    """All weight vectors on the simplex (w_text + w_skills + w_spec = 1) with the given step."""
    n = round(1 / step)
    grid = []
    for a, b in product(range(n + 1), repeat=2):
        c = n - a - b
        if c >= 0:
            grid.append({"text": a / n, "skills": b / n, "specialisation": c / n})
    return grid


def tune_weights(
    config: MatchingConfig,
    mentors: Sequence[MentorProfile],
    validation_mentees: Sequence[MenteeProfile],
    relevance: Mapping[str, Mapping[str, int]],
    k: int = 5,
    threshold: int = 1,
    step: float = 0.1,
    policies: Sequence[str] = MISSING_POLICIES,
) -> tuple[MatchingConfig, pd.DataFrame]:
    """Return the best configuration and a table of every (policy, weights) combination.

    Selection: highest mean NDCG@K, then Precision@K, then the weights closest to equal,
    then the policy listed first in `policies`."""
    objective = f"ndcg@{k}"
    mentees, restricted, _ = evaluable_mentees(validation_mentees, mentors, config, relevance, threshold)
    rows = []
    for policy_rank, policy in enumerate(policies):
        recommender = ContentRecommender(config.with_policy(policy)).fit(mentors)
        blocks = recommender.block_scores(mentees)
        eligibility = recommender.pool.eligibility(mentees, config.filters)
        for weights in weight_grid(step):
            ranked = recommender.rank(mentees, k, blocks=blocks, weights=weights, eligibility=eligibility)
            per_query = score_rankings({"candidate": ranked}, restricted, k, threshold)
            row = {"missing_policy": policy, **{f"w_{b}": weights[b] for b in BLOCKS}}
            for metric in (c for c in per_query.columns if c not in ("system", "mentee_id")):
                row[metric] = per_query[metric].dropna().mean()
            row["distance_from_equal"] = float(np.linalg.norm([weights[b] - 1 / len(BLOCKS) for b in BLOCKS]))
            row["_policy_rank"] = policy_rank
            rows.append(row)

    results = (
        pd.DataFrame(rows)
        .sort_values([objective, f"precision@{k}", "distance_from_equal", "_policy_rank"], ascending=[False, False, True, True])
        .drop(columns="_policy_rank")
        .reset_index(drop=True)
    )
    best_row = results.iloc[0]
    best = config.with_policy(str(best_row["missing_policy"])).with_weights(**{b: float(best_row[f"w_{b}"]) for b in BLOCKS})
    return best, results
