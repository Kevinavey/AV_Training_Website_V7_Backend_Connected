(function exposeBookingForm(globalScope) {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  class BookingFormValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "BookingFormValidationError";
    }
  }

  function requireText(value, label) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new BookingFormValidationError(`${label} is required.`);
    }
    return value.trim();
  }

  function requireEmail(value, label) {
    const email = requireText(value, label).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new BookingFormValidationError(`${label} must be a valid email address.`);
    }
    return email;
  }

  function delegateCount(value) {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      throw new BookingFormValidationError("Choose between 1 and 12 delegates.");
    }
    return count;
  }

  function createDelegateRecords({ count, existing = [], purchaser = null, purchaserIsDelegate = false }) {
    const total = delegateCount(count);
    return Array.from({ length: total }, (_, index) => {
      if (index === 0 && purchaserIsDelegate) {
        return {
          fullName: purchaser?.name ?? "",
          email: purchaser?.email ?? "",
          phone: purchaser?.phone ?? ""
        };
      }
      return {
        fullName: existing[index]?.fullName ?? "",
        email: existing[index]?.email ?? "",
        phone: existing[index]?.phone ?? ""
      };
    });
  }

  function buildCheckoutPayload({
    courseSessionId,
    availableSessionIds,
    purchaser,
    delegates,
    additionalInformation = ""
  }) {
    if (!courseSessionId || !availableSessionIds?.includes(courseSessionId)) {
      throw new BookingFormValidationError(
        "The selected course session is no longer available. Please choose another date."
      );
    }

    const count = delegateCount(delegates?.length);
    const normalizedPurchaser = {
      name: requireText(purchaser?.name, "Purchaser name"),
      email: requireEmail(purchaser?.email, "Purchaser email"),
      phone: requireText(purchaser?.phone, "Purchaser phone")
    };
    const normalizedDelegates = delegates.map((delegate, index) => ({
      fullName: requireText(delegate?.fullName, `Delegate ${index + 1} name`),
      email: requireEmail(delegate?.email, `Delegate ${index + 1} email`),
      phone: typeof delegate?.phone === "string" ? delegate.phone.trim() : ""
    }));

    if (normalizedDelegates.length !== count) {
      throw new BookingFormValidationError("Every delegate must have a complete record.");
    }

    return {
      courseSessionId,
      purchaser: normalizedPurchaser,
      delegates: normalizedDelegates,
      additionalInformation: typeof additionalInformation === "string"
        ? additionalInformation.trim()
        : ""
    };
  }

  function calculateTotalMinorUnits(unitPriceMinorUnits, count) {
    if (!Number.isInteger(unitPriceMinorUnits) || unitPriceMinorUnits < 0) {
      throw new TypeError("Unit price must be a non-negative integer.");
    }
    return unitPriceMinorUnits * delegateCount(count);
  }

  function selectedCourseSession(courseSessions, courseSessionId) {
    if (!Array.isArray(courseSessions)) return null;
    return courseSessions.find((session) => session?.id === courseSessionId) ?? null;
  }

  function publicCheckoutError(errorResponse) {
    const code = errorResponse?.error?.code;
    const messages = {
      COURSE_FULL: "There are not enough seats remaining for this booking.",
      INSUFFICIENT_SEATS: "There are not enough seats remaining for this booking.",
      SESSION_NOT_BOOKABLE: "This course session is no longer open for booking.",
      COURSE_SESSION_NOT_FOUND: "This course session is no longer available.",
      INVALID_CHECKOUT_REQUEST: "Please check the booking details and try again.",
      CHECKOUT_UNAVAILABLE: "Secure Checkout is temporarily unavailable. Please try again."
    };
    return messages[code] || "We could not start secure Checkout. Please try again.";
  }

  const api = {
    BookingFormValidationError,
    buildCheckoutPayload,
    calculateTotalMinorUnits,
    createDelegateRecords,
    delegateCount,
    publicCheckoutError,
    selectedCourseSession
  };

  globalScope.BookingForm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
