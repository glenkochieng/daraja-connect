# API reference

Base URL: `http://localhost:4000/api` in development (the client reaches it as `/api` through the Vite proxy). All bodies are JSON.

## Conventions

**Access levels**

| Level | Meaning |
|---|---|
| Public | No token |
| Signed in | Valid `Authorization: Bearer <token>`, any approval status (pending members can use these) |
| Member | Signed in **and** approved (administrators always pass) |
| Mentee / Mentor | Member who is a Pride Centre graduate / current or former staff |
| Admin | Signed in with `role: admin` |

**Errors** use one shape. `details` lists field problems; the field path starts with `body.`, `query.` or `params.`:

```json
{ "error": { "message": "Some fields are missing or invalid",
             "details": [{ "field": "body.email", "message": "Enter a valid email address" }] } }
```

Status codes: 400 invalid input, 401 not signed in or token expired, 403 not allowed (for example, waiting for approval), 404 not found (also used when a resource exists but is hidden from you), 409 conflict (already changed, already exists, no capacity), 429 too many sign-in attempts, 503 matching service unavailable.

**Pagination**: list endpoints with `page` (default 1) and `limit` (default 20, at most 50) return `{ items, page, limit, total, pages }`.

**Privacy**: member objects include `email` only for the member themselves, administrators, accepted connections and accepted or completed mentorships.

## Health and metadata

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API, database and matching-service status (`mlService: "ok"` or an error) |
| GET | `/meta/taxonomy` | Public | `{ specialisations, topics, programmes }` from the matching service (cached for 10 minutes) |

## Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public, rate-limited | Create an account: `name`, `email`, `password` (10+ characters), `userType` (`pride_alumni`, `current_staff`, `former_staff`), `consent: true`, optional `roleTitle`, `yearsExperience`. Returns `{ token, user }`; the account starts `pending`. |
| POST | `/auth/login` | Public, rate-limited | `email`, `password` → `{ token, user }` |
| GET | `/auth/me` | Signed in | The current user with private fields (`status`, `statusReason`, `consent`) |

## Profile and members

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/profile/me` | Signed in | Own profile |
| PUT | `/profile/me` | Signed in | Partial update of `name`, `profile` (headline, bio, location, specialisation, yearsExperience, roleTitle, department, fleetExperience, skills, certifications, linkedinUrl), `mentor` (expertiseText, canMentorIn, maxMentees, isAvailable) or `mentee` (prideProgramme, graduationYear, goalsText, wantsToLearn). Topic and specialisation ids are checked against the taxonomy; capacity cannot go below current mentees. |
| GET | `/users/:id` | Member | A member's public profile (email when allowed) |

## Mentorship

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/mentorship/recommendations?k=5` | Mentee | Ranked mentors (`k` 1–20) from the matching service: `{ status, configVersion, batchId, items: [{ recommendationId, rank, score, blockScores, reasons, mentor }] }`. `status` is `ok`, `incomplete_profile` or `no_eligible_mentors`. Each item shown is logged. 503 if the matcher is down. |
| POST | `/mentorship/requests` | Mentee | `mentorId`, optional `message` (≤1000) and `recommendationId`. 409 if the mentor is unavailable, full, or already has an open request from you. |
| GET | `/mentorship/requests?as=mentee\|mentor&status=` | Member | Your requests (latest 100), as mentee or mentor |
| PATCH | `/mentorship/requests/:id` | Member (party to the request) | `action`: `accept` or `decline` (mentor), `cancel` (mentee), `complete` (either, once accepted); optional `message`. Accepting reserves a place atomically; 409 when full or already changed. |

## Networking

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/directory?q=&userType=&specialisation=&topic=&mentorsOnly=&page=&limit=` | Member | Search approved members (text search on name, headline, role, bio, expertise, goals). Each card has `topics`, `mentorAvailable` and your `connection` status (`none`, `pending_outgoing`, `pending_incoming`, `connected`). |
| POST | `/connections` | Member | `userId`, optional `message` (≤500). A declined request can be sent again. |
| GET | `/connections?type=connected\|incoming\|outgoing` | Member | Your connections or pending requests |
| PATCH | `/connections/:id` | Member (recipient) | `action`: `accept` or `decline` |
| DELETE | `/connections/:id` | Member (either side) | Remove a connection or withdraw a request (204) |

## Knowledge repository

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/articles?q=&category=&topic=&mine=&page=&limit=` | Member | Published articles, or all your own with `mine=true` |
| GET | `/articles/:id` | Member | One article with its body (unpublished ones only for the author and admins) |
| POST | `/articles` | Member | `title` (5–200), `summary` (≤300), `body` (20–20,000), `category` (specialisation id), `topics` (≤10 topic ids). Starts `pending`. |
| PUT | `/articles/:id` | Author | Replace the article; it returns to `pending` for review |
| DELETE | `/articles/:id` | Author or Admin | Delete (204) |
| GET | `/admin/articles?status=pending\|approved\|rejected` | Admin | Moderation queue with full bodies |
| PATCH | `/admin/articles/:id` | Admin | `status`: `approved` or `rejected`, optional `note` to the author |

## Events

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/events?past=true&page=&limit=` | Member | Upcoming (or past) events with `going`, `rsvpCount` and `spotsLeft` |
| GET | `/events/:id` | Member | One event |
| POST | `/events` | Admin | `title`, `description`, `startsAt`, optional `endsAt` (after start), `location`, `isOnline` with `onlineUrl`, `capacity` (null for no limit) |
| PUT | `/events/:id` | Admin | Replace; capacity cannot go below current RSVPs |
| DELETE | `/events/:id` | Admin | Delete the event and its RSVPs (204) |
| POST | `/events/:id/rsvp` | Member | Reserve a place; 409 if full, finished or already going |
| DELETE | `/events/:id/rsvp` | Member | Give up your place |

## Updates

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/updates?page=&limit=` | Member | Feed, pinned first then newest |
| POST | `/updates` | Admin | `title` (3–160), `body` (10–5,000), `pinned` |
| PUT | `/updates/:id` | Admin | Replace (used to edit and to pin or unpin) |
| DELETE | `/updates/:id` | Admin | Delete (204) |

## Administration

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/admin/users?status=pending\|approved\|rejected&userType=&q=&page=&limit=` | Admin | Members by status (default `pending`), with email and consent |
| PATCH | `/admin/users/:id` | Admin | `status` and optional `reason` shown to the member. You cannot change your own status. |
| GET | `/admin/stats` | Admin | Counts: users by status and type, requests by status, recommendations shown, connections, articles by status, upcoming events, RSVPs, updates |

## Known issue

- `POST/PUT /events` accept `startsAt: null` and store 1 January 1970 (#53). The client never sends an empty start.
