# Architecture

How Daraja Connect is put together, why, and what is deliberately left for later.

## 1. Requirements

**Functional**

- Pride Centre graduates (mentees) register, wait for approval, complete a profile and receive ranked mentor recommendations with the reasons in plain words. They send requests and follow their status.
- Current and former Kenya Airways staff (mentors) answer requests within a capacity they set, and can pause availability.
- Every approved member uses the networking hub (directory, connections), the knowledge repository (articles with moderation), the events calendar (RSVP with capacity) and the updates feed.
- Administrators approve registrations, moderate articles, publish events and updates, and see platform counts.

**Non-functional**

- **Privacy:** email addresses are personal data. They are shown only to the member, to administrators, and to people with an accepted connection or mentorship. Registration requires explicit consent to profile processing.
- **Explainability:** each recommendation carries per-block scores and plain-language reasons.
- **Graceful degradation:** if the matching service is down, only recommendations stop; the rest of the platform keeps working.
- **Accessibility:** WCAG 2.2 AA (labels, focus, contrast, status never shown by colour alone).
- **Runs locally on Windows** with no cloud credentials (in-memory MongoDB, seeded sample data).
- **Scale:** a pilot community of hundreds to a few thousand members. Recommendations must return in well under a second for a pool of a few hundred mentors.

**Constraints**

- Solo final-year student, one semester; a working end-to-end system matters more than breadth.
- The recommender was built and evaluated first, in Python, so it stays in Python.
- Independent prototype: no Kenya Airways branding; all development data synthetic.

## 2. Components

```
                        ┌──────────────────────── Browser ─────────────────────────┐
                        │ React client (Vite)                                       │
                        │ React Router · TanStack Query · design tokens in CSS      │
                        └───────────────┬──────────────────────────────────────────┘
                                        │ HTTPS, JSON, Bearer JWT   (/api/*)
                        ┌───────────────▼──────────────────────────────────────────┐
                        │ Express API (Node.js 24)                                  │
                        │  routes: auth · profile · users · mentorship · directory  │
                        │          connections · articles · events · updates ·      │
                        │          admin · meta · health                            │
                        │  lib: auth (JWT, roles, approval) · validate (Zod) ·      │
                        │       errors · serialize (privacy) · mlClient · taxonomy  │
                        └───────┬───────────────────────────────┬──────────────────┘
                                │ Mongoose                      │ HTTP JSON (private)
                        ┌───────▼─────────┐            ┌────────▼─────────────────────┐
                        │ MongoDB         │            │ Matching service (FastAPI)    │
                        │ users, requests,│            │  POST /recommendations        │
                        │ recommendations,│            │  GET  /taxonomy  /health      │
                        │ connections,    │            │  ContentRecommender:          │
                        │ articles,       │            │   TF-IDF text + topic tags +  │
                        │ events, rsvps,  │            │   specialisation, filters,    │
                        │ updates         │            │   reasons                     │
                        └─────────────────┘            └──────────────────────────────┘
```

| Component | Responsibility | Does not do |
|---|---|---|
| Client | Screens, navigation, forms, data fetching with caching and invalidation | Business rules (the API decides eligibility, privacy and capacity) |
| API | Identity, roles and approval; validation; all persistence; privacy of contact details; capacity and RSVP integrity; calling the matcher; logging recommendations | Similarity scoring |
| Matching service | Eligibility filters, scoring, ranking, reasons, the topic taxonomy | Storage, identity, anything user-facing |
| MongoDB | Durable state | – |

## 3. Data flow: a mentee asks for recommendations

```
Client                         API                                   Matching service
  │ GET /api/mentorship/         │                                          │
  │     recommendations?k=5      │                                          │
  │ ───────────────────────────► │ requireAuth, requireApproved, isMentee   │
  │                              │ load approved mentors + open requests    │
  │                              │ POST /recommendations                    │
  │                              │  { mentee, mentors[], k,                 │
  │                              │    exclude_mentor_ids }                  │
  │                              │ ───────────────────────────────────────► │
  │                              │                                          │ filters, scores,
  │                              │                                          │ ranks, reasons
  │                              │ ◄─────────────────────────────────────── │
  │                              │ { status, config_version, results[] }    │
  │                              │ insert Recommendation docs (batchId)     │
  │                              │ attach mentor cards                      │
  │ ◄─────────────────────────── │ { status, batchId, items[] }             │
  │ POST /api/mentorship/requests│                                          │
  │  { mentorId, recommendationId, message }                                │
  │ ───────────────────────────► │ checks: mentor approved and available,   │
  │                              │ has capacity, no open request, the       │
  │                              │ recommendation belongs to this pair      │
```

Accepting a request reserves a place with a conditional update (`currentMentees < maxMentees`) before changing the request, and releases it if the second step fails. Two acceptances therefore cannot exceed capacity. Event RSVPs use the same reserve-then-commit pattern.

