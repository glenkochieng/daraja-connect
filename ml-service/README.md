# Daraja Connect: mentor recommender

A **content-based mentor recommender** that ranks current and former Kenya Airways employees
(mentors) for Kenya Airways Pride Centre alumni (mentees). It compares profiles with TF-IDF
text similarity, skill-tag similarity and a specialisation match, combines the three with
weights, and explains each recommendation.

It is **not** a trained machine-learning model. The only settings chosen from data are three
block weights and a missing-data policy, selected by grid search on a validation split.

> **Data notice.** Profiles and relevance labels in `data/synthetic/` are simulated. They show
> the pipeline works and how methods compare under stated assumptions, not that the matches
> suit real people. Real validation needs expert or participant ratings (see *Expert rating kit*).

---

## Quick start (Windows, VS Code)

This service lives in `ml-service/` of the Daraja Connect monorepo. Run every command below from
this folder.

1. Open the repository root in VS Code and install the recommended extensions when prompted (Python, Jupyter).
2. Create the virtual environment (once). In a terminal (Ctrl + `):

   ```
   cd ml-service
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   pip install -e . --no-deps
   ```

3. Run everything (about 2 minutes):

   ```
   python scripts/run_pipeline.py
   ```

4. Run the tests: `pytest`, or use the Testing panel in VS Code.
5. Start the matching API: `uvicorn daraja.api:app --reload`, or press F5 and choose *ML: matching service*. Then open http://127.0.0.1:8000/docs.
6. Open `notebooks/01_walkthrough.ipynb` and select the `ml-service/.venv` kernel.

## How matching works

For a mentee *m* and each mentor *M* who passes the **hard filters** (consent, availability,
capacity, at least 2 more years of experience):

| Block | Similarity |
|---|---|
| text | cosine of TF-IDF vectors: mentee `goals_text` vs mentor `expertise_text` (after the aviation glossary maps e.g. *B787 / Dreamliner* to one token) |
| skills | cosine of multi-hot topic tags: `wants_to_learn` vs `can_mentor_in` |
| specialisation | 1 if the mentee's target domain equals the mentor's domain, else 0 |

`score = Σ w_b · a_b · s_b / Σ w_b` (policy `zero`, chosen on validation), where `a_b` = 1 when
the block is present on both profiles. Weights: text 0.4, skills 0.3, specialisation 0.3.
Two other missing-data policies are implemented and compared (see `docs/methodology.md`).

Each result includes per-block scores and reasons, e.g. *"Can mentor in: Dangerous goods regulations |
Same specialisation: Cargo & Logistics | Shared terms: dangerous goods"*.

## Data

| Folder | What | Source |
|---|---|---|
| `data/kq_public/` | Fleet, business units, MRO and ground services, approvals, Pride Centre programmes | Public Kenya Airways, IATA and Kenyaplex pages, robots.txt respected. 85/85 quotes verified against saved snapshots. See `SOURCES.md`. |
| `data/taxonomy/` | 8 specialisations, 57 mentoring topics, 27-entry glossary | Author-defined, linked to the KQ vocabulary. Needs expert review. |
| `data/synthetic/` | 160 mentors, 300 mentees, validation/test split, hidden latent attributes and simulated labels | `scripts/generate_synthetic_data.py`. See `data/synthetic/README.md`. |

**No personal data was collected.** `kqpridecentre.com` disallows crawlers, so it was not scraped.

### Finding that affects the proposal

Kenya Airways launched an official **KQ Alumni Association / Alumni Network** on 14 November 2025.
Its page lists *mentorship*, networking, events and job boards among its benefits for former
colleagues (`data/kq_public/raw/kq_alumni_network.txt`). The proposal's claim that no institutionally
endorsed alumni platform exists needs revising. The page does not mention Pride Centre graduates or
how mentors and mentees are matched.

## Evaluation

* **Split:** mentees 40% validation / 60% test. Weights and policy are tuned on validation only.
* **Baselines:** random, rule-based (same specialisation, then most experienced), unweighted cosine; ablations text-only, skills-only, no glossary, each missing-data policy.
* **Metrics:** Precision@5, Recall@5, MRR@5 (relevant = grade ≥ 1), NDCG@5 (graded 0/1/2), with paired Wilcoxon tests.
* **Sensitivity:** 4 scenarios (standard, vocabulary mismatch, sparse profiles, both) × 3 seeds.

Test split, simulated labels (`reports/test_report.md`):

| System | P@5 | NDCG@5 |
|---|---|---|
| Random | 0.12 | 0.09 |
| Rule-based | 0.81 | 0.67 |
| Text only | 0.65 | 0.56 |
| Skills only | 0.69 | 0.60 |
| Unweighted cosine | 0.93 | 0.83 |
| **Weighted cosine (tuned)** | **0.93** | **0.82** |

Takeaways under the simulation's assumptions (`reports/sensitivity_report.md`):
* Combining the three blocks beat the rule-based baseline and either signal alone in **12/12** runs.
* Tuned weights were **never** significantly better than equal weights. Equal weights are the simpler, equally good choice until real labels say otherwise.
* Harder data lowered scores (NDCG@5 0.83 → 0.71) but did not change the ranking of methods.

## Expert rating kit (real validation)

1. Collect real profiles with informed consent, in the same JSON format as `data/synthetic/mentors.json` and `mentees.json`.
2. Build a blind sheet:

   ```
   python scripts/build_rating_sheet.py --mentors data/real/mentors.json --mentees data/real/mentees.json --split all --n-mentees 15
   ```

   About 14 pairs per mentee: 15 mentees is roughly 200 pairs per rater.
3. Give each rater a copy of `ratings/rating_sheet_blank.csv` and `ratings/RATING_GUIDE.md`. Keep `ratings/pool_key.csv` private.
4. Score the completed files (store them in the git-ignored `ratings/real/`):

   ```
   python scripts/score_expert_ratings.py ratings/real/rater_A.csv ratings/real/rater_B.csv --out ratings/real
   ```

`ratings/demo/` shows the kit working with **simulated** raters; never report those numbers as expert results.

## Calling the API from Node.js

```js
const res = await fetch("http://matching-service:8000/recommendations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mentee: {
      mentee_id: user.id,
      pride_programme: "cert_flight_dispatch",
      specialisation: "flight_operations",
      years_experience: 1,
      goals_text: user.goals,
      wants_to_learn: ["flight_dispatch", "aircraft_performance"]
    },
    k: 5,
    exclude_mentor_ids: openRequestMentorIds,
    // Candidate mentors from MongoDB (MentorProfile objects). Omit to use data/synthetic/mentors.json.
    mentors: eligibleMentors
  })
});
const { status, results } = await res.json(); // status: ok | incomplete_profile | no_eligible_mentors
```

Keep the service on the internal network. The Express server (`server/src/services/mentorship.js`)
sends the candidate mentors with each request, so this service never needs database credentials.
`GET /taxonomy` returns the specialisations, topics and Pride Centre programmes for the profile forms.

## Project structure

```
config/            matching.yaml (defaults), matching.tuned.yaml (written by tuning)
data/kq_public/    fetched snapshots, verified vocabulary, SOURCES.md
data/taxonomy/     topics, specialisations, glossary
data/synthetic/    generated profiles, splits, hidden/ labels
docs/              methodology.md (specification, corrections mapping, results)
notebooks/         01_walkthrough.ipynb
ratings/           RATING_GUIDE.md, blind sheet, key, demo/, real/ (git-ignored)
reports/           tuning, test and sensitivity results, figures
scripts/           fetch, generate, tune, evaluate, rating kit, sensitivity, run_pipeline
src/daraja/        recommender, baselines, metrics, evaluation, tuning, synthetic, api, ...
tests/             pytest suite (53 tests)
```

## Limitations

* The labels and text are simulated, so absolute scores are optimistic.
* Lexical TF-IDF misses paraphrases the glossary doesn't cover.
* The taxonomy and glossary are author-defined and need review by Pride Centre / KQ experts.
* The system relies on self-reported profiles and has a cold-start problem.
* Beyond the capacity filter, there is no load balancing across mentors.
* Some Pride Centre programme names come from a third-party directory; confirm them on the official site.
