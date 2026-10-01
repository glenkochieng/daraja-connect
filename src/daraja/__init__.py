"""Daraja Connect mentor recommender.

A content-based recommender (TF-IDF + structured-feature cosine similarity with
weighted, missing-aware aggregation). It is not a trained machine-learning model:
its only tuned parameters are the block weights, chosen by grid search on a
validation split.
"""

from daraja.config import MatchingConfig, load_config
from daraja.recommender import ContentRecommender
from daraja.schema import MenteeProfile, MentorProfile

__all__ = ["ContentRecommender", "MatchingConfig", "MenteeProfile", "MentorProfile", "load_config"]
__version__ = "0.1.0"
