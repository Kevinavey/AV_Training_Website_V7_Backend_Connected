(function exposeConfirmationPage(globalScope) {
  const BOOKING_REFERENCE_PATTERN = /^AVT-[A-Z0-9]{8}$/;
  const CHECKOUT_SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/;
  const STORAGE_KEY = "avTrainingPendingConfirmation";
  const TERMINAL_STATUSES = new Set(["confirmed", "failed", "expired", "invalid"]);
  const activePolls = new Map();

  function isValidDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function requireConfirmation(value, requestedReference = "") {
    if (
      !value ||
      typeof value !== "object" ||
      !BOOKING_REFERENCE_PATTERN.test(value.bookingReference) ||
      (requestedReference && requestedReference !== value.bookingReference) ||
      value.paymentStatus !== "processing" ||
      typeof value.courseName !== "string" ||
      value.courseName.trim() === "" ||
      typeof value.courseDateTime !== "string" ||
      value.courseDateTime.trim() === "" ||
      typeof value.deliveryType !== "string" ||
      value.deliveryType.trim() === "" ||
      typeof value.purchaserName !== "string" ||
      value.purchaserName.trim() === "" ||
      !Array.isArray(value.delegates) ||
      value.delegates.length < 1 ||
      value.delegates.length > 12 ||
      value.delegates.some((name) => typeof name !== "string" || name.trim() === "") ||
      !Number.isInteger(value.totalPaid?.amountMinorUnits) ||
      value.totalPaid.amountMinorUnits < 0 ||
      typeof value.totalPaid.currency !== "string" ||
      !/^[A-Z]{3}$/.test(value.totalPaid.currency) ||
      !isValidDate(value.bookingDate)
    ) {
      return null;
    }
    return value;
  }

  function readConfirmation(storage, requestedReference = "") {
    try {
      return requireConfirmation(
        JSON.parse(storage.getItem(STORAGE_KEY)),
        requestedReference
      );
    } catch {
      return null;
    }
  }

  function checkoutSessionIdFromSearch(search) {
    const value = new URLSearchParams(search).get("checkoutSessionId") || "";
    return CHECKOUT_SESSION_ID_PATTERN.test(value) ? value : "";
  }

  function formatMoney(totalPaid) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: totalPaid.currency
    }).format(totalPaid.amountMinorUnits / 100);
  }

  function formatBookingDate(value) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/London"
    }).format(new Date(value));
  }

  function formatCourseDateTime(startsAt, endsAt) {
    const date = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeZone: "Europe/London"
    }).format(new Date(startsAt));
    const time = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London"
    });
    return `${date}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`;
  }

  function confirmationViewModel(confirmation) {
    return {
      bookingReference: confirmation.bookingReference,
      paymentStatus: "Payment submitted — confirmation pending.",
      courseName: confirmation.courseName,
      courseDateTime: confirmation.courseDateTime,
      deliveryType: confirmation.deliveryType,
      purchaserName: confirmation.purchaserName,
      delegates: confirmation.delegates.map((name) => name.trim()),
      totalPaid: formatMoney(confirmation.totalPaid),
      bookingDate: formatBookingDate(confirmation.bookingDate),
      confirmationEmailQueued: false
    };
  }

  function bookingStatusViewModel(booking) {
    const venue = booking.course.venue
      ? `${booking.course.venue.name}, ${booking.course.venue.address}`
      : "Live Online";
    const delivery = booking.course.deliveryType === "classroom"
      ? `Classroom — ${venue}`
      : "Online — Live Online";
    return {
      bookingReference: booking.bookingReference,
      paymentStatus: booking.status === "confirmed"
        ? "Payment confirmed"
        : "Payment submitted — confirmation pending.",
      courseName: booking.course.name,
      courseDateTime: formatCourseDateTime(
        booking.course.startsAt,
        booking.course.endsAt
      ),
      deliveryType: delivery,
      purchaserName: booking.purchaserName,
      delegates: booking.delegates.map(({ fullName }) => fullName),
      totalPaid: formatMoney(booking.totalPaid),
      bookingDate: formatBookingDate(booking.bookingDate),
      confirmationEmailQueued: booking.confirmationEmailQueued === true
    };
  }

  function appendDetail(container, label, value) {
    const item = document.createElement("div");
    item.className = "confirmation-detail";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    item.append(term, description);
    container.append(item);
  }

  function renderBookingDetails(view) {
    const details = document.querySelector("#confirmationDetails");
    const delegates = document.querySelector("#confirmationDelegates");
    if (details) {
      details.replaceChildren();
      appendDetail(details, "Booking reference", view.bookingReference);
      appendDetail(details, "Payment status", view.paymentStatus);
      appendDetail(details, "Course", view.courseName);
      appendDetail(details, "Course date and time", view.courseDateTime);
      appendDetail(details, "Delivery", view.deliveryType);
      appendDetail(details, "Purchaser", view.purchaserName);
      appendDetail(details, "Total paid", view.totalPaid);
      appendDetail(details, "Booking date", view.bookingDate);
    }
    if (delegates) {
      delegates.replaceChildren(...view.delegates.map((name) => {
        const item = document.createElement("li");
        item.textContent = name;
        return item;
      }));
    }
  }

  function bookingStatusUrl(backendUrl, checkoutSessionId) {
    const url = new URL("/api/bookings/status", backendUrl);
    url.searchParams.set("checkoutSessionId", checkoutSessionId);
    return url.toString();
  }

  async function fetchBookingStatus({ fetchImplementation, backendUrl, checkoutSessionId }) {
    const response = await fetchImplementation(
      bookingStatusUrl(backendUrl, checkoutSessionId),
      { headers: { Accept: "application/json" } }
    );
    const body = await response.json().catch(() => null);
    if (response.status === 400 || response.status === 404) return { status: "invalid" };
    if (!response.ok || !body?.booking) throw new Error("Booking status is temporarily unavailable");
    return body.booking;
  }

  function pollBookingStatus({
    checkoutSessionId,
    fetchStatus,
    onStatus = () => {},
    intervalMs = 2000,
    timeoutMs = 60000,
    now = () => Date.now(),
    wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration))
  }) {
    if (activePolls.has(checkoutSessionId)) return activePolls.get(checkoutSessionId);

    const polling = (async () => {
      const startedAt = now();
      while (now() - startedAt < timeoutMs) {
        try {
          const booking = await fetchStatus(checkoutSessionId);
          onStatus(booking);
          if (TERMINAL_STATUSES.has(booking.status)) return booking;
        } catch {
          // Network and temporary server failures are retried until the timeout.
        }
        const remaining = timeoutMs - (now() - startedAt);
        if (remaining <= 0) break;
        await wait(Math.min(intervalMs, remaining));
      }
      const timedOut = { status: "timeout" };
      onStatus(timedOut);
      return timedOut;
    })().finally(() => activePolls.delete(checkoutSessionId));

    activePolls.set(checkoutSessionId, polling);
    return polling;
  }

  function showOnly(stateId) {
    [
      "confirmationLoading",
      "confirmationContent",
      "confirmationInvalid",
      "confirmationFailed",
      "confirmationExpired",
      "confirmationTimeout"
    ].forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) element.hidden = id !== stateId;
    });
  }

  function updatePageForStatus(booking) {
    if (booking.status === "confirmed" || booking.status === "pending") {
      const view = bookingStatusViewModel(booking);
      renderBookingDetails(view);
      showOnly("confirmationContent");
      const heading = document.querySelector("#confirmationHeading");
      const introduction = document.querySelector("#confirmationIntroduction");
      const emailStatus = document.querySelector("#confirmationEmailStatus");
      if (booking.status === "confirmed") {
        if (heading) heading.textContent = "Booking confirmed";
        if (introduction) introduction.textContent = "Payment confirmed";
        if (emailStatus) {
          emailStatus.textContent = view.confirmationEmailQueued
            ? "Confirmation email queued"
            : "Your confirmation email is being prepared";
        }
      }
      return;
    }
    if (booking.status === "failed") return showOnly("confirmationFailed");
    if (booking.status === "expired") return showOnly("confirmationExpired");
    if (booking.status === "invalid") return showOnly("confirmationInvalid");
    if (booking.status === "timeout") return showOnly("confirmationTimeout");
  }

  function renderSuccessPage({
    storage = sessionStorage,
    search = window.location.search,
    fetchImplementation = fetch,
    backendUrl = SITE_CONFIG.backendUrl
  } = {}) {
    const checkoutSessionId = checkoutSessionIdFromSearch(search);
    const stored = readConfirmation(storage);

    if (!checkoutSessionId) {
      showOnly("confirmationInvalid");
      return Promise.resolve({ status: "invalid" });
    }

    if (stored) {
      renderBookingDetails(confirmationViewModel(stored));
      showOnly("confirmationContent");
    }

    return pollBookingStatus({
      checkoutSessionId,
      fetchStatus: () => fetchBookingStatus({
        fetchImplementation,
        backendUrl,
        checkoutSessionId
      }),
      onStatus: updatePageForStatus
    });
  }

  const api = {
    BOOKING_REFERENCE_PATTERN,
    CHECKOUT_SESSION_ID_PATTERN,
    STORAGE_KEY,
    bookingStatusUrl,
    bookingStatusViewModel,
    checkoutSessionIdFromSearch,
    confirmationViewModel,
    fetchBookingStatus,
    pollBookingStatus,
    readConfirmation,
    renderSuccessPage,
    requireConfirmation
  };

  globalScope.ConfirmationPage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
