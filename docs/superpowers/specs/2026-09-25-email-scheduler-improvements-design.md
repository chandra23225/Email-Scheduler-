# EmailSched Improvements Design

## Goal

Improve the existing EmailSched application across reliability, security, frontend UX, testing, and developer experience while preserving existing API contracts, routes, data model semantics, and visual language wherever correctness does not require a change.

## Scope and Order

Work will proceed in five focused passes:

1. Reliability
2. Security
3. Frontend UX
4. Testing
5. Developer experience

Each pass will be validated before the next pass begins. Changes remain localized to the existing Express, BullMQ, Redis, PostgreSQL, Elasticsearch, and Next.js architecture.

## Compatibility Constraints

- Preserve existing route paths and response shapes unless a security or correctness defect makes a narrow change necessary.
- Preserve the current database as the source of truth for email state.
- Preserve BullMQ delayed jobs, Redis-backed coordination, PostgreSQL persistence, and the existing frontend component structure.
- Reuse existing UI components and Lucide icons rather than introducing a new design system.
- Avoid unrelated refactoring and avoid breaking configuration changes.

## Pass 1: Reliability

### Scheduling and queue publication

Keep database creation transactional and enqueue jobs only after the transaction commits. Make individual queue publication failures observable and recoverable instead of leaving silent scheduled rows with no BullMQ job. Keep deterministic BullMQ job IDs and database idempotency keys so replay and reconciliation do not create duplicate logical sends.

### Worker state transitions

Ensure a successful SMTP send cannot be treated as a new send solely because a later database or search-index update failed. Keep transient failures retryable and mark jobs terminal only after the configured BullMQ attempts are exhausted. Preserve rate-limit reservations when a job is rescheduled and refund reservations only when an email was not sent.

### Validation

Add focused checks for partial queue failure, worker retry state transitions, idempotency behavior, rate-limit reservation refund, and rescheduling. Run the backend build and focused backend tests.

## Pass 2: Security

- Remove the insecure fallback JWT secret and fail clearly when `JWT_SECRET` is absent.
- Validate JWT configuration at startup or at the authentication boundary.
- Require a valid Bearer authorization scheme when using the authorization header.
- Validate pagination, query parameters, scheduling fields, recipient payloads, and upload limits at the API boundary.
- Confirm ownership filtering for email jobs, senders, Slack configuration, and search results.
- Review OAuth callback handling for open redirects and unsafe error exposure.
- Keep SMTP credentials, OAuth secrets, and tokens out of logs and API responses.

Add focused tests for missing secrets, invalid tokens, malformed bearer headers, cross-user access, and malformed input. Preserve routes and response shapes where possible.

## Pass 3: Frontend UX

Improve the existing dashboard workflow without changing its visual language or route structure:

- Group compose controls clearly into recipients, message, scheduling, and throttling sections.
- Show recipient count and validation feedback before submission.
- Prevent duplicate submissions with a pending state and disabled submit action.
- Add consistent loading, empty, error, and retry states to scheduled and sent email lists.
- Improve responsive behavior for mobile while preserving desktop information architecture.
- Make scheduled, retrying, sent, and failed states visually distinct.
- Keep Slack controls and authenticated user details discoverable but secondary to composing and monitoring emails.
- Reuse existing UI primitives and Lucide icons.

## Pass 4: Testing

Build a focused deterministic test surface for the previous passes:

- Recipient parsing, normalization, validation, and deduplication.
- Scheduling validation and ownership checks.
- Rate-limit reservation, refund, and next-window rescheduling.
- Worker retry and idempotency state transitions.
- Authentication failures and malformed bearer tokens.
- API response typing and dashboard loading/error behavior where practical.
- Backend production build and frontend production build.

Separate local deterministic tests from checks that require Google, Slack, SMTP, PostgreSQL, Redis, or Elasticsearch credentials. Infrastructure-dependent checks must report their prerequisites rather than silently failing or being mistaken for passing local tests.

## Pass 5: Developer Experience

Make the documented local workflow reproducible and diagnosable:

- Align dependency installation instructions with the separate root, backend, and frontend package manifests.
- Add clear prerequisite and environment validation for Node, Docker services, PostgreSQL, Redis, Elasticsearch, and required secrets.
- Make migration and worker startup commands explicit and reliable.
- Add health checks or startup diagnostics that identify unavailable infrastructure.
- Align project naming across Docker containers, README, environment examples, and frontend metadata.
- Document optional integrations and the requirements for each local workflow.
- Add concise troubleshooting guidance for startup, OAuth, queue, and migration failures.
- Preserve existing scripts where possible and add aliases only when necessary.

## Error Handling and Operational Boundaries

Errors should be returned in the existing JSON error format for API callers, logged with useful context but without credentials, and represented by actionable loading/error states in the dashboard. Elasticsearch remains an operational read-optimized index and must not replace PostgreSQL as the source of truth. External OAuth, Slack, SMTP, and search availability must not obscure deterministic local validation.

## Validation Sequence

After each pass, run the narrowest relevant executable check before moving on. At the end, run:

1. Backend focused tests.
2. Backend TypeScript build.
3. Frontend production build.
4. Any available infrastructure health and migration checks.
5. A final compatibility and documentation review against this spec.

## Out of Scope

- Replacing the existing framework or persistence stack.
- Introducing a new frontend design system.
- Changing public API routes for convenience.
- Adding unrelated product features.
- Committing changes without explicit user request.
