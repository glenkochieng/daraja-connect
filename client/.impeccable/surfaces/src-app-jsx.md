---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: []
---

# Surface brief: Daraja Connect web app

## Scope and mode

The whole authenticated web app plus sign-in and registration. Mode: **Operate**. Desktop first (1280–1600), phone layouts must work.

## Audience, job, task

Pride Centre alumni find and request mentors; current and former Kenya Airways staff answer requests within their capacity; all members use the directory, knowledge repository, events and updates; admins approve members, moderate articles and publish events and updates.

## Constraints

Independent student prototype: no Kenya Airways logo, colours or slogans. Sample data labelled. English only. WCAG 2.2 AA. Plain CSS with tokens, no UI library.

## Direction contract

THESIS: The platform is a terminal you move through by signs. Each module is a concourse with its own letter; a "you are here" location sign marks where you stand; people, requests, articles and events are listed on boards the way a terminal lists departures. It refuses the professional-network card feed: avatars in white cards, a blue accent and a left sidebar.

OWN-WORLD: Terminal-floor off-white ground; near-black sign panels carrying directional yellow lettering and arrows; the location sign inverts to black on yellow. Green appears only with the word "available" or "accepted". One wayfinding face (Signika) carries everything, with tabular figures. Pictograms are authored SVG in one stroke weight, and an arrow always leads its text. Sign corners are small; hairline rules divide board rows; there are no cards.

STORY: A Pride Centre graduate signs in, sees where they are, follows the Mentorship sign, reads a ranked board of mentors with the reasons in plain words, sends a request and watches its status on their own board. A mentor reads the board of incoming requests and accepts within capacity. Everyone else finds people, articles, events and updates by following the signs.

FIRST VIEWPORT: Mentorship for a mentee at 1440×900. A full-width sign band (about 64px): the wordmark on the left, then five module signs, each a letter tile, pictogram and name; the current module is the yellow location panel. Below it, a location header: a 56px yellow concourse tile "M", "Mentorship" at about 40px, and one status line. The main two-thirds holds the "Recommended mentors" board: five rows, each with a tabular rank numeral, name and role, the reasons as plain lines, places left, and the primary action "Request →". The right third holds a dark "Your requests" status board with status words.

FORM: Terminal Wayfinding (airport wayfinding sign systems), position 1 on my ordered list (chosen as IMPECCABLE'S PICK over the assigned candidate 7), seed key 2ee01420. Code-led: no image generation this session. Signature interaction: on navigation the yellow location panel slides along the sign band to the new module (View Transitions), and arrows step forward on hover and focus. A status that changes on a board flips once, like a split-flap cell.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Kiswahili translation (out of scope; keep copy centralised).
- Real member photos: none exist; members carry initials tiles, never stock faces.
