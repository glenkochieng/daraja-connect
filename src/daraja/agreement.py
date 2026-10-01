"""Inter-rater agreement for 0/1/2 relevance ratings."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
from sklearn.metrics import cohen_kappa_score

CATEGORIES = (0, 1, 2)


def percent_agreement(a: Sequence[int], b: Sequence[int]) -> float:
    a, b = np.asarray(a), np.asarray(b)
    if len(a) != len(b) or len(a) == 0:
        raise ValueError("Ratings must be non-empty and the same length")
    return float(np.mean(a == b))


def cohen_kappa(a: Sequence[int], b: Sequence[int], weights: str | None = "quadratic") -> float:
    """Cohen's kappa for two raters. Quadratic weights suit ordinal 0/1/2 grades.
    Returns 1.0 when both raters give identical ratings with no variation."""
    a, b = list(a), list(b)
    if a == b:
        return 1.0
    return float(cohen_kappa_score(a, b, labels=list(CATEGORIES), weights=weights))


def fleiss_kappa(counts: np.ndarray) -> float:
    """Fleiss' kappa from a [n_items, n_categories] matrix of rating counts
    (every item must be rated by the same number of raters)."""
    counts = np.asarray(counts, dtype=float)
    n_items = counts.shape[0]
    raters = counts.sum(axis=1)
    if n_items == 0 or not np.allclose(raters, raters[0]) or raters[0] < 2:
        raise ValueError("Each item needs the same number (>= 2) of ratings")
    n = raters[0]
    p_category = counts.sum(axis=0) / (n_items * n)
    p_item = (np.sum(counts**2, axis=1) - n) / (n * (n - 1))
    p_bar, p_expected = p_item.mean(), np.sum(p_category**2)
    if np.isclose(p_expected, 1.0):
        return 1.0
    return float((p_bar - p_expected) / (1 - p_expected))


def ratings_to_counts(ratings_by_item: Sequence[Sequence[int]]) -> np.ndarray:
    counts = np.zeros((len(ratings_by_item), len(CATEGORIES)))
    for i, ratings in enumerate(ratings_by_item):
        for r in ratings:
            counts[i, CATEGORIES.index(int(r))] += 1
    return counts
