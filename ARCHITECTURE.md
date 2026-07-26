# AV Training Booking Platform Architecture

## Purpose

This document defines the target architecture for the AV Training booking platform. It covers the website, booking API, course capacity, Stripe payments, webhook processing, email and calendar automation, administration, and Render deployment.

The design is intended for a small training company processing tens or hundreds of bookings per month. It prioritizes reliable bookings and straightforward maintenance over infrastructure designed for very high scale.

## Architecture Summary

The platform should use a modular monolith: one Node.js application containing clearly separated business modules, supported by one PostgreSQL database.

```text
Customer browser
      │
      ├── Static website
      │       │
      │       └── HTTPS API requests
      │
      ▼
Node.js / Express application on Render
      │
      ├── Course and availability module
      ├── Booking and delegate module
      ├── Stripe Checkout module
      ├── Stripe webhook module
      ├── Fulfilment worker
      ├── Email integration
      ├── Google Calendar integration
      └── Admin module
              │
              ▼
       Render PostgreSQL

External services:
  Stripe Checkout
  Resend
  Google Calendar API
```

One application is sufficient for the expected workload. The internal module boundaries allow individual responsibilities to be tested and changed without introducing microservices, Redis, or a separate message broker.

## System Components

### Frontend

The frontend remains a browser-based website responsible for:

- Displaying course information.
- Loading available online and classroom sessions from the API.
- Showing server-calculated remaining seats.
- Collecting purchaser and delegate details.
- Starting Stripe Checkout through the backend.
- Displaying verified booking status after Checkout.

The frontend must not decide price, capacity, booking state, or payment state. Values displayed in the browser are informational until validated by the backend.

### Backend API

The Node.js/Express backend is responsible for:

- Validating all input.
- Managing courses, sessions, bookings, delegates, and seat holds.
- Calculating availability.
- Creating Stripe Checkout Sessions.
- Verifying and processing Stripe webhooks.
- Creating durable fulfilment jobs.
- Sending emails and calendar invitations.
- Serving protected administrative operations.

The backend should be internally divided into route, service, repository, integration, and validation layers. These are code organization boundaries, not separately deployed services.

### PostgreSQL

PostgreSQL is the source of truth for:

- Courses and scheduled course sessions.
- Purchasers and delegates.
- Pending and paid bookings.
- Active seat holds.
- Stripe event-processing history.
- Email and calendar fulfilment jobs.
- External provider references.

All schema changes must use versioned migrations.

### External integrations

- **Stripe Checkout:** Hosted payment collection.
- **Stripe webhooks:** Authoritative payment notification.
- **Resend:** Customer, delegate, and administrator emails.
- **Google Calendar:** Course invitations for paid delegates.
- **Render:** Web service and managed PostgreSQL hosting.

## Suggested Backend Structure

```text
server/
├── app/
│   ├── courses/
│   ├── bookings/
│   ├── delegates/
│   ├── checkout/
│   ├── webhooks/
│   ├── fulfilment/
│   └── admin/
├── database/
│   ├── migrations/
│   └── repositories/
├── integrations/
│   ├── stripe/
│   ├── resend/
│   └── google-calendar/
├── middleware/
├── configuration/
├── logging/
└── server.js
```

Business rules should live in services rather than route handlers. Stripe, Resend, and Google-specific code should remain behind integration interfaces so providers can be tested or replaced without rewriting booking logic.

## Core Data Model

### Courses

A course describes a reusable training product, such as SPA Health & Safety Core Day.

Key fields:

- ID and stable code.
- Name and description.
- Normal duration.
- Active status.

### Course sessions

A course session represents a specific date and delivery method.

Key fields:

- Course ID.
- Delivery type: `online` or `classroom`.
- Start and end timestamps.
- Timezone, normally `Europe/London`.
- Venue or online joining details.
- Capacity from 1 to 12.
- Unit price, currency, and Stripe Price ID.
- Status: `draft`, `open`, `closed`, or `cancelled`.

Every bookable date has a stable session ID. The frontend submits this ID instead of a human-readable date string.

### Bookings

A booking represents one purchaser transaction for one course session.

Key fields:

- Booking ID and human-readable reference.
- Course-session ID.
- Purchaser name, email, and phone.
- Delegate count.
- Unit price, total, and currency captured at booking time.
- Booking status.
- Stripe Checkout Session and Payment Intent references.
- Hold-expiry and payment timestamps.

Suggested states:

```text
pending_checkout
checkout_created
paid
expired
payment_failed
cancelled
refunded
```

### Delegates

