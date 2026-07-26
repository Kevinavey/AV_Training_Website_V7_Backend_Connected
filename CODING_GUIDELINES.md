# AV Training Booking Platform Coding Guidelines

## Purpose

These guidelines define how the AV Training booking platform should be implemented and maintained. They support the design in `ARCHITECTURE.md` and the delivery sequence in `PROJECT_ROADMAP.md`.

The goals are to keep the system reliable, secure, understandable, and proportionate to a small training business. Prefer clear, conventional code over clever abstractions or infrastructure that the current workload does not require.

## Core Principles

1. PostgreSQL is the source of truth for courses, sessions, bookings, delegates, capacity, and fulfilment state.
2. The backend owns business decisions. Never trust client-provided prices, totals, availability, payment status, or display values.
3. Stripe webhooks confirm payment; browser redirects do not.
4. Capacity changes must be transactional and safe under concurrent requests.
5. Webhook and fulfilment processing must be idempotent.
6. Validate all external input at the boundary.
7. Keep route handlers small and business logic testable.
8. Return safe errors to customers and retain diagnostic context in structured logs.
9. Store only credentials and signing secrets in environment variables.
10. Keep the application modular, but deploy it as one service until evidence justifies separation.

## Language and Runtime

- Use a supported Node.js long-term-support release.
- Use ECMAScript modules consistently.
- Pick either JavaScript with strict runtime schemas or TypeScript and use it consistently across the backend.
- If TypeScript is adopted, enable strict compiler settings and do not suppress errors with broad `any` types.
- Pin the Node.js major version for local development and Render.
- Commit the package lockfile and use reproducible installs in deployment.
- Remove unused dependencies and imports.
- Do not add a library when a small, clear standard-library solution is sufficient.

## Code Organization

Organize code by business capability rather than placing all routes, queries, and integrations in one file.

```text
app/
├── courses/
├── bookings/
├── delegates/
├── checkout/
├── webhooks/
├── fulfilment/
└── admin/
```

Within a capability, separate responsibilities where useful:

- **Routes/controllers:** HTTP concerns only.
- **Schemas:** Request, response, and configuration validation.
- **Services:** Business rules and state transitions.
- **Repositories:** PostgreSQL access.
- **Integrations:** Stripe, Resend, and Google-specific calls.

Avoid layers that merely pass arguments through without adding a useful boundary.

## Naming

- Use descriptive names that match the domain: `courseSession`, `booking`, `delegate`, `seatHold`, and `fulfilmentJob`.
- Use `camelCase` for JavaScript variables and functions.
- Use `PascalCase` for classes and exported types.
- Use `UPPER_SNAKE_CASE` for true constants.
- Use `snake_case` for PostgreSQL tables and columns.
- Name booleans as questions or states, such as `isBookable`, `hasCapacity`, or `emailSent`.
- Include units in ambiguous names: `priceMinorUnits`, `durationMinutes`, and `holdExpiresAt`.
- Use stable domain terms consistently. Do not alternate between `student`, `learner`, `attendee`, and `delegate` in implementation code.

## Functions and Modules

- Give each function one clear responsibility.
- Prefer explicit inputs and return values over hidden mutable state.
- Keep pure calculations, such as availability and expected totals, separate from database and provider calls.
- Avoid deeply nested conditionals; use validation and early returns.
- Do not catch errors unless the current layer can add context, translate them, retry safely, or complete cleanup.
- Preserve the original error as a cause when wrapping errors.
- Do not use exceptions for expected business outcomes such as insufficient seats unless the application has a consistent typed-error convention.
- Export only the public surface that other modules need.
- Do not place business logic in HTML templates, route registration, or database migrations.

## API Guidelines

### Request validation

