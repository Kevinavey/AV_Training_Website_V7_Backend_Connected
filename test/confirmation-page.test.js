const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  STORAGE_KEY,
  bookingStatusViewModel,
  checkoutSessionIdFromSearch,
  confirmationViewModel,
  pollBookingStatus,
  readConfirmation,
  requireConfirmation
} = require("../js/confirmation-page.js");

const websiteRoot = path.resolve(__dirname, "..");

function validConfirmation() {
  return {
    bookingReference: "AVT-ABC12345",
    paymentStatus: "processing",
    courseName: "SPA Health & Safety Core Day",
    courseDateTime: "21 July 2026, 08:30–16:30",
    deliveryType: "Classroom — West Thames College",
    purchaserName: "Taylor Purchaser",
    delegates: ["Alex Delegate", "Jamie Delegate"],
    totalPaid: { amountMinorUnits: 30800, currency: "GBP" },
    bookingDate: "2026-07-21T10:30:00.000Z"
  };
}

function backendBooking(status) {
  return {
    status,
    bookingReference: "AVT-ABC12345",
    course: {
      name: "SPA Health & Safety Core Day",
      startsAt: "2026-08-01T07:30:00.000Z",
      endsAt: "2026-08-01T15:30:00.000Z",
      timezone: "Europe/London",
      deliveryType: "classroom",
      venue: { name: "West Thames College", address: "London Road" }
    },
    purchaserName: "Taylor Purchaser",
    delegates: [{ fullName: "Alex Delegate" }],
    totalPaid: { amountMinorUnits: 15400, currency: "GBP" },
    bookingDate: "2026-07-21T10:30:00.000Z",
    confirmationEmailQueued: status === "confirmed"
  };
}

function storageFor(value) {
  return {
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return value;
    }
  };
}

test("builds a complete valid success-page view", () => {
  const stored = validConfirmation();
  const confirmation = readConfirmation(
    storageFor(JSON.stringify(stored)),
    stored.bookingReference
  );
  const view = confirmationViewModel(confirmation);

  assert.deepEqual(view.delegates, ["Alex Delegate", "Jamie Delegate"]);
  assert.equal(view.bookingReference, "AVT-ABC12345");
  assert.match(view.paymentStatus, /confirmation pending/);
  assert.equal(view.courseName, stored.courseName);
  assert.equal(view.totalPaid, "£308.00");
  assert.match(view.bookingDate, /21 July 2026/);
});

test("rejects missing, malformed, and mismatched booking references", () => {
  const stored = validConfirmation();
  assert.equal(readConfirmation(storageFor(null)), null);
  assert.equal(requireConfirmation({ ...stored, bookingReference: "invalid" }), null);
  assert.equal(requireConfirmation(stored, "AVT-DIFFERENT"), null);
  assert.equal(readConfirmation(storageFor("not-json")), null);
});

test("success page includes loading, valid, and invalid states", () => {
  const html = fs.readFileSync(path.join(websiteRoot, "success.html"), "utf8");
  assert.match(html, /id="confirmationLoading"/);
  assert.match(html, /id="confirmationContent"[^>]*hidden/);
  assert.match(html, /id="confirmationInvalid"[^>]*hidden/);
  assert.match(html, /confirmation email will arrive shortly/i);
  assert.match(html, /keep your booking reference/i);
  assert.match(html, /Payment submitted — confirmation pending\./);
});

test("successful polling stops when the booking is confirmed", async () => {
  const statuses = [backendBooking("pending"), backendBooking("confirmed")];
  const observed = [];
  const result = await pollBookingStatus({
    checkoutSessionId: "cs_test_success",
    fetchStatus: async () => statuses.shift(),
    onStatus: (booking) => observed.push(booking.status),
    wait: async () => {}
  });
  assert.equal(result.status, "confirmed");
  assert.deepEqual(observed, ["pending", "confirmed"]);
  const view = bookingStatusViewModel(result);
  assert.equal(view.paymentStatus, "Payment confirmed");
  assert.equal(view.confirmationEmailQueued, true);
  assert.match(view.courseDateTime, /08:30–16:30$/);
});

