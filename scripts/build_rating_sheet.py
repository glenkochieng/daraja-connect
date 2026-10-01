"""Build a blind rating sheet for domain experts (or mentees).

    python scripts/build_rating_sheet.py [--mentees 30] [--k 5] [--random-extra 2] [--out ratings]

For each sampled mentee, the top-K mentors from every system plus a few random eligible
mentors are pooled and shuffled. Raters see only the profiles, never which system
suggested a mentor.

Writes:
    <out>/rating_sheet_blank.csv   give a copy to each rater (rename e.g. rater_A.csv)
    <out>/pool_key.csv             which systems retrieved each pair: DO NOT share with raters

When real profiles are available, point --mentors/--mentees at them instead of the
synthetic files.
"""

import argparse
import sys

import numpy as np

from daraja import paths
from daraja.baselines import build_systems
from daraja.config import load_config
from daraja.data import load_mentees, load_mentors, load_splits, subset
from daraja.rating_kit import build_rating_pool
from daraja.recommender import ContentRecommender
from daraja.vocabulary import load_kq_vocabulary, load_taxonomy


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mentors", default=str(paths.SYNTHETIC_DIR / "mentors.json"))
    parser.add_argument("--mentees", default=str(paths.SYNTHETIC_DIR / "mentees.json"))
    parser.add_argument("--split", default="test", help="mentee split to sample from ('all' to ignore splits)")
    parser.add_argument("--n-mentees", "--mentees-count", dest="n_mentees", type=int, default=30)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--random-extra", type=int, default=2)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", default=str(paths.RATINGS_DIR))
    args = parser.parse_args()

    tuned = load_config(paths.active_config_path())
    base = load_config(paths.DEFAULT_CONFIG)
    mentors, mentees = load_mentors(args.mentors), load_mentees(args.mentees)
    if args.split != "all":
        mentees = subset(mentees, load_splits()[args.split])
    checker = ContentRecommender(tuned)
    mentees = [m for m in mentees if checker.is_complete(m)]
    rng = np.random.default_rng(args.seed)
    chosen = sorted(rng.choice(len(mentees), size=min(args.n_mentees, len(mentees)), replace=False))
    sample = [mentees[i] for i in chosen]

    systems = build_systems(tuned, base, seed=args.seed)
    for system in systems.values():
        system.fit(mentors)
    programme_names = {p["id"]: p["name"] for p in load_kq_vocabulary()["pride_centre_programmes"]}
    sheet, key = build_rating_pool(systems, mentors, sample, tuned, load_taxonomy(), programme_names,
                                   k=args.k, n_random_extra=args.random_extra, seed=args.seed)

    from pathlib import Path
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    sheet.to_csv(out / "rating_sheet_blank.csv", index=False)
    key.to_csv(out / "pool_key.csv", index=False)
    print(f"{len(sample)} mentees, {len(sheet)} pairs to rate (avg {len(sheet) / max(len(sample), 1):.1f} per mentee)")
    print(f"Blind sheet: {out / 'rating_sheet_blank.csv'}")
    print(f"Key (keep private): {out / 'pool_key.csv'}")


if __name__ == "__main__":
    main()
