"""Sensitivity analysis: do the conclusions hold when the synthetic data is harder?

    python scripts/run_sensitivity.py [--seeds 42 43 44]

For each scenario and seed, the full procedure is repeated in memory:
generate data -> tune weights and missing-data policy on validation -> evaluate on test.

Scenarios
    standard           the default generator settings (same as data/synthetic/)
    vocabulary_mismatch mentors and mentees describe the same topic with different phrases
    sparse_profiles    many more missing tags, texts and specialisations
    hard               vocabulary mismatch and sparse profiles together

Writes reports/sensitivity_results.csv and reports/sensitivity_report.md.
"""

import argparse
import sys
from dataclasses import replace
from datetime import datetime, timezone

import pandas as pd

from daraja import paths
from daraja.baselines import build_systems
from daraja.config import load_config
from daraja.data import subset
from daraja.evaluation import paired_tests, run_evaluation
from daraja.synthetic import SyntheticConfig, SyntheticGenerator
from daraja.tuning import tune_weights
from daraja.vocabulary import load_kq_vocabulary, load_taxonomy

SPARSE = dict(mentor_text_missing=0.20, mentor_tags_missing=0.35, mentor_spec_missing=0.15,
              mentee_text_missing=0.25, mentee_tags_missing=0.40, mentee_spec_missing=0.30)
SCENARIOS = {
    "standard": {},
    "vocabulary_mismatch": {"phrase_split": True},
    "sparse_profiles": SPARSE,
    "hard": {"phrase_split": True, **SPARSE},
}
SYSTEMS = ["random", "rule_based", "unweighted_cosine", "weighted_cosine", "text_only", "skills_only", "weighted_no_glossary"]


def relevance_dict(frame: pd.DataFrame) -> dict[str, dict[str, int]]:
    return {m: dict(zip(g["mentor_id"], g["grade"])) for m, g in frame.groupby("mentee_id")}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 43, 44])
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    k = args.k

    taxonomy, vocab = load_taxonomy(), load_kq_vocabulary()
    base = load_config(paths.DEFAULT_CONFIG)
    rows, tests_rows, chosen_rows = [], [], []
    for scenario, overrides in SCENARIOS.items():
        for seed in args.seeds:
            cfg = replace(SyntheticConfig(seed=seed), **overrides)
            data = SyntheticGenerator(cfg, taxonomy, vocab).generate()
            relevance = relevance_dict(data["relevance"])
            validation = subset(data["mentees"], data["splits"]["validation"])
            test = subset(data["mentees"], data["splits"]["test"])

            tuned, _ = tune_weights(base, data["mentors"], validation, relevance, k=k)
            chosen_rows.append({"scenario": scenario, "seed": seed, "missing_policy": tuned.missing_policy, **tuned.weights})
            systems = {n: s for n, s in build_systems(tuned, base, seed=seed, include_ablations=True).items() if n in SYSTEMS}
            per_query, counts = run_evaluation(systems, data["mentors"], test, relevance, tuned, k=k)
            for system, group in per_query.groupby("system"):
                rows.append({"scenario": scenario, "seed": seed, "system": system, "n_mentees": len(group),
                             **{m: group[m].dropna().mean() for m in (f"precision@{k}", f"mrr@{k}", f"ndcg@{k}")}})
            t = paired_tests(per_query, "weighted_cosine", f"ndcg@{k}")
            t.insert(0, "seed", seed)
            t.insert(0, "scenario", scenario)
            tests_rows.append(t)
            print(f"done: {scenario} seed={seed} ({counts['evaluated']} test mentees)")

    results = pd.DataFrame(rows)
    chosen = pd.DataFrame(chosen_rows)
    tests = pd.concat(tests_rows, ignore_index=True)
    paths.REPORTS_DIR.mkdir(exist_ok=True)
    results.to_csv(paths.REPORTS_DIR / "sensitivity_results.csv", index=False)
    tests.to_csv(paths.REPORTS_DIR / "sensitivity_tests.csv", index=False)
    chosen.to_csv(paths.REPORTS_DIR / "sensitivity_chosen_configs.csv", index=False)

    ndcg = f"ndcg@{k}"
    pivot = results.pivot_table(index="system", columns="scenario", values=ndcg, aggfunc="mean").reindex(SYSTEMS)[list(SCENARIOS)]
    spread = results.pivot_table(index="system", columns="scenario", values=ndcg, aggfunc=lambda s: s.max() - s.min()).reindex(SYSTEMS)[list(SCENARIOS)]
    lines = [
        "# Sensitivity analysis (simulated data)",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}  ",
        f"Seeds: {args.seeds}. For every scenario and seed, the data were regenerated, weights and the missing-data policy were tuned "
        "on validation mentees, and systems were evaluated on test mentees.",
        "",
        f"## Mean NDCG@{k} across seeds (range across seeds in brackets)",
        "",
        "| System | " + " | ".join(SCENARIOS) + " |",
        "|---|" + "---|" * len(SCENARIOS),
    ]
    for system in SYSTEMS:
        cells = [f"{pivot.loc[system, s]:.3f} [{spread.loc[system, s]:.3f}]" for s in SCENARIOS]
        lines.append(f"| {system} | " + " | ".join(cells) + " |")
    lines += ["", f"## weighted_cosine vs other systems: seeds where weighted_cosine is significantly better / worse (p < 0.05, NDCG@{k})", "",
              "| Compared with | " + " | ".join(SCENARIOS) + " |", "|---|" + "---|" * len(SCENARIOS)]
    for other in [s for s in SYSTEMS if s != "weighted_cosine"]:
        cells = []
        for scenario in SCENARIOS:
            sub = tests[(tests["scenario"] == scenario) & (tests["compared_with"] == other)]
            better = int(((sub["p_value"] < 0.05) & (sub["mean_difference"] > 0)).sum())
            worse = int(((sub["p_value"] < 0.05) & (sub["mean_difference"] < 0)).sum())
            cells.append(f"{better} / {worse} of {len(sub)}")
        lines.append(f"| {other} | " + " | ".join(cells) + " |")
    lines += ["", "## Configuration chosen on validation", "",
              "| Scenario | Seed | Missing policy | w_text | w_skills | w_specialisation |", "|---|---|---|---|---|---|"]
    lines += [f"| {r.scenario} | {r.seed} | {r.missing_policy} | {r.text:.1f} | {r.skills:.1f} | {r.specialisation:.1f} |"
              for r in chosen.itertuples()]
    lines.append("")
    (paths.REPORTS_DIR / "sensitivity_report.md").write_text("\n".join(lines), encoding="utf-8")
    print(pivot.round(3).to_string())
    print(f"Report: {(paths.REPORTS_DIR / 'sensitivity_report.md').relative_to(paths.ROOT)}")


if __name__ == "__main__":
    main()
