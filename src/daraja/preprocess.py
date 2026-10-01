"""Text preprocessing: lowercasing, glossary normalisation and cleanup.

The glossary maps abbreviations and synonyms (e.g. 'B787', 'Dreamliner') to one
canonical token (e.g. 'boeing787') so TF-IDF treats them as the same term.
"""

from __future__ import annotations

import re
from functools import lru_cache

from daraja.vocabulary import load_glossary

_WS = re.compile(r"\s+")
_NON_TEXT = re.compile(r"[^a-z0-9\s]")


@lru_cache(maxsize=1)
def _compiled_glossary() -> tuple[re.Pattern, dict[str, str], dict[str, str]]:
    entries = load_glossary()
    variant_to_canonical: dict[str, str] = {}
    canonical_to_display: dict[str, str] = {}
    for entry in entries:
        canonical_to_display[entry["canonical"]] = entry["display"]
        for variant in entry["variants"]:
            variant_to_canonical[variant.lower()] = entry["canonical"]
    # Longest variants first so "boeing 737 freighter" wins over "boeing 737".
    ordered = sorted(variant_to_canonical, key=len, reverse=True)
    pattern = re.compile(r"(?<![a-z0-9])(" + "|".join(re.escape(v) for v in ordered) + r")(?![a-z0-9])")
    return pattern, variant_to_canonical, canonical_to_display


def normalise_text(text: str | None, use_glossary: bool = True) -> str:
    """Lowercase, apply the glossary, strip punctuation and collapse whitespace."""
    if not text:
        return ""
    text = text.lower().replace("’", "'")
    if use_glossary:
        pattern, variant_to_canonical, _ = _compiled_glossary()
        text = pattern.sub(lambda m: f" {variant_to_canonical[m.group(1)]} ", text)
    text = _NON_TEXT.sub(" ", text)
    return _WS.sub(" ", text).strip()


def has_content(text: str | None) -> bool:
    """True if the text contains at least one alphabetic token."""
    return bool(text) and re.search(r"[a-z]{2,}", text.lower()) is not None


def display_term(term: str) -> str:
    """Human-readable form of a TF-IDF feature (maps canonical glossary tokens back)."""
    _, _, canonical_to_display = _compiled_glossary()
    return " ".join(canonical_to_display.get(tok, tok) for tok in term.split())
