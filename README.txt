AV Training Website V7 Launch Connected

This version connects the booking form and live course availability to the
deployed Node.js backend.

Flow:
1. User completes booking form.
2. Website loads course dates and remaining seats from the deployed backend.
3. Website sends booking details to the deployed backend.
4. Backend creates a Stripe Checkout session.
5. User is redirected to Stripe.
6. Stripe redirects to success.html or cancel.html.

Important:
- The deployed backend must be live on Render.
- Render must contain the required Stripe, database, email and website
  environment variables.
- Google Calendar variables can be left unconfigured while Calendar
  invitations are postponed; payment confirmation and email fulfilment remain
  separate from Calendar fulfilment.
