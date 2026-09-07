# Email Scheduler Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and verify the existing ReachInbox scheduler against the assignment requirements.

**Architecture:** Keep Express routes, PostgreSQL via Knex, BullMQ delayed jobs, Redis atomic coordination, Elasticsearch indexing, Ethereal SMTP, Slack OAuth, and the existing Next.js dashboard. Repair boundary behavior first, then add focused tests and documentation.

**Tech Stack:** TypeScript, Express, BullMQ, Redis/ioredis, PostgreSQL/Knex, Elasticsearch, Nodemailer, Passport Google OAuth, Next.js 15, React Query, Tailwind.

---

### Task 1: Establish baseline and test surface

**Files:**
- Create: `backend/src/lib/recipientParser.ts`
- Create: `backend/src/lib/recipientParser.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Add recipient parser tests** for CSV headers, plain text, duplicate addresses, invalid addresses, and empty input.
- [ ] **Step 2: Add a test script** using the repository's available TypeScript test runner or a minimal Node-compatible test command.
- [ ] **Step 3: Implement the parser** and use it as the single recipient parsing boundary.
- [ ] **Step 4: Run the focused parser test and backend TypeScript build.**

### Task 2: Make scheduling transactional and validated

**Files:**
- Modify: `backend/src/routes/emails.ts`
- Modify: `backend/src/lib/queue.ts`
- Modify: `backend/src/db/migrations/20240601_001_initial.ts` only if schema validation requires it

- [ ] **Step 1: Add request validation** for future/valid start time, positive delay, positive hourly limit, and bounded recipient count.
- [ ] **Step 2: Replace duplicated parsing with `recipientParser`** for upload and pasted input.
- [ ] **Step 3: Create batch and email rows in a Knex transaction** and enqueue deterministic jobs after the transaction commits.
- [ ] **Step 4: Preserve the database row id/idempotency key in every job and return a stable batch response.**
- [ ] **Step 5: Run the backend build and a request-level schedule validation check.**

### Task 3: Harden worker idempotency, throttling, and rescheduling

**Files:**
- Modify: `backend/src/worker.ts`
- Modify: `backend/src/lib/rateLimiter.ts`
- Modify: `backend/src/lib/slack.ts`
- Create: `backend/src/lib/rateLimiter.test.ts`

- [ ] **Step 1: Test atomic rate reservation** for below-limit, limit-hit, and next-window behavior.
- [ ] **Step 2: Make the idempotency claim state-aware** so a rate-limited job can be safely retried without losing its claim.
- [ ] **Step 3: Make Slack notification deduplicated per sender/hour window** and ensure missing Slack credentials are a no-op.
- [ ] **Step 4: Ensure failures are only marked terminal after BullMQ retry attempts are exhausted.**
- [ ] **Step 5: Run focused rate-limit tests and the backend build.**

### Task 4: Verify auth, sender setup, and runtime boundaries

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/db/index.ts`
- Modify: `frontend/src/app/auth/callback/page.tsx`
- Modify: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Validate required OAuth configuration at login time** and use a safe callback failure redirect.
- [ ] **Step 2: Verify JWT claims and authenticated `/me` behavior** without relying on an Express session.
- [ ] **Step 3: Make default Ethereal sender provisioning retry-safe** and avoid duplicate default senders.
- [ ] **Step 4: Ensure startup runs migrations predictably and worker/server shutdown closes Redis and DB resources.**
- [ ] **Step 5: Run backend and frontend builds.**

### Task 5: Complete dashboard workflow and API typing

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/dashboard/ComposeModal.tsx`
- Modify: `frontend/src/components/dashboard/EmailTable.tsx`
- Modify: `frontend/src/components/dashboard/Header.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Align API response types** with backend snake_case payloads and error responses.
- [ ] **Step 2: Add visible loading, empty, and error states** to scheduled and sent views.
- [ ] **Step 3: Validate CSV/TXT selection and schedule controls** before submission, including duplicate-aware recipient count.
- [ ] **Step 4: Expose Slack connect/disconnect and authenticated user details** in the header.
- [ ] **Step 5: Run the frontend production build.**

### Task 6: Document and perform final requirement validation

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example`
- Modify: `frontend/.env.local.example`

- [ ] **Step 1: Document exact local setup, migration, worker, OAuth, Ethereal, Elasticsearch, and Slack configuration.**
- [ ] **Step 2: Document concurrency, minimum delay, Redis hourly counters, rate-limit rescheduling, restart persistence, and load behavior.**
- [ ] **Step 3: Run backend build, frontend build, migration/configuration checks, and focused tests.**
- [ ] **Step 4: Review the final diff against every assignment requirement and report any infrastructure-dependent checks that could not run.**