import numpy as np
import pandas as pd
import pytest
from conftest import mentee

from daraja.agreement import cohen_kappa, fleiss_kappa, percent_agreement, ratings_to_counts
from daraja.baselines import build_systems
from daraja.rating_kit import aggregate_labels, agreement_report, build_rating_pool, evaluate_pooled, read_ratings
from daraja.vocabulary import load_taxonomy


def test_fleiss_kappa_hand_computed():
    # item 1: both raters say 0; item 2: raters split 0/1
    # p = [3/4, 1/4, 0]; P1 = 1, P2 = 0; P_bar = 0.5; P_e = 10/16; kappa = (0.5 - 0.625) / 0.375
    counts = ratings_to_counts([[0, 0], [0, 1]])
    assert fleiss_kappa(counts) == pytest.approx(-1 / 3)


def test_perfect_agreement():
    assert fleiss_kappa(ratings_to_counts([[2, 2], [0, 0], [1, 1]])) == pytest.approx(1.0)
    assert cohen_kappa([0, 1, 2], [0, 1, 2]) == 1.0
    assert percent_agreement([0, 1, 2], [0, 1, 1]) == pytest.approx(2 / 3)


def test_fleiss_requires_equal_rater_counts():
    with pytest.raises(ValueError):
        fleiss_kappa(np.array([[2, 0, 0], [1, 0, 0]]))


def test_read_ratings_rejects_invalid(tmp_path):
    path = tmp_path / "rater_x.csv"
    pd.DataFrame({"pair_id": ["P1", "P2"], "rating": [1, 5]}).to_csv(path, index=False)
    with pytest.raises(ValueError, match="P2"):
        read_ratings([path])


def test_aggregate_rounds_half_up():
    ratings = pd.DataFrame({"rater_id": ["a", "b", "a", "b"], "pair_id": ["P1", "P1", "P2", "P2"], "rating": [1, 2, 0, 1]})
    labels = aggregate_labels(ratings)
    assert labels["P1"] == 2 and labels["P2"] == 1
    assert agreement_report(ratings)["n_pairs_rated_by_all"] == 2


def test_rating_pool_end_to_end(config, mentors):
    systems = build_systems(config)
    for s in systems.values():
        s.fit(mentors)
    mentees = [mentee("MTE-A", goals_text="dangerous goods", wants_to_learn=["dangerous_goods"])]
    sheet, key = build_rating_pool(systems, mentors, mentees, config, load_taxonomy(), {}, k=2, n_random_extra=1)
    assert list(sheet["pair_id"]) == list(key["pair_id"])
    assert "rank_weighted_cosine" in key.columns and "rank_weighted_cosine" not in sheet.columns
    assert sheet["rating"].eq("").all()

    labels = pd.Series({pid: (2 if mid == "M-DG" else 0) for pid, mid in zip(key["pair_id"], key["mentor_id"], strict=False)})
    per_query = evaluate_pooled(key, labels, k=2)
    weighted = per_query[per_query["system"] == "weighted_cosine"].iloc[0]
    assert weighted["mrr@2"] == 1.0