Each attendee is stored separately and belongs to one booking. A booking must have between 1 and 12 delegates, and the stored delegate count must match the booking quantity.

### Seat holds

A seat hold temporarily reserves booking capacity while Checkout is open. Holds have explicit expiry timestamps and are included in availability only while active.

### Stripe events

Each verified Stripe event is stored using Stripe's `event.id` as a unique key. Its processing state and sanitized failure information are recorded for audit and retry decisions.

### Fulfilment jobs

PostgreSQL also acts as a small durable job queue for:

- Customer confirmation email.
- Delegate joining emails.
- Administrator notification.
- Google Calendar invitation.

Every job has a unique deduplication key, processing status, attempt count, retry time, provider reference, and last error.

## Availability and Capacity

Every course session has a maximum capacity of 12 delegates.

Availability is calculated as:

```text
remaining seats =
    session capacity
    - delegates on paid bookings
    - delegates covered by unexpired active holds
```

Remaining seats should be calculated from authoritative records rather than maintained as an independently editable counter.

### Concurrent booking protection

Checkout creation must use a PostgreSQL transaction:

1. Lock the selected course-session row.
2. Confirm it is open and in the future.
3. Calculate remaining capacity.
4. Reject requests exceeding the available seats.
5. Store the pending booking, delegates, and seat hold.
6. Commit the reservation.

This prevents simultaneous customers from reserving the same final seat.

## Public API

Recommended endpoints:

```text
GET  /health
GET  /api/course-sessions
POST /api/checkout-sessions
GET  /api/bookings/status
POST /webhooks/stripe
```

### Course sessions

`GET /api/course-sessions` returns future open dates, delivery information, public prices, and calculated remaining seats. It does not expose Stripe Price IDs.

### Checkout creation

`POST /api/checkout-sessions` accepts:

- A course-session ID.
- Purchaser details.
- An array containing one record per delegate.
- Optional additional information.

The backend derives quantity from the delegate array and derives price from the stored course session.

### Booking status

The Stripe success URL includes `{CHECKOUT_SESSION_ID}`. The frontend uses that value to request minimal verified status from the backend. A redirect by itself never confirms payment.

## Stripe Checkout Flow

1. The customer selects a course session and enters purchaser/delegate details.
2. The backend validates the request and atomically holds the requested seats.
3. The backend creates the pending booking.
4. Stripe Checkout is created with the server-owned Price ID and delegate quantity.
5. The booking ID is placed in `client_reference_id` and minimal Stripe metadata.
6. The Stripe Session ID is stored against the booking.
7. The browser redirects to Stripe.
8. Payment completion is processed through the webhook.
9. The success page retrieves verified booking status from the backend.

Stripe metadata is a correlation mechanism, not the booking database.

## Webhook Processing

The Stripe webhook route must receive the original raw body and verify `Stripe-Signature` before processing.

Initially supported events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Processing sequence:

1. Verify the webhook signature.
2. Begin a database transaction.
3. Insert the Stripe event using its unique event ID.
4. Return success immediately if the event was already completed.
5. Locate the stored booking.
6. Verify Session ID, payment status, amount, currency, and quantity.
7. Apply a valid booking-state transition exactly once.
8. Convert paid seat holds into confirmed capacity or release expired holds.
9. Insert deduplicated fulfilment jobs for paid bookings.
10. Mark the event completed and commit.
11. Return `200` without waiting for email or Google APIs.

Duplicate protection exists at three levels:

- Unique Stripe event IDs.
- Conditional booking-state transitions.
- Unique fulfilment-job deduplication keys.

## Email and Calendar Automation

### Fulfilment worker

A lightweight worker loop runs inside the same Render application and polls PostgreSQL for pending jobs. It atomically claims jobs, calls the relevant provider, stores the result, and retries transient failures with bounded backoff.

This avoids adding Redis or another hosted service. The worker can move into a separate Render Background Worker later without changing the booking model.

### Emails

Resend sends:

- Purchaser confirmation.
- Individual delegate joining information where required.
- Administrator booking notification.

Emails include the booking reference, course, date/time, timezone, delivery information, delegates, seat count, and payment amount. Templates provide HTML and plain-text content and escape all customer-provided values.

### Google Calendar

A dedicated business calendar is accessed through restricted Google credentials. For each paid booking, the platform creates an event using the stored course-session timestamps and invites the delegates.

The Google event ID is stored so retries, cancellations, and rescheduling update the original event rather than create duplicates.

## Configuration

Only credentials and signing secrets belong in environment variables:

