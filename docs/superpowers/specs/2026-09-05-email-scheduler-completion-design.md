# Email Scheduler Completion Design

## Goal

Complete the existing ReachInbox email scheduler so it satisfies the assignment requirements without replacing its current Express, BullMQ, Redis, PostgreSQL, Elasticsearch, Slack, and Next.js architecture.

## Scope

The completion pass will audit and repair the following behavior:

- Google OAuth login, callback, JWT/session handling, logout, and user data shown in the dashboard.
- Transactional scheduling of batches and individual email rows, with deterministic BullMQ job IDs and restart-safe delayed jobs.
- Worker idempotency, retry behavior, configurable concurrency, minimum send delay, Redis-atomic hourly limits, next-window rescheduling, and one live Slack notification per rate-limit event.
- Ethereal SMTP configuration and sender creation without making local development depend on an unavailable external service during unrelated startup paths.
- Elasticsearch indexing/search behavior and graceful degradation where the search service is unavailable.
- Bull Board exposure and health/startup behavior.
- Dashboard compose, CSV/TXT parsing, scheduled/sent lists, loading/empty/error states, Slack connect/disconnect controls, and API typing.
- README and environment documentation for verified commands, configuration, restart behavior, and trade-offs.

## Design

The database remains the source of truth for email status. Scheduling creates a batch and its email rows in one database transaction, then enqueues durable delayed BullMQ jobs using each row's idempotency key. The worker checks the database status and a Redis idempotency key before sending. A successful send updates PostgreSQL and Elasticsearch; a failure records the error and lets BullMQ apply bounded retries.

The worker uses configurable concurrency. A Redis Lua operation reserves the sender's current UTC-hour slot atomically. When the limit is full, the worker releases the temporary idempotency claim, sends a Slack notification only when a connected user has not already been notified for that sender/window, and re-enqueues the same logical email for the next hour. A Redis-backed timestamp gate enforces the minimum inter-send delay across worker instances.

OAuth remains a real Google OAuth flow. The callback issues a short-lived handoff to the frontend, which stores the JWT only after validating the callback response. Authenticated API requests use the bearer token. Slack OAuth stores the tenant's token/webhook in PostgreSQL and can be connected or disconnected at runtime.

The dashboard keeps the existing component structure and visual language. It will use typed API responses, explicit loading and empty states, client-side recipient previews, and actionable toast errors. No cron-based scheduling or in-memory-only rate limiting will be introduced.

## Validation

Validation will include:

1. Backend TypeScript build and frontend production build.
2. Migration/configuration checks and health endpoint startup where infrastructure is available.
3. Focused behavior checks for recipient parsing, scheduling payloads, auth guards, rate-limit reservation, idempotency, and rescheduling.
4. A final requirement audit against the assignment and README review.

## Assumptions and Trade-offs

- Ethereal is a fake SMTP provider; preview URLs are useful evidence, but no real external mail delivery is expected.
- Google and Slack credentials remain environment-provided because OAuth cannot be meaningfully mocked for the assignment.
- Elasticsearch is a search index rather than the source of truth; list APIs continue to read PostgreSQL.
- The existing schema and dependencies are preferred over introducing a new framework or ORM.