- Validate path parameters, query parameters, headers, and bodies using explicit schemas.
- Reject unknown fields for write operations unless forward compatibility specifically requires them.
- Apply sensible length and format limits to names, emails, phone numbers, references, and notes.
- Require a numeric delegate count from 1 to 12.
- Derive booking quantity from the validated delegate array.
- Use stable course-session IDs, not formatted date strings.
- Normalize email addresses consistently while preserving the original where appropriate for display.

### Responses

- Return JSON consistently from API routes.
- Use stable machine-readable error codes.
- Do not expose raw Stripe, PostgreSQL, Resend, Google, stack-trace, or configuration errors.
- Return only the information the caller needs.
- Do not expose Stripe Price IDs or internal fulfilment details through public APIs.
- Use appropriate status codes rather than returning `200` for application errors.

Example error shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_SEATS",
    "message": "Only 2 seats remain for this course."
  }
}
```

### Compatibility

- Prefer additive response changes.
- Document intentional breaking changes.
- Do not create separate online and classroom booking APIs when both can use the same course-session model.

## Database Guidelines

- Apply every schema change through a committed migration.
- Use UUIDs or another non-guessable stable identifier for public booking and session references.
- Enforce critical rules in PostgreSQL as well as application code.
- Add constraints for course capacity, delegate count, statuses, currency, and non-negative monetary values.
- Add unique constraints for booking references, Stripe Session IDs, Stripe event IDs, and fulfilment deduplication keys.
- Store money as integer minor units, never floating-point values.
- Store timestamps in timezone-aware PostgreSQL columns and render them using `Europe/London` where appropriate.
- Use parameterized queries or a query builder/ORM that produces parameterized queries.
- Select only required columns, particularly where personal information is involved.
- Add indexes to actual query paths; do not add speculative indexes without a reason.
- Keep transactions short and never call Stripe, Resend, or Google while holding database locks.

### Capacity transactions

Any operation that holds, confirms, releases, cancels, or refunds seats must:

1. Begin a transaction.
2. Lock the relevant course-session record.
3. Recalculate availability from current paid bookings and active holds.
4. Validate the requested transition.
5. Apply all related state changes atomically.
6. Commit before calling external services.

Do not implement remaining seats as a browser-maintained or manually edited value.

### Migrations

- Give migrations descriptive names.
- Make the forward migration deterministic.
- Include a safe rollback where practical.
- Do not edit a migration after it has been applied to a shared environment; add a new migration.
- Review data migrations separately from structural migrations when they carry operational risk.

## Booking State Guidelines

- Define booking states and allowed transitions centrally.
- Do not update status with unrestricted arbitrary strings.
- Make transitions conditional on the current state.
- Treat repeated requests to reach the current state as idempotent when safe.
- Record important timestamps such as Checkout creation, payment, expiry, cancellation, and refund.
- Preserve the unit price, total, currency, delegate count, and course-session identity used at purchase time.
- Do not delete paid bookings to represent cancellation or refunds; transition their state and retain the audit record.

## Stripe Guidelines

- Create Checkout Sessions only from validated, stored bookings.
- Select Stripe Price IDs from server-owned course-session configuration.
- Set quantity from the stored delegate count.
- Put only internal correlation identifiers in Stripe metadata.
- Use the booking ID as `client_reference_id`.
- Store the returned Checkout Session ID immediately.
- Include Stripe's literal `{CHECKOUT_SESSION_ID}` placeholder in the success URL.
- Never put Stripe secret keys in frontend code, logs, database records, or committed files.
- Treat Stripe metadata as a correlation aid, not the primary booking record.

### Webhooks

- Register the webhook route before general JSON parsing.
- Verify `Stripe-Signature` against the original raw request body.
- Reject invalid signatures before logging or processing event content.
- Store every verified Stripe `event.id` under a unique constraint.
- Validate payment status, amount, currency, quantity, Session ID, and booking identity.
- Keep webhook database processing short.
- Store durable fulfilment jobs before returning success.
- Do not send emails or call Google Calendar directly inside the webhook transaction.
- Return `500` for temporary database failures so Stripe retries.
- Return `200` for completed duplicate events.
- Design for duplicate and out-of-order delivery.

## Fulfilment Jobs

- Give every action a deterministic deduplication key.
- Atomically claim jobs so two worker loops cannot perform the same action.
- Record attempts, retry time, provider reference, completion time, and sanitized last error.
- Use bounded exponential backoff for transient failures.
- Distinguish retryable provider errors from permanent validation/configuration errors.
- Mark repeatedly failed jobs for administrator review.
- Make handlers safe to rerun after uncertain provider responses.
- Keep job payloads small; store authoritative booking data in normalized tables.

## Email Guidelines

- Keep templates outside route and webhook handlers.
- Produce both HTML and plain-text versions.
- Escape every customer-provided value before inserting it into HTML.
- Use stored booking and course-session data, not untrusted webhook metadata, to build content.
- Include booking reference, course date/time, delivery type, venue or joining details, delegates, seat count, and support contact information.
- Store Resend message IDs after successful sends.
- Do not claim payment is complete until the booking is durably marked paid.
- Avoid including accessibility notes or other sensitive information unless operationally necessary.
- Test templates with missing optional fields and long but valid values.

## Google Calendar Guidelines

- Use a dedicated business calendar with least-privilege credentials.
- Build event timestamps from stored course-session data.
- Set the intended timezone explicitly.
- Store the returned Google event ID.
- Check existing state before creating an event.
- Update the stored event for rescheduling or cancellation rather than creating another event.
- Restrict guest permissions and attendee visibility where supported.
- Do not expose Google credentials or raw provider errors.
- Treat Calendar API failures as fulfilment failures, not payment failures.

## Frontend Guidelines

- Use semantic HTML and accessible form labels.
- Keep JavaScript progressively understandable; do not add a framework unless the interface becomes complex enough to justify it.
- Load course dates and availability from the backend.
- Display loading, empty, sold-out, validation, network-error, and retry states.
- Disable submission while Checkout creation is in progress, but do not rely on the button state to prevent duplicate server operations.
- Render one delegate section per selected seat.
- Preserve entered data when validation fails where safe.
- Treat frontend validation as user assistance; repeat all validation on the backend.
- Escape or use text-based DOM APIs when rendering API data.
- Do not place secrets or privileged configuration in browser JavaScript.
- Do not show a confirmed booking solely because the browser reached the success page.

## Security and Privacy

- Keep secrets in protected Render environment variables and local ignored files.
- Provide a `.env.example` containing names and documentation but no secret values.
- Validate required secrets at startup without logging their values.
- Restrict CORS to approved frontend origins.
- Rate-limit Checkout and administrative authentication endpoints.
- Apply request body size limits.
- Use HTTPS in deployed environments.
- Add secure headers appropriate to the frontend and API.
- Avoid collecting personal information that is not needed to deliver the training.
- Redact personal information from logs.
- Define a retention policy for expired holds, failed bookings, and delegate data.
- Protect all administrative operations with authentication and authorization.
- Never store card details; Stripe hosts payment collection.
- Review dependencies regularly and address relevant security advisories.

## Logging

Use structured JSON logging in the backend.

Include identifiers that allow one workflow to be traced:

```text
requestId
bookingId
bookingReference
courseSessionId
stripeEventId
stripeSessionId
fulfilmentJobId
jobType
```

Use levels consistently:

- `debug`: development diagnostics.
- `info`: normal lifecycle events.
- `warn`: rejected requests, duplicates, and recoverable provider failures.
- `error`: failed transactions, inconsistent state, and exhausted retries.

Never log:

- Secret keys or credentials.
- Authorization headers.
- Raw webhook bodies.
- Card or bank information.
- Full service-account JSON.
- Complete delegate records or sensitive notes.

Log state changes and outcomes, not large raw objects.

## Error Handling

- Use one centralized HTTP error handler.
- Define typed or categorized application errors.
- Separate expected business errors from unexpected system failures.
- Attach safe operational context when rethrowing errors.
- Log unexpected failures once at the boundary responsible for reporting them.
- Do not silently swallow errors.
- Do not return provider error messages to the browser.
- Ensure cleanup failures do not hide the original failure.
- Treat external-provider timeouts as uncertain outcomes and rely on idempotency before retrying.

## Testing

Every material feature should include tests proportionate to its risk.

### Unit tests

- Validation schemas.
- Availability calculations.
- Price and total calculations.
- Booking-state transitions.
- Retry decisions.
- Email escaping and rendering.

### Integration tests

- Database repositories and constraints.
- Booking and seat-hold transactions.
- Concurrent attempts to reserve the final seats.
- Checkout creation with a mocked Stripe client.
- Webhook processing and duplicate event delivery.
- Fulfilment job claiming and retry behavior.

### End-to-end tests

- Future course dates load correctly.
- A purchaser can register multiple delegates.
- Successful Stripe test payment confirms the booking.
- Expired Checkout releases seats.
- Confirmation/admin emails and calendar jobs are created once.
- The success page displays verified backend state.

Use Stripe test mode and Stripe CLI fixtures before enabling live changes.

Tests must not call live payment, email, or calendar services.

## Tooling and Quality Checks

The project should provide repeatable commands for:

- Starting development.
- Running migrations.
- Linting.
- Formatting checks.
- Unit and integration tests.
- Production startup.

Run the relevant checks before merging. Do not apply broad automatic rewrites to unrelated files in a focused change.

## Documentation

- Update documentation when an API, environment secret, schema, deployment step, or business rule changes.
- Document why a non-obvious decision exists, not what self-explanatory code does.
- Keep example payloads free of real personal information or credentials.
- Record significant architectural decisions in `ARCHITECTURE.md` or a short decision record.
- Keep `PROJECT_ROADMAP.md` focused on delivery state rather than low-level implementation notes.

## Git and Change Management

- Keep commits focused and reviewable.
- Use descriptive commit messages that explain the outcome.
- Do not commit `.env`, credentials, service-account files, database dumps containing personal data, or generated dependency folders.
- Include migrations and their related application changes together where practical.
- Do not rewrite unrelated code during a feature or bug fix.
- Identify breaking deployment dependencies in the change description.
- Deploy database-compatible changes before code that requires them.

## Review Checklist

Before approving a booking-platform change, confirm:

- [ ] External input is validated.
- [ ] Prices and availability come from the backend.
- [ ] Capacity remains safe under concurrency.
- [ ] Database changes include migrations and constraints.
- [ ] Booking transitions are explicit and idempotent.
- [ ] Webhook duplicates cannot repeat side effects.
- [ ] External calls occur outside critical database transactions.
- [ ] Errors are safe for users and useful in logs.
- [ ] Secrets and personal information are not exposed.
- [ ] Tests cover success, failure, duplicate, and retry paths.
- [ ] Documentation reflects the change.
- [ ] The implementation remains understandable for a small development team.

## Definition of Done

A change is complete when:

1. Its acceptance criteria are met.
2. Relevant automated tests pass.
3. Database migrations are included and reviewed where required.
4. Validation, logging, and error handling are present.
5. Security and privacy implications have been considered.
6. Retry and duplicate behavior are defined for external integrations.
7. Documentation is updated.
8. The change is verified in an appropriate non-production environment.
9. No unrelated files or behavior have been modified.

## Simplicity Rule

Choose the smallest design that preserves correctness and recoverability.

For the expected workload, prefer:

- One modular application over microservices.
- PostgreSQL transactions over distributed locking.
- A PostgreSQL-backed fulfilment table over a new queue service.
- Conventional REST endpoints over a more complex API layer.
- Explicit business services over generic abstraction frameworks.

Complexity may be added later when measurement or operational experience demonstrates a real need.