## 4. Design decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| **Three services** (React, Express, FastAPI) | The recommender and its evaluation already existed in Python; the web stack is MERN as proposed. A small HTTP contract keeps them independent. | One more process to run and deploy; a network hop per recommendation. |
| **Stateless matcher: the API sends the candidate pool** | One source of truth (MongoDB). No sync job, no stale mentor copies in the matcher. Filters live in one place (Python) so the evaluation and production behave identically. | The request carries every approved mentor (fine for hundreds; capped at 5,000; see deferred work). |
| **Taxonomy served by the matcher** | The topic and specialisation ids used for matching are the same ones the client offers and the API validates, so profiles cannot drift from the model's vocabulary. | The API depends on the matcher at start-up (it caches and retries). |
| **Content-based matching, not collaborative filtering** | No interaction history exists yet; content similarity explains itself. | Cannot learn from outcomes until accepted/completed mentorships accumulate. |
| **Every shown recommendation is logged** | Needed for evaluation (what was shown, rank, score, config version) and for auditing fairness later. | Storage grows with page views; the client caches recommendations for five minutes. |
| **MongoDB with Mongoose** | Flexible profile sub-documents (mentor and mentee sections), text indexes for search, Atlas free tier for hosting. | Fewer relational guarantees; integrity rules (one open request per pair, unique RSVP) are enforced with unique and partial indexes. |
| **JWT in the Authorization header, 8-hour expiry** | Simple, stateless, works with a separate client origin. | No server-side revocation; token kept in `localStorage` (XSS exposure, mitigated by never rendering member text as HTML). Refresh tokens are deferred (#17). |
| **Approval gate** | The network is for Pride Centre graduates and Kenya Airways staff only. | Administrators must review sign-ups; pending members can still edit their profile. |
| **Privacy in serializers** | Contact details are decided in one place (`serialize.js`, `canSeeEmail`), not in each route. | Every new endpoint must use the serializers. |
| **In-memory MongoDB for development and tests** | Anyone can clone and run without cloud credentials; tests are hermetic. | Development data resets on every restart. |
| **Plain CSS with design tokens, no UI library** | A distinctive, accessible interface ("Terminal Wayfinding", see `client/DESIGN.md`) with no dependency weight. | More CSS to maintain by hand. |

## 5. Security

- Passwords hashed with bcrypt; sign-in and registration rate-limited per IP.
- Input validated with Zod on every route; unknown fields rejected on profile updates; taxonomy ids checked.
- Roles (`member`, `admin`) and approval (`pending`, `approved`, `rejected`) enforced by middleware; ownership checked for edits and deletions.
- `helmet` headers, CORS restricted to `CLIENT_ORIGIN`, 200 kB JSON body limit.
- Secrets only in environment variables (`server/.env` is gitignored; production secrets belong in AWS Secrets Manager or Parameter Store).
- The matching service has no authentication, so it must never be publicly reachable. In production it sits on a private network that only the API can reach.

## 6. Reliability and scale

- **Matcher down:** recommendations return 503 with a plain message and a retry button; all other modules work.
- **Load:** with the 160 seeded mentors, `GET /api/mentorship/recommendations` takes about 160–180 ms end to end on a development laptop (database reads, the matcher call with a refit, and logging). At a few thousand mentors the payload and refit cost grow linearly; the fix is in the deferred list.
- **Database:** indexes support every list query (see [database.md](database.md)). Directory and article search use weighted text indexes.
- **Monitoring (planned):** API logs to CloudWatch, `/api/health` reports API, database and matcher status for uptime checks.

## 7. Deferred, and what to revisit as the system grows

| Item | When it matters | Issue |
|---|---|---|
| Real data validation (consented profiles, blind expert rating study) | Before any claim that matches suit real people | #30 |
| Refresh tokens and session revocation | Before real users | #17 |
| Password reset and email verification | Before real users | #16 |
| Notifications (email or in-app) for requests, approvals and moderation | When members stop checking the app daily | #27 |
| Load balancing so the same popular mentors are not always ranked first | When mentors report too many requests | #22 |
| Equal versus tuned block weights | After expert ratings exist | #20 |
| Taxonomy and glossary review by domain experts | Before pilot | #21 |
| Configurable trusted-proxy hops for rate limiting behind CloudFront | Before deployment | #58 |
| Matcher keeps its own mentor index, synced by events, instead of receiving the pool per request | Beyond roughly 2,000 mentors | – |
| Pagination for mentorship request lists (currently the latest 100) | Mentors with long histories | – |
| Accessibility and responsive audit with real assistive technology | Before pilot | #28 |
| MongoDB Atlas and production configuration; AWS deployment | Deployment milestone | #34, #35 |
