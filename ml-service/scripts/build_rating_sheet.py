"""Build a blind rating sheet for domain experts (or mentees).

    python scripts/build_rating_sheet.py [--mentees 30] [--k 5] [--random-extra 2] [--out ratings]

For each sampled mentee, the top-K mentors from every system plus a few random eligible
mentors are pooled and shuffled. Raters see only the profiles, never which system
suggested a mentor.

Writes:
    <out>/rating_sheet_blank.csv   give a copy to each rater (rename e.g. rater_A.csv)
    <out>/pool_key.csv             which systems retrieved each pair: DO NOT share with raters

When real profiles are available, point --mentors/--mentees at them (JSON or CSV, see
data/real_template/) with --split all; the sheet and key then go to ratings/real/.
"""

import argparse
import sys
from pathlib import Path

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
    parser.add_argument("--out", default=None,
                        help="default: ratings/ for the synthetic files, ratings/real/ (git-ignored) for any other profiles")
    args = parser.parse_args()

    synthetic = (Path(args.mentors).resolve() == (paths.SYNTHETIC_DIR / "mentors.json").resolve()
                 and Path(args.mentees).resolve() == (paths.SYNTHETIC_DIR / "mentees.json").resolve())
    # Sheets built from real profiles hold personal data, so they never default to a committed folder.
    out = Path(args.out or (paths.RATINGS_DIR if synthetic else paths.RATINGS_DIR / "real"))

    tuned = load_config(paths.active_config_path())
    base = load_config(paths.DEFAULT_CONFIG)
    mentors, mentees = load_mentors(args.mentors), load_mentees(args.mentees)
    taxonomy = load_taxonomy()
    programme_names = {p["id"]: p["name"] for p in load_kq_vocabulary()["pride_centre_programmes"]}
    # A mistyped id would silently drop that evidence from the ranking, so refuse it instead.
    problems = [f"{m.mentor_id}: unknown topic {t}" for m in mentors for t in taxonomy.validate_topics(m.can_mentor_in)]
    problems += [f"{e.mentee_id}: unknown topic {t}" for e in mentees for t in taxonomy.validate_topics(e.wants_to_learn)]
    problems += [f"{p.mentor_id if hasattr(p, 'mentor_id') else p.mentee_id}: unknown specialisation {p.specialisation}"
                 for p in [*mentors, *mentees] if p.specialisation and p.specialisation not in taxonomy.specialisations]
    problems += [f"{e.mentee_id}: unknown programme {e.pride_programme}"
                 for e in mentees if e.pride_programme and e.pride_programme not in programme_names]
    if problems:
        sys.exit("Fix these ids before building the sheet:\n  " + "\n  ".join(problems))
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
    sheet, key = build_rating_pool(systems, mentors, sample, tuned, taxonomy, programme_names,
                                   k=args.k, n_random_extra=args.random_extra, seed=args.seed)

    out.mkdir(parents=True, exist_ok=True)
    sheet.to_csv(out / "rating_sheet_blank.csv", index=False)
    key.to_csv(out / "pool_key.csv", index=False)
    print(f"{len(sample)} mentees, {len(sheet)} pairs to rate (avg {len(sheet) / max(len(sample), 1):.1f} per mentee)")
    print(f"Blind sheet: {out / 'rating_sheet_blank.csv'}")
    print(f"Key (keep private): {out / 'pool_key.csv'}")


if __name__ == "__main__":
    main()
