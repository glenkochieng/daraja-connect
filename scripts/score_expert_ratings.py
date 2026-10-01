"""Score completed rating sheets: agreement between raters, then metrics per system.

    python scripts/score_expert_ratings.py ratings/real/rater_A.csv ratings/real/rater_B.csv \
        [--key ratings/pool_key.csv] [--k 5] [--out ratings/real]

Each rater file is a copy of rating_sheet_blank.csv with the 'rating' column filled
with 0, 1 or 2 (see ratings/RATING_GUIDE.md).
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from daraja import paths
from daraja.evaluation import paired_tests, summarise
from daraja.rating_kit import aggregate_labels, agreement_report, evaluate_pooled, read_ratings


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ratings", nargs="+", help="completed rater CSV files")
    parser.add_argument("--key", default=str(paths.RATINGS_DIR / "pool_key.csv"))
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--threshold", type=int, default=1)
    parser.add_argument("--out", default=None, help="output folder (default: folder of the first ratings file)")
    parser.add_argument("--title", default="Expert relevance ratings")
    args = parser.parse_args()

    out = Path(args.out) if args.out else Path(args.ratings[0]).parent
    ratings = read_ratings(args.ratings)
    key = pd.read_csv(args.key, dtype={"pair_id": str})
    agreement = agreement_report(ratings)
    labels = aggregate_labels(ratings)
    per_query = evaluate_pooled(key, labels, args.k, args.threshold)
    order = ["random", "rule_based", "unweighted_cosine", "weighted_cosine"]
    summary = summarise(per_query, order=[s for s in order if s in set(per_query["system"])])
    tests = paired_tests(per_query, "weighted_cosine", f"ndcg@{args.k}") if "weighted_cosine" in set(per_query["system"]) else pd.DataFrame()

    out.mkdir(parents=True, exist_ok=True)
    labels.rename("grade").to_csv(out / "aggregated_labels.csv")
    per_query.to_csv(out / "expert_per_mentee.csv", index=False)
    summary.to_csv(out / "expert_summary.csv", index=False)

    metrics = [f"precision@{args.k}", f"recall@{args.k}", f"mrr@{args.k}", f"ndcg@{args.k}"]
    lines = [
        f"# {args.title}",
        "",
        f"Raters: {agreement['n_raters']}; pairs rated by all raters: {agreement['n_pairs_rated_by_all']}; "
        f"mentees scored: {per_query['mentee_id'].nunique() if len(per_query) else 0}.",
        "",
        "Metrics are computed on the pooled pairs only (every system's top-K was judged), so recall is relative to the pool.",
        "",
        "## Inter-rater agreement",
        "",
    ]
    if "pairwise" in agreement:
        lines += ["| Raters | % agreement | Cohen's kappa (quadratic) |", "|---|---|---|"]
        lines += [f"| {p['raters']} | {p['percent_agreement']:.2f} | {p['cohen_kappa_quadratic']:.2f} |" for p in agreement["pairwise"]]
        lines += ["", f"Fleiss' kappa (all raters, unweighted): **{agreement['fleiss_kappa']:.2f}**", ""]
    else:
        lines += ["Only one rater: agreement cannot be computed.", ""]
    lines += ["## Metrics per system (mean ± 95% CI half-width)", "", "| System | " + " | ".join(metrics) + " |", "|---|" + "---|" * len(metrics)]
    for _, r in summary.iterrows():
        lines.append(f"| {r['system']} | " + " | ".join(f"{r[m]:.3f} ± {r[m + '_ci95']:.3f}" for m in metrics) + " |")
    if len(tests):
        lines += ["", f"## Wilcoxon signed-rank tests on NDCG@{args.k}", "", "| weighted_cosine vs | Mean difference | p-value | Pairs |", "|---|---|---|---|"]
        lines += [f"| {r.compared_with} | {r.mean_difference:+.3f} | {r.p_value:.2g} | {r.n_pairs} |" for r in tests.itertuples()]
    (out / "expert_results.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({k: v for k, v in agreement.items() if k != "pairwise"}, indent=2))
    print(summary[["system", "n_mentees"] + metrics].round(3).to_string(index=False))
    print(f"Report: {out / 'expert_results.md'}")


if __name__ == "__main__":
    main()
