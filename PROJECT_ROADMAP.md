# AV Training Booking Platform Roadmap

## Vision

Build a simple, dependable booking platform for AV Training & Consultancy that allows customers to find an online or classroom course, register up to 12 delegates, pay securely, and receive everything they need automatically.

The platform should give AV Training an accurate view of course dates, bookings, delegates, payments, and remaining seats. It should suit a small training company handling tens or hundreds of bookings per month while providing a clean foundation for additional courses, venues, and administrative tools.

The intended architecture is a modular Node.js application on Render, backed by PostgreSQL and integrated with Stripe Checkout, Resend, and Google Calendar. Reliability and clarity take priority over unnecessary infrastructure.

## Current Completed Features

- Static responsive website for AV Training & Consultancy.
- SPA Health & Safety Core Day course information.
- Online and classroom delivery options.
- Display of multiple course dates.
- Booking form collecting purchaser contact details, requested places, and additional information.
- Booking-page preselection from course-date links.
- Frontend connection to the deployed Checkout Session endpoint.
- Stripe Checkout Session creation for online and classroom Stripe Prices.
- Stripe-hosted payment page redirect.
- Static payment success and cancellation pages.
- Stripe webhook signature verification in the separate backend repository.
- Basic handling of `checkout.session.completed`.
- Basic customer confirmation and administrator notification emails through Resend.

These features form a working prototype. Course dates and seat counts are currently static, multi-seat quantities are not yet processed by the backend, and successful payment does not yet create a durable booking record.

## Milestone 1 – Foundation

**Goal:** Establish a maintainable, persistent backend as the source of truth.

- [ ] Organize the backend as a modular Node.js/Express application.
- [ ] Add Render PostgreSQL and a migration system.
- [ ] Define database models for courses, course sessions, bookings, delegates, Stripe events, seat holds, and fulfilment jobs.
- [ ] Represent each online or classroom course date as a stable course-session record.
- [ ] Store structured start/end times using the `Europe/London` timezone.
- [ ] Enforce a maximum course capacity of 12 delegates at database and application levels.
- [ ] Add schema validation for requests and startup configuration.
- [ ] Add centralized error handling and consistent public error codes.
- [ ] Add structured, privacy-aware logging with request and booking identifiers.
- [ ] Document local development, migrations, testing, and Render deployment.
- [ ] Store only credentials and signing secrets in environment variables; keep ordinary business configuration in code or PostgreSQL.

**Completion criteria:** The backend starts with validated configuration, connects to PostgreSQL, runs migrations, exposes a health endpoint, and can store and retrieve course-session data.

## Milestone 2 – Booking Engine

**Goal:** Make bookings, delegates, dates, and capacity reliable before accepting payment.

- [ ] Add an API that returns future, open course sessions and calculated remaining seats.
- [ ] Replace hard-coded frontend dates and availability with data from the API.
- [ ] Submit a stable `courseSessionId` instead of a display-formatted date.
- [ ] Collect purchaser details separately from delegate details.
- [ ] Render and validate one delegate form section per requested seat.
- [ ] Require an explicit numeric delegate count from 1 to 12.
- [ ] Store pending bookings and delegate records before Checkout begins.
- [ ] Implement time-limited seat holds.
- [ ] Calculate availability from paid bookings and active holds.
- [ ] Use PostgreSQL transactions and row locking to prevent overselling.
- [ ] Disable sold-out, closed, cancelled, and past sessions in the frontend.
- [ ] Add a safe process for releasing abandoned or expired holds.

**Completion criteria:** Concurrent customers cannot reserve more than the remaining capacity, every requested seat has a delegate record, and availability is consistent across the frontend and database.

## Milestone 3 – Payments

**Goal:** Connect every Stripe payment to exactly one stored booking.

- [ ] Create Checkout Sessions from server-owned course-session and pricing data.
- [ ] Set Stripe line-item quantity from the validated delegate count.
- [ ] Store the Stripe Checkout Session ID against the pending booking.
- [ ] Use the booking ID as Stripe's client reference and minimal metadata.
- [ ] Include `{CHECKOUT_SESSION_ID}` in the success URL.
- [ ] Verify Stripe webhook signatures using the raw request body.
- [ ] Handle `checkout.session.completed`.
- [ ] Handle asynchronous payment success and failure.
- [ ] Handle expired Checkout Sessions and release their seat holds.
- [ ] Verify payment status, amount, currency, quantity, and booking identity before confirmation.
- [ ] Store every Stripe event ID with a unique database constraint.
- [ ] Make booking state transitions idempotent and safe for out-of-order events.
- [ ] Add a booking-status endpoint for the success page.
- [ ] Show confirmed, processing, or failed status based on backend state rather than the redirect alone.

**Completion criteria:** A valid payment confirms one booking and its seats exactly once, while duplicate or retried webhook events cause no duplicate processing.