```text
DATABASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
GOOGLE_SERVICE_ACCOUNT_JSON
```

Render supplies operational values such as `PORT` at runtime.

Non-secret configuration belongs in versioned application configuration or PostgreSQL, including course capacity, business contact details, timezone, venue details, frontend URL, Stripe Price IDs, retry limits, and seat-hold duration.

The application must validate required secrets during startup and fail clearly if configuration is incomplete.

## Logging and Error Handling

Use structured JSON logs with identifiers such as:

- Request ID.
- Booking ID and reference.
- Course-session ID.
- Stripe event and Session IDs.
- Fulfilment job ID and type.

Never log secrets, credentials, card information, raw webhook bodies, or unnecessary personal data.

The API uses centralized error handling and stable error codes. Provider and database details are logged internally but are not returned to customers.

Examples:

```text
VALIDATION_ERROR          400
COURSE_SESSION_NOT_FOUND  404
SESSION_NOT_BOOKABLE      409
INSUFFICIENT_SEATS        409
RATE_LIMITED              429
CHECKOUT_UNAVAILABLE      502
INTERNAL_ERROR            500
```

Webhook responses follow different rules:

- Invalid signature returns `400`.
- Processed and duplicate events return `200`.
- Temporary database failures return `500` so Stripe retries.
- Email/calendar failures return `200` after durable jobs are stored because the internal worker owns those retries.

## Security Boundaries

- Validate every external request against a strict schema.
- Limit request body sizes.
- Restrict browser CORS to approved frontend origins.
- Rate-limit Checkout creation.
- Verify every Stripe webhook signature.
- Use parameterized database access.
- Escape user content in email HTML.
- Store no card details.
- Protect administrator endpoints with authentication and authorization.
- Restrict Google credentials to the required calendar.
- Keep secrets only in Render's protected environment settings.
- Minimize collection, logging, and retention of personal information.

## Render Deployment

Initial production resources:

1. One Render Web Service for the Node.js application and fulfilment loop.
2. One Render PostgreSQL database.
3. One production Stripe webhook endpoint.
4. Resend and Google credentials stored as Render secrets.

Deployment order:

1. Run database migrations.
2. Validate secrets and connect to PostgreSQL.
3. Start the HTTP server.
4. Start the fulfilment loop.
5. Expose the health endpoint.

The health endpoint should check application and database availability without calling every external provider.

## Testing Strategy

Minimum automated coverage:

- Request and environment validation.
- Capacity calculations.
- Concurrent attempts to reserve the final seats.
- Booking-state transitions.
- Checkout amount and quantity selection.
- Valid and invalid webhook signatures.
- Duplicate and out-of-order webhook events.
- Checkout expiry and hold release.
- Fulfilment deduplication and retry behavior.
- Email HTML escaping.
- Google event reuse after a retry.

Stripe CLI and Stripe test mode should be used for end-to-end payment testing before live deployment.

## Extension Boundaries

Future capabilities should extend the existing domain model:

- New courses create course records and sessions.
- Waiting lists extend session availability behavior.
- Certificates and reminders become new fulfilment job types.
- Refunds and rescheduling become explicit booking state transitions.
- An admin dashboard consumes protected APIs over the same services.
- Reporting reads from PostgreSQL.
- A separate worker deployment can process the existing fulfilment table if workload grows.

The platform should remain a modular monolith until actual load or operational constraints justify separation. This preserves a simple deployment while avoiding tightly coupled route handlers that would require a rewrite later.

## Architectural Decisions

1. **Modular monolith over microservices:** appropriate for the team and expected booking volume.
2. **PostgreSQL as the source of truth:** required for durable bookings and transactional capacity.
3. **Calculated availability over a mutable counter:** reduces inconsistency risk.
4. **Seat holds before Checkout:** prevents overselling while payment is in progress.
5. **Webhooks over redirects:** payment confirmation remains reliable if the browser closes.
6. **Database-backed fulfilment jobs:** reliable automation without an additional queue service.
7. **Server-owned prices and capacity:** prevents client manipulation.
8. **Stable course-session IDs:** supports multiple dates and future course types cleanly.

## Current Architectural Priority

The immediate priority is the persistence and booking boundary:

1. PostgreSQL and migrations.
2. Course-session, booking, delegate, seat-hold, Stripe-event, and fulfilment-job models.
3. Dynamic availability API.
4. Atomic seat reservations.
5. Checkout creation from stored bookings.
6. Idempotent webhook processing.
7. Durable email and calendar fulfilment.

This sequence establishes reliable booking and capacity data before expanding payment automation or administrative features.
