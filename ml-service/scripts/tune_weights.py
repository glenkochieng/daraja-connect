"""Tune the block weights by grid search on the VALIDATION mentees.

    python scripts/tune_weights.py [--step 0.1] [--k 5]

Writes:
    reports/tuning_results.csv       every weight combination with validation metrics
    config/matching.tuned.yaml       best weights (used by the evaluation and the API)
"""

import argparse
import json
import sys
from datetime import datetime, timezone

from daraja import paths
from daraja.config import load_config, save_config
from daraja.data import load_mentees, load_mentors, load_relevance, load_splits, subset
from daraja.tuning import tune_weights


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--step", type=float, default=0.1)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--threshold", type=int, default=1, help="minimum grade counted as relevant")
    args = parser.parse_args()

    base = load_config(paths.DEFAULT_CONFIG)
    mentors, mentees = load_mentors(), load_mentees()
    validation = subset(mentees, load_splits()["validation"])
    relevance = load_relevance()

    tuned, results = tune_weights(base, mentors, validation, relevance, k=args.k, threshold=args.threshold, step=args.step)
    paths.REPORTS_DIR.mkdir(exist_ok=True)
    results.to_csv(paths.REPORTS_DIR / "tuning_results.csv", index=False)

    top = results.iloc[0]
    save_config(tuned, paths.TUNED_CONFIG, metadata={
        "tuned_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": f"grid search over the weight simplex (step {args.step}) x missing-data policies",
        "split": "validation",
        "objective": f"mean ndcg@{args.k}",
        "relevance_labels": "simulated (data/synthetic/hidden/simulated_relevance.csv)",
        "validation_score": {c: round(float(top[c]), 4) for c in results.columns if "@" in c},
    })
    print("Top 5 combinations on the validation split:")
    print(results.head(5).round(4).to_string(index=False))
    print("\nBest per missing-data policy:")
    print(results.groupby("missing_policy", sort=False).head(1).round(4).to_string(index=False))
    print("\nChosen:", json.dumps({"missing_policy": tuned.missing_policy, "weights": tuned.weights}))
    print(f"Saved {paths.TUNED_CONFIG.relative_to(paths.ROOT)}")


if __name__ == "__main__":
    main()
