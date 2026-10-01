# DEMO - simulated raters (not real expert judgements)

Raters: 2; pairs rated by all raters: 408; mentees scored: 30.

Metrics are computed on the pooled pairs only (every system's top-K was judged), so recall is relative to the pool.

## Inter-rater agreement

| Raters | % agreement | Cohen's kappa (quadratic) |
|---|---|---|
| demo_rater_A vs demo_rater_B | 0.79 | 0.84 |

Fleiss' kappa (all raters, unweighted): **0.67**

## Metrics per system (mean ± 95% CI half-width)

| System | precision@5 | recall@5 | mrr@5 | ndcg@5 |
|---|---|---|---|---|
| random | 0.280 ± 0.072 | 0.173 ± 0.043 | 0.497 ± 0.128 | 0.156 ± 0.042 |
| rule_based | 0.867 ± 0.076 | 0.601 ± 0.080 | 0.933 ± 0.078 | 0.774 ± 0.076 |
| unweighted_cosine | 0.947 ± 0.032 | 0.657 ± 0.057 | 1.000 ± 0.000 | 0.862 ± 0.038 |
| weighted_cosine | 0.947 ± 0.032 | 0.657 ± 0.057 | 1.000 ± 0.000 | 0.862 ± 0.037 |

## Wilcoxon signed-rank tests on NDCG@5

| weighted_cosine vs | Mean difference | p-value | Pairs |
|---|---|---|---|
| random | +0.706 | 1.7e-06 | 30 |
| rule_based | +0.088 | 0.067 | 30 |
| unweighted_cosine | -0.000 | 1 | 30 |
