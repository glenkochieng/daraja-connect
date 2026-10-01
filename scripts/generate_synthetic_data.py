"""Generate the synthetic mentor/mentee dataset and simulated relevance labels.

    python scripts/generate_synthetic_data.py [--mentors 160] [--mentees 300] [--seed 42]

Outputs (data/synthetic/):
    mentors.json / mentors.csv     observable mentor profiles (what the recommender sees)
    mentees.json / mentees.csv     observable mentee profiles
    splits.json                    validation / test mentee ids
    hidden/                        latent attributes + simulated labels (never read by the recommender)
"""

import argparse
import json
import sys

from daraja import paths
from daraja.synthetic import SyntheticConfig, SyntheticGenerator, write_dataset
from daraja.vocabulary import load_kq_vocabulary, load_taxonomy


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mentors", type=int, default=160)
    parser.add_argument("--mentees", type=int, default=300)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    config = SyntheticConfig(n_mentors=args.mentors, n_mentees=args.mentees, seed=args.seed)
    dataset = SyntheticGenerator(config, load_taxonomy(), load_kq_vocabulary()).generate()
    metadata = write_dataset(dataset, paths.SYNTHETIC_DIR, config)
    print(json.dumps({k: metadata[k] for k in ("counts", "label_distribution", "per_mentee", "observable_missingness", "mentor_eligibility")}, indent=2))
    print(f"Written to {paths.SYNTHETIC_DIR}")


if __name__ == "__main__":
    main()
