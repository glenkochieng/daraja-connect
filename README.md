# Daraja Connect

Mentor matching and alumni engagement for the Kenya Airways ecosystem. Kenya Airways Pride Centre graduates (mentees) get ranked mentor recommendations from current and former Kenya Airways staff (mentors), with the reasons for each match in plain words. Around that sit a networking hub, a knowledge repository, an events calendar and an organisational updates feed.

Final-year capstone project, BSc Informatics and Computer Science, Strathmore University.

> **Independent prototype.** Daraja Connect is a student project. It is not an official Kenya Airways service and uses no Kenya Airways logo, colours or slogans.
>
> **Data notice.** Every member, article, event and update in development is synthetic and labelled "Sample". The recommender's results on synthetic data show that the pipeline works, not that its matches suit real people (see [docs/datasets.md](docs/datasets.md)).

## What it does

| Module | For members | For administrators |
|---|---|---|
| **Mentorship** | Mentees see a ranked board of recommended mentors with reasons and scores, and send requests. Mentors accept or decline within their capacity. Contact details appear once a request is accepted. | Request and recommendation counts |
| **Networking hub** | Directory search and filters, member profiles, connection requests; email shared after a connection is accepted | – |
| **Knowledge repository** | Read, search, write and edit articles; authors see the review status | Publish or decline articles with a note |
| **Events** | Upcoming and past events, reserve or give up a place | Create, edit, delete events |
| **Updates** | Organisational news feed, pinned first | Publish, edit, pin, delete updates |
| **Accounts** | Two-step registration with consent; profile editor with topic pickers | Approve or refuse registrations |

## Architecture

```
 Browser                      Express API (Node.js)                    Matching service (Python)
┌──────────────┐  /api/*   ┌──────────────────────────┐   HTTP JSON   ┌───────────────────────────┐
│ React client │ ────────► │ auth · profiles · admin  │ ────────────► │ FastAPI                   │
│ (Vite)       │ ◄──────── │ mentorship · networking  │ ◄──────────── │ POST /recommendations     │
└──────────────┘   JSON    │ articles · events ·      │               │ GET  /taxonomy · /health  │
                           │ updates                  │               │ TF-IDF + tag + domain     │
                           └────────────┬─────────────┘               │ similarity, stateless     │
                                        │ Mongoose                    └───────────────────────────┘
                                        ▼
                              MongoDB (Atlas in production;
                              in-memory and seeded in development)
```

- The **client** only talks to the API. In development Vite forwards `/api` to `http://localhost:4000`.
- The **API** owns all data, sign-in (JWT), approval, privacy rules and capacity. It asks the matching service to rank candidates and logs every recommendation it shows.
- The **matching service** is stateless. The API sends it the mentee and the candidate mentors; it applies the eligibility filters (consent, availability, capacity, experience gap), scores and ranks, and returns reasons. It also serves the topic taxonomy that the API validates profiles against and the client shows in its pickers.

More detail: [docs/architecture.md](docs/architecture.md).

## Tech stack

| Layer | Technology |
|---|---|
| Client | React 19, React Router 8, TanStack Query 5, Vite 8, plain CSS with design tokens ([client/DESIGN.md](client/DESIGN.md)), self-hosted Signika font |
| API | Node.js 24, Express 5, Mongoose 9, Zod 4, JSON Web Tokens, bcrypt, helmet, express-rate-limit |
| Matching service | Python 3.14, FastAPI, scikit-learn (TF-IDF), NumPy/SciPy, Pydantic |
| Database | MongoDB (Atlas planned); mongodb-memory-server for development and tests |
| Tests | Vitest + Testing Library (client), Vitest + Supertest (API), pytest (ML), Playwright (end to end) |
| Quality | ESLint, Prettier, Ruff, EditorConfig, GitHub Actions |
| Hosting (planned) | AWS: see [docs/aws.md](docs/aws.md) |

## Repository layout

```
daraja-connect/
├── client/          React web app (Vite). DESIGN.md records the design system
├── server/          Express REST API, Mongoose models, seed script, API tests
├── ml-service/      Python recommender, FastAPI service, data, evaluation reports, notebook
├── e2e/             Playwright end-to-end tests (start the whole stack)
├── docs/            Architecture, API, database, ML service, datasets, AWS, contributing
├── data/            Where datasets live and the rules for real data
├── scripts/         dev.mjs: start all three services with one command
└── .github/         CI workflows, issue and pull request templates
```

## Prerequisites (Windows)

- **Git** for Windows
- **Node.js 24 LTS** (22 or newer works) with npm 11
- **Python 3.14** (from python.org; tick "Add python.exe to PATH")
- **VS Code**, with the recommended extensions it offers when you open the folder
- Optional: **GitHub CLI** (`winget install GitHub.cli`) for the workflow in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

No cloud account is needed to run everything locally: the API starts an in-memory MongoDB and seeds it with the synthetic sample data.

## Set up (PowerShell)

```powershell
git clone https://github.com/glenkochieng/daraja-connect.git
cd daraja-connect

# JavaScript dependencies for the client, the API and the tooling (npm workspaces)
npm install

# Python environment for the matching service
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -e . --no-deps
deactivate
cd ..

# API settings: copy the template, then fill in the values
Copy-Item server\.env.example server\.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste as JWT_SECRET
```

