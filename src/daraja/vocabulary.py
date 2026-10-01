"""Loading the taxonomy, glossary and KQ public vocabulary."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from daraja import paths


@dataclass(frozen=True)
class Topic:
    id: str
    name: str
    domain: str
    phrases: tuple[str, ...]
    kq_refs: tuple[str, ...] = ()


@dataclass
class Taxonomy:
    domains: dict[str, dict]
    topics: dict[str, Topic]
    role_titles: dict[str, list[str]] = field(default_factory=dict)

    @property
    def topic_ids(self) -> list[str]:
        return list(self.topics)

    @property
    def specialisations(self) -> list[str]:
        return [d for d, meta in self.domains.items() if meta.get("selectable_specialisation")]

    def topics_in(self, domain: str) -> list[Topic]:
        return [t for t in self.topics.values() if t.domain == domain]

    def validate_topics(self, topic_ids: list[str]) -> list[str]:
        """Return the ids that are not in the taxonomy."""
        return [t for t in topic_ids if t not in self.topics]


@lru_cache(maxsize=4)
def load_taxonomy(path: str | Path = paths.TAXONOMY_PATH) -> Taxonomy:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    domains = {d["id"]: d for d in raw["domains"]}
    topics = {
        t["id"]: Topic(t["id"], t["name"], t["domain"], tuple(t["phrases"]), tuple(t.get("kq_refs", ())))
        for t in raw["topics"]
    }
    for t in topics.values():
        if t.domain not in domains:
            raise ValueError(f"Topic {t.id} references unknown domain {t.domain}")
    return Taxonomy(domains=domains, topics=topics, role_titles=raw.get("role_titles", {}))


@lru_cache(maxsize=4)
def load_glossary(path: str | Path = paths.GLOSSARY_PATH) -> list[dict]:
    return json.loads(Path(path).read_text(encoding="utf-8"))["entries"]


@lru_cache(maxsize=2)
def load_kq_vocabulary(path: str | Path = paths.KQ_VOCAB_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))
