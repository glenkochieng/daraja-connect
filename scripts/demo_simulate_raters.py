"""DEMO ONLY: fill the blind rating sheet with two simulated raters so the rating kit
can be tested end to end before real experts are available.

    python scripts/demo_simulate_raters.py

Each simulated rater starts from the hidden simulated label and disagrees with it 20%
of the time (moving one grade up or down). Output goes to ratings/demo/. Never report
these numbers as expert judgements.
"""

import sys

import numpy as np
import pandas as pd

from daraja import paths
from daraja.data import load_relevance

DEMO_DIR = paths.RATINGS_DIR / "demo"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    sheet = pd.read_csv(paths.RATINGS_DIR / "rating_sheet_blank.csv", dtype={"pair_id": str})
    relevance = load_relevance()
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    for rater, seed in (("demo_rater_A", 1), ("demo_rater_B", 2)):
        rng = np.random.default_rng(seed)
        truth = np.array([relevance[m][t] for m, t in zip(sheet["mentee_id"], sheet["mentor_id"])])
        noise = np.where(rng.random(len(truth)) < 0.20, rng.choice([-1, 1], size=len(truth)), 0)
        filled = sheet.copy()
        filled["rating"] = np.clip(truth + noise, 0, 2)
        filled["comment"] = "simulated"
        filled.to_csv(DEMO_DIR / f"{rater}.csv", index=False)
    print(f"Simulated rater files written to {DEMO_DIR}")


if __name__ == "__main__":
    main()