Edit `server/.env` and set at least `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `SEED_USER_PASSWORD` (the password for every sample account). The file is gitignored; never commit it.

## Run

All three services with prefixed logs (stop with Ctrl+C):

```powershell
npm run dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000/api/health |
| Matching service | http://127.0.0.1:8000/docs |

Sign in as the administrator (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) or as any sample member, for example `mte-0001@sample.daraja.test` (mentee) or `mtr-0001@sample.daraja.test` (mentor), with `SEED_USER_PASSWORD`. The in-memory database is rebuilt on every start.

Or run each part on its own:

```powershell
# Matching service
cd ml-service; .venv\Scripts\activate; uvicorn daraja.api:app --reload; cd ..

# API (restarts when server/src changes)
npm run dev -w server

# Client
npm run dev -w client
```

VS Code launch configurations (F5) are included for the API, its tests and the matching service.

## Environment variables

**API (`server/.env`, template `server/.env.example`)**

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` requires `MONGODB_URI` and a 32+ character `JWT_SECRET` |
| `PORT` | `4000` | API port |
| `MONGODB_URI` | empty | MongoDB connection string; empty means in-memory (development only) |
| `JWT_SECRET` | random per start in development | Signs session tokens |
| `JWT_EXPIRES_IN` | `8h` | Session length |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated origins allowed by CORS |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | Matching service address |
| `ML_TIMEOUT_MS` | `8000` | Timeout for matching requests |
| `AUTH_RATE_LIMIT` | `20` | Sign-in and registration attempts per IP per 15 minutes |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | – | Administrator created on start-up if missing |
| `SEED_ON_START` | `auto` | `auto` seeds only the in-memory database; `true` also seeds a real one; `false` never |
| `SEED_USER_PASSWORD` | – | Password for all sample accounts; empty disables them |

**Client (`client/.env.local`, template `client/.env.example`)**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | empty | API base URL for a production build served from another origin; leave empty in development (Vite proxies `/api`) |

**Matching service (`ml-service/.env`, template `ml-service/.env.example`)**

| Variable | Default | Purpose |
|---|---|---|
| `DARAJA_MENTORS_PATH` | `data/synthetic/mentors.json` | Mentor pool for requests that do not send their own |
| `DARAJA_CONFIG_PATH` | `config/matching.tuned.yaml` | Matching configuration (weights, filters, missing-data policy) |

## How the matching service connects to the API

1. On start-up the API loads the topic taxonomy from `GET {ML_SERVICE_URL}/taxonomy` (and retries until the service is up). It uses the taxonomy to validate profile topics and serves it to the client at `GET /api/meta/taxonomy`.
2. When a mentee opens Mentorship, the client calls `GET /api/mentorship/recommendations`. The API loads every approved mentor, converts the mentee and mentors to the service's schema and calls `POST {ML_SERVICE_URL}/recommendations` with the candidate pool and the mentors to exclude (those with an open request).
3. The service returns ranked mentors with per-block scores and reasons, or `incomplete_profile` / `no_eligible_mentors`. The API logs each recommendation, attaches mentor cards and returns them.
4. If the service is unreachable, the API answers 503 with a plain message and the client shows a retry, while every other module keeps working.

Request and response formats: [docs/ml-service.md](docs/ml-service.md).

## Tests

```powershell
npm test -w client          # React components and pages (Vitest, jsdom)
npm test -w server          # API (Vitest + Supertest + in-memory MongoDB)
cd ml-service; .venv\Scripts\activate; pytest; cd ..   # recommender and FastAPI
npm run test:e2e            # whole stack in Chromium (Playwright starts all three services)
npm run lint; npm run format:check
```

GitHub Actions runs the relevant checks on every pull request: client, server, ML service, end-to-end, and ESLint with Prettier.

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Components, data flow, design decisions and trade-offs, what is deferred |
| [docs/api.md](docs/api.md) | Every API endpoint with method, access and purpose |
| [docs/database.md](docs/database.md) | Collections, fields, indexes and relationships |
| [docs/ml-service.md](docs/ml-service.md) | Matching service endpoints, inputs and outputs |
| [docs/datasets.md](docs/datasets.md) | Datasets, provenance and where full data lives |
| [docs/aws.md](docs/aws.md) | Planned AWS deployment |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Day-to-day Git and GitHub workflow (PowerShell) |
| [client/DESIGN.md](client/DESIGN.md) | Design system: tokens, components and rules |
| [ml-service/README.md](ml-service/README.md) · [ml-service/docs/methodology.md](ml-service/docs/methodology.md) | Recommender method, evaluation and limitations |

## Project management

Work is tracked in GitHub issues grouped into six milestones (M1 Repository and environment … M6 Deployment and final documentation). Each change goes through a short-lived branch and a pull request that links its issue and carries a review comment; `main` is protected. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Licence

All rights reserved (unlicensed student project). Synthetic data is generated by the project; public Kenya Airways web pages were used only to build a small vocabulary, with sources and quotes recorded in `ml-service/data/kq_public/`.
