# Real rating files (private)

Put completed rating sheets from real experts or participants here, e.g. `rater_AB.csv`.
This folder is git-ignored because the files contain personal information.

Score them with:

```
python scripts/score_expert_ratings.py ratings/real/rater_AB.csv ratings/real/rater_CD.csv --key ratings/pool_key.csv --out ratings/real
```

Delete these files at the end of the project, as your consent form promises.
