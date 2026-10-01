# Database

MongoDB through Mongoose (`server/src/models/`). Development and tests use an in-memory MongoDB seeded with the synthetic data; production will use MongoDB Atlas (#34). All collections have `createdAt` and `updatedAt` timestamps.

## Relationships

```
                        ┌──────────────┐
          ┌────────────►│    users     │◄──────────────┬───────────────┐
          │ mentee,     └──────────────┘ requester,    │ author,       │ createdBy
          │ mentor        ▲      ▲        recipient    │ moderatedBy   │
┌─────────┴────────┐      │      │     ┌───────────────┴───┐   ┌───────┴──────┐
│mentorshiprequests│──────┘      │     │connectionrequests │   │   articles   │
└─────────┬────────┘ recommend-  │     └───────────────────┘   └──────────────┘
          │ recommendation       │ user                      ┌──────────────┐
          ▼                      │                           │   updates    │ createdBy → users
┌──────────────────┐       ┌─────┴──┐  event   ┌─────────┐   └──────────────┘
│ recommendations  │       │ rsvps  ├─────────►│ events  │ createdBy → users
└──────────────────┘       └────────┘          └─────────┘
  mentee, mentor → users
```

## users

One collection for every account. A Pride Centre graduate has a `mentee` section; current and former staff have a `mentor` section.

| Field | Type | Notes |
|---|---|---|
| `name` | string, ≤120 | Required |
| `email` | string | Required, unique, lower-case |
| `passwordHash` | string | bcrypt; never returned (`select: false`) |
| `role` | `member` \| `admin` | Default `member` |
| `userType` | `pride_alumni` \| `current_staff` \| `former_staff` | Required |
| `status` | `pending` \| `approved` \| `rejected` | Default `pending`; with `statusChangedAt`, `statusChangedBy` (→ users), `statusReason` |
| `consent.given`, `consent.givenAt` | boolean, date | Required at registration |
| `externalId` | string | Sparse index; set only on seeded sample accounts (e.g. `MTR-0001`), which marks them "Sample" |
| `lastLoginAt` | date | |
| `profile` | object | `headline`, `bio`, `location`, `specialisation` (taxonomy domain id), `yearsExperience`, `roleTitle`, `department`, `fleetExperience` and `skills` (topic ids), `certifications` [{ `name`, `issuer`, `year` }], `linkedinUrl` |
| `mentor` | object | `expertiseText`, `canMentorIn` (topic ids), `maxMentees` (0–10, default 2), `currentMentees`, `isAvailable` |
| `mentee` | object | `prideProgramme` (programme id), `graduationYear`, `goalsText`, `wantsToLearn` (topic ids) |

Indexes: `email` unique; `{ status, userType, profile.specialisation }`; text index `directory_text` on name (weight 10), headline and role title (5), expertise (2), bio and goals (1); `externalId` sparse.

## mentorshiprequests

| Field | Type | Notes |
|---|---|---|
| `mentee`, `mentor` | → users | Required |
| `status` | `pending` \| `accepted` \| `declined` \| `cancelled` \| `completed` | Default `pending` |
| `open` | boolean | True while `pending` or `accepted` |
| `message`, `responseMessage` | string, ≤1000 | From the mentee; from the mentor when answering |
| `recommendation` | → recommendations | The recommendation the request came from, if any |
| `respondedAt`, `completedAt` | date | |

Indexes: unique partial `one_open_request_per_pair` on `{ mentee, mentor }` where `open: true` (one open request per pair); `{ mentor, status, createdAt }`; `{ mentee, status, createdAt }`.

Capacity: accepting increments `users.mentor.currentMentees` only while it is below `maxMentees` (a conditional update), and completing decrements it.

## recommendations

A log of every recommendation shown to a mentee, for evaluation and audit.

| Field | Type | Notes |
|---|---|---|
| `mentee`, `mentor` | → users | |
| `batchId` | string | One per request to the matcher |
| `rank`, `score` | number | |
| `blockScores` | { `text`, `skills`, `specialisation` } | Null when a block could not be compared |
| `reasons` | string[] | As shown to the mentee |
| `configVersion` | string | Matching configuration in use |

Indexes: `{ mentee, createdAt }`, `{ batchId }`.

## connectionrequests

| Field | Type | Notes |
|---|---|---|
| `requester`, `recipient` | → users | |
| `pairKey` | string | Unique; the two user ids in sorted order, so a pair has one document whichever side asked |
| `status` | `pending` \| `accepted` \| `declined` | A declined request can be re-sent (the document is reused) |
| `message` | string, ≤500 | |
| `respondedAt` | date | |

Indexes: `pairKey` unique; `{ recipient, status }`; `{ requester, status }`.

## articles

| Field | Type | Notes |
|---|---|---|
| `author` | → users | |
| `title` (5–200), `summary` (≤300), `body` (20–20,000) | string | Plain text; rendered as text, never HTML |
| `category` | string | Specialisation id |
| `topics` | string[] | Topic ids |
| `status` | `pending` \| `approved` \| `rejected` | Editing returns an article to `pending` |
| `moderationNote`, `moderatedBy`, `moderatedAt`, `publishedAt` | | |
| `sample` | boolean | Seeded sample content |

Indexes: `{ status, publishedAt }`; `{ author, createdAt }`; text index `article_text` on title (10), summary (5), body (1).

## events and rsvps

**events**: `title`, `description`, `startsAt` (required), `endsAt`, `location`, `isOnline`, `onlineUrl`, `capacity` (null means unlimited), `rsvpCount`, `createdBy` (→ users), `sample`. Index: `{ startsAt }`.

**rsvps**: `event` (→ events), `user` (→ users). Indexes: unique `{ event, user }`; `{ user }`.

An RSVP takes a place only while `rsvpCount < capacity` (conditional update) and is removed again if no place was free. Deleting an event deletes its RSVPs.

## updates

`title` (3–160), `body` (10–5,000), `pinned`, `publishedAt` (default now), `createdBy` (→ users), `sample`. Index: `{ pinned: -1, publishedAt: -1 }`.

## Seeding

`server/src/seed/` loads the synthetic mentors and mentees from `ml-service/data/synthetic/` (160 mentors, 300 mentees, all approved, with short display names such as "Wanjiru C."), plus six sample articles, four events and three updates. In development this runs automatically on the in-memory database. For a real database (`MONGODB_URI` set), `npm run seed -w server` adds the sample data only if none exists yet; `npm run seed -w server -- --reset` deletes everything first, so never run it against a database with real members.
