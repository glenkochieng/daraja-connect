"""Evaluate all systems on the TEST mentees against the simulated relevance labels.

    python scripts/evaluate.py [--k 5] [--threshold 1]

Systems: random, rule_based, unweighted_cosine, weighted_cosine (tuned) + ablations.
Writes reports/test_per_mentee.csv, test_summary.csv, significance_tests.csv,
test_report.md and figures/test_metrics.png.
"""

import argparse
import json
import sys
from datetime import datetime, timezone

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from daraja import paths  # noqa: E402
from daraja.baselines import build_systems  # noqa: E402
from daraja.config import load_config  # noqa: E402
from daraja.data import load_mentees, load_mentors, load_relevance, load_splits, subset  # noqa: E402
from daraja.evaluation import paired_tests, run_evaluation, summarise  # noqa: E402

MAIN = ["random", "rule_based", "unweighted_cosine", "weighted_cosine"]
ABLATIONS = ["text_only", "skills_only", "weighted_no_glossary", "weighted_policy_renormalise_content",
             "weighted_policy_renormalise", "weighted_policy_zero"]


def plot(summary, k, out_path):
    metrics = [f"precision@{k}", f"recall@{k}", f"mrr@{k}", f"ndcg@{k}"]
    main = summary[summary["system"].isin(MAIN)].set_index("system").loc[MAIN]
    fig, ax = plt.subplots(figsize=(9, 4.5))
    width = 0.2
    colors = ["#9e9e9e", "#6d8fb3", "#e0a458", "#2a7f62"]
    for i, system in enumerate(MAIN):
        xs = [m + (i - 1.5) * width for m in range(len(metrics))]
        ax.bar(xs, [main.loc[system, m] for m in metrics], width, yerr=[main.loc[system, f"{m}_ci95"] for m in metrics],
               label=system.replace("_", " "), color=colors[i], capsize=3)
    ax.set_xticks(range(len(metrics)))
    ax.set_xticklabels([m.upper().replace("PRECISION", "P").replace("RECALL", "R") for m in metrics])
    ax.set_ylim(0, 1)
    ax.set_ylabel("mean over test mentees (95% CI)")
    ax.set_title("Test split, simulated relevance labels")
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.12))
    fig.tight_layout()
    fig.savefig(out_path, dpi=160)
    plt.close(fig)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--threshold", type=int, default=1)
    parser.add_argument("--seed", type=int, default=0, help="seed for the random baseline")
    args = parser.parse_args()
    k = args.k

    if not paths.TUNED_CONFIG.exists():
        raise SystemExit("config/matching.tuned.yaml not found: run scripts/tune_weights.py first")
    tuned, base = load_config(paths.TUNED_CONFIG), load_config(paths.DEFAULT_CONFIG)
    mentors, mentees = load_mentors(), load_mentees()
    test = subset(mentees, load_splits()["test"])
    relevance = load_relevance()

    systems = build_systems(tuned, base, seed=args.seed, include_ablations=True)
    per_query, counts = run_evaluation(systems, mentors, test, relevance, tuned, k=k, threshold=args.threshold)
    summary = summarise(per_query, order=MAIN + ABLATIONS)
    tests = paired_tests(per_query, reference="weighted_cosine", metric=f"ndcg@{k}")

    out = paths.REPORTS_DIR
    (out / "figures").mkdir(parents=True, exist_ok=True)
    per_query.to_csv(out / "test_per_mentee.csv", index=False)
    summary.to_csv(out / "test_summary.csv", index=False)
    tests.to_csv(out / "significance_tests.csv", index=False)
    plot(summary, k, out / "figures" / "test_metrics.png")

    metric_cols = [f"precision@{k}", f"recall@{k}", f"mrr@{k}", f"ndcg@{k}"]

    def table(frame):
        lines = ["| System | " + " | ".join(metric_cols) + " |", "|---|" + "---|" * len(metric_cols)]
        for _, r in frame.iterrows():
            cells = [f"{r[m]:.3f} ± {r[m + '_ci95']:.3f}" for m in metric_cols]
            lines.append(f"| {r['system']} | " + " | ".join(cells) + " |")
        return "\n".join(lines)

    report = [
        "# Test-split evaluation (simulated labels)",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}  ",
        f"Tuned weights: `{json.dumps(tuned.weights)}` (config version `{tuned.version}`)  ",
        f"K = {k}; relevant = grade >= {args.threshold}; NDCG uses graded labels (0/1/2).  ",
        f"Test mentees evaluated: {counts['evaluated']} (skipped: {counts['incomplete_profile']} incomplete profiles, "
        f"{counts['no_relevant_eligible_mentor']} with no relevant eligible mentor).",
        "",
        "> **These labels are simulated.** The results show whether the pipeline recovers the signal built into the",
        "> synthetic generator and how the methods compare under those assumptions. They are not evidence that the",
        "> recommendations suit real Kenya Airways mentors and Pride Centre alumni; that requires expert or participant",
        "> relevance judgements (see `ratings/`).",
        "",
        "## Main comparison (mean ± 95% CI half-width)",
        "",
        table(summary[summary["system"].isin(MAIN)]),
        "",
        "## Ablations",
        "",
        table(summary[summary["system"].isin(ABLATIONS)]),
        "",
        f"## Paired Wilcoxon signed-rank tests on NDCG@{k} (weighted_cosine vs. each system)",
        "",
        "| Compared with | Mean difference | p-value | Pairs |",
        "|---|---|---|---|",
    ]
    report += [f"| {r.compared_with} | {r.mean_difference:+.3f} | {r.p_value:.2g} | {r.n_pairs} |" for r in tests.itertuples()]
    report += ["", "![Test metrics](figures/test_metrics.png)", ""]
    (out / "test_report.md").write_text("\n".join(report), encoding="utf-8")

    print(summary[["system", "n_mentees"] + metric_cols].round(3).to_string(index=False))
    print()
    print(tests[["compared_with", "mean_difference", "p_value"]].round(4).to_string(index=False))
    print(f"\nCounts: {counts}")
    print(f"Report: {(out / 'test_report.md').relative_to(paths.ROOT)}")


if __name__ == "__main__":
    main()
