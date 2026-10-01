"""Run the whole offline pipeline in order.

    python scripts/run_pipeline.py            # everything except re-downloading KQ pages
    python scripts/run_pipeline.py --fetch    # also re-fetch the Kenya Airways public pages
    python scripts/run_pipeline.py --quick    # skip the (slower) sensitivity analysis
"""

import argparse
import subprocess
import sys
import time

from daraja import paths

STEPS = [
    ("Verify KQ vocabulary against snapshots", ["fetch_kq_public_data.py", "verify"]),
    ("Generate synthetic data", ["generate_synthetic_data.py"]),
    ("Tune weights and missing-data policy (validation)", ["tune_weights.py"]),
    ("Evaluate on the test split", ["evaluate.py"]),
    ("Build blind expert rating sheet", ["build_rating_sheet.py"]),
    ("DEMO: simulate two raters", ["demo_simulate_raters.py"]),
    ("DEMO: score simulated ratings", ["score_expert_ratings.py", "ratings/demo/demo_rater_A.csv", "ratings/demo/demo_rater_B.csv",
                                       "--title", "DEMO - simulated raters (not real expert judgements)"]),
    ("Sensitivity analysis", ["run_sensitivity.py"]),
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fetch", action="store_true", help="re-download the Kenya Airways public pages first")
    parser.add_argument("--quick", action="store_true", help="skip the sensitivity analysis")
    args = parser.parse_args()

    steps = list(STEPS)
    if args.fetch:
        steps[0] = ("Fetch and verify KQ public pages", ["fetch_kq_public_data.py"])
    if args.quick:
        steps = [s for s in steps if s[1][0] != "run_sensitivity.py"]

    for i, (title, command) in enumerate(steps, start=1):
        print(f"\n[{i}/{len(steps)}] {title}", flush=True)
        start = time.time()
        result = subprocess.run([sys.executable, str(paths.ROOT / "scripts" / command[0]), *command[1:]], cwd=paths.ROOT)
        if result.returncode != 0:
            raise SystemExit(f"Step failed: {title}")
        print(f"    done in {time.time() - start:.1f}s", flush=True)
    print("\nPipeline complete. See reports/ and ratings/.")


if __name__ == "__main__":
    main()
