# Kenya Airways public sources

The vocabulary in `kq_domain_vocabulary.json` comes from public, organisational web pages.
It makes the synthetic profiles realistic; it is **not** data about real people.

## How the pages were collected

`scripts/fetch_kq_public_data.py`:

* checks each site's `robots.txt` (downloaded with the crawler's own User-Agent) and skips anything disallowed
* waits 2 seconds between requests and identifies itself as a student research crawler
* saves the visible text of each page to `raw/<source_id>.txt`, with the URL and fetch time
* records status, size and a SHA-256 hash per page in `sources_manifest.json`

`python scripts/fetch_kq_public_data.py verify` confirms that every quote in the vocabulary file
still appears in its snapshot, and writes `provenance_report.md`.

## Sources used

| Publisher | Pages | Used for |
|---|---|---|
| Kenya Airways (kenya-airways.com) | Our Aircraft + 5 aircraft pages, Class of Service | Fleet types, engines, Premier World cabin |
| Kenya Airways (corporate.kenya-airways.com) | MRO, Ground Handling Services, KQ Group Brands, KQ Alumni Network | Service areas, business units, approvals, alumni network facts |
| Kenya Airways press releases | EASA Part-145 (Jan 2025), CEIV Pharma (May 2023), ISAGO accreditation (Nov 2023), NDC/Amadeus (Apr 2025), Asante Rewards (Jun 2023), Fahari Aviation drones (Sep 2023), SAF (May 2023) | Approvals, cargo, commercial and innovation topics |
| IATA | Regional Training Partner page for the Kenya Airways Pride Centre | IATA courses delivered at the Pride Centre |
| Kenyaplex (third-party directory) | Courses offered at Kenya Airways Limited Pride Centre | Pride Centre programme names (**secondary source**; verify on the official site) |

## Deliberately not collected

| Site | Reason |
|---|---|
| kqpridecentre.com | `robots.txt` disallows all crawlers. Check the programme list manually in a browser and update the vocabulary if it has changed. |
| kqalumni.kenya-airways.com | Alumni registration application (`noindex`), handles personal data. |
| careers.kenya-airways.com | JavaScript application with no static content; job adverts were not needed. |
| Staff story pages in the press room | About named individuals. |

## Finding relevant to the proposal

Kenya Airways launched the **KQ Alumni Association / KQ Alumni Network** on 14 November 2025
("Once KQ, Always KQ"). Its page lists mentorship, networking, events and job boards among its
benefits for former colleagues. This contradicts the proposal's claim that no institutionally
endorsed alumni platform exists. The page does not mention Pride Centre graduates or say how
mentors and mentees would be matched, which is where this project can position itself.

## Citing in the report

Cite each page you rely on with its URL and the fetch date in `sources_manifest.json`, e.g.

> Kenya Airways. (n.d.). *KQ Alumni Network*. Retrieved 17 September 2026, from https://corporate.kenya-airways.com/en/alumni-network/
