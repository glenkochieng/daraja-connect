from conftest import mentee, mentor
from daraja.baselines import RandomRecommender, RuleBasedRecommender, build_systems


def test_rule_based_prefers_same_specialisation_then_experience(config):
    pool = [
        mentor("M-CARGO-10", specialisation="cargo", years_experience=10),
        mentor("M-CARGO-25", specialisation="cargo", years_experience=25),
        mentor("M-ENG-30", specialisation="aircraft_maintenance", years_experience=30),
    ]
    ranked = RuleBasedRecommender(config).fit(pool).rank([mentee(specialisation="cargo")], k=3)
    assert ranked["MTE-T1"] == ["M-CARGO-25", "M-CARGO-10", "M-ENG-30"]


def test_random_is_reproducible_and_respects_filters(config):
    pool = [mentor(f"M{i}") for i in range(10)] + [mentor("M-NO", consent_given=False)]
    mentees = [mentee("A"), mentee("B")]
    first = RandomRecommender(config, seed=3).fit(pool).rank(mentees, k=10)
    second = RandomRecommender(config, seed=3).fit(pool).rank(mentees, k=10)
    assert first == second
    assert "M-NO" not in first["A"]
    assert first["A"] != first["B"]


def test_build_systems_names(config):
    systems = build_systems(config, include_ablations=True)
    assert {"random", "rule_based", "unweighted_cosine", "weighted_cosine", "text_only"} <= set(systems)
    assert systems["unweighted_cosine"].config.weights["text"] == systems["unweighted_cosine"].config.weights["skills"]
