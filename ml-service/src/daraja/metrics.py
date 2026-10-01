"""Ranking metrics with graded relevance labels (0 = not relevant, 1 = somewhat, 2 = highly).

Binary metrics treat grade >= `threshold` as relevant. `relevance` maps every judged
candidate mentor to its grade; unjudged mentors count as grade 0.

    Precision@K = |relevant in top K| / K
    Recall@K    = |relevant in top K| / |relevant among all judged candidates|
    MRR@K       = 1 / rank of the first relevant item in the top K (0 if none)
    NDCG@K      = DCG@K / IDCG@K,  DCG@K = sum_{i=1..K} (2^grade_i - 1) / log2(i + 1)
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence


def _grades(ranked: Sequence[str], relevance: Mapping[str, int], k: int) -> list[int]:
    return [int(relevance.get(item, 0)) for item in list(ranked)[:k]]


def precision_at_k(ranked: Sequence[str], relevance: Mapping[str, int], k: int, threshold: int = 1) -> float:
    if k <= 0:
        raise ValueError("k must be positive")
    return sum(g >= threshold for g in _grades(ranked, relevance, k)) / k


def recall_at_k(ranked: Sequence[str], relevance: Mapping[str, int], k: int, threshold: int = 1) -> float | None:
    total = sum(g >= threshold for g in relevance.values())
    if total == 0:
        return None
    return sum(g >= threshold for g in _grades(ranked, relevance, k)) / total


def reciprocal_rank_at_k(ranked: Sequence[str], relevance: Mapping[str, int], k: int, threshold: int = 1) -> float:
    for i, g in enumerate(_grades(ranked, relevance, k), start=1):
        if g >= threshold:
            return 1.0 / i
    return 0.0


def dcg(grades: Sequence[int]) -> float:
    return sum((2**g - 1) / math.log2(i + 1) for i, g in enumerate(grades, start=1))


def ndcg_at_k(ranked: Sequence[str], relevance: Mapping[str, int], k: int) -> float | None:
    ideal = sorted((int(g) for g in relevance.values()), reverse=True)[:k]
    idcg = dcg(ideal)
    if idcg == 0:
        return None
    return dcg(_grades(ranked, relevance, k)) / idcg


def all_metrics(ranked: Sequence[str], relevance: Mapping[str, int], k: int, threshold: int = 1) -> dict[str, float | None]:
    return {
        f"precision@{k}": precision_at_k(ranked, relevance, k, threshold),
        f"recall@{k}": recall_at_k(ranked, relevance, k, threshold),
        f"mrr@{k}": reciprocal_rank_at_k(ranked, relevance, k, threshold),
        f"ndcg@{k}": ndcg_at_k(ranked, relevance, k),
    }
