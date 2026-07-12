AV Training Website V7 Backend Connected

This version connects the booking form to the Node.js backend.

Flow:
1. User completes booking form.
2. Website sends booking details to http://localhost:3000/create-checkout-session.
3. Backend creates a Stripe Checkout session.
4. User is redirected to Stripe.
5. Stripe redirects to success.html or cancel.html.

You must keep the backend terminal running:
cd ~/Desktop/AV_Training_Backend_Starter/server
npm start

Important:
- This version needs the backend running on port 3000.
- Backend .env needs your real STRIPE_SECRET_KEY.
- Backend index.js needs your real Stripe PRICE IDs, not payment links.
