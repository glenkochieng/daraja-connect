"""Synthetic mentor/mentee data with a hidden ("latent") ground truth.

How it works
------------
1. Each synthetic person first gets LATENT attributes:
   * mentors: primary/secondary domain, true expertise level (1-3) per topic, years of experience
   * mentees: Pride Centre programme, target domain, true needs with importance, years of experience
2. OBSERVABLE profiles (what users would type) are generated from the latent attributes
   with realistic noise: paraphrased text, filler sentences, missing fields, under-tagging,
   over-claimed tags and occasional wrong tags.
3. SIMULATED relevance labels are computed from the LATENT attributes only:

       utility = 0.65 * need_coverage + 0.20 * domain_fit + 0.15 * seniority_fit + noise
       grade   = 2 if utility >= t_high, 1 if utility >= t_low, else 0

   need_coverage weights each mentee need by how expert the mentor truly is in it
   (level 1 -> 0.25, level 2 -> 0.70, level 3 -> 1.00).

What this can and cannot show
-----------------------------
It tests whether the pipeline recovers a known signal from noisy profiles and lets
you compare against baselines end to end. It does NOT show that recommendations are
good for real Kenya Airways mentors and Pride Centre alumni: the utility formula is an
assumption. Real validity needs expert or participant relevance judgements (see the
rating kit in scripts/build_rating_sheet.py).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from daraja.data import save_profiles
from daraja.schema import MenteeProfile, MentorProfile
from daraja.vocabulary import Taxonomy

LEVEL_QUALITY = {1: 0.25, 2: 0.70, 3: 1.00}

MENTOR_DOMAIN_SHARE = {
    "aircraft_maintenance": 0.20, "flight_operations": 0.12, "cabin_services": 0.14, "ground_operations": 0.16,
    "cargo": 0.12, "safety_security_quality": 0.10, "commercial": 0.10, "digital_innovation": 0.06,
}
FLEET_HEAVY_DOMAINS = {"aircraft_maintenance", "flight_operations"}


@dataclass
class SyntheticConfig:
    n_mentors: int = 160
    n_mentees: int = 300
    seed: int = 42
    validation_fraction: float = 0.4
    reference_year: int = 2026
    # observable-profile noise
    mentor_text_missing: float = 0.05
    mentor_tags_missing: float = 0.08
    mentor_spec_missing: float = 0.04
    mentee_text_missing: float = 0.08
    mentee_tags_missing: float = 0.12
    mentee_spec_missing: float = 0.10
    mentee_career_switch: float = 0.25
    mentor_available: float = 0.85
    mentor_consent: float = 0.95
    # If True, mentors and mentees describe a topic with DISJOINT phrase subsets
    # (e.g. mentor "crew resource management" vs mentee "CRM"), simulating vocabulary mismatch.
    phrase_split: bool = False
    # relevance model (applied to latent attributes only)
    utility_weights: dict = field(default_factory=lambda: {"coverage": 0.65, "domain_fit": 0.20, "seniority_fit": 0.15})
    utility_noise_sd: float = 0.04
    grade_thresholds: dict = field(default_factory=lambda: {"somewhat_relevant": 0.40, "highly_relevant": 0.62})


MENTOR_INTRO_CURRENT = [
    "{role} at Kenya Airways with {years} years of experience.",
    "I work as a {role} and have been in aviation for {years} years.",
    "{years} years in aviation, currently serving as {role}.",
]
MENTOR_INTRO_FORMER = [
    "Former {role} with {years} years in aviation, now an independent consultant.",
    "I spent {years} years in aviation and left Kenya Airways as a {role}.",
    "Previously a {role} at Kenya Airways; {years} years in the industry.",
]
MENTOR_LEVEL_SENTENCES = {
    3: ["Many years of experience in {p}.", "Deep hands-on expertise in {p}.", "I currently train others in {p}.", "Recognised specialist in {p}."],
    2: ["Solid experience with {p}.", "I have worked on {p} regularly.", "Comfortable handling {p}."],
    1: ["Some exposure to {p}.", "I have occasionally supported {p}.", "Basic familiarity with {p}."],
}
MENTOR_FLEET_SENTENCES = {
    3: ["Extensive type experience on the {p}.", "Many years working on the {p}."],
    2: ["Type experience on the {p}.", "Worked on the {p}."],
    1: ["Some time on the {p}."],
}
MENTOR_FILLER = [
    "I enjoy helping young professionals grow.",
    "Happy to share practical lessons from the Pride of Africa.",
    "I believe good mentoring builds confidence and teamwork.",
    "I prefer structured, goal-based mentoring sessions.",
    "Available for monthly virtual meetings.",
    "I care deeply about safety culture.",
]
MENTEE_INTRO = [
    "Pride Centre graduate ({programme}).",
    "I completed the {programme} at the Pride Centre.",
    "Recent Pride Centre alumnus from the {programme} programme.",
]
MENTEE_INTRO_SWITCH = [
    "I completed the {programme} but want to move into {domain}.",
    "Pride Centre graduate ({programme}) hoping to transition into {domain}.",
]
MENTEE_PRIMARY_NEED = ["My main goal is to master {p}.", "I most need guidance on {p}.", "I want to build strong skills in {p}."]
MENTEE_SECONDARY_NEED = ["I would also like to learn about {p}.", "Some support with {p} would help.", "Interested in {p} as well."]
MENTEE_FILLER = [
    "I am eager to grow my career.",
    "Looking for a mentor with practical experience.",
    "I value honest feedback.",
    "Open to virtual or in-person sessions.",
]


class SyntheticGenerator:
    def __init__(self, config: SyntheticConfig, taxonomy: Taxonomy, kq_vocabulary: dict):
        self.cfg = config
        self.tax = taxonomy
        self.rng = np.random.default_rng(config.seed)
        self.programmes = kq_vocabulary["pride_centre_programmes"]
        self.domains = [d for d in taxonomy.specialisations if d in MENTOR_DOMAIN_SHARE]
        self.topic_ids = taxonomy.topic_ids
        self.topic_col = {t: i for i, t in enumerate(self.topic_ids)}

    # ---------------------------------------------------------------- helpers
    def _choice(self, seq):
        return seq[int(self.rng.integers(len(seq)))]

    def _sample(self, seq, n):
        n = min(n, len(seq))
        idx = self.rng.choice(len(seq), size=n, replace=False)
        return [seq[i] for i in idx]

    def _topics(self, domain):
        return [t.id for t in self.tax.topics_in(domain)]

    def _phrase(self, topic_id, side):
        phrases = self.tax.topics[topic_id].phrases
        if self.cfg.phrase_split and len(phrases) >= 2:
            phrases = phrases[0::2] if side == "mentor" else phrases[1::2]
        return self._choice(phrases)

    # ---------------------------------------------------------------- mentors
    def _mentor_latent(self, idx):
        rng = self.rng
        primary = str(rng.choice(list(MENTOR_DOMAIN_SHARE), p=list(MENTOR_DOMAIN_SHARE.values())))
        secondary = None
        if rng.random() < 0.30:
            secondary = self._choice([d for d in self.domains if d != primary])
        user_type = "current_staff" if rng.random() < 0.65 else "former_staff"
        years = int(rng.integers(4, 31)) if user_type == "current_staff" else int(rng.integers(10, 39))
        seniority = min(years / 30, 1.0)
        p3 = 0.15 + 0.35 * seniority  # more senior -> more topics at expert level
        p_levels = [0.40 - 0.35 * seniority, 0.45, p3]

        expertise: dict[str, int] = {}
        for topic in self._sample(self._topics(primary), int(rng.integers(2, 6))):
            expertise[topic] = int(rng.choice([1, 2, 3], p=p_levels))
        if years >= 10 and 3 not in expertise.values():
            expertise[next(iter(expertise))] = 3
        if secondary:
            for topic in self._sample(self._topics(secondary), int(rng.integers(1, 3))):
                expertise[topic] = int(rng.choice([1, 2], p=[0.5, 0.5]))
        if rng.random() < 0.6:
            for topic in self._sample(self._topics("career_development"), int(rng.integers(1, 3))):
                expertise[topic] = 3 if (years >= 15 and rng.random() < 0.5) else int(rng.choice([1, 2]))
        fleet = self._topics("fleet")
        if primary in FLEET_HEAVY_DOMAINS:
            for topic in self._sample([t for t in fleet if t != "fleet_b737f"], int(rng.integers(1, 3))):
                expertise[topic] = int(rng.choice([2, 3]))
        elif primary == "cabin_services" and rng.random() < 0.5:
            expertise[self._choice(["fleet_b787", "fleet_b737", "fleet_e190"])] = int(rng.choice([1, 2]))
        elif primary == "cargo" and rng.random() < 0.4:
            expertise["fleet_b737f"] = int(rng.choice([2, 3]))

        return {
            "mentor_id": f"MTR-{idx:04d}", "user_type": user_type, "primary_domain": primary,
            "secondary_domain": secondary, "years_experience": years, "expertise": expertise,
        }

    def _mentor_observable(self, latent) -> MentorProfile:
        rng, cfg = self.rng, self.cfg
        role = self._choice(self.tax.role_titles[latent["primary_domain"]])
        years = latent["years_experience"]

        text = ""
        if rng.random() >= cfg.mentor_text_missing:
            intro_bank = MENTOR_INTRO_CURRENT if latent["user_type"] == "current_staff" else MENTOR_INTRO_FORMER
            sentences = [self._choice(intro_bank).format(role=role, years=years)]
            mention_prob = {3: 0.95, 2: 0.80, 1: 0.50}
            items = list(latent["expertise"].items())
            rng.shuffle(items)
            for topic, level in items:
                if rng.random() < mention_prob[level]:
                    bank = MENTOR_FLEET_SENTENCES if self.tax.topics[topic].domain == "fleet" else MENTOR_LEVEL_SENTENCES
                    sentences.append(self._choice(bank[level]).format(p=self._phrase(topic, "mentor")))
            sentences += self._sample(MENTOR_FILLER, int(rng.integers(0, 3)))
            text = " ".join(sentences)

        tags: list[str] = []
        if rng.random() >= cfg.mentor_tags_missing:
            tag_prob = {3: 0.85, 2: 0.70, 1: 0.35}  # level-1 tags = over-claiming
            tags = [t for t, level in latent["expertise"].items() if rng.random() < tag_prob[level]]
            if rng.random() < 0.10:  # claims a topic they have no real expertise in
                extra = [t for t in self._topics(latent["primary_domain"]) if t not in latent["expertise"]]
                if extra:
                    tags.append(self._choice(extra))

        max_mentees = int(rng.integers(1, 5))
        return MentorProfile(
            mentor_id=latent["mentor_id"],
            user_type=latent["user_type"],
            role_title=role if latent["user_type"] == "current_staff" else f"Former {role}",
            specialisation=None if rng.random() < cfg.mentor_spec_missing else latent["primary_domain"],
            years_experience=years,
            expertise_text=text,
            can_mentor_in=tags,
            is_available=bool(rng.random() < cfg.mentor_available),
            max_mentees=max_mentees,
            current_mentees=int(rng.integers(0, max_mentees + 1)),
            consent_given=bool(rng.random() < cfg.mentor_consent),
        )

    # ---------------------------------------------------------------- mentees
    def _mentee_latent(self, idx):
        rng, cfg = self.rng, self.cfg
        programme = self._choice(self.programmes)
        programme_domain = programme["domain"] if programme["domain"] in self.domains else self._choice(self.domains)
        career_switch = bool(rng.random() < cfg.mentee_career_switch)
        target = self._choice([d for d in self.domains if d != programme_domain]) if career_switch else programme_domain
        years = int(rng.choice([0, 1, 2, 3, 4, 5, 6, 8], p=[0.18, 0.18, 0.16, 0.14, 0.12, 0.10, 0.07, 0.05]))

        domain_topics = self._topics(target)
        chosen = self._sample(domain_topics, 1 + int(rng.integers(1, 3)))
        needs = {chosen[0]: 1.0, **{t: 0.7 for t in chosen[1:]}}
        if target in FLEET_HEAVY_DOMAINS and rng.random() < 0.5:
            needs[self._choice([t for t in self._topics("fleet") if t != "fleet_b737f"])] = 0.5
        if rng.random() < 0.45:
            needs[self._choice(self._topics("career_development"))] = 0.5
        return {
            "mentee_id": f"MTE-{idx:04d}", "programme_id": programme["id"], "programme_domain": programme_domain,
            "target_domain": target, "career_switch": career_switch, "years_experience": years, "needs": needs,
        }

    def _mentee_observable(self, latent) -> MenteeProfile:
        rng, cfg = self.rng, self.cfg
        programme = next(p for p in self.programmes if p["id"] == latent["programme_id"])
        domain_name = self.tax.domains[latent["target_domain"]]["name"]

        text = ""
        if rng.random() >= cfg.mentee_text_missing:
            bank = MENTEE_INTRO_SWITCH if latent["career_switch"] else MENTEE_INTRO
            sentences = [self._choice(bank).format(programme=programme["name"], domain=domain_name)]
            years = latent["years_experience"]
            if years:
                sentences.append(f"I have {years} year{'s' if years != 1 else ''} of work experience.")
            else:
                sentences.append("I am starting my career.")
            for topic, importance in latent["needs"].items():
                if importance >= 0.9 or rng.random() < 0.85:
                    bank = MENTEE_PRIMARY_NEED if importance >= 0.9 else MENTEE_SECONDARY_NEED
                    sentences.append(self._choice(bank).format(p=self._phrase(topic, "mentee")))
            sentences += self._sample(MENTEE_FILLER, int(rng.integers(0, 3)))
            text = " ".join(sentences)

        tags: list[str] = []
        if rng.random() >= cfg.mentee_tags_missing:
            tags = [t for t in latent["needs"] if rng.random() < 0.70]
            if rng.random() < 0.15:  # a tag that does not reflect a real need
                tags.append(self._choice(self.topic_ids))

        grad_year = max(2008, cfg.reference_year - latent["years_experience"] - int(rng.integers(0, 3)))
        return MenteeProfile(
            mentee_id=latent["mentee_id"],
            pride_programme=latent["programme_id"],
            graduation_year=grad_year,
            specialisation=None if rng.random() < cfg.mentee_spec_missing else latent["target_domain"],
            years_experience=latent["years_experience"],
            goals_text=text,
            wants_to_learn=tags,
        )

    # ---------------------------------------------------------------- labels
    def _relevance(self, mentor_latent, mentee_latent) -> pd.DataFrame:
        cfg, rng = self.cfg, self.rng
        n_topics = len(self.topic_ids)
        quality = np.zeros((len(mentor_latent), n_topics))
        for i, m in enumerate(mentor_latent):
            for topic, level in m["expertise"].items():
                quality[i, self.topic_col[topic]] = LEVEL_QUALITY[level]
        importance = np.zeros((len(mentee_latent), n_topics))
        for j, m in enumerate(mentee_latent):
            for topic, weight in m["needs"].items():
                importance[j, self.topic_col[topic]] = weight
        coverage = (importance @ quality.T) / importance.sum(axis=1, keepdims=True)

        target = np.array([m["target_domain"] for m in mentee_latent], dtype=object)
        primary = np.array([m["primary_domain"] for m in mentor_latent], dtype=object)
        secondary = np.array([m["secondary_domain"] or "" for m in mentor_latent], dtype=object)
        domain_fit = np.where(target[:, None] == primary[None, :], 1.0, np.where(target[:, None] == secondary[None, :], 0.5, 0.0))

        mentee_years = np.array([m["years_experience"] for m in mentee_latent], dtype=float)
        mentor_years = np.array([m["years_experience"] for m in mentor_latent], dtype=float)
        seniority_fit = np.clip((mentor_years[None, :] - mentee_years[:, None] - 1) / 6, 0, 1)

        w = cfg.utility_weights
        utility = w["coverage"] * coverage + w["domain_fit"] * domain_fit + w["seniority_fit"] * seniority_fit
        utility = utility + rng.normal(0, cfg.utility_noise_sd, size=utility.shape)
        t = cfg.grade_thresholds
        grade = np.where(utility >= t["highly_relevant"], 2, np.where(utility >= t["somewhat_relevant"], 1, 0))

        mentee_ids = [m["mentee_id"] for m in mentee_latent]
        mentor_ids = [m["mentor_id"] for m in mentor_latent]
        return pd.DataFrame({
            "mentee_id": np.repeat(mentee_ids, len(mentor_ids)),
            "mentor_id": np.tile(mentor_ids, len(mentee_ids)),
            "coverage": coverage.ravel().round(4),
            "domain_fit": domain_fit.ravel(),
            "seniority_fit": seniority_fit.ravel().round(4),
            "utility": utility.ravel().round(4),
            "grade": grade.ravel(),
        })

    # ---------------------------------------------------------------- driver
    def generate(self) -> dict:
        cfg = self.cfg
        mentor_latent = [self._mentor_latent(i + 1) for i in range(cfg.n_mentors)]
        mentors = [self._mentor_observable(m) for m in mentor_latent]
        mentee_latent = [self._mentee_latent(i + 1) for i in range(cfg.n_mentees)]
        mentees = [self._mentee_observable(m) for m in mentee_latent]
        relevance = self._relevance(mentor_latent, mentee_latent)

        ids = [m.mentee_id for m in mentees]
        order = self.rng.permutation(len(ids))
        n_val = round(cfg.validation_fraction * len(ids))
        splits = {
            "validation": sorted(ids[i] for i in order[:n_val]),
            "test": sorted(ids[i] for i in order[n_val:]),
        }
        return {"mentors": mentors, "mentees": mentees, "mentor_latent": mentor_latent,
                "mentee_latent": mentee_latent, "relevance": relevance, "splits": splits}


def write_dataset(dataset: dict, out_dir: Path, config: SyntheticConfig) -> dict:
    out_dir = Path(out_dir)
    hidden = out_dir / "hidden"
    hidden.mkdir(parents=True, exist_ok=True)
    save_profiles(dataset["mentors"], out_dir / "mentors.json", out_dir / "mentors.csv")
    save_profiles(dataset["mentees"], out_dir / "mentees.json", out_dir / "mentees.csv")
    (out_dir / "splits.json").write_text(json.dumps(dataset["splits"], indent=2), encoding="utf-8")
    (hidden / "mentor_latent.json").write_text(json.dumps(dataset["mentor_latent"], indent=2), encoding="utf-8")
    (hidden / "mentee_latent.json").write_text(json.dumps(dataset["mentee_latent"], indent=2), encoding="utf-8")
    dataset["relevance"].to_csv(hidden / "simulated_relevance.csv", index=False)

    rel = dataset["relevance"]
    per_mentee = rel.groupby("mentee_id")["grade"]
    mentors, mentees = dataset["mentors"], dataset["mentees"]
    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "warning": "SIMULATED data and labels. Suitable for testing the pipeline and comparing methods under stated assumptions; NOT evidence of real-world mentorship relevance.",
        "config": asdict(config),
        "counts": {"mentors": len(mentors), "mentees": len(mentees), "pairs": len(rel),
                   "validation_mentees": len(dataset["splits"]["validation"]), "test_mentees": len(dataset["splits"]["test"])},
        "label_distribution": {str(k): int(v) for k, v in rel["grade"].value_counts().sort_index().items()},
        "per_mentee": {
            "mean_grade2_mentors": float(per_mentee.apply(lambda g: (g == 2).sum()).mean()),
            "mean_grade_ge1_mentors": float(per_mentee.apply(lambda g: (g >= 1).sum()).mean()),
            "mentees_without_grade2": int(per_mentee.apply(lambda g: (g == 2).sum() == 0).sum()),
        },
        "observable_missingness": {
            "mentor_text_missing": sum(not m.expertise_text for m in mentors),
            "mentor_tags_missing": sum(not m.can_mentor_in for m in mentors),
            "mentor_spec_missing": sum(m.specialisation is None for m in mentors),
            "mentee_text_missing": sum(not m.goals_text for m in mentees),
            "mentee_tags_missing": sum(not m.wants_to_learn for m in mentees),
            "mentee_spec_missing": sum(m.specialisation is None for m in mentees),
            "mentee_text_and_tags_missing": sum(not m.goals_text and not m.wants_to_learn for m in mentees),
        },
        "mentor_eligibility": {
            "unavailable": sum(not m.is_available for m in mentors),
            "no_consent": sum(not m.consent_given for m in mentors),
            "at_capacity": sum(m.current_mentees >= m.max_mentees for m in mentors),
        },
    }
    (hidden / "generation_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
