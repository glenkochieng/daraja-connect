"""Mentor pool and the hard eligibility filters shared by every recommender.

All systems (random, rule-based, unweighted and weighted cosine) rank the same
eligible mentors, so any difference between them comes from the ranking alone.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

import numpy as np

from daraja.config import FilterConfig
from daraja.schema import MenteeProfile, MentorProfile


def _years(values) -> np.ndarray:
    return np.array([np.nan if v is None else float(v) for v in values], dtype=float)


class MentorPool:
    def __init__(self, mentors: Sequence[MentorProfile]):
        if not mentors:
            raise ValueError("The mentor pool is empty")
        self.mentors = list(mentors)
        self.ids = np.array([m.mentor_id for m in self.mentors], dtype=object)
        if len(set(self.ids)) != len(self.ids):
            raise ValueError("Duplicate mentor_id values in the mentor pool")
        self.index = {mid: i for i, mid in enumerate(self.ids)}
        # Integer position of each id in sorted order: used for deterministic tie-breaks.
        self.id_rank = np.argsort(np.argsort(self.ids.astype(str)))
        self.years = _years(m.years_experience for m in self.mentors)
        self.specialisation = np.array([m.specialisation or "" for m in self.mentors], dtype=object)
        self.consent = np.array([m.consent_given for m in self.mentors])
        self.available = np.array([m.is_available for m in self.mentors])
        self.has_capacity = np.array([m.current_mentees < m.max_mentees for m in self.mentors])

    def __len__(self) -> int:
        return len(self.mentors)

    def eligibility(
        self,
        mentees: Sequence[MenteeProfile],
        filters: FilterConfig,
        exclude: Mapping[str, Iterable[str]] | None = None,
    ) -> np.ndarray:
        """Boolean matrix [n_mentees, n_mentors]: True where the mentor may be recommended."""
        n = len(mentees)
        base = np.ones(len(self), dtype=bool)
        if filters.require_consent:
            base &= self.consent
        if filters.require_available:
            base &= self.available
        if filters.respect_capacity:
            base &= self.has_capacity
        mask = np.tile(base, (n, 1))

        if filters.min_experience_gap_years is not None:
            mentee_years = _years(m.years_experience for m in mentees)
            gap = self.years[None, :] - mentee_years[:, None]
            # Unknown experience on either side does not exclude the mentor.
            mask &= np.isnan(gap) | (gap >= filters.min_experience_gap_years)

        if exclude:
            for row, mentee in enumerate(mentees):
                for mentor_id in exclude.get(mentee.mentee_id, ()):
                    col = self.index.get(mentor_id)
                    if col is not None:
                        mask[row, col] = False
        return mask

    def order(self, row_scores: np.ndarray, candidates: np.ndarray, k: int | None) -> list[str]:
        """Sort candidate columns by descending score, ties broken by mentor_id."""
        cols = np.flatnonzero(candidates)
        ordered = cols[np.lexsort((self.id_rank[cols], -row_scores[cols]))]
        if k is not None:
            ordered = ordered[:k]
        return [str(self.ids[c]) for c in ordered]
