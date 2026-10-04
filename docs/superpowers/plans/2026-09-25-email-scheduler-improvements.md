# EmailSched Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve EmailSched reliability, security, dashboard usability, test coverage, and local developer experience while preserving existing API routes, response contracts, and visual language.

**Architecture:** Keep Express routes, PostgreSQL via Knex, BullMQ delayed jobs, Redis coordination, Elasticsearch indexing, and the existing Next.js component structure. Work in five ordered passes, validating each pass before starting the next. Use small helpers only where they isolate a tested boundary; do not introduce a new framework or persistence layer.

**Tech Stack:** TypeScript, Express, Knex/PostgreSQL, BullMQ, Redis/ioredis, Nodemailer, Elasticsearch, Next.js 15, React 19, Tailwind CSS, Node test runner.

---

## File Map

- `backend/src/routes/emails.ts`: schedule request validation, queue publication recovery, ownership-safe list/search boundaries.
- `backend/src/worker.ts`: idempotency, send-state transitions, retry and rate-limit coordination.
- `backend/src/lib/queue.ts`: deterministic queue helpers and queue event lifecycle if needed.
- `backend/src/lib/rateLimiter.ts`: atomic reservation and refund behavior.
- `backend/src/middleware/auth.ts`: strict JWT and Bearer-token validation.
- `backend/src/routes/auth.ts`: configuration validation and safe OAuth callback behavior.
- `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/db/index.ts`: health, startup validation, and resource lifecycle.
- `backend/src/lib/*.test.ts`: deterministic backend behavior tests.
- `frontend/src/components/dashboard/ComposeModal.tsx`: compose validation and duplicate-submit prevention.
- `frontend/src/components/dashboard/EmailTable.tsx`, `frontend/src/app/dashboard/page.tsx`: loading, empty, error, retry, and responsive states.
- `frontend/src/lib/api.ts`, `frontend/src/types/index.ts`: API contract typing and error handling.
- `README.md`, `backend/.env.example`, `frontend/.env.local.example`, `package.json`, `docker-compose.yml`: reproducible setup and operational documentation.

## Pass 1: Reliability

### Task 1: Establish the reliability baseline