test("SPA Core Day listing displays the standard 08:30–16:30 time", () => {
  const html = fs.readFileSync(path.join(websiteRoot, "index.html"), "utf8");
  assert.match(html, /8:30am - 4:30pm/);
  assert.doesNotMatch(html, /8:30am - 4:00pm/);
});

test("polling stops for failed and expired bookings", async () => {
  for (const status of ["failed", "expired"]) {
    let requestCount = 0;
    const result = await pollBookingStatus({
      checkoutSessionId: `cs_test_${status}`,
      fetchStatus: async () => {
        requestCount += 1;
        return backendBooking(status);
      }
    });
    assert.equal(result.status, status);
    assert.equal(requestCount, 1);
  }
});

test("polling retries temporary failures and times out after about 60 seconds", async () => {
  let elapsed = 0;
  let requests = 0;
  const result = await pollBookingStatus({
    checkoutSessionId: "cs_test_timeout",
    fetchStatus: async () => {
      requests += 1;
      throw new Error("temporary network failure");
    },
    timeoutMs: 60000,
    now: () => elapsed,
    wait: async (duration) => { elapsed += duration; }
  });
  assert.equal(result.status, "timeout");
  assert.equal(elapsed, 60000);
  assert.ok(requests >= 29 && requests <= 31);
});

test("page refresh recovers the Checkout Session ID from the success URL", () => {
  assert.equal(
    checkoutSessionIdFromSearch("?checkoutSessionId=cs_test_refresh123"),
    "cs_test_refresh123"
  );
  assert.equal(checkoutSessionIdFromSearch(""), "");
  assert.equal(checkoutSessionIdFromSearch("?checkoutSessionId=invalid"), "");
});

test("duplicate polling callers share one in-flight request", async () => {
  let resolveStatus;
  let requestCount = 0;
  const fetchStatus = () => {
    requestCount += 1;
    return new Promise((resolve) => { resolveStatus = resolve; });
  };
  const options = {
    checkoutSessionId: "cs_test_duplicate",
    fetchStatus
  };
  const first = pollBookingStatus(options);
  const second = pollBookingStatus(options);
  assert.equal(first, second);
  assert.equal(requestCount, 1);
  resolveStatus(backendBooking("confirmed"));
  assert.equal((await first).status, "confirmed");
});

test("success page includes failed, expired, and timeout outcomes", () => {
  const html = fs.readFileSync(path.join(websiteRoot, "success.html"), "utf8");
  const script = fs.readFileSync(
    path.join(websiteRoot, "js/confirmation-page.js"),
    "utf8"
  );
  assert.match(html, /id="confirmationFailed"/);
  assert.match(html, /id="confirmationExpired"/);
  assert.match(html, /id="confirmationTimeout"/);
  assert.match(html, />Start a New Booking</);
  assert.match(html, /id="confirmationEmailStatus"/);
  assert.match(script, /Confirmation email queued/);
});

test("cancelled page clearly explains the payment outcome and retry", () => {
  const html = fs.readFileSync(path.join(websiteRoot, "cancel.html"), "utf8");
  assert.match(html, /booking was not completed/i);
  assert.match(html, /no payment has been taken/i);
  assert.match(html, /subject to availability/i);
  assert.match(html, /href="book\.html"[^>]*>Try Booking Again</);
});

test("confirmation layout includes its responsive single-column rules", () => {
  const css = fs.readFileSync(path.join(websiteRoot, "css/style.css"), "utf8");
  assert.match(css, /@media \(max-width: 1000px\)/);
  assert.match(css, /\.confirmation-details \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.confirmation-actions \.btn \{ width: 100%; \}/);
});
