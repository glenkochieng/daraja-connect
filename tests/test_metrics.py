import math

import pytest

from daraja.metrics import all_metrics, ndcg_at_k, precision_at_k, recall_at_k, reciprocal_rank_at_k

RANKED = ["a", "b", "c", "d", "e"]
RELEVANCE = {"a": 2, "c": 1, "f": 2, "b": 0}


def test_precision_recall_mrr_binary_threshold_1():
    assert precision_at_k(RANKED, RELEVANCE, 5) == pytest.approx(2 / 5)
    assert recall_at_k(RANKED, RELEVANCE, 5) == pytest.approx(2 / 3)
    assert reciprocal_rank_at_k(RANKED, RELEVANCE, 5) == 1.0


def test_strict_threshold_2():
    assert precision_at_k(RANKED, RELEVANCE, 5, threshold=2) == pytest.approx(1 / 5)
    assert recall_at_k(RANKED, RELEVANCE, 5, threshold=2) == pytest.approx(1 / 2)
    assert reciprocal_rank_at_k(["b", "c", "a"], RELEVANCE, 3, threshold=2) == pytest.approx(1 / 3)


def test_ndcg_hand_computed():
    dcg = (2**2 - 1) / math.log2(2) + (2**1 - 1) / math.log2(4)
    idcg = (2**2 - 1) / math.log2(2) + (2**2 - 1) / math.log2(3) + (2**1 - 1) / math.log2(4)
    assert ndcg_at_k(RANKED, RELEVANCE, 5) == pytest.approx(dcg / idcg)


def test_perfect_ranking_has_ndcg_one():
    assert ndcg_at_k(["a", "f", "c"], RELEVANCE, 3) == pytest.approx(1.0)


def test_no_relevant_items():
    rel = {"x": 0}
    metrics = all_metrics(["x", "y"], rel, 5)
    assert metrics["recall@5"] is None
    assert metrics["ndcg@5"] is None
    assert metrics["mrr@5"] == 0.0
    assert metrics["precision@5"] == 0.0


def test_short_list_counts_missing_positions_as_misses():
    assert precision_at_k(["a"], RELEVANCE, 5) == pytest.approx(1 / 5)


def test_invalid_k():
    with pytest.raises(ValueError):
        precision_at_k(RANKED, RELEVANCE, 0)