**Files:**
- Test: `backend/src/lib/recipientParser.test.ts`
- Test: `backend/src/lib/rateLimiter.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Run the existing backend tests and build.**

Run from the repository root:

```powershell
npm --prefix backend test
npm --prefix backend run build
```

Record the baseline result. The current test script must execute the parser test, and the TypeScript build must complete without errors before reliability changes begin.

- [ ] **Step 2: Add deterministic rate-limit test cleanup.**

Use a unique sender address per test and delete the corresponding Redis key or use a unique timestamped key. Keep the existing `node:test` and `node:assert/strict` style. Ensure the test closes Redis clients in one `after` hook.

- [ ] **Step 3: Add tests for limit-hit and refund behavior.**

Cover these exact cases:

```ts
const first = await checkAndIncrementRateLimit(sender, 1);
assert.deepEqual(first.allowed, true);
const second = await checkAndIncrementRateLimit(sender, 1);
assert.deepEqual(second.allowed, false);
await releaseRateLimitReservation(sender);
const retry = await checkAndIncrementRateLimit(sender, 1);
assert.deepEqual(retry.allowed, true);
```

Run `npm --prefix backend test` and confirm the focused test passes with Redis available.

### Task 2: Make queue publication failures visible and recoverable

**Files:**
- Modify: `backend/src/routes/emails.ts`
- Modify: `backend/src/lib/queue.ts`
- Test: `backend/src/lib/queue.test.ts`

- [ ] **Step 1: Extract a small queue-publication helper.**

Define a helper that accepts one persisted email-job record and sender data, builds the existing `EmailJobData`, and calls `emailQueue.add` with:

```ts
jobId: `email:${idempotencyKey}`
delay: Math.max(0, scheduledAt.getTime() - Date.now())
```

Return the BullMQ job ID. Keep the existing job name `send-email` and payload property names.

- [ ] **Step 2: Write the failing partial-publication test.**

Mock the queue add operation so the first call succeeds and the second call throws. Assert that the helper reports the failed database ID and does not claim that all jobs were queued. Keep this test at the pure queue-helper boundary rather than requiring an Express or database harness.

- [ ] **Step 3: Implement explicit publication status handling.**

After the database transaction commits, publish each job independently. On success, store its BullMQ ID. On failure, update only that email row to the existing `retrying` status with an error message, log the database ID, and continue processing the remaining rows. Return the existing `201` response with `totalScheduled` reflecting persisted jobs and include a stable warning field only if adding it does not break existing consumers; otherwise log the warning and preserve the response shape.

- [ ] **Step 4: Add a recovery path for retryable unpublished jobs.**

Add a small internal function that selects rows with `status IN ('scheduled', 'retrying')` and no `bullmq_job_id`, rebuilds the same deterministic job ID, publishes them, and stores the resulting BullMQ ID. Invoke it from startup after infrastructure is ready. Do not add a public endpoint.

- [ ] **Step 5: Run focused validation.**

```powershell
npm --prefix backend test
npm --prefix backend run build
```

Expected result: tests pass and the backend compiles.

### Task 3: Harden worker send state and idempotency

**Files:**
- Modify: `backend/src/worker.ts`
- Modify: `backend/src/lib/elasticsearch.ts` if indexing errors currently escape the send path.
- Test: `backend/src/worker.test.ts` or a pure worker-state helper test.

- [ ] **Step 1: Write tests for terminal-state and post-send failure behavior.**

Test that a job with database status `sent` or `cancelled` is skipped. Test that SMTP success followed by search-index failure does not invoke SMTP a second time on retry; the database update must establish the durable sent state before search indexing is attempted.

- [ ] **Step 2: Separate delivery success from observability failure.**

Keep the database update to `sent` immediately after SMTP success. Wrap Elasticsearch indexing in its own non-terminal error boundary that logs the failure and allows the worker job to complete successfully. This prevents an already-delivered email from being retried only because the search index is unavailable.

- [ ] **Step 3: Preserve retry state semantics.**

On SMTP failure, calculate the final attempt from `job.opts.attempts` and `job.attemptsMade`. Write `retrying` before the next attempt and `failed` only on the final attempt. Always release the processing lock in `finally`; refund the rate-limit reservation only when SMTP did not report success.

- [ ] **Step 4: Keep rescheduled jobs deterministic at the logical level.**

When rate-limited, release only the processing lock, enqueue the same payload for the next hour, update the database BullMQ ID and schedule, and leave the database status as `scheduled`. Keep the existing unique reschedule job ID so a rescheduled attempt can run.

- [ ] **Step 5: Run focused validation.**

```powershell
npm --prefix backend test
npm --prefix backend run build
```

## Pass 2: Security

### Task 4: Remove insecure authentication defaults

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/middleware/auth.test.ts`

- [ ] **Step 1: Write failing auth tests.**

Cover missing `JWT_SECRET`, a malformed `Authorization` header, an expired token, an invalid signature, and a valid Bearer token. Assert that failures return `401` without exposing token or secret details.

- [ ] **Step 2: Require a configured JWT secret.**

Replace `process.env.JWT_SECRET || 'secret'` with a shared configuration check that throws a startup/auth configuration error when the value is absent or still equals the example placeholder. Do not silently fall back to a known secret.

- [ ] **Step 3: Parse Bearer tokens strictly.**

Accept a cookie token as before, or accept only a header matching `/^Bearer\\s+\\S+$/i`. Reject other authorization schemes and malformed values with the existing `401` JSON shape.

- [ ] **Step 4: Run focused validation.**

```powershell
npm --prefix backend test
npm --prefix backend run build
```

### Task 5: Validate API inputs and ownership boundaries

