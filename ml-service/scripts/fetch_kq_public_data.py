"""Fetch public, organisational (non-personal) pages from Kenya Airways-related
websites and verify the curated domain vocabulary against those snapshots.

Usage:
    python scripts/fetch_kq_public_data.py fetch    # download text snapshots
    python scripts/fetch_kq_public_data.py verify   # check vocabulary evidence
    python scripts/fetch_kq_public_data.py          # both

Ethics / scope rules enforced here:
  * robots.txt is checked for every URL; disallowed URLs are skipped.
  * Requests are rate-limited (REQUEST_DELAY_SECONDS between requests).
  * Only organisational pages are listed (fleet, services, business units,
    training programmes). Pages about named individuals are never fetched.
  * No personal data is collected. The vocabulary is used only to make the
    synthetic profiles realistic.

Uses the Python standard library only.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "kq_public"
RAW_DIR = OUT_DIR / "raw"
MANIFEST_PATH = OUT_DIR / "sources_manifest.json"
VOCAB_PATH = OUT_DIR / "kq_domain_vocabulary.json"
REPORT_PATH = OUT_DIR / "provenance_report.md"

USER_AGENT = "DarajaConnect-StudentResearch/0.1 (academic capstone project; polite crawler)"
REQUEST_DELAY_SECONDS = 2.0
TIMEOUT_SECONDS = 30

KQ = "https://www.kenya-airways.com"
KQC = "https://corporate.kenya-airways.com"
PRESS = f"{KQC}/en/commitments-partnerships/corporate-responsibility/commitments/news-press-release"

# source_type: "primary" = published by Kenya Airways or IATA about the Pride Centre,
#              "secondary" = third-party directory (verify against the official source).
SOURCES = [
    {"id": "kq_fleet_overview", "url": f"{KQ}/en/experience/our-aircraft/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_b787_8", "url": f"{KQ}/en/experience/our-aircraft/boeing-787-8/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_b737_800", "url": f"{KQ}/en/experience/our-aircraft/boeing-737-800/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_b737_300f", "url": f"{KQ}/en/experience/our-aircraft/boeing-737-300f/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_e190", "url": f"{KQ}/en/experience/our-aircraft/embraer-e190/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_b777_300er", "url": f"{KQ}/en/experience/our-aircraft/boeing-777-300er/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_class_of_service", "url": f"{KQ}/en/experience/on-board/class-of-service/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_mro", "url": f"{KQC}/en/maintenance-repair-and-overhaul-mro/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_ground_handling", "url": f"{KQC}/en/ground-handling-services/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_group_brands", "url": f"{KQC}/en/about-us/kq-group-brands/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_alumni_network", "url": f"{KQC}/en/alumni-network/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_easa_part145", "url": f"{PRESS}/2025/january/kenya-airways-achieves-prestigious-easa-part-145-certification/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_ceiv_pharma", "url": f"{PRESS}/2023/may/kenya-airways-cargo-receives-iatas-ceiv-certification-for-pharmaceutical-logistics-excellence/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_iata_ground_handling", "url": f"{PRESS}/2023/november/kenya-airways-secures-iata-accreditation-for-ground-handling/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_ndc_amadeus", "url": f"{PRESS}/2025/april/kq-goes-live-with-ndc-content-in-amadeus/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_asante_rewards", "url": f"{PRESS}/2023/june/kenya-airways-unveils-new-asante-rewards-loyalty-program-to-reward-customers/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_fahari_drones", "url": f"{PRESS}/2023/september/fahari-aviation-scales-up-service-offering-with-additional-high-capacity-drones-for-precision-farming/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "kq_press_saf", "url": f"{PRESS}/2023/may/kq-to-pilot-use-of-sustainable-aviation-fuel-during-the-sustainable-flight-challenge/", "publisher": "Kenya Airways", "source_type": "primary"},
    {"id": "iata_rtp_pride_centre", "url": "https://www.iata.org/en/training/courses/classroom-training-centers/rtp/kq/", "publisher": "IATA", "source_type": "primary"},
    {"id": "kenyaplex_pride_centre_courses", "url": "https://www.kenyaplex.com/colleges/courses/631", "publisher": "Kenyaplex (third-party directory)", "source_type": "secondary"},
]

# Deliberately NOT fetched (documented in data/kq_public/SOURCES.md):
EXCLUDED = [
    {"url": "https://www.kqpridecentre.com/", "reason": "robots.txt disallows all crawlers (Disallow: /). Verify programme names manually in a browser."},
    {"url": "https://kqalumni.kenya-airways.com/", "reason": "Registration application marked noindex; handles personal data."},
    {"url": "https://careers.kenya-airways.com/", "reason": "JavaScript application with no static content; job adverts are not needed."},
    {"url": f"{PRESS}/2023/kq/ (staff story pages)", "reason": "Pages about named individuals (personal data)."},
]

# Note: <form> is not skipped because ASP.NET sites wrap the whole page body in one.
_SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header"}
_BLOCK_TAGS = {"p", "br", "li", "h1", "h2", "h3", "h4", "h5", "div", "tr", "td", "th", "section", "article"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip_depth:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    seen: set[str] = set()
    lines: list[str] = []
    for line in "".join(parser.parts).split("\n"):
        line = re.sub(r"\s+", " ", line.replace("​", "")).strip()
        if line and line not in seen:
            seen.add(line)
            lines.append(line)
    return "\n".join(lines)


def normalise_for_match(text: str) -> str:
    text = text.replace("​", "").replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip().lower()


_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}


def robots_allows(url: str) -> bool:
    parts = urlparse(url)
    base = f"{parts.scheme}://{parts.netloc}"
    if base not in _robots_cache:
        # Download robots.txt with our own User-Agent. RobotFileParser.read() uses
        # Python's default agent, which some sites answer with 403, and the parser
        # then treats the whole site as disallowed.
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(f"{base}/robots.txt", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                rp.parse(resp.read().decode("utf-8", "replace").splitlines())
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                rp = None  # access to robots.txt refused: be conservative
            else:
                rp.parse([])  # no robots.txt (e.g. 404): crawling is not restricted
        except (urllib.error.URLError, TimeoutError):
            rp = None  # unreachable: be conservative
        _robots_cache[base] = rp
    rp = _robots_cache[base]
    return bool(rp and rp.can_fetch(USER_AGENT, url))


def fetch() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    failures = 0
    for i, src in enumerate(SOURCES):
        if i:
            time.sleep(REQUEST_DELAY_SECONDS)
        record = {**src, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        if not robots_allows(src["url"]):
            record.update(status="skipped_robots_disallowed")
            print(f"SKIP (robots) {src['id']}")
            manifest.append(record)
            continue
        try:
            req = urllib.request.Request(src["url"], headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                html = resp.read().decode("utf-8", "replace")
                record["http_status"] = resp.status
        except (urllib.error.URLError, TimeoutError) as exc:
            record.update(status="error", error=str(exc))
            print(f"ERROR {src['id']}: {exc}")
            failures += 1
            manifest.append(record)
            continue
        text = html_to_text(html)
        header = f"# source_id: {src['id']}\n# url: {src['url']}\n# publisher: {src['publisher']}\n# fetched_at: {record['fetched_at']}\n\n"
        (RAW_DIR / f"{src['id']}.txt").write_text(header + text, encoding="utf-8")
        record.update(status="ok", chars=len(text), sha256=hashlib.sha256(text.encode("utf-8")).hexdigest())
        print(f"OK   {src['id']} ({len(text)} chars)")
        manifest.append(record)
    MANIFEST_PATH.write_text(json.dumps({"sources": manifest, "excluded": EXCLUDED}, indent=2), encoding="utf-8")
    print(f"Manifest written to {MANIFEST_PATH.relative_to(ROOT)}")
    return failures


def _iter_evidence(node, path=""):
    """Yield (path, label, evidence) for every item carrying an 'evidence' list."""
    if isinstance(node, dict):
        if "evidence" in node:
            yield path, node.get("name") or node.get("value") or path, node["evidence"]
        for key, value in node.items():
            if key != "evidence":
                yield from _iter_evidence(value, f"{path}.{key}" if path else key)
    elif isinstance(node, list):
        for idx, value in enumerate(node):
            yield from _iter_evidence(value, f"{path}[{idx}]")


def verify() -> int:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    snapshots = {p.stem: normalise_for_match(p.read_text(encoding="utf-8")) for p in RAW_DIR.glob("*.txt")}
    rows, failures = [], 0
    for path, label, evidence in _iter_evidence(vocab):
        for ev in evidence:
            text = snapshots.get(ev["source"])
            ok = text is not None and normalise_for_match(ev["quote"]) in text
            failures += not ok
            rows.append((label, ev["source"], ev["quote"], "PASS" if ok else ("MISSING SNAPSHOT" if text is None else "FAIL")))
    lines = [
        "# Provenance report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        "Each vocabulary item's quote is checked against the saved text snapshot of its source page.",
        "",
        f"**{len(rows) - failures} of {len(rows)} evidence quotes verified.**",
        "",
        "| Item | Source | Quote | Result |",
        "|---|---|---|---|",
    ]
    lines += [f"| {label} | `{src}` | {quote} | {res} |" for label, src, quote, res in rows]
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(rows) - failures}/{len(rows)} evidence quotes verified -> {REPORT_PATH.relative_to(ROOT)}")
    return failures


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    mode = argv[1] if len(argv) > 1 else "all"
    failures = 0
    if mode in ("fetch", "all"):
        failures += fetch()
    if mode in ("verify", "all"):
        failures += verify()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
