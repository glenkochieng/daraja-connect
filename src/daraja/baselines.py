"""Baseline recommenders for comparison.

Every baseline applies the same hard filters as the content recommender, so the
comparison isolates the effect of the ranking method.

* RandomRecommender      eligible mentors in random order (seeded per mentee)
* RuleBasedRecommender   mentors with the mentee's specialisation first, each group
                         ordered by years of experience (most experienced first)
* Unweighted cosine      ContentRecommender with equal block weights (see build_systems)
"""

from __future__ import annotations

import zlib
from collections.abc import Iterable, Mapping, Sequence

import numpy as np

from daraja.config import BLOCKS, MISSING_POLICIES, MatchingConfig
from daraja.pool import MentorPool
from daraja.recommender import ContentRecommender
from daraja.schema import MenteeProfile, MentorProfile


class RandomRecommender:
    def __init__(self, config: MatchingConfig, seed: int = 0, name: str = "random"):
        self.config, self.seed, self.name = config, seed, name
        self.pool: MentorPool | None = None

    def fit(self, mentors: Sequence[MentorProfile]) -> "RandomRecommender":
        self.pool = MentorPool(mentors)
        return self

    def rank(self, mentees: Sequence[MenteeProfile], k: int | None = None,
             exclude: Mapping[str, Iterable[str]] | None = None) -> dict[str, list[str]]:
        k = self.config.top_k if k is None else k
        eligible = self.pool.eligibility(mentees, self.config.filters, exclude)
        ranked = {}
        for row, mentee in enumerate(mentees):
            rng = np.random.default_rng([self.seed, zlib.crc32(mentee.mentee_id.encode("utf-8"))])
            cols = np.flatnonzero(eligible[row])
            rng.shuffle(cols)
            ranked[mentee.mentee_id] = [str(self.pool.ids[c]) for c in cols[:k]]
        return ranked


class RuleBasedRecommender:
    def __init__(self, config: MatchingConfig, name: str = "rule_based"):
        self.config, self.name = config, name
        self.pool: MentorPool | None = None

    def fit(self, mentors: Sequence[MentorProfile]) -> "RuleBasedRecommender":
        self.pool = MentorPool(mentors)
        return self

    def rank(self, mentees: Sequence[MenteeProfile], k: int | None = None,
             exclude: Mapping[str, Iterable[str]] | None = None) -> dict[str, list[str]]:
        k = self.config.top_k if k is None else k
        pool = self.pool
        eligible = pool.eligibility(mentees, self.config.filters, exclude)
        years = np.nan_to_num(pool.years, nan=-1.0)
        ranked = {}
        for row, mentee in enumerate(mentees):
            same_spec = (pool.specialisation == mentee.specialisation) if mentee.specialisation else np.zeros(len(pool), bool)
            # score: same specialisation dominates, then experience
            scores = same_spec.astype(float) * 1000.0 + years
            ranked[mentee.mentee_id] = pool.order(scores, eligible[row], k)
        return ranked


def build_systems(tuned: MatchingConfig, base: MatchingConfig | None = None, seed: int = 0,
                  include_ablations: bool = False) -> dict[str, object]:
    """Recommenders compared in the evaluation (unfitted)."""
    base = base or tuned
    equal = {b: 1.0 / len(BLOCKS) for b in BLOCKS}
    systems: dict[str, object] = {
        "random": RandomRecommender(base, seed=seed),
        "rule_based": RuleBasedRecommender(base),
        # same missing-data policy as the tuned system, so only the weights differ
        "unweighted_cosine": ContentRecommender(tuned.with_weights(**equal), name="unweighted_cosine"),
        "weighted_cosine": ContentRecommender(tuned, name="weighted_cosine"),
    }
    if include_ablations:
        systems["text_only"] = ContentRecommender(tuned.with_weights(text=1.0, skills=0.0, specialisation=0.0), name="text_only")
        systems["skills_only"] = ContentRecommender(tuned.with_weights(text=0.0, skills=1.0, specialisation=0.0), name="skills_only")
        no_glossary = MatchingConfig.from_dict({**tuned.to_dict(), "text": {**tuned.to_dict()["text"], "use_glossary": False}})
        systems["weighted_no_glossary"] = ContentRecommender(no_glossary, name="weighted_no_glossary")
        for policy in MISSING_POLICIES:
            name = f"weighted_policy_{policy}"
            systems[name] = ContentRecommender(tuned.with_policy(policy), name=name)
    return systems