**Files:**
- Modify: `backend/src/routes/emails.ts`
- Modify: `backend/src/routes/slack.ts`
- Modify: `backend/src/routes/auth.ts`
- Test: `backend/src/routes/emails.test.ts`

- [ ] **Step 1: Write request-boundary tests.**

Cover invalid page and limit values, invalid schedule dates, non-positive delay and hourly limit, oversized recipient input, sender IDs belonging to another user, and search/list requests for another user’s data.

- [ ] **Step 2: Normalize pagination.**

Parse page and limit as finite integers, clamp page to at least `1`, and clamp limit to a maximum of `100`. Use the normalized values for both query and pagination metadata.

- [ ] **Step 3: Validate all schedule fields before database writes.**

Require non-empty subject/body, a valid non-past start time, an integer delay in the existing range, a positive integer hourly limit when present, and at most 10,000 deduplicated recipients. Reject invalid input with `400` and the existing `{ error: string }` response shape.

- [ ] **Step 4: Audit ownership filters.**

Every email job, sender, Slack configuration, and search query must include `user_id = req.user.userId`. Never use a client-supplied user ID for authorization. Do not include SMTP passwords, OAuth tokens, or webhook secrets in response objects or logs.

- [ ] **Step 5: Run focused validation.**

```powershell
npm --prefix backend test
npm --prefix backend run build
```

### Task 6: Harden OAuth callback and runtime configuration

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/routes/auth.test.ts`

- [ ] **Step 1: Write callback configuration tests.**

Cover missing Google OAuth configuration, safe failure redirects, and callback success with a valid user. Assert that error redirects use the configured frontend origin rather than a request-controlled URL.

- [ ] **Step 2: Validate integration configuration at the boundary.**

Require Google client credentials only when the Google login route is used. Keep Slack and Elasticsearch optional for unrelated local flows, but return actionable errors when their specific integrations are invoked without configuration.

- [ ] **Step 3: Run focused validation.**

```powershell
npm --prefix backend test
npm --prefix backend run build
```

## Pass 3: Frontend UX

### Task 7: Strengthen compose validation and submission states

**Files:**
- Modify: `frontend/src/components/dashboard/ComposeModal.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Inspect existing form state and add typed validation results.**

Keep the existing fields and API payload names. Add client-side checks for subject, body, recipient presence, valid start time, delay range, and positive hourly limit. Derive the deduplicated recipient count from the existing parser or preview state.

- [ ] **Step 2: Add a failing interaction test or pure validation test.**

Assert that invalid input prevents the schedule request and that a second submit while the first request is pending is ignored.

- [ ] **Step 3: Implement pending, success, and failure behavior.**

Disable the submit control while scheduling, preserve the modal during failure, show an actionable error toast, and clear/reset only after a successful response. Keep the existing API response contract.

- [ ] **Step 4: Run frontend validation.**

```powershell
npm --prefix frontend run build
```

### Task 8: Add dashboard loading, empty, error, and responsive states

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/components/dashboard/EmailTable.tsx`
- Modify: `frontend/src/components/dashboard/StatsBar.tsx`
- Modify: `frontend/src/components/dashboard/Header.tsx`

- [ ] **Step 1: Add explicit query state branches.**

Render the existing `Skeleton` while loading, `EmptyState` when the result is empty, and an actionable retry state when a query fails. Keep scheduled, retrying, sent, and failed statuses visually distinct.

- [ ] **Step 2: Make table content responsive.**

Use the existing table/list primitives and responsive classes so recipient, subject, status, and time remain readable on narrow screens without horizontal overlap. Keep the primary compose action available on mobile.

- [ ] **Step 3: Keep account and Slack controls secondary.**

Show authenticated user details and Slack connect/disconnect actions in the existing header or account surface without displacing primary email workflow controls.

- [ ] **Step 4: Run frontend validation.**

```powershell
npm --prefix frontend run build
```

## Pass 4: Testing

### Task 9: Expand backend deterministic coverage

**Files:**
- Create or modify: `backend/src/middleware/auth.test.ts`
- Create or modify: `backend/src/routes/emails.test.ts`
- Create or modify: `backend/src/routes/auth.test.ts`
- Create or modify: `backend/src/worker.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Keep tests dependency-light.**

