# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Pride Centre alumni (mentees).** Graduates of the Kenya Airways Pride Centre training programmes (cabin crew, flight dispatch, passenger services, weight and balance, dangerous goods, cargo, aviation security, maintenance engineering, business courses). Early in their aviation careers, often career-switching between departments. Their job: find the right mentor, ask for help, and learn from people who have done the work.
- **Current and former Kenya Airways staff (mentors).** Engineers, pilots, dispatchers, cabin crew, ground and cargo specialists, safety and commercial staff, some retired or now independent consultants. Their job: decide which mentees to take on within their capacity, share knowledge, and stay connected to the airline community.
- **Administrators.** Approve registrations, moderate knowledge articles, and publish events and organisational updates.

## Product Purpose

Daraja Connect ("daraja" is Kiswahili for "bridge") connects Pride Centre alumni with current and former Kenya Airways staff. It has five modules: networking hub (member directory and connections), mentorship (ranked mentor recommendations and a request workflow), knowledge repository (moderated articles), events calendar (RSVPs), and an organisational updates feed. Success means a mentee reaches a suitable mentor quickly, the mentor can see why the match was suggested, and expertise is captured before it leaves with departing staff.

## Positioning

Mentor suggestions come from a content-based recommender (TF-IDF text similarity, skill-topic similarity and a specialisation match) that explains every match in plain language ("Can mentor in: Dangerous goods regulations · Same specialisation: Cargo & Logistics"). It also brings Pride Centre graduates into the same network as staff. Kenya Airways' own KQ Alumni Network (launched 14 November 2025) serves former employees and does not describe structured matching or include Pride Centre graduates.

## Operating Context

- Mostly used on desktop and laptop (office PCs, home laptops); phone layouts must still work.
- Every new account is reviewed by an administrator before it can use community features; pending members can only sign in and edit their profile.
- Recommendations depend on a separate Python matching service; when it is down, the rest of the platform keeps working and the mentorship screen must say so plainly.
- Final-year capstone (BSc Informatics and Computer Science, Strathmore University), demonstrated to supervisors and assessors this term.

## Capabilities and Constraints

- Stack already decided by the project: React (Vite) client, Express REST API, MongoDB, Python ML service. The API contract lives in `server/src/routes/`.
- Plain CSS with design tokens; no UI component library.
- English only. Keep user-facing text easy to find so translation (e.g. Kiswahili) can be added later; it is not in scope now.
- Mentees are Pride Centre alumni only; mentors are current or former staff only.
- Mentor capacity, availability and consent filters are enforced by the ML service and API; the UI explains outcomes rather than re-implementing them.
- Email addresses are shown only to the member themselves, admins, accepted connections and accepted mentorship pairs (Kenya Data Protection Act, 2019).
- Articles, events and updates are plain text, never HTML.
- Topics, specialisations and Pride Centre programmes come from `GET /api/meta/taxonomy` (57 topics, 8 specialisations, 20 programmes); the UI never hard-codes them.

## Brand Commitments

- Name: **Daraja Connect**.
- Independent student prototype. Kenya Airways and the Pride Centre are named in text only. **No Kenya Airways logo, colours, slogans ("Pride of Africa") or other brand assets.** The footer states that this is a student capstone prototype, not an official Kenya Airways service.
- Voice: calm, plain, respectful of experience; professional rather than playful.

## Evidence on Hand

- Synthetic sample data only: 160 mentors and 300 mentees (`ml-service/data/synthetic/`), plus sample articles, events and updates (`server/src/seed/sampleContent.js`). The API marks these `isSample` / `sample: true`; the UI must label them as samples.
- Verified public facts about Kenya Airways (fleet, services, programmes) in `ml-service/data/kq_public/kq_domain_vocabulary.json`.
- No real testimonials, member counts, partner logos or outcome statistics exist. Do not invent any.

## Product Principles

1. **Explain every match.** A recommendation without its reasons is not shown.
2. **Capacity is respect.** Never push a mentee towards a mentor who has no space; make availability visible.
3. **Privacy by default.** Contact details appear only after both sides agree.
4. **Honest data.** Sample content is always labelled; nothing implies real people or official endorsement.
5. **Degrade gracefully.** If matching is unavailable, the network, knowledge, events and updates still work.

## Accessibility & Inclusion

Target WCAG 2.2 AA: full keyboard operation with visible focus, labelled form controls, colour contrast of at least 4.5:1 for text, and no information conveyed by colour alone. Members range from recent graduates to retired engineers, so text must stay readable at default browser zoom and when enlarged.
