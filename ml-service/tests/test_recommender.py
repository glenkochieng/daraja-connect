import numpy as np
import pytest
from conftest import mentee, mentor

from daraja.config import MatchingConfig
from daraja.recommender import BlockScores, ContentRecommender, combine_blocks, join_words, shared_phrases


def test_best_matching_mentor_ranks_first(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    m = mentee(goals_text="I want to learn dangerous goods acceptance.", wants_to_learn=["dangerous_goods"])
    result = rec.recommend(m, k=3)
    assert result.status == "ok"
    assert result.results[0].mentor_id == "M-DG"
    assert result.results[0].score > result.results[1].score


def test_glossary_links_abbreviation_to_full_phrase(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    m = mentee(specialisation=None, goals_text="Help with DGR please", wants_to_learn=[])
    top = rec.recommend(m, k=1).results[0]
    assert top.mentor_id == "M-DG"
    assert top.block_scores["text"] > 0


def test_missing_policies_hand_computed():
    # text present (0.5), skills missing, specialisation matches (1.0)
    blocks = BlockScores(
        similarity={"text": np.array([[0.5]]), "skills": np.array([[1.0]]), "specialisation": np.array([[1.0]])},
        available={"text": np.array([[True]]), "skills": np.array([[False]]), "specialisation": np.array([[True]])},
    )
    weights = {"text": 0.4, "skills": 0.4, "specialisation": 0.2}
    content, comparable = combine_blocks(blocks, weights, "renormalise_content")
    renorm, _ = combine_blocks(blocks, weights, "renormalise")
    zero, _ = combine_blocks(blocks, weights, "zero")
    assert content[0, 0] == pytest.approx(0.8 * 0.5 + 0.2 * 1.0)          # specialisation keeps its 0.2 share
    assert renorm[0, 0] == pytest.approx((0.4 * 0.5 + 0.2 * 1.0) / 0.6)    # specialisation grows to 1/3
    assert zero[0, 0] == pytest.approx(0.4 * 0.5 + 0.2 * 1.0)
    assert comparable[0, 0]


def test_content_policy_stops_specialisation_dominating_incomplete_profiles():
    # Same specialisation for both mentors; M-NOTAGS has weak text and no tags,
    # M-FULL has moderate text and skill overlap.
    blocks = BlockScores(
        similarity={"text": np.array([[0.03, 0.08]]), "skills": np.array([[0.0, 0.29]]), "specialisation": np.array([[1.0, 1.0]])},
        available={"text": np.array([[True, True]]), "skills": np.array([[False, True]]), "specialisation": np.array([[True, True]])},
    )
    weights = {"text": 0.4, "skills": 0.4, "specialisation": 0.2}
    renorm, _ = combine_blocks(blocks, weights, "renormalise")
    content, _ = combine_blocks(blocks, weights, "renormalise_content")
    assert renorm[0, 0] > renorm[0, 1]      # the problem: incomplete profile ranked higher
    assert content[0, 1] > content[0, 0]    # fixed under renormalise_content


def test_missing_block_reported_as_none(config):
    rec = ContentRecommender(config).fit([mentor("M1", expertise_text="", can_mentor_in=["dangerous_goods"])])
    result = rec.recommend(mentee(goals_text="dangerous goods", wants_to_learn=["dangerous_goods"]))
    assert result.results[0].block_scores["text"] is None
    assert result.results[0].block_scores["skills"] == pytest.approx(1.0)


@pytest.mark.parametrize("field,value", [
    ("consent_given", False),
    ("is_available", False),
    ("current_mentees", 3),   # max_mentees defaults to 3 in the fixture
    ("years_experience", 2),  # gap to the mentee (1 year) is below the 2-year minimum
])
def test_hard_filters_exclude_mentor(config, field, value):
    rec = ContentRecommender(config).fit([
        mentor("M-OK", can_mentor_in=["dangerous_goods"]),
        mentor("M-FILTERED", can_mentor_in=["dangerous_goods"], **{field: value}),
    ])
    ranked = rec.rank([mentee(wants_to_learn=["dangerous_goods"])], k=5)
    assert ranked["MTE-T1"] == ["M-OK"]


def test_unknown_experience_is_not_filtered(config):
    rec = ContentRecommender(config).fit([mentor("M1", years_experience=None, can_mentor_in=["dangerous_goods"])])
    assert rec.rank([mentee(wants_to_learn=["dangerous_goods"])])["MTE-T1"] == ["M1"]


def test_excluded_mentor_ids(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    result = rec.recommend(mentee(wants_to_learn=["dangerous_goods"]), k=3, exclude_mentor_ids=["M-DG"])
    assert "M-DG" not in [r.mentor_id for r in result.results]


def test_incomplete_profile(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    empty = mentee(goals_text="", wants_to_learn=[])
    assert rec.recommend(empty).status == "incomplete_profile"
    assert rec.rank([empty])["MTE-T1"] == []


def test_no_eligible_mentors(config):
    rec = ContentRecommender(config).fit([mentor("M1", is_available=False, can_mentor_in=["dangerous_goods"])])
    assert rec.recommend(mentee(wants_to_learn=["dangerous_goods"])).status == "no_eligible_mentors"


def test_ties_are_broken_by_mentor_id(config):
    twins = [mentor("M-B", can_mentor_in=["dangerous_goods"]), mentor("M-A", can_mentor_in=["dangerous_goods"])]
    rec = ContentRecommender(config).fit(twins)
    assert rec.rank([mentee(wants_to_learn=["dangerous_goods"])])["MTE-T1"] == ["M-A", "M-B"]


def test_reasons_explain_the_match(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    result = rec.recommend(mentee(goals_text="dangerous goods regulations", wants_to_learn=["dangerous_goods"]))
    reasons = " | ".join(result.results[0].reasons)
    assert "Dangerous goods regulations" in reasons
    assert "Same specialisation" in reasons
    assert "dangerous goods" in reasons


def test_shared_terms_skip_generic_words_and_repeats():
    terms = ["years", "interview", "interview preparation", "preparation", "station", "work experience"]
    assert shared_phrases(terms, 3) == ["interview preparation", "station"]
    assert shared_phrases(["years", "experience", "work"], 3) == []
    # Words another reason already shows are not repeated.
    covered = ["station", "management", "ground", "handling"]
    assert shared_phrases(["station", "handling", "interview preparation"], 3, covered) == ["interview preparation"]
    assert shared_phrases(["station", "handling"], 3, covered) == []
    assert join_words(["a"]) == "a"
    assert join_words(["a", "b", "c"]) == "a, b and c"


def test_reason_names_shared_phrases_as_a_sentence(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    result = rec.recommend(mentee(goals_text="dangerous goods regulations", wants_to_learn=["dangerous_goods"]))
    mention = [r for r in result.results[0].reasons if r.startswith("You both mention")]
    assert mention and "dangerous goods" in mention[0]
    assert "Shared terms" not in " | ".join(result.results[0].reasons)


def test_unknown_tags_are_ignored(config, mentors):
    rec = ContentRecommender(config).fit(mentors)
    assert not rec.is_complete(mentee(goals_text="", wants_to_learn=["not_a_topic"]))


def test_config_validation_and_version():
    with pytest.raises(ValueError):
        MatchingConfig(weights={"text": -1, "skills": 1, "specialisation": 1})
    with pytest.raises(ValueError):
        MatchingConfig(weights={"colour": 1})
    a = MatchingConfig()
    assert a.version != a.with_weights(text=0.9, skills=0.05, specialisation=0.05).version
    assert a.version == MatchingConfig.from_dict(a.to_dict()).version


def test_recommend_requires_fit(config):
    with pytest.raises(RuntimeError):
        ContentRecommender(config).recommend(mentee(wants_to_learn=["dangerous_goods"]))
