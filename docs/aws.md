# AWS deployment (planned)

> **Status: planned, not yet deployed** (#34 MongoDB Atlas, #35 AWS). This document is the plan the deployment will follow; steps marked "to verify" have not been run yet.

## Target architecture

```
                 Users (HTTPS)
                      │
          ┌───────────▼────────────┐          ┌──────────────────────────────┐
          │ CloudFront             │  /api/*  │ EC2 instance (one VM)        │
          │  ├─ S3 bucket: client  │ ───────► │  Caddy :443  (TLS, Let's     │
          │  │  (static build)     │          │   Encrypt) → API :4000       │
          └──┴─────────────────────┘          │  Express API  (systemd)      │
                                              │  Matching service :8000      │
                                              │   bound to 127.0.0.1 only    │
                                              └──────────────┬───────────────┘
                                                             │ TLS, IP allow-list
                                              ┌──────────────▼───────────────┐
                                              │ MongoDB Atlas (same region)  │
                                              └──────────────────────────────┘
   Secrets: SSM Parameter Store (SecureString)   Logs: CloudWatch   Cost: AWS Budgets alert
```

| Part | Service | Why |
|---|---|---|
| Client | **S3 + CloudFront** (Amplify Hosting is an alternative) | Static files, HTTPS, caching; CloudFront also forwards `/api/*` to the API so the client and API share one origin (no CORS in production) |
| API | **EC2** (small burstable instance, Ubuntu LTS) with **Caddy** for HTTPS | Simple, cheap, and lets the matching service sit on the same machine |
| Matching service | Same EC2 instance, listening on `127.0.0.1:8000` | Never publicly reachable (it has no authentication); no extra network to manage |
| Database | **MongoDB Atlas** cluster in the same AWS region | Managed service with TLS; the free tier is enough for a pilot (backups need a paid tier, see Rollback) |
| Secrets | **Systems Manager Parameter Store** (SecureString) or Secrets Manager | No secrets on disk in the repository or in images |
| Logs and alerts | **CloudWatch** agent; **AWS Budgets** email alert | See errors; avoid surprise bills |

Region: choose one region for EC2, CloudFront origin and Atlas, ideally close to Kenya (for example `af-south-1` Cape Town, which must be opted into, or `eu-west-1` Ireland). Check current prices in the AWS Pricing Calculator before creating anything.

**Alternative when the project grows:** containers on ECS Fargate in a private subnet behind an Application Load Balancer, with the matching service as a second service reachable only inside the VPC.

## Production configuration

`server/.env` values become Parameter Store entries under `/daraja/prod/`:

| Parameter | Value |
|---|---|
| `NODE_ENV` | `production` (the API then refuses to start without `MONGODB_URI` and a 32+ character `JWT_SECRET`) |
| `MONGODB_URI` | Atlas connection string (database user with read/write on the `daraja` database only) |
| `JWT_SECRET` | 64+ random characters |
| `CLIENT_ORIGIN` | The CloudFront domain, e.g. `https://dxxxx.cloudfront.net` |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First administrator; change the password after the first sign-in |
| `SEED_ON_START` | `false` (never load sample members into production) |
| `SEED_USER_PASSWORD` | Not set |
| `TRUST_PROXY` | Number of proxies in front of the API: `2` behind CloudFront and Caddy, `1` behind Caddy alone |

Client build: `VITE_API_URL` stays empty when CloudFront forwards `/api/*` to the API (same origin).

**Proxy hops.** In production the API trusts `TRUST_PROXY` proxy hops (default 1, `server/src/app.js`), which is right when only Caddy sits in front. With CloudFront in front of Caddy there are two hops: set `TRUST_PROXY=2`, otherwise the sign-in rate limit sees CloudFront's address instead of the user's and every user shares one limit.

## Steps

**1. Atlas (#34)**
1. Create a project and a cluster in the chosen AWS region; create a database user with a generated password.
2. Network access: allow only the EC2 instance's Elastic IP.
3. Store the connection string in Parameter Store as `/daraja/prod/MONGODB_URI`.

**2. EC2 (to verify)**
1. Launch an Ubuntu LTS instance with an Elastic IP. Security group: 443 and 80 open (Caddy obtains certificates over 80); no SSH from the internet, use **SSM Session Manager** instead. Port 8000 stays closed.
2. Attach an IAM role that can read `/daraja/prod/*` from Parameter Store and write CloudWatch logs.
3. Install Node.js 24, Python 3.14, Git and Caddy. Clone the repository at a release tag.
4. `npm ci --omit=dev -w server`; in `ml-service`: create `.venv`, `pip install -r requirements.txt`, `pip install -e . --no-deps`.
5. Two systemd services:
   - `daraja-ml`: `ml-service/.venv/bin/uvicorn daraja.api:app --host 127.0.0.1 --port 8000`
   - `daraja-api`: a small start script that reads the parameters into the environment and runs `node server/src/index.js`
6. Caddy: a domain (or the EC2 public DNS name) → `reverse_proxy 127.0.0.1:4000`.

**3. Client**
1. `npm ci` then `npm run build -w client`.
2. Upload `client/dist/` to a private S3 bucket with versioning on.
3. CloudFront distribution: S3 origin with Origin Access Control (default behaviour), API origin for `/api/*` with caching disabled, and a custom error response that serves `index.html` for unknown paths (client-side routes).

**4. Check**
- `https://<cloudfront>/api/health` reports `database: connected` and `mlService: ok`.
- Sign in as the administrator, approve a test account, and run through the end-to-end journeys by hand.

## Rollback

- **Client:** S3 versioning keeps the previous build; re-upload or restore the previous version, then invalidate CloudFront.
- **API and matching service:** deploy by release tag. To roll back, check out the previous tag on the instance and restart both services. Database changes are additive (Mongoose schemas), so the previous release can read current data.
- **Database:** Atlas snapshot restore on paid tiers. The free tier has no backups, so during a free-tier pilot export regularly with `mongodump` to a private, encrypted S3 bucket.

## Deploy checklist

- [ ] Atlas cluster, user and IP allow-list created; connection string in Parameter Store
- [ ] All `/daraja/prod/*` parameters set; nothing secret in the repository or on the instance's disk
- [ ] `SEED_ON_START=false`; no sample accounts in production
- [ ] Port 8000 not reachable from the internet (checked from outside)
- [ ] `trust proxy` matches the number of proxies (2 behind CloudFront and Caddy); rate limiting checked with two different client addresses
- [ ] HTTPS on the API and CloudFront; HTTP redirects to HTTPS
- [ ] `/api/health` green through CloudFront
- [ ] Administrator password changed after first sign-in
- [ ] CloudWatch logs arriving; AWS Budgets alert set
- [ ] Release tag recorded; rollback steps tested once
