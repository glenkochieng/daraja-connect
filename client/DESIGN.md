---
name: Daraja Connect
description: A mentorship and community network for Pride Centre alumni and Kenya Airways staff, signed like an airport terminal.
colors:
  sign-black: "#16181b"
  sign-raised: "#24282c"
  sign-rule: "#343a40"
  sign-text: "#f2f1ec"
  sign-text-2: "#b8bcbf"
  directional-yellow: "#f2c230"
  directional-yellow-hover: "#ffd34d"
  go-green: "#1c6a46"
  stop-red: "#9a2c1b"
  stop-wash: "#f6e2dc"
  wait-olive: "#6b5200"
  terminal-floor: "#ecede9"
  board-panel: "#fafaf7"
  board-panel-hover: "#f1f2ee"
  board-panel-sunk: "#e3e4df"
  field-white: "#ffffff"
  ink: "#16181b"
  ink-2: "#474c52"
  ink-3: "#62686e"
  rule: "#cdd0ca"
  rule-strong: "#80868b"
typography:
  display:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  tile:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
  title:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
  title-sm:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  reading:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  group-label:
    fontFamily: "Signika Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
rounded:
  sign: "3px"
  tile: "2px"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s5: "1.5rem"
  s6: "2rem"
  s7: "3rem"
  s8: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-text}"
    typography: "{typography.button}"
    rounded: "{rounded.sign}"
    padding: "0 1rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.sign-raised}"
    textColor: "{colors.sign-text}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sign}"
    padding: "0 1rem"
    height: "2.75rem"
  button-secondary-hover:
    backgroundColor: "{colors.board-panel-hover}"
  button-yellow:
    backgroundColor: "{colors.directional-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sign}"
    padding: "0 1rem"
    height: "2.75rem"
  button-yellow-hover:
    backgroundColor: "{colors.directional-yellow-hover}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.stop-red}"
    typography: "{typography.button}"
    rounded: "{rounded.sign}"
    height: "2.75rem"
  button-danger-hover:
    backgroundColor: "{colors.stop-wash}"
  button-small:
    padding: "0 0.75rem"
    height: "2.25rem"
  input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sign}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  sign-band:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-text}"
    height: "4rem"
  location-sign:
    backgroundColor: "{colors.directional-yellow}"
    textColor: "{colors.ink}"
  letter-tile:
    backgroundColor: "{colors.directional-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.tile}"
    rounded: "{rounded.sign}"
    size: "3.5rem"
  board:
    backgroundColor: "{colors.board-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sign}"
    padding: "1rem 1.5rem"
  board-departures:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-text}"
    rounded: "{rounded.sign}"
    padding: "1rem 1.5rem"
  tag:
    backgroundColor: "{colors.board-panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0.125rem 0.5rem"
  tag-chosen:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sign-text}"
  tag-shared:
    backgroundColor: "{colors.directional-yellow}"
    textColor: "{colors.ink}"
  status-available:
    backgroundColor: "{colors.go-green}"
    textColor: "{colors.field-white}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0.125rem 0.5rem"
  status-going:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sign-text}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0.125rem 0.5rem"
  status-going-departures:
    backgroundColor: "{colors.directional-yellow}"
    textColor: "{colors.ink}"
  status-published:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0.125rem 0.5rem"
  initials:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sign-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sign}"
    size: "2.5rem"
---

# Design System: Daraja Connect

## Overview

**Creative North Star: "Terminal Wayfinding"**

The platform is a terminal you move through by signs. A near-black sign band runs across the top; each module is a concourse with its own letter tile and pictogram; the module you are in inverts to a black-on-yellow "you are here" location sign. Under the band, a location header repeats the concourse letter as a large yellow tile beside the module name and one plain status line. Everything below is a board: people, requests, articles and events are listed on hairline-ruled rows the way a terminal lists departures, with dark departures boards for things in motion.

Density is operational, not editorial. Rows carry tabular numerals, plain-language reasons and a single status word; there are no hero images, no decorative illustration and no cards. One wayfinding face carries every role, and authored stroke pictograms do the work icons would do elsewhere. Motion is short and stateful only: the location sign slides along the band between modules, arrows step forward on hover and focus, and a status that changes flips once like a split-flap cell.

The world refuses the professional-network card feed: avatars in white cards, a blue accent and a left sidebar. Members carry initials tiles, never photographs or stock faces.

