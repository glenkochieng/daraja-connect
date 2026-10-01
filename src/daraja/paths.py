"""Project paths, resolved relative to the repository root."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"
TAXONOMY_PATH = DATA_DIR / "taxonomy" / "aviation_mentoring_taxonomy.json"
GLOSSARY_PATH = DATA_DIR / "taxonomy" / "glossary.json"
KQ_VOCAB_PATH = DATA_DIR / "kq_public" / "kq_domain_vocabulary.json"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
HIDDEN_DIR = SYNTHETIC_DIR / "hidden"
RATINGS_DIR = ROOT / "ratings"
REPORTS_DIR = ROOT / "reports"
DEFAULT_CONFIG = CONFIG_DIR / "matching.yaml"
TUNED_CONFIG = CONFIG_DIR / "matching.tuned.yaml"


def active_config_path() -> Path:
    """Tuned configuration if it exists, otherwise the default (equal weights)."""
    return TUNED_CONFIG if TUNED_CONFIG.exists() else DEFAULT_CONFIG
