const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BookingFormValidationError,
  buildCheckoutPayload,
  calculateTotalMinorUnits,
  createDelegateRecords,
  publicCheckoutError,
  selectedCourseSession
} = require("../js/booking-form.js");

const sessionId = "2df11c03-f8e5-4a0a-914b-2f7f215d58ac";

function bookingInput(delegates) {
  return {
    courseSessionId: sessionId,
    availableSessionIds: [sessionId],
    purchaser: {
      name: "Taylor Purchaser",
      email: "taylor@example.test",
      phone: "07123456789"
    },
    delegates,
    additionalInformation: "Step-free access"
  };
}

test("builds the backend payload for one delegate", () => {
  const payload = buildCheckoutPayload(bookingInput([
    { fullName: "Alex Delegate", email: "alex@example.test", phone: "" }
  ]));
  assert.equal(payload.courseSessionId, sessionId);
  assert.equal(payload.delegates.length, 1);
  assert.equal(payload.additionalInformation, "Step-free access");
  assert.deepEqual(Object.keys(payload), [
    "courseSessionId",
    "purchaser",
    "delegates",
    "additionalInformation"
  ]);
  assert.deepEqual(payload.purchaser, {
    name: "Taylor Purchaser",
    email: "taylor@example.test",
    phone: "07123456789"
  });
});

test("builds one complete payload record per delegate", () => {
  const payload = buildCheckoutPayload(bookingInput([
    { fullName: "Delegate One", email: "one@example.test", phone: "07111111111" },
    { fullName: "Delegate Two", email: "two@example.test", phone: "" }
  ]));
  assert.deepEqual(payload.delegates.map(({ fullName }) => fullName), [
    "Delegate One",
    "Delegate Two"
  ]);
});

test("dynamically adds and removes delegate records while preserving values", () => {
  const existing = [{ fullName: "One", email: "one@example.test", phone: "" }];
  const expanded = createDelegateRecords({ count: 3, existing });
  assert.equal(expanded.length, 3);
  assert.equal(expanded[0].fullName, "One");
  assert.equal(createDelegateRecords({ count: 1, existing: expanded }).length, 1);
});

test("explicit purchaser-as-delegate choice populates delegate one", () => {
  const purchaser = {
    name: "Taylor Purchaser",
    email: "taylor@example.test",
    phone: "07123456789"
  };
  const delegates = createDelegateRecords({
    count: 2,
    purchaser,
    purchaserIsDelegate: true
  });
  assert.deepEqual(delegates[0], {
    fullName: purchaser.name,
    email: purchaser.email,
    phone: purchaser.phone
  });
  assert.equal(delegates[1].fullName, "");
});

test("calculates total price using integer minor units", () => {
  assert.equal(calculateTotalMinorUnits(15400, 3), 46200);
});

test("selects a course using its stable course-session ID", () => {
  const session = { id: sessionId, courseName: "SPA Core Day" };
  assert.equal(selectedCourseSession([session], sessionId), session);
  assert.equal(selectedCourseSession([session], "missing"), null);
});

test("rejects invalid delegate counts, emails, empty records, and stale sessions", () => {
  assert.throws(
    () => buildCheckoutPayload(bookingInput([])),
    BookingFormValidationError
  );
  assert.throws(
    () => buildCheckoutPayload(bookingInput(Array.from({ length: 13 }, (_, index) => ({
      fullName: `Delegate ${index + 1}`,
      email: `delegate-${index + 1}@example.test`,
      phone: ""
    })))),
    /between 1 and 12/
  );
  assert.throws(
    () => buildCheckoutPayload({
      ...bookingInput([{ fullName: "Delegate", email: "delegate@example.test" }]),
      purchaser: { name: "Purchaser", email: "invalid", phone: "07123456789" }
    }),
    /Purchaser email must be a valid email/
  );
  assert.throws(
    () => buildCheckoutPayload(bookingInput([
      { fullName: "Delegate", email: "invalid", phone: "" }
    ])),
    /valid email/
  );
  assert.throws(
    () => buildCheckoutPayload(bookingInput([
      { fullName: "", email: "delegate@example.test", phone: "" }
    ])),
    /name is required/
  );
  assert.throws(
    () => buildCheckoutPayload({ ...bookingInput([{
      fullName: "Delegate",
      email: "delegate@example.test",
      phone: ""
    }]), availableSessionIds: [] }),
    /no longer available/
  );
});

test("maps safe backend errors for customer display", () => {
  assert.match(publicCheckoutError({ error: { code: "COURSE_FULL" } }), /enough seats/);
  assert.match(publicCheckoutError({ error: { code: "INSUFFICIENT_SEATS" } }), /enough seats/);
  assert.match(publicCheckoutError({ error: { code: "SESSION_NOT_BOOKABLE" } }), /no longer open/);
  assert.match(publicCheckoutError({ error: { code: "INVALID_CHECKOUT_REQUEST" } }), /check the booking details/);
  assert.match(publicCheckoutError({ error: { code: "CHECKOUT_UNAVAILABLE" } }), /temporarily unavailable/);
  assert.doesNotMatch(publicCheckoutError({ error: { message: "private detail" } }), /private detail/);
});