**Key Characteristics:**
- Near-black sign panels with directional yellow; light boards on a terrazzo-grey floor.
- A black-on-yellow "you are here" location sign in the band and a yellow concourse letter tile in the location header.
- Boards with hairline-ruled rows instead of cards; dark departures boards for live status.
- One face (Signika Variable) with tabular figures everywhere.
- Status is always a word plus a pictogram plus a line type; colour is never the only signal.
- Arrows lead link text and trail action buttons.

## Colors

A sign-system palette: one near-black, one directional yellow, three meaning colours that only ever appear with a word, and a quiet run of warm greys.

### Primary
- **Sign Black** (sign-black / ink): the sign band, departures boards, primary buttons, chosen tags, initials tiles, the `going` status on light boards, and all body text. Accept, Approve and Publish are sign-black primaries.
- **Sign Raised** (sign-raised): hover on band signs and dark rows; the wall signs on the sign-in screen; message wells inside dark boards.
- **Sign Rule** (sign-rule): dividers between band signs and between rows on dark boards.
- **Sign Text / Sign Text 2** (sign-text, sign-text-2): primary and secondary text on dark panels (sign-text-2 holds 9.6:1 on sign black).

### Secondary
- **Directional Yellow** (directional-yellow): letter tiles, the location sign, the location-header concourse tile, arrows, pictograms and date numerals on dark boards, the departures-board header rule, shared-topic tags, the count badge, the current step numeral, the yellow action button, and text selection. Hover lifts to **Bright Yellow** (directional-yellow-hover).

### Tertiary
- **Go Green** (go-green): the fill of the `available` and `accepted` status signs, with white text (6.6:1 on panel). Nothing else.
- **Stop Red** (stop-red): field errors, the danger button outline, the `Not published` status, and error notices on a **Stop Wash** (stop-wash) ground.
- **Wait Olive** (wait-olive): the dashed line and pictogram of pending status signs and wait notices on light boards.

### Neutral
- **Terminal Floor** (terminal-floor): the page ground, the sticky save bar, and scrollbar tracks.
- **Board Panel** (board-panel): light board surface; **Board Panel Hover** (board-panel-hover) for row hover and the filter strip inside a board; **Board Panel Sunk** (board-panel-sunk) for inset wells (request forms, message quotes, topic picker groups, admin forms, score-bar tracks, skeleton lines).
- **Field White** (field-white): input fields and the checked choice tile, so a field reads as a slot cut into the board.
- **Ink 2** (ink-2): secondary text, location status lines, board notes (7.4:1 on floor).
- **Ink 3** (ink-3): tertiary text, hints, placeholders, metadata, the sample tag (5.2:1 on panel).
- **Rule** (rule): hairlines between board rows and the 1px board outline.
- **Rule Strong** (rule-strong): control borders on inputs, tags and choice tiles (3.6:1 on panel).

### Named Rules
**The Green Means Go Rule.** Green appears only with the words "available" or "accepted" ("4 places available", "Available to mentor", "Accepted"). Buttons are never green; success notices are neutral with a check pictogram.

**The Directional Yellow Rule.** Yellow appears only on sign panels (dark band, dark boards, sign wall) or as a panel carrying black text: letter tiles, the location sign, arrows and numerals on dark boards, shared-topic tags, the count badge. Never yellow text or a yellow pictogram on a light board, and never a pale yellow wash.

**The Dashed Wait Rule.** Pending and waiting states are drawn with a dashed line: dashed wait-olive on light boards, dashed yellow on dark boards. There is no yellow wash panel.

## Typography

**Display Font:** Signika Variable (with Segoe UI, system-ui, sans-serif)
**Body Font:** Signika Variable (same stack)

**Character:** A single humanist wayfinding face, self-hosted, carries everything from the 40px location sign to 13px metadata. Hierarchy comes from size and weight (400, 500, 600, 700), never from a second family. Tabular figures are on globally, so ranks, counts, dates and admin figures line up in columns.

