# Matching service

`ml-service/` is a Python package (`daraja`) with a FastAPI app (`daraja.api:app`). It ranks mentors for a mentee by content similarity and explains each match. It is stateless: the API sends the candidates with each request. Method, evaluation and limitations are in [ml-service/README.md](../ml-service/README.md) and [ml-service/docs/methodology.md](../ml-service/docs/methodology.md).

Run it on its own with `uvicorn daraja.api:app --reload` inside `ml-service` (activated `.venv`); interactive documentation is at http://127.0.0.1:8000/docs.

> **Not for the public internet.** The service has no authentication. Only the API may reach it (see [aws.md](aws.md)).

## How a match is scored

For each eligible mentor the service compares three blocks:

| Block | Mentee side | Mentor side | Similarity |
|---|---|---|---|
| `text` | `goals_text` | `expertise_text` | Cosine of TF-IDF vectors (unigrams and bigrams, English stop words, an aviation glossary that merges variants such as "B787" and "Dreamliner") |
| `skills` | `wants_to_learn` | `can_mentor_in` | Cosine of multi-hot topic vectors |
| `specialisation` | `specialisation` | `specialisation` | 1 if the same domain, else 0 |

`score = Σ w_b · present_b · s_b / Σ w_b` with weights text 0.4, skills 0.3, specialisation 0.3 (`config/matching.tuned.yaml`, chosen by grid search on a validation split; the missing-data policy is `zero`).

**Eligibility filters** (applied before ranking): consent given, mentor available, a free place (`current_mentees < max_mentees`), at least 2 more years of experience than the mentee, and not in `exclude_mentor_ids`.

**Reasons** shown to the mentee, in order: the shared topics ("Can mentor in: Station management"), a shared specialisation ("Same specialisation: Ground Handling & Airport Services"), and the most specific shared terms from the texts ("You both mention interview preparation"). Shared terms skip generic career words, words inside a chosen phrase, and words the other reasons already show; the line is left out when nothing specific is shared.

## Endpoints

### `GET /health`

```json
{ "status": "ok", "mentors_loaded": 160, "config_version": "d1316c5b80",
  "weights": { "text": 0.4, "skills": 0.3, "specialisation": 0.3 },
  "loaded_at": "2026-10-01T12:00:00+00:00" }
```

### `GET /taxonomy`

The vocabulary shared by the matcher, the API (validation) and the client (pickers):

```json
{ "specialisations": [{ "id": "ground_operations", "name": "Ground Handling & Airport Services" }],
  "topics": [{ "id": "station_management", "name": "Station management", "domain": "ground_operations" }],
  "programmes": [{ "id": "cert_weight_balance", "name": "Certificate in Weight and Balance", "domain": "ground_operations" }] }
```

Eight specialisations, 57 topics (including fleet types, career development and digital topics) and 20 Pride Centre programmes.

### `POST /recommendations`

Request:

```json
{
  "mentee": {
    "mentee_id": "64b0…", "user_type": "pride_alumni",
    "pride_programme": "cert_weight_balance", "graduation_year": 2020,
    "specialisation": "ground_operations", "years_experience": 4,
    "goals_text": "I want to build strong skills in station management…",
    "wants_to_learn": ["station_management"], "consent_given": true
  },
  "mentors": [
    { "mentor_id": "64b1…", "user_type": "current_staff", "role_title": "Load Controller",
      "specialisation": "ground_operations", "years_experience": 29,
      "expertise_text": "…", "can_mentor_in": ["station_management"],
      "is_available": true, "max_mentees": 4, "current_mentees": 0, "consent_given": true }
  ],
  "k": 5,
  "exclude_mentor_ids": ["64b2…"]
}
```

- `k`: 1–20 (default 5). `mentors`: up to 5,000; when omitted the service ranks its own file (`DARAJA_MENTORS_PATH`, the synthetic mentors), which is how the evaluation scripts call it.
- Unknown topic or specialisation ids return 422.

Response:

```json
{
  "mentee_id": "64b0…",
  "status": "ok",
  "config_version": "d1316c5b80",
  "results": [
    { "mentor_id": "64b1…", "rank": 1, "score": 0.7126,
      "block_scores": { "text": 0.0418, "skills": 1.0, "specialisation": 1.0 },
      "reasons": ["Can mentor in: Station management",
                  "Same specialisation: Ground Handling & Airport Services",
                  "You both mention interview preparation"] }
  ]
}
```

`status` is `ok`, `incomplete_profile` (the mentee has neither goals text nor topics to learn; a specialisation alone is not enough) or `no_eligible_mentors`. `config_version` is a short hash of the matching configuration, stored with every logged recommendation. A block score is `null` when that block is missing on either side. Ties are broken by mentor id, so results are deterministic.

The configuration and the default mentor file are read once at start-up; restart the service after changing them.

## Settings

| Variable | Default | Purpose |
|---|---|---|
| `DARAJA_MENTORS_PATH` | `data/synthetic/mentors.json` | Mentor pool for requests without `mentors` |
| `DARAJA_CONFIG_PATH` | `config/matching.tuned.yaml` if present, else `config/matching.yaml` | Weights, filters, text settings, missing-data policy |

## How the API uses it

`server/src/lib/mlClient.js` calls `/health`, `/taxonomy` and `/recommendations` with a timeout (`ML_TIMEOUT_MS`, default 8 s). `server/src/services/mentorship.js` converts users to the schemas above (`toMlMentee`, `toMlMentor`), sends every approved mentor plus the mentors the mentee already has an open request with as `exclude_mentor_ids`, logs each result as a `recommendations` document, and returns 503 with a plain message when the service cannot be reached.

## Tests and evaluation

`pytest` (63 tests) covers the recommender, filters, reasons, the API and the data pipeline. `python scripts/run_pipeline.py` regenerates the synthetic data, tunes the weights, evaluates on the test split and writes `reports/`. Results and their limits are in `ml-service/docs/methodology.md`.
