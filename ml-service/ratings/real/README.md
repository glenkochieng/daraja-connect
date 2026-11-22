# Running the rating study offline (private files)

This folder is git-ignored because its files contain personal information. Only this README is committed.
The study needs ethics approval and organisational permission before step 1.

## 1. Collect profiles

Give consenting participants the templates in `data/real_template/` (one row per person) and save the
completed files as `data/real/mentors.csv` and `data/real/mentees.csv` (also git-ignored).

- Use a pseudonym in `mentor_id` / `mentee_id` (for example `M-07`, `P-12`). Keep the list that links
  pseudonyms to people outside the repository.
- Lists such as `can_mentor_in` and `wants_to_learn` take topic ids separated by `;`. Valid ids:
  `GET http://127.0.0.1:8000/taxonomy` or `data/taxonomy/aviation_mentoring_taxonomy.json`.
- `consent_given` must say `true`. An empty cell counts as no consent, and that mentor is never ranked.

## 2. Build the blind sheet

```
python scripts/build_rating_sheet.py --mentors data/real/mentors.csv --mentees data/real/mentees.csv --split all --n-mentees 15
```

The script refuses unknown topic, specialisation or programme ids and lists them, so fix those first.
It writes `rating_sheet_blank.csv` and `pool_key.csv` here. Give each assessor a copy of the sheet with
`RATING_GUIDE.md`; never share `pool_key.csv`.

## 3. Score the returned sheets

```
python scripts/score_expert_ratings.py ratings/real/rater_AB.csv ratings/real/rater_CD.csv --key ratings/real/pool_key.csv --out ratings/real
```

This reports agreement between the assessors and then precision@5, recall@5, MRR@5 and NDCG@5 for each method.

## 4. Close the study

Delete the profiles, sheets, key and pseudonym list at the end of the project, as your consent form promises.