Use Node’s built-in `node:test` and `node:assert/strict` where possible. Extract pure validation/state helpers instead of requiring a live OAuth, SMTP, Slack, or Elasticsearch service for unit tests.

- [ ] **Step 2: Add explicit test commands.**

Change the backend test script to `node --require ts-node/register --test "src/**/*.test.ts"`, which runs all TypeScript test files under Node's built-in test runner. Retain a focused command such as `node --require ts-node/register --test src/lib/rateLimiter.test.ts` when debugging one file.

- [ ] **Step 3: Run the full backend test suite.**

```powershell
npm --prefix backend test
npm --prefix backend run build
```

Expected result: all deterministic tests pass and TypeScript compilation succeeds.

### Task 10: Add frontend type and build coverage

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.json` only if required by the existing build.
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Align API types with backend payloads.**

Define typed scheduled/sent job records, pagination metadata, schedule responses, and `{ error: string }` failures. Preserve snake_case fields returned by the backend or normalize them in one API boundary, not ad hoc in components.

- [ ] **Step 2: Run the production build.**

```powershell
npm --prefix frontend run build
```

Expected result: the build catches type errors in the touched workflow and completes successfully.

## Pass 5: Developer Experience

### Task 11: Make installation and startup reproducible

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `backend/.env.example`
- Modify: `frontend/.env.local.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Align root scripts with separate manifests.**

Add explicit scripts for installing backend and frontend dependencies, running migrations, starting the worker, and building both applications. Keep existing `dev`, `build`, `start`, and lint commands working.

- [ ] **Step 2: Correct the README install sequence.**

Document these exact commands from a clean checkout:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
docker compose up -d
npm --prefix backend run migrate
npm run dev
npm --prefix backend run worker
```

Document that Google OAuth is required for login, while Slack and Elasticsearch are optional for unrelated local workflows.

- [ ] **Step 3: Align names and environment examples.**

Use `EmailSched` consistently in user-facing metadata and documentation. Keep database names and container names stable unless a migration is required; if names change, document the clean-volume requirement explicitly. Ensure example secrets clearly indicate that they must be replaced.

### Task 12: Add health diagnostics and troubleshooting documentation

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/db/index.ts`
- Modify: `README.md`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add a health endpoint with dependency status.**

Return an HTTP success when PostgreSQL and Redis are reachable, and report Elasticsearch as `ok` or `degraded` because search is optional for core scheduling. Report all three statuses without exposing credentials. Keep the endpoint unauthenticated for local diagnostics and ensure errors use a stable JSON shape.

- [ ] **Step 2: Add startup diagnostics.**

Run migrations predictably, log which optional integrations are disabled, and fail with actionable messages when PostgreSQL or Redis is unavailable. Ensure server and worker shutdown handlers close database and Redis connections.

- [ ] **Step 3: Add troubleshooting entries.**

Document Docker health checks, migration failures, missing JWT/Google configuration, Redis queue issues, OAuth callback URL mismatches, and the fact that Ethereal preview URLs are not real delivery.

- [ ] **Step 4: Run final validation.**

```powershell
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Run `npm --prefix backend run migrate` and the health endpoint when Docker services are available. Report any unavailable external integration separately from local deterministic test results.

## Final Review Checklist

- [ ] Reliability pass completed and validated before security changes.
- [ ] JWT fallback removed and ownership boundaries tested.
- [ ] Compose and dashboard states cover loading, empty, error, retry, and pending behavior.
- [ ] Backend tests and frontend production build pass.
- [ ] README commands match the actual package scripts and environment examples.
- [ ] No credentials, tokens, or SMTP passwords appear in logs or responses.
- [ ] Public route paths and response shapes remain compatible unless a narrow security correction is documented.
- [ ] No commit is created unless the user explicitly requests one.
