"""Content-based mentor recommender.

For a mentee m and an eligible mentor M, three block similarities are computed:

    s_text(m, M)  = cosine(TF-IDF(goals_text_m), TF-IDF(expertise_text_M))
    s_skills(m, M) = cosine(multi-hot(wants_to_learn_m), multi-hot(can_mentor_in_M))
    s_spec(m, M)  = 1 if specialisation_m == specialisation_M else 0

and combined as follows, where a_b = 1 if block b is present for both profiles, else 0,
and W = w_text + w_skills + w_spec:

    renormalise_content (default)
        content = sum_{b in text,skills} w_b a_b s_b / sum_{b in text,skills} w_b a_b   (0 if none present)
        score   = [ (w_text + w_skills) * content + w_spec * a_spec * s_spec ] / W
        A missing text or skills block is replaced by the other content block, while the
        specialisation match keeps its fixed share, so it cannot dominate incomplete profiles.
    renormalise
        score = sum_b w_b a_b s_b / sum_b w_b a_b          (all blocks rescaled)
    zero
        score = sum_b w_b a_b s_b / W                      (a missing block scores 0)

Mentors failing the hard filters (consent, availability, capacity, experience gap) are
never ranked.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from daraja.config import BLOCKS, CONTENT_BLOCKS, MatchingConfig
from daraja.pool import MentorPool
from daraja.preprocess import display_term, has_content, normalise_text
from daraja.schema import MenteeProfile, MentorProfile, Recommendation, RecommendationResult
from daraja.vocabulary import Taxonomy, load_taxonomy


@dataclass
class BlockScores:
    """Similarity and availability matrices, each shaped [n_mentees, n_mentors]."""

    similarity: dict[str, np.ndarray]
    available: dict[str, np.ndarray]


def combine_blocks(blocks: BlockScores, weights: Mapping[str, float], missing_policy: str) -> tuple[np.ndarray, np.ndarray]:
    """Weighted aggregation. Returns (scores, comparable) where comparable marks
    pairs with at least one positively weighted block present."""
    weighted = {b: weights[b] * blocks.available[b] * blocks.similarity[b] for b in BLOCKS}
    present = {b: weights[b] * blocks.available[b] for b in BLOCKS}
    present_weight = sum(present.values())
    comparable = present_weight > 0
    total_weight = sum(weights[b] for b in BLOCKS)

    if missing_policy == "renormalise_content":
        content_num = sum(weighted[b] for b in CONTENT_BLOCKS)
        content_den = sum(present[b] for b in CONTENT_BLOCKS)
        content = np.divide(content_num, content_den, out=np.zeros_like(content_num, dtype=float), where=content_den > 0)
        content_share = sum(weights[b] for b in CONTENT_BLOCKS)
        return (content_share * content + weighted["specialisation"]) / total_weight, comparable

    numerator = sum(weighted.values())
    if missing_policy == "renormalise":
        denominator = present_weight
    else:  # zero
        denominator = np.full_like(present_weight, total_weight, dtype=float)
    scores = np.divide(numerator, denominator, out=np.zeros_like(numerator, dtype=float), where=denominator > 0)
    return scores, comparable


class ContentRecommender:
    """TF-IDF + tag + specialisation cosine recommender with weighted, missing-aware aggregation."""

    def __init__(self, config: MatchingConfig, taxonomy: Taxonomy | None = None, name: str = "weighted_cosine"):
        self.config = config
        self.taxonomy = taxonomy or load_taxonomy()
        self.name = name
        self._topic_index = {tid: i for i, tid in enumerate(self.taxonomy.topic_ids)}
        self.pool: MentorPool | None = None

    # ------------------------------------------------------------------ fitting
    def fit(self, mentors: Sequence[MentorProfile]) -> ContentRecommender:
        """Index the mentor pool: build the TF-IDF vocabulary from mentor expertise texts."""
        self.pool = MentorPool(mentors)
        use_glossary = self.config.text.use_glossary
        texts = [normalise_text(m.expertise_text, use_glossary) for m in mentors]
        self.mentor_has_text = np.array([has_content(t) for t in texts])
        tc = self.config.text
        self.vectorizer = TfidfVectorizer(
            ngram_range=tuple(tc.ngram_range),
            sublinear_tf=tc.sublinear_tf,
            min_df=tc.min_df,
            stop_words=tc.stop_words,
            norm="l2",
        )
        corpus = [t for t, present in zip(texts, self.mentor_has_text, strict=False) if present]
        if corpus:
            self.vectorizer.fit(corpus)
            self.mentor_text = self.vectorizer.transform(texts)
        else:
            self.vectorizer = None
            self.mentor_text = None
            self.mentor_has_text[:] = False

        self.mentor_skills = self._tag_matrix([m.can_mentor_in for m in mentors])
        self.mentor_has_skills = np.asarray(self.mentor_skills.sum(axis=1)).ravel() > 0
        self.mentor_has_spec = np.array([bool(m.specialisation) for m in mentors])
        return self

    def _tag_matrix(self, tag_lists: Iterable[list[str]]) -> sparse.csr_matrix:
        rows, cols = [], []
        tag_lists = list(tag_lists)
        for r, tags in enumerate(tag_lists):
            for tag in tags:
                c = self._topic_index.get(tag)
                if c is not None:  # unknown tags are ignored
                    rows.append(r)
                    cols.append(c)
        data = np.ones(len(rows), dtype=float)
        matrix = sparse.csr_matrix((data, (rows, cols)), shape=(len(tag_lists), len(self._topic_index)))
        matrix.data[:] = 1.0  # duplicates collapse to 1
        return normalize(matrix, norm="l2", axis=1)

    def _require_fitted(self) -> MentorPool:
        if self.pool is None:
            raise RuntimeError("Call fit(mentors) before recommending")
        return self.pool

    # ------------------------------------------------------------------ scoring
    def mentee_blocks_present(self, mentee: MenteeProfile) -> dict[str, bool]:
        use_glossary = self.config.text.use_glossary
        return {
            "text": has_content(normalise_text(mentee.goals_text, use_glossary)),
            "skills": any(t in self._topic_index for t in mentee.wants_to_learn),
            "specialisation": bool(mentee.specialisation),
        }

    def is_complete(self, mentee: MenteeProfile) -> bool:
        present = self.mentee_blocks_present(mentee)
        return any(present[b] for b in self.config.required_mentee_blocks_any)

    def block_scores(self, mentees: Sequence[MenteeProfile]) -> BlockScores:
        pool = self._require_fitted()
        n, p = len(mentees), len(pool)
        use_glossary = self.config.text.use_glossary
        similarity, available = {}, {}

        texts = [normalise_text(m.goals_text, use_glossary) for m in mentees]
        mentee_has_text = np.array([has_content(t) for t in texts])
        if self.vectorizer is not None and n:
            q = self.vectorizer.transform(texts)
            similarity["text"] = (q @ self.mentor_text.T).toarray()
        else:
            similarity["text"] = np.zeros((n, p))
        available["text"] = mentee_has_text[:, None] & self.mentor_has_text[None, :]

        q_skills = self._tag_matrix([m.wants_to_learn for m in mentees])
        mentee_has_skills = np.asarray(q_skills.sum(axis=1)).ravel() > 0
        similarity["skills"] = (q_skills @ self.mentor_skills.T).toarray()
        available["skills"] = mentee_has_skills[:, None] & self.mentor_has_skills[None, :]

        mentee_spec = np.array([m.specialisation or "" for m in mentees], dtype=object)
        similarity["specialisation"] = (mentee_spec[:, None] == pool.specialisation[None, :]).astype(float)
        available["specialisation"] = (mentee_spec != "")[:, None] & self.mentor_has_spec[None, :]

        # Cosine of non-negative vectors lies in [0, 1]; clip float error.
        similarity = {b: np.clip(s, 0.0, 1.0) for b, s in similarity.items()}
        return BlockScores(similarity, available)

    # ------------------------------------------------------------------ ranking
    def rank(
        self,
        mentees: Sequence[MenteeProfile],
        k: int | None = None,
        exclude: Mapping[str, Iterable[str]] | None = None,
        blocks: BlockScores | None = None,
        weights: Mapping[str, float] | None = None,
        eligibility: np.ndarray | None = None,
    ) -> dict[str, list[str]]:
        """Ranked mentor ids for each mentee (empty list for incomplete profiles).

        `blocks`, `weights` and `eligibility` can be passed in to reuse precomputed
        matrices, e.g. during the weight grid search."""
        pool = self._require_fitted()
        k = self.config.top_k if k is None else k
        blocks = blocks or self.block_scores(mentees)
        weights = weights or self.config.weights
        scores, comparable = combine_blocks(blocks, weights, self.config.missing_policy)
        if eligibility is None:
            eligibility = pool.eligibility(mentees, self.config.filters, exclude)
        candidates = eligibility & comparable
        ranked = {}
        for row, mentee in enumerate(mentees):
            ranked[mentee.mentee_id] = pool.order(scores[row], candidates[row], k) if self.is_complete(mentee) else []
        return ranked

    def recommend(
        self,
        mentee: MenteeProfile,
        k: int | None = None,
        exclude_mentor_ids: Iterable[str] = (),
    ) -> RecommendationResult:
        """Recommendations for one mentee, with per-block scores and plain-language reasons."""
        pool = self._require_fitted()
        k = self.config.top_k if k is None else k
        version = self.config.version
        if not self.is_complete(mentee):
            return RecommendationResult(mentee_id=mentee.mentee_id, status="incomplete_profile", config_version=version)

        blocks = self.block_scores([mentee])
        scores, comparable = combine_blocks(blocks, self.config.weights, self.config.missing_policy)
        eligible = pool.eligibility([mentee], self.config.filters, {mentee.mentee_id: list(exclude_mentor_ids)})
        ordered = pool.order(scores[0], eligible[0] & comparable[0], k)
        if not ordered:
            return RecommendationResult(mentee_id=mentee.mentee_id, status="no_eligible_mentors", config_version=version)

        results = []
        for rank, mentor_id in enumerate(ordered, start=1):
            col = pool.index[mentor_id]
            block_values = {
                b: (round(float(blocks.similarity[b][0, col]), 4) if blocks.available[b][0, col] else None) for b in BLOCKS
            }
            results.append(
                Recommendation(
                    mentor_id=mentor_id,
                    rank=rank,
                    score=round(float(scores[0, col]), 4),
                    block_scores=block_values,
                    reasons=self._reasons(mentee, col),
                )
            )
        return RecommendationResult(mentee_id=mentee.mentee_id, status="ok", config_version=version, results=results)

    def _reasons(self, mentee: MenteeProfile, col: int, max_terms: int = 3) -> list[str]:
        mentor = self.pool.mentors[col]
        reasons = []
        shared = [t for t in mentee.wants_to_learn if t in set(mentor.can_mentor_in) and t in self.taxonomy.topics]
        if shared:
            reasons.append("Can mentor in: " + ", ".join(self.taxonomy.topics[t].name for t in shared))
        if mentee.specialisation and mentee.specialisation == mentor.specialisation:
            domain = self.taxonomy.domains.get(mentor.specialisation, {}).get("name", mentor.specialisation)
            reasons.append(f"Same specialisation: {domain}")
        if self.vectorizer is not None and self.mentor_has_text[col]:
            q = self.vectorizer.transform([normalise_text(mentee.goals_text, self.config.text.use_glossary)])
            overlap = q.multiply(self.mentor_text[col]).tocoo()
            if overlap.nnz:
                top = overlap.col[np.argsort(-overlap.data)][:max_terms]
                names = self.vectorizer.get_feature_names_out()
                reasons.append("Shared terms: " + ", ".join(display_term(names[i]) for i in top))
        return reasons
