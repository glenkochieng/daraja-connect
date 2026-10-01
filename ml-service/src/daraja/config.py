"""Matching configuration (weights, filters, text settings)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

import yaml

BLOCKS = ("text", "skills", "specialisation")
CONTENT_BLOCKS = ("text", "skills")
MISSING_POLICIES = ("renormalise_content", "renormalise", "zero")


@dataclass
class FilterConfig:
    require_consent: bool = True
    require_available: bool = True
    respect_capacity: bool = True
    min_experience_gap_years: float | None = 2


@dataclass
class TextConfig:
    use_glossary: bool = True
    ngram_range: tuple[int, int] = (1, 2)
    sublinear_tf: bool = True
    min_df: int = 1
    stop_words: str | None = "english"


@dataclass
class MatchingConfig:
    weights: dict[str, float] = field(default_factory=lambda: {b: 1 / 3 for b in BLOCKS})
    missing_policy: str = "renormalise_content"
    filters: FilterConfig = field(default_factory=FilterConfig)
    top_k: int = 5
    text: TextConfig = field(default_factory=TextConfig)
    required_mentee_blocks_any: tuple[str, ...] = ("text", "skills")

    def __post_init__(self) -> None:
        unknown = set(self.weights) - set(BLOCKS)
        if unknown:
            raise ValueError(f"Unknown weight blocks: {sorted(unknown)}")
        self.weights = {b: float(self.weights.get(b, 0.0)) for b in BLOCKS}
        if any(w < 0 for w in self.weights.values()) or sum(self.weights.values()) <= 0:
            raise ValueError("Weights must be non-negative and not all zero")
        if self.missing_policy not in MISSING_POLICIES:
            raise ValueError(f"missing_policy must be one of {MISSING_POLICIES}")
        self.text.ngram_range = tuple(self.text.ngram_range)
        self.required_mentee_blocks_any = tuple(self.required_mentee_blocks_any)

    def with_weights(self, **weights: float) -> "MatchingConfig":
        data = self.to_dict()
        data["weights"] = {**data["weights"], **weights}
        return MatchingConfig.from_dict(data)

    def with_policy(self, missing_policy: str) -> "MatchingConfig":
        return MatchingConfig.from_dict({**self.to_dict(), "missing_policy": missing_policy})

    def to_dict(self) -> dict:
        data = asdict(self)
        data["text"]["ngram_range"] = list(self.text.ngram_range)
        data["required_mentee_blocks_any"] = list(self.required_mentee_blocks_any)
        return data

    @property
    def version(self) -> str:
        """Short hash identifying this exact configuration (logged with recommendations)."""
        payload = json.dumps(self.to_dict(), sort_keys=True).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()[:10]

    @classmethod
    def from_dict(cls, data: dict) -> "MatchingConfig":
        data = dict(data)
        data.pop("metadata", None)
        filters = FilterConfig(**data.pop("filters", {}))
        text = TextConfig(**data.pop("text", {}))
        return cls(filters=filters, text=text, **data)


def load_config(path: str | Path) -> MatchingConfig:
    with open(path, encoding="utf-8") as fh:
        return MatchingConfig.from_dict(yaml.safe_load(fh))


def save_config(config: MatchingConfig, path: str | Path, metadata: dict | None = None) -> None:
    data = config.to_dict()
    if metadata:
        data["metadata"] = metadata
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, sort_keys=False)