## Milestone 4 – Automation

**Goal:** Reliably deliver customer, delegate, and administrator follow-up after payment.

- [ ] Add a durable PostgreSQL-backed fulfilment-job table.
- [ ] Run a lightweight fulfilment worker in the backend deployment.
- [ ] Create idempotent jobs for customer email, delegate email, administrator notification, and calendar invitations.
- [ ] Move Resend templates into dedicated modules.
- [ ] Escape customer-provided content and provide HTML and plain-text email versions.
- [ ] Include booking reference, course date/time, delivery details, delegates, seat count, and amount in confirmations.
- [ ] Store Resend message IDs and delivery outcomes.
- [ ] Retry temporary email failures with bounded backoff.
- [ ] Connect a dedicated Google Calendar using restricted credentials.
- [ ] Create calendar events with the correct `Europe/London` time, venue or online joining link, and delegate attendees.
- [ ] Store Google event IDs and prevent duplicate invitations.
- [ ] Support calendar and email updates for cancellations or rescheduling.
- [ ] Alert administrators when fulfilment repeatedly fails.

**Completion criteria:** A paid booking produces the required emails and calendar invitations once, with durable retry behavior if an external provider is temporarily unavailable.

## Milestone 5 – Admin Dashboard

**Goal:** Give AV Training a small, secure operational interface.

- [ ] Add authenticated administrator access.
- [ ] Display upcoming course sessions and remaining seats.
- [ ] Display booking, purchaser, payment, and delegate information.
- [ ] Create, edit, close, cancel, and reschedule course sessions.
- [ ] Add or update venue and online joining information.
- [ ] Search bookings by reference, purchaser, delegate, date, or Stripe Session ID.
- [ ] Export delegate lists for a selected course session.
- [ ] Show failed email or calendar jobs and allow safe retries.
- [ ] Record cancellations and refunds without directly editing database state.
- [ ] Maintain an audit trail for important administrative actions.

**Completion criteria:** Routine course and booking administration can be completed without editing source files or accessing PostgreSQL directly.

## Future Expansion

- Additional courses such as SMSTS, SSSTS, and First Aid.
- More classroom venues and additional online delivery formats.
- Waiting lists for sold-out dates.
- Discount codes, company accounts, and invoice-based bookings.
- Self-service booking changes and cancellations.
- Automated refund workflows.
- Course reminder emails and post-course follow-up.
- Certificate and training-record management.
- Customer accounts and repeat-booking shortcuts.
- Attendance recording and completion status.
- Reporting for revenue, occupancy, course demand, and email delivery.
- Accounting, CRM, or learning-management integrations.
- Move the fulfilment worker into a separate Render worker only if workload justifies it.

New capabilities should extend the existing course-session, booking, delegate, and fulfilment models rather than creating separate parallel booking flows.

## Development Rules

1. PostgreSQL is the source of truth for bookings, delegates, course sessions, and capacity.
2. The backend owns price, availability, capacity, and booking-state decisions; never trust client-provided totals or display values.
3. A course can contain no more than 12 confirmed delegates, including active seat holds where availability is concerned.
4. All capacity changes must occur in database transactions that are safe under concurrent requests.
5. Stripe webhooks, not browser redirects, confirm payment.
6. Every webhook and fulfilment action must be idempotent.
7. External email and calendar calls must not run inside the critical payment database transaction.
8. Store only secrets in environment variables. Store non-secret course and business configuration in versioned application configuration or PostgreSQL.
9. Never log secrets, raw payment data, complete credentials, or unnecessary personal information.
10. Return safe, stable error messages to users and log diagnostic context internally.
11. Validate all external input at the API boundary.
12. Add automated tests for booking capacity, state transitions, webhook duplication, and failure recovery before live release.
13. Keep the system as one modular application until scale or operational evidence justifies separation.
14. Apply database changes through migrations; do not make undocumented production edits.
15. Deploy and verify changes in Stripe test mode before enabling live behavior.

## Current Focus

The immediate focus is **Milestone 1 – Foundation**, followed by the capacity-critical parts of **Milestone 2 – Booking Engine**.

The next implementation sequence should be:

1. Bring the backend and its deployment documentation under a clear, maintainable project structure.
2. Add PostgreSQL and migrations.
3. Create the course, course-session, booking, delegate, seat-hold, Stripe-event, and fulfilment-job models.
4. Seed or administratively create the first online and classroom course dates.
5. Implement the availability API and replace static frontend seat counts.
6. Implement delegate registration and atomic seat holds.
7. Rebuild Checkout creation around stored bookings.
8. Complete idempotent Stripe webhook processing.
9. Add durable email and Google Calendar automation.

Payments should not be expanded further until booking persistence and atomic seat tracking are in place. That order prevents the platform from accepting payments for bookings it cannot reliably store or capacity it cannot reliably protect.
