# ReachInbox Email Scheduler

A production-grade email job scheduler built for the ReachInbox hiring assignment.  
Schedule bulk email campaigns, track delivery in real time, enforce per-sender rate limits, and receive Slack alerts — all from a clean Next.js 15 dashboard.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Running the Backend](#running-the-backend)
4. [Running the Frontend](#running-the-frontend)
5. [Ethereal Email Setup](#ethereal-email-setup)
6. [Google OAuth Setup](#google-oauth-setup)
7. [Slack Setup (Optional)](#slack-setup-optional)
8. [Architecture Overview](#architecture-overview)
9. [Features Implemented](#features-implemented)
10. [API Reference](#api-reference)
11. [Assumptions, Shortcuts & Trade-offs](#assumptions-shortcuts--trade-offs)

---

## Quick Start

```bash
# 1. Start infrastructure (Postgres, Redis, Elasticsearch)
docker compose up -d

# 2. Backend
cd backend
npm ci
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
# Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and a random JWT_SECRET
npm run dev                   # API server on :4000

# (separate terminal)
npm run worker                # BullMQ worker process

# 3. Frontend
cd frontend
cp .env.local.example .env.local  # PowerShell: Copy-Item .env.local.example .env.local
npm ci
npm run dev                   # Next.js on :3000
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and start scheduling.

---

## Environment Variables

### Backend — `backend/.env`

```env
# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/reachinbox_scheduler

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=replace-with-a-random-secret
JWT_EXPIRES_IN=7d

# Google OAuth  (required)
# https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID
# Authorised redirect URI: http://localhost:4000/auth/google/callback
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# Slack OAuth  (optional — needed only for rate-limit notifications)
# https://api.slack.com/apps → OAuth & Permissions → redirect URL: http://localhost:4000/slack/callback
# Scopes: chat:write, incoming-webhook
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:4000/slack/callback

# Ethereal Email  (leave blank — auto-created on first login)
ETHEREAL_USER=
ETHEREAL_PASS=

# Rate Limiting
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
```

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `JWT_SECRET` are required for login. Slack is optional unless you want live rate-limit notifications. Everything else has working local defaults.

For PowerShell, generate a local JWT secret with:

```powershell
[guid]::NewGuid().ToString('N')
```

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=ReachInbox Scheduler
```

---

## Running the Backend

### Prerequisites
- Node.js ≥ 18
- Docker Desktop (for Postgres, Redis, Elasticsearch)

### Steps

```bash
# Start all infrastructure containers
docker compose up -d

# Install dependencies
cd backend
npm ci

# Copy and edit env
Copy-Item .env.example .env
# → fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and JWT_SECRET

# Start the API server (migrations run automatically on boot)
npm run dev
# → http://localhost:4000
# → BullBoard at http://localhost:4000/admin/queues

# Start the BullMQ worker in a SEPARATE terminal
npm run worker
```

To run migrations manually:
```bash
npm run migrate
```

To build for production:
```bash
npm run build
npm start
```

---

## Running the Frontend

```bash
cd frontend
npm ci

cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL is already set to http://localhost:4000

npm run dev
# → http://localhost:3000
```

---

## Ethereal Email Setup

[Ethereal](https://ethereal.email) is a free fake SMTP service — emails are captured and never actually delivered, making it perfect for demos and testing.

**Automatic (recommended):**  
Just sign in with Google. On first login, a dedicated Ethereal SMTP account is automatically created and stored as your default sender. No configuration needed.

**Manual (optional):**  
Visit [ethereal.email/create](https://ethereal.email/create), copy the credentials, and add them to `backend/.env`. When both values are set, the application reuses this account:

```env
ETHEREAL_USER=your.name@ethereal.email
ETHEREAL_PASS=yourpassword
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
```

**Viewing sent emails:**  
After a job processes, the worker logs a preview URL:
```
https://ethereal.email/message/XXXXXXXXXXXXXXX
```
You can also create additional Ethereal senders from the "Sender" dropdown inside the Compose modal.

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth 2.0 Client ID** → Application type: **Web application**.
3. Under **Authorised redirect URIs**, add: `http://localhost:4000/auth/google/callback`
4. Copy the **Client ID** and **Client Secret** into `backend/.env`.

---

## Slack Setup (Optional)

Slack is only needed if you want rate-limit notifications pushed to a channel.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. Under **OAuth & Permissions** → **Redirect URLs**, add: `http://localhost:4000/slack/callback`
3. Under **Scopes** → **Bot Token Scopes**, add: `chat:write`, `incoming-webhook`
4. Copy **Client ID** and **Client Secret** into `backend/.env`.
5. In the dashboard, click **Connect Slack** in the header to complete the OAuth flow.

Once connected, a Slack message is automatically sent whenever a sender's hourly rate limit is hit.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 15 Frontend  (port 3000)                                │
│  Google OAuth → HTTP-only cookie → Dashboard → Compose → Tables  │
└──────────────────────┬───────────────────────────────────────────┘
                       │  REST API  (JWT Bearer token)
┌──────────────────────▼───────────────────────────────────────────┐
│  Express Backend  (port 4000)                                    │
│  ┌──────────┐   ┌───────────────┐   ┌──────────────────────┐    │
│  │  Routes  │   │   BullBoard   │   │  Passport Google     │    │
│  └────┬─────┘   └───────────────┘   └──────────────────────┘    │
│       │                                                           │
│  ┌────▼──────────────────────────────────────────────────────┐   │
│  │  BullMQ Queue  (Redis sorted set, delayed jobs)           │   │
│  └────┬──────────────────────────────────────────────────────┘   │
│       │                                                           │
│  ┌────▼──────────────────────────────────────────────────────┐   │
│  │  Worker Process  (separate Node process)                  │   │
│  │  1. Idempotency  — Redis SET NX + DB status check         │   │
│  │  2. Rate limit   — Redis Lua atomic check-and-increment   │   │
│  │  3. Min delay    — Redis shared timestamp across workers  │   │
│  │  4. Send         — Nodemailer → Ethereal SMTP             │   │
│  │  5. Persist      — PostgreSQL status update               │   │
│  │  6. Index        — Elasticsearch document upsert          │   │
│  │  7. Notify       — Slack webhook on rate-limit hit        │   │
│  └────┬──────────────────────────────────────────────────────┘   │
│       │                                                           │
│  ┌────▼──────────┐   ┌────────────────────┐                     │
│  │  PostgreSQL   │   │   Elasticsearch    │                     │
│  │  source of    │   │   full-text        │                     │
│  │  truth        │   │   search only      │                     │
│  └───────────────┘   └────────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

### How Scheduling Works

1. The frontend POSTs to `/emails/schedule` with subject, body, recipient list (pasted or CSV), start time, per-email delay, and optional hourly limit.
2. The backend parses and validates recipients, creates a **batch** record and one **email_job** row per recipient in PostgreSQL, then enqueues each as a **BullMQ delayed job**:
   ```
   delay = (startTime + i × delayBetweenEmailsMs) - now
   ```
3. BullMQ stores delayed jobs in a **Redis sorted set** keyed by their fire timestamp. Jobs are not polled — Redis notifies BullMQ when a job's time arrives.
4. The **worker** picks up the job, runs the processing pipeline (idempotency → rate limit → min delay → send → persist), and moves on to the next.

### How Persistence on Restart Works

BullMQ delayed jobs live entirely in Redis. The `docker-compose.yml` starts Redis with `--appendonly yes`, which persists the sorted set to disk (AOF mode). This means:

- **Server restart:** the Express app re-attaches to the same queue name on startup. Redis AOF keeps normal delayed jobs; startup reconciliation also scans PostgreSQL scheduled rows and recreates any job missing from Redis after a crash between database commit and enqueue.
- **Worker restart:** the worker reconnects and resumes. Any jobs that were `active` (in-flight) when the worker died are retried by BullMQ's `attempts: 3` / exponential-backoff policy.
- **Container restart:** Docker volumes (`redis_data`) survive `docker-compose down` / `docker-compose up` cycles, so no jobs are lost.
- **Idempotency:** PostgreSQL `sent` or `cancelled` state is the durable guard and a short-lived Redis processing lock prevents concurrent duplicate work. The lock is released after each attempt so transient SMTP failures can use BullMQ retries. Jobs remain `retrying` until the final BullMQ attempt, then become `failed`.

### How Rate Limiting & Concurrency Work

| Setting | Default | Env var |
|---|---|---|
| Worker concurrency | 5 | `WORKER_CONCURRENCY` |
| Min delay between sends | 2 000 ms | `MIN_DELAY_BETWEEN_SENDS_MS` |
| Max emails / hour / sender | 50 | `MAX_EMAILS_PER_HOUR_PER_SENDER` |

**Per-sender hourly rate limit** — enforced with an atomic Lua script in Redis:

```lua
local key    = KEYS[1]          -- rate_limit:<sender>:<YYYYMMDDTHH>
local limit  = tonumber(ARGV[1])
local ttl    = tonumber(ARGV[2]) -- ms until start of next UTC hour

local current = redis.call('GET', key)
if current == false then
  redis.call('SET', key, 1, 'PX', ttl)
  return {1, 1}
end
local count = tonumber(current)
if count >= limit then
  return {0, count}
end
redis.call('INCR', key)
return {1, count + 1}
```

When the limit is hit:
- The idempotency Redis lock is **released** so the rescheduled job can re-acquire it.
- The job is **re-enqueued with `delay = ms until next UTC hour`** — emails are never dropped.
- PostgreSQL `scheduled_at` is updated to the new fire time.
- If Slack is connected, a notification is sent immediately.

**Min-delay throttle** — a second Lua script reads and writes a shared Redis key `email_worker:last_send_ts`, calculating the exact wait time needed before the next send. Because it runs in Redis, it is consistent across all concurrent worker instances.

**BullMQ limiter** — the worker also sets `limiter: { max: 1, duration: MIN_DELAY_MS }` at the BullMQ level as a secondary guard, ensuring the queue itself drains at the configured pace even before the in-worker throttle runs.

---

## Features Implemented

### Backend

| Feature | Details |
|---|---|
| **Email scheduling** | BullMQ delayed jobs; one job per recipient; delay formula preserves send order within a batch |
| **Persistence** | Redis AOF + named Docker volumes; jobs survive server/worker/container restarts |
| **Idempotency** | Short-lived Redis processing lock + PostgreSQL status check; sent/cancelled jobs are skipped |
| **Per-sender rate limiting** | Atomic Lua script; configurable limit; over-limit jobs rescheduled to next UTC hour, never dropped |
| **Min-delay throttle** | Redis shared timestamp; consistent across all concurrent worker instances |
| **Worker concurrency** | Configurable via `WORKER_CONCURRENCY`; BullMQ limiter as secondary guard |
| **Multiple SMTP senders** | Per-user Ethereal accounts stored in DB; user can add custom SMTP or create new Ethereal senders from the UI |
| **Google OAuth 2.0** | Passport.js strategy; JWT issued into an HTTP-only cookie on callback |
| **JWT auth middleware** | Reads token from `Authorization: Bearer` header or `cookie`; validates on every protected route |
| **Elasticsearch indexing** | Email documents indexed on schedule; status updated on send/fail; full-text search across subject, body, sender, recipient |
| **Slack OAuth + notifications** | OAuth flow stores webhook URL; `sendSlackNotification` uses webhook if present, falls back to `chat.postMessage` |
| **BullBoard** | Authenticated live queue dashboard at `/admin/queues`; shows delayed, waiting, active, completed, failed counts |
| **Graceful shutdown** | `SIGTERM`/`SIGINT` handlers close worker, queue, Redis, and DB connections cleanly |
| **Winston logging** | Structured JSON in production; colourised dev format; `logs/error.log` + `logs/combined.log` |
| **CSV / plain-text upload** | `multer` parses file upload; supports `.csv` (header detection) and `.txt` (newline/comma separated) |

### Frontend

| Feature | Details |
|---|---|
| **Google OAuth login** | Redirect to `/auth/google`; callback sets an HTTP-only cookie and AuthContext loads `/auth/me` |
| **Auth guard** | Dashboard redirects to `/login` if not authenticated; callback completes the cookie-based flow |
| **User profile in header** | Displays name, email, and avatar from the verified `/auth/me` response; logout clears the server cookie |
| **Stats bar** | Scheduled / Sent / Failed / Cancelled counts from `/emails/stats`; auto-refreshes every 10 s |
| **Scheduled tab** | Paginated table of pending jobs; auto-refreshes every 5 s; cancel button per row |
| **Sent tab** | Paginated table of sent/failed jobs; auto-refreshes every 15 s |
| **Elasticsearch search** | Search box in table header; queries `/emails/search?q=`; debounced |
| **Compose modal** | Subject, HTML body, CSV drag-and-drop or paste recipients, sender select, start time, delay, hourly limit |
| **Live email count** | Parses pasted text or reads CSV to show valid email count in real time |
| **Cancel scheduled email** | DELETE `/emails/:id`; removes BullMQ job and marks DB row cancelled |
| **Slack connect/disconnect** | Header button triggers OAuth flow; status shown; disconnect calls `POST /slack/disconnect` |
| **BullMQ Dashboard link** | Header link opens `/admin/queues` in a new tab |
| **Loading skeletons** | Shown while data fetches are in-flight |
| **Empty states** | Illustrated empty state when no emails exist |
| **Toast notifications** | `react-hot-toast` for success, error, and info messages |
| **TanStack React Query** | Caching, background refetch, invalidation on mutation |
| **Full TypeScript** | All components, API client, and types fully typed |

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `GET` | `/auth/google` | — | Start Google OAuth |
| `GET` | `/auth/google/callback` | — | OAuth callback, issues JWT, redirects to frontend |
| `GET` | `/auth/me` | JWT | Current user from token |
| `POST` | `/auth/logout` | — | Clear token cookie |
| `POST` | `/emails/schedule` | JWT | Schedule a bulk email campaign |
| `GET` | `/emails/scheduled` | JWT | List scheduled emails (paginated) |
| `GET` | `/emails/sent` | JWT | List sent/failed emails (paginated) |
| `GET` | `/emails/search?q=` | JWT | Elasticsearch full-text search |
| `DELETE` | `/emails/:id` | JWT | Cancel a scheduled email |
| `GET` | `/emails/stats` | JWT | DB counts + live BullMQ queue counts |
| `GET` | `/emails/senders` | JWT | List SMTP senders for current user |
| `POST` | `/emails/senders` | JWT | Add a custom SMTP sender |
| `POST` | `/emails/senders/ethereal` | JWT | Create a new Ethereal test sender |
| `GET` | `/slack/connect` | JWT | Get Slack OAuth URL |
| `GET` | `/slack/callback` | — | Slack OAuth callback |
| `POST` | `/slack/disconnect` | JWT | Disconnect Slack |
| `GET` | `/slack/status` | JWT | Slack connection status |
| `GET` | `/admin/queues` | — | BullBoard live queue dashboard |

---

## Assumptions, Shortcuts & Trade-offs

**Idempotency key scope**  
Each recipient in a batch gets a fresh UUID generated at schedule time. If the same campaign (same subject+body+recipients) is scheduled twice, each scheduling creates new idempotency keys — intentional, since the user made a deliberate second request.

**Elasticsearch as search layer only**  
Elasticsearch is used purely for full-text search. PostgreSQL is the source of truth for job status, timestamps, and pagination. This avoids dual-write consistency problems: the ES document can lag slightly, but the DB is always correct.

**Rate limit rescheduling preserves relative order**  
When a sender's hourly limit is hit, the job is re-enqueued with `delay = ms until next UTC hour`. The original `i × delayBetweenEmailsMs` offset is preserved in `job.data`, so relative send order within a batch is maintained in the next window.

**BullBoard has no auth guard**  
`/admin/queues` is open in development. In production, add an `express-basic-auth` or JWT middleware in front of `serverAdapter.getRouter()`.

**JWT payload used for display only**  
The JWT contains `userId`, `email`, `name`, and `avatar` for client-side display. All database queries use the `userId` extracted from the verified JWT in the auth middleware — the payload is never trusted as-is for data access.

**Ethereal for email delivery**  
Ethereal is a fake SMTP sink. Emails are captured and never delivered to real inboxes, which is appropriate for a demo/test environment. Swapping to a real provider (SendGrid, SES, Postmark) requires only updating the SMTP credentials in the `email_senders` table — no code changes.

**No email templating engine**  
The `body` field accepts raw HTML or plain text. A real product would add Handlebars / Liquid templating, but that's out of scope for this assignment.

**Slack `chat.postMessage` fallback**  
If the Slack OAuth response does not include an `incoming_webhook` URL (e.g., the user selected a workspace without an existing webhook), the app falls back to `chat.postMessage` using the stored access token and channel ID. In practice the incoming webhook URL is almost always present when the `incoming-webhook` scope is requested.

**No test suite**  
Unit and integration tests were not included due to time constraints. The rate-limiter Lua script and idempotency logic are the most critical paths to test in a follow-up.
