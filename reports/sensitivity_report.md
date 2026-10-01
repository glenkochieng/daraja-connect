# Sensitivity analysis (simulated data)

Generated: 2026-09-17T10:46:17+00:00  
Seeds: [42, 43, 44]. For every scenario and seed, the data were regenerated, weights and the missing-data policy were tuned on validation mentees, and systems were evaluated on test mentees.

## Mean NDCG@5 across seeds (range across seeds in brackets)

| System | standard | vocabulary_mismatch | sparse_profiles | hard |
|---|---|---|---|---|
| random | 0.086 [0.018] | 0.082 [0.006] | 0.081 [0.010] | 0.082 [0.020] |
| rule_based | 0.693 [0.059] | 0.657 [0.037] | 0.564 [0.098] | 0.548 [0.075] |
| unweighted_cosine | 0.833 [0.042] | 0.802 [0.035] | 0.735 [0.094] | 0.708 [0.034] |
| weighted_cosine | 0.834 [0.039] | 0.798 [0.033] | 0.734 [0.103] | 0.707 [0.026] |
| text_only | 0.580 [0.053] | 0.451 [0.047] | 0.489 [0.042] | 0.377 [0.071] |
| skills_only | 0.611 [0.092] | 0.594 [0.020] | 0.400 [0.076] | 0.408 [0.037] |
| weighted_no_glossary | 0.830 [0.047] | 0.798 [0.038] | 0.735 [0.102] | 0.705 [0.032] |

## weighted_cosine vs other systems: seeds where weighted_cosine is significantly better / worse (p < 0.05, NDCG@5)

| Compared with | standard | vocabulary_mismatch | sparse_profiles | hard |
|---|---|---|---|---|
| random | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 |
| rule_based | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 |
| unweighted_cosine | 0 / 0 of 3 | 0 / 1 of 3 | 0 / 0 of 3 | 0 / 0 of 3 |
| text_only | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 |
| skills_only | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 | 3 / 0 of 3 |
| weighted_no_glossary | 0 / 0 of 3 | 1 / 0 of 3 | 0 / 0 of 3 | 0 / 0 of 3 |

## Configuration chosen on validation

| Scenario | Seed | Missing policy | w_text | w_skills | w_specialisation |
|---|---|---|---|---|---|
| standard | 42 | zero | 0.4 | 0.3 | 0.3 |
| standard | 43 | zero | 0.4 | 0.2 | 0.4 |
| standard | 44 | renormalise_content | 0.2 | 0.2 | 0.6 |
| vocabulary_mismatch | 42 | renormalise_content | 0.1 | 0.6 | 0.3 |
| vocabulary_mismatch | 43 | zero | 0.4 | 0.4 | 0.2 |
| vocabulary_mismatch | 44 | renormalise_content | 0.2 | 0.3 | 0.5 |
| sparse_profiles | 42 | renormalise | 0.2 | 0.6 | 0.2 |
| sparse_profiles | 43 | zero | 0.3 | 0.2 | 0.5 |
| sparse_profiles | 44 | zero | 0.6 | 0.2 | 0.2 |
| hard | 42 | renormalise | 0.4 | 0.4 | 0.2 |
| hard | 43 | zero | 0.5 | 0.3 | 0.2 |
| hard | 44 | zero | 0.4 | 0.2 | 0.4 |
