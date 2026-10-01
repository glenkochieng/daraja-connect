import json
import subprocess
import sys

from daraja import paths
from daraja.synthetic import SyntheticConfig, SyntheticGenerator
from daraja.tuning import weight_grid
from daraja.vocabulary import load_kq_vocabulary, load_taxonomy


def _generate(seed=1):
    cfg = SyntheticConfig(n_mentors=25, n_mentees=15, seed=seed)
    return SyntheticGenerator(cfg, load_taxonomy(), load_kq_vocabulary()).generate()


def test_generator_is_deterministic():
    a, b = _generate(), _generate()
    dump = lambda d: json.dumps([p.model_dump() for p in d["mentors"] + d["mentees"]])  # noqa: E731
    assert dump(a) == dump(b)
    assert a["relevance"].equals(b["relevance"])


def test_observable_profiles_do_not_leak_latent_attributes():
    data = _generate()
    observable_keys = set(data["mentors"][0].model_dump()) | set(data["mentees"][0].model_dump())
    assert not observable_keys & {"expertise", "needs", "primary_domain", "target_domain", "career_switch"}


def test_generated_values_are_valid():
    taxonomy = load_taxonomy()
    data = _generate()
    assert len(data["relevance"]) == 25 * 15
    assert set(data["relevance"]["grade"].unique()) <= {0, 1, 2}
    for m in data["mentors"]:
        assert not taxonomy.validate_topics(m.can_mentor_in)
        assert m.specialisation is None or m.specialisation in taxonomy.specialisations
    for m in data["mentees"]:
        assert not taxonomy.validate_topics(m.wants_to_learn)
    splits = data["splits"]
    assert not set(splits["validation"]) & set(splits["test"])
    assert len(splits["validation"]) + len(splits["test"]) == 15


def test_taxonomy_links_to_kq_vocabulary():
    taxonomy, vocab = load_taxonomy(), load_kq_vocabulary()
    known = {item["id"] for section in ("fleet", "business_units", "service_areas", "approvals_and_standards")
             for item in vocab[section]}
    for topic in taxonomy.topics.values():
        assert set(topic.kq_refs) <= known, topic.id
    for programme in vocab["pride_centre_programmes"]:
        assert programme["domain"] in taxonomy.domains


def test_kq_vocabulary_evidence_matches_snapshots():
    result = subprocess.run([sys.executable, str(paths.ROOT / "scripts" / "fetch_kq_public_data.py"), "verify"],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_weight_grid():
    grid = weight_grid(0.1)
    assert len(grid) == 66
    assert all(abs(sum(w.values()) - 1) < 1e-9 for w in grid)
    assert len(weight_grid(0.5)) == 6
