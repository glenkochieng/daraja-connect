# Methodology notes

Technical reference for the recommender, the data and the evaluation, mapped to the
assessor's corrections on the proposal. Numbers refer to the run recorded in `reports/`.

## 1. How the implementation addresses the assessor's corrections

| Assessor's point | Where it is handled |
|---|---|
| Not a "trained ML model" (visible 1–2, required 2–3) | Implemented and documented as a **content-based recommender** (`src/daraja/recommender.py`). Only the block weights and the missing-data policy are tuned, by grid search on a validation split (`src/daraja/tuning.py`). |
| Define feature vectors, preprocessing, weights, missing data (required 4) | Section 2 below; `config/matching.yaml`; `src/daraja/preprocess.py`; taxonomy and glossary in `data/taxonomy/`. |
| Weights chosen and validated how? (visible 7) | Grid search over the weight simplex (step 0.1) × 3 missing-data policies on **validation mentees only**; results reported on held-out **test mentees**. |
| Synthetic data cannot validate relevance (visible 2) | Synthetic data is used to test the pipeline and compare methods under explicit assumptions. Every report states this. Latent attributes and labels sit in `data/synthetic/hidden/` and are never read by the recommender. |
| Circular evaluation / no ground truth (visible 5–6, required 5) | Simulated labels come from latent attributes, not from the features the recommender scores. For real validation, `scripts/build_rating_sheet.py` builds a **blind, pooled** sheet for expert raters, and `scripts/score_expert_ratings.py` reports agreement (Cohen's and Fleiss' kappa) and metrics. |
| Baselines (required 6) | Random, rule-based (same specialisation, then most experienced), unweighted (equal-weight) cosine; ablations text-only, skills-only, no glossary, each missing-data policy. All share the same hard filters. |
| Ranking metrics with defined relevance (required 7) | Precision@5, Recall@5, MRR@5 (relevant = grade ≥ 1) and NDCG@5 (graded gains 2^g − 1), `src/daraja/metrics.py`; paired Wilcoxon signed-rank tests. |
| Sample, consent, privacy (visible 8, required 8) | The code supports it (`consent_given` filter, pseudonymous ids, git-ignored `ratings/real/`, rater privacy note in `ratings/RATING_GUIDE.md`). The sampling, consent form and ethics approval themselves still need to be written into the proposal. |
| Evidence about Kenya Airways (visible 9, required 9) | `data/kq_public/`: verified public vocabulary. **Finding:** KQ launched an official Alumni Association on 14 Nov 2025 that lists mentorship among its benefits; the problem statement must be revised. Primary evidence (interviews, questionnaire) is still needed. |
| Unreliable web sources (visible 12, required 12) | Every vocabulary item carries a verbatim quote checked against a saved snapshot (`provenance_report.md`). Secondary sources are labelled. |

## 2. Recommender specification

**Inputs**
* Mentee (Pride Centre alumnus): `goals_text`, `wants_to_learn` (topic ids), `specialisation` (target domain id), `years_experience`, `consent_given`.
* Mentor (current or former KQ employee): `expertise_text`, `can_mentor_in` (topic ids), `specialisation`, `years_experience`, `is_available`, `max_mentees`, `current_mentees`, `consent_given`.

**Hard filters** (never part of the score): consent, availability, `current_mentees < max_mentees`,
`mentor_years − mentee_years ≥ 2` (unknown years do not exclude), and caller-supplied exclusions
(e.g. mentors with an open request).

**Preprocessing**
1. Lowercase; apply the glossary (27 entries, longest match first, word-boundary safe), e.g. *B787 / Dreamliner / Boeing 787-8 → boeing787*, *DGR / dangerous goods → dangerousgoods*.
2. Remove punctuation, collapse whitespace.
3. TF-IDF: unigrams and bigrams, English stop words, sublinear TF, L2 norm; vocabulary and IDF fitted on mentor expertise texts.
4. Tags: multi-hot over the 57 taxonomy topics, L2-normalised; unknown tags ignored (the API rejects them).

**Block similarities** (all in [0, 1])
* s_text = cosine(TF-IDF(goals), TF-IDF(expertise))
* s_skills = cosine(tags(wants_to_learn), tags(can_mentor_in))
* s_spec = 1 if specialisations match, else 0

A block is *present* for a pair (a_b = 1) when both sides have it (text with at least one word, at least one known tag, a specialisation).

**Aggregation** (W = Σ w_b)

| Policy | Score |
|---|---|
| `zero` | Σ_b w_b·a_b·s_b / W |
| `renormalise` | Σ_b w_b·a_b·s_b / Σ_b w_b·a_b |
| `renormalise_content` | [(w_text + w_skills)·content + w_spec·a_spec·s_spec] / W, where content = weighted mean of the present text/skills blocks |

Tuned on validation: policy **zero**, weights **text 0.4, skills 0.3, specialisation 0.3**.

**Ranking**: descending score, ties broken by mentor id. A mentee with neither text nor tags gets
`incomplete_profile`; if no mentor passes the filters, `no_eligible_mentors`.

**Explanations**: shared tags, same specialisation, and the top shared TF-IDF terms.

## 3. Evaluation design

* Split mentees 40% validation / 60% test; mentors shared.
* Exclude mentees with incomplete profiles (4 of 180 in test).
* Restrict relevance to *eligible* mentors, so recall and NDCG denominators only count mentors a system could recommend.
* K = 5. Report the mean ± 95% CI half-width over mentees, plus paired Wilcoxon signed-rank tests on per-mentee NDCG@5.
* **Sensitivity analysis**: 4 scenarios × 3 seeds, repeating generate → tune → test each time.

## 4. Results on simulated data (test split)

| System | P@5 | R@5 | MRR@5 | NDCG@5 |
|---|---|---|---|---|
| Random | 0.122 | 0.061 | 0.241 | 0.093 |
| Rule-based | 0.807 | 0.465 | 0.893 | 0.668 |
| Unweighted cosine | 0.933 | 0.539 | 0.994 | 0.825 |
| Weighted cosine (tuned) | 0.933 | 0.539 | 0.991 | 0.823 |
| Text only | 0.647 | 0.352 | 0.860 | 0.556 |
| Skills only | 0.688 | 0.381 | 0.811 | 0.602 |

Sensitivity (mean NDCG@5 over 3 seeds; standard → vocabulary mismatch → sparse → hard):
weighted cosine 0.834 → 0.798 → 0.734 → 0.707; rule-based 0.693 → 0.657 → 0.564 → 0.548; text-only 0.580 → 0.451 → 0.489 → 0.377.

**Interpretation** (holds only under the simulation's assumptions):
1. Combining text, tags and specialisation beat the rule-based baseline in 12/12 runs (p < 0.05), and beat text-only and skills-only in 12/12.
2. Tuned weights were never significantly better than equal weights (0/12; equal weights were significantly better in 1/12), and the chosen weights varied between seeds. **Recommendation: use equal weights** unless tuning on real, expert-labelled validation data shows a benefit.
3. The glossary helped significantly in only 1/12 runs; tags and specialisation compensate for vocabulary mismatch.
4. The missing-data policies differed by at most about 0.01 NDCG@5.

## 5. Limitations

* The labels and text are simulated, so absolute scores are optimistic.
* Lexical TF-IDF misses paraphrases the glossary doesn't cover.
* The taxonomy and glossary are author-defined and need expert review.
* The system relies on self-reported profiles.
* There is no load balancing across mentors beyond the capacity filter.
* Pride Centre programme names come partly from a third-party directory.