### Hierarchy
- **Display** (600, 2.5rem, 1.2, -0.01em): the location-header module name only. Drops to 2rem below 56rem.
- **Tile** (700, 2.25rem, 1): the concourse letter in the location-header tile; 1.875rem below 56rem. Smaller letter tiles use the same weight at 0.875rem (band) and 1.375rem (wall signs, destination rows).
- **Headline** (600, 1.75rem, 1.2): the sign-in and registration title; rank numerals on recommendation rows and day numerals on departure rows. The mentor capacity figure and admin waiting counts go to 3rem in yellow on dark boards.
- **Title** (600, 1.375rem, 1.2): board titles (always led by a pictogram), update titles, admin figures.
- **Title Small** (600, 1.125rem): names on recommendation and destination rows, article titles, empty-state titles.
- **Body** (400, 1rem, 1.5): everything else; prose capped at 68ch, article summaries at 72ch.
- **Reading** (400, 1.0625rem, 1.65): the article reading view only.
- **Button** (600, 0.9375rem, 1.2): buttons and band signs (band signs at 500).
- **Label** (600, 0.875rem): field labels, status signs, tags.
- **Group Label** (600, 0.8125rem, 0.06em, uppercase): topic-group names in the picker, figure-group headings on the admin board, and the month under a date numeral (0.08em). It names the group it sits on; it never sits above a headline.

### Named Rules
**The One Face Rule.** Signika Variable is the only family. Do not add a display or mono face.

**The Tabular Rule.** Figures are tabular everywhere (`font-variant-numeric: tabular-nums` on body); numbers that are compared sit right-aligned or in a fixed column.

## Layout

Content is centred in an 82rem column with a 2rem gutter (1rem below 56rem). Spacing runs on a 4px base: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4rem. Boards stack with a 2rem gap; rows pad 1rem by 1.5rem.

Every module screen has the same three tiers: the 4rem sticky sign band, the location header (tile, title, one status line, optional actions to the right), then the page. The page's main split is two-thirds board to one-third departures board (`2fr / minmax(18rem, 1fr)`), collapsing to one column below 64rem. Sign-in is a two-column sign wall (dark wall of module signs left, form right) that stacks below 56rem and drops the wall signs below 40rem so the form comes first.

Responsive band:
- Below 86rem the signs tighten their padding.
- Below 80rem the module signs and account fold into a menu drawer, but the current module stays in the band as the black-on-yellow location sign.
- Below 30rem the wordmark tightens; beside a location sign the word "Menu" is screen-reader only.
- Below 360px (22.4rem), on module screens only, the wordmark text is screen-reader only; Home keeps the name.

Rows reflow below 40rem: the trailing aside column (status, actions, places) drops under the main text, aligned to the text column.

### Named Rules
**The Board Not Card Rule.** Content sits on boards with hairline-ruled rows. Filter forms are the control strip inside the board they filter, not a separate panel. Admin figures are label-left, tabular-figure-right rows on hairlines.

**The One Status Line Rule.** The location header carries one status line. Profile gaps appear there as a single arrow link ("→ Add your skills"), never as a nudge banner or a completeness count.

## Elevation & Depth

The system is flat. Light boards are separated from the floor by a 1px rule-coloured outline (`box-shadow: 0 0 0 1px` rule) and a tonal step from floor to panel; dark departures boards need no outline. Board headers carry a 2px rule in ink (yellow on dark boards) that reads like the top edge of a sign. Inset wells use the sunk panel tone, not shadow. The sign band and save bar are sticky, distinguished by colour and a 2px ink top rule, not by a drop shadow.

### Named Rules
**The Flat Terminal Rule.** No drop shadows on boards, rows, buttons or the band. Depth is tone and rule weight.

## Shapes

Corners are small and sign-like: 3px on boards, buttons, inputs, tiles, notices and initials; 2px on tags, status signs, small letter tiles, the count badge and step numerals. Nothing is pill-shaped or circular. Lines carry meaning: a hairline divides rows, a 2px ink rule caps a board header, a 1.5px border outlines controls, a dashed line means waiting (and the dashed 1px "Sample" tag means synthetic data). Pictograms are authored SVG on a 24px grid with one 2px round-joined stroke.

## Components

### Buttons
Squared, confident, ink-led; an action ends with its arrow.
- **Shape:** sign corners (3px), 2.75rem tall, 1rem side padding; small buttons 2.25rem.
- **Primary:** sign black with sign-text, a yellow trailing arrow. Used for Request, Accept, Approve, Publish and every committing action.
- **Secondary:** transparent with a 1.5px ink border; on dark boards the border is sign-text-2.
- **Yellow:** directional yellow with ink text, for reserving a place and editing your own profile on dark boards.
- **Danger:** transparent with a stop-red border, stop-wash on hover.
- **Quiet:** an underlined text button.
- **Hover / Focus:** primary lifts to sign-raised; the trailing arrow steps 3px right on hover and focus. Focus is a 3px ink outline at 2px offset (yellow inside the band and dark boards). Disabled is 50% opacity.

### Status Signs
A word, a pictogram and a line type; colour never stands alone.
- **Available / Accepted:** go-green fill, white text, check pictogram.
- **Going** (you hold an event place): ink fill on light boards, black on yellow on dark boards, like the location sign.
- **Published / Completed:** ink-outlined, ink text (a light sign-text outline on dark boards).
- **Pending:** dashed line (wait-olive on light boards, yellow on dark boards) with a clock pictogram.
- **Declined / Withdrawn:** rule-strong outline, ink-3 text, struck through. **Full:** the same outline without the strike. **Not published:** stop-red outline.
- **Change:** a status that changes flips once (rotateX from -90deg over 240ms).

### Tags
- **Style:** board-panel ground, 1px rule-strong border, 2px corners, 0.875rem.
- **State:** chosen or pressed tags invert to ink with sign-text; a topic the viewer shares is a yellow tag with an ink border and 600 weight (plus screen-reader text "you share this").

### Boards
- **Corner Style:** 3px.
- **Background:** board-panel on the floor; departures boards in sign black.
- **Shadow Strategy:** none; a 1px rule outline on light boards (see Elevation & Depth).
- **Header:** pictogram-led title at 1.375rem, optional note at right, 2px ink rule beneath (yellow on departures boards).
- **Rows:** 1rem by 1.5rem, hairline between rows; linked rows tint on hover. Footers carry a leading-arrow link ("→ All events").

### Inputs / Fields
- **Style:** field-white, 1.5px rule-strong border, 3px corners, 2.75rem tall; label above at 600 0.875rem, hint below in ink-3.
- **Focus:** border goes to ink plus the 3px ink focus outline. Hover darkens the border to ink-2.
- **Error:** stop-red border and an alert pictogram leading the error text.
- **Choice tiles:** radio cards on the panel; checked turns field-white with a doubled 1.5px ink border.

### Navigation
- **Sign band:** 4rem sticky sign-black band. Wordmark (a yellow tile carrying an arrow pictogram, then "Daraja Connect" at 600) left; module signs each a 1.625rem yellow letter tile, pictogram and name, divided by sign-rule lines; account initials and sign-out right.
- **Location sign:** the current module inverts to yellow with ink text and an ink letter tile carrying yellow; it is the view-transition element that slides along the band (240ms ease-out).
- **Tabs:** underline tabs within a page, 3px ink underline on the current tab.
- **Mobile:** see Layout; the drawer lists signs at 3.25rem rows.

### Location Header
A 3.5rem yellow concourse tile (3rem below 56rem) carrying the module letter, the display-size module name, and one ink-2 status line at 1.125rem that may end with a single arrow link in ink.

### Notices
Neutral panel with a rule outline and a leading 22px pictogram. Success is neutral with a check. Wait notices drop the outline for a 1.5px dashed wait-olive border. Errors sit on stop-wash with a 1px stop-red outline and a stop-red pictogram.

### Initials Tiles
Members are shown as ink initials tiles (2.5rem; 4rem large; 2rem small), never photographs. In the band they sit on sign-raised with a sign-rule inset line.

## Do's and Don'ts

### Do:
- **Do** use green only with the words "available" or "accepted".
- **Do** make Accept, Approve and Publish sign-black primary buttons with a trailing arrow ("Request →").
- **Do** lead link text with its arrow in board footers and the status line ("→ All events", "→ Add your skills").
- **Do** draw pending and waiting states with a dashed line.
- **Do** keep yellow on sign panels or as a panel carrying black text.
- **Do** sign a held event place as `going`: ink on light boards, black on yellow on dark boards; sign "Published" with an ink outline.
- **Do** put content on boards with hairline-ruled rows, filters as the board's own control strip, and admin figures as label-left, tabular-figure-right rows.
- **Do** keep the current module visible as the black-on-yellow location sign at every width, even when the other signs fold into the menu.
- **Do** zero the view-transition and status-flip durations under reduced motion.
- **Do** pair every status and notice with a word and a pictogram.

### Don't:
- **Don't** make a button green, or use a green success notice.
- **Don't** use cards, avatars in white cards, a blue accent or a left sidebar.
- **Don't** use a yellow wash panel, or yellow text or pictograms on a light board.
- **Don't** show profile gaps as a nudge banner or a completeness count.
- **Don't** add drop shadows to boards, rows, buttons or the band.
- **Don't** add a second typeface or round anything into a pill.
- **Don't** show member photographs or stock faces; use initials tiles.
- **Don't** use Kenya Airways logos, colours or slogans.
