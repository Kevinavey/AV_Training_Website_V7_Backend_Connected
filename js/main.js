document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll("[data-company]").forEach((element) => {
    element.textContent = SITE_CONFIG.companyName;
  });

  document.querySelectorAll("[data-price]").forEach((element) => {
    element.textContent = `${SITE_CONFIG.currency}${SITE_CONFIG.price}`;
  });

  document.querySelectorAll("[data-email]").forEach((element) => {
    element.textContent = SITE_CONFIG.email;
    element.href = `mailto:${SITE_CONFIG.email}`;
  });

  document.querySelectorAll("[data-phone]").forEach((element) => {
    element.textContent = SITE_CONFIG.phone;
    element.href = `tel:${SITE_CONFIG.phone.replace(/\s/g, "")}`;

    if (SITE_CONFIG.landline) {
      const lineBreak = document.createElement("br");
      const landline = document.createElement("a");
      landline.textContent = SITE_CONFIG.landline;
      landline.href = `tel:${SITE_CONFIG.landline.replace(/\s/g, "")}`;
      landline.dataset.landline = "";
      element.after(lineBreak, landline);
    }
  });

  document.querySelectorAll("[data-whatsapp]").forEach((element) => {
    const message = "Hi, I would like more information about the SPA Core Day course.";
    element.href = `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  });

  let courseSessions = [];

  function formatCourseDate(startsAt) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeZone: "Europe/London"
    }).format(new Date(startsAt));
  }

  function formatCourseDateTime(startsAt, endsAt) {
    const date = formatCourseDate(startsAt);
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London"
    });
    return `${date}, ${timeFormatter.format(new Date(startsAt))}–${timeFormatter.format(new Date(endsAt))}`;
  }

  function formatPrice(unitPrice) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: unitPrice.currency
    }).format(unitPrice.amountMinorUnits / 100);
  }

  function sessionType(session) {
    return session.deliveryType === "classroom" ? "Classroom" : "Online";
  }

  function sessionVenue(session) {
    if (session.deliveryType === "online") return "Live Online";
    return session.venue
      ? `${session.venue.name}, ${session.venue.address}`
      : "Classroom Training";
  }

  function createBookingUrl(session) {
    const params = new URLSearchParams();
    params.set("type", sessionType(session));
    params.set("session", session.id);
    return `book.html?${params.toString()}`;
  }

  function createDateCard(session) {
    const courseType = sessionType(session);
    const date = formatCourseDate(session.startsAt);
    const article = document.createElement("article");
    article.className = "date-card reveal show";

    const label = document.createElement("span");
    label.className = "date-label";
    label.textContent = `${courseType} Course`;
    const heading = document.createElement("h3");
    heading.textContent = date;
    const venue = document.createElement("p");
    venue.textContent = sessionVenue(session);
    const metadata = document.createElement("div");
    metadata.className = "date-meta";
    const availability = document.createElement("span");
    availability.textContent = session.remainingSeats === 0
      ? "Sold out"
      : `${session.remainingSeats} places remaining`;
    const price = document.createElement("strong");
    price.textContent = formatPrice(session.unitPrice);
    metadata.append(availability, price);
    const link = document.createElement(session.remainingSeats === 0 ? "span" : "a");
    link.className = "btn btn-primary btn-full";
    if (session.remainingSeats === 0) {
      link.setAttribute("aria-disabled", "true");
      link.textContent = "Sold out";
    } else {
      link.href = createBookingUrl(session);
      link.textContent = "Book this date";
    }
    article.append(label, heading, venue, metadata, link);
    return article;
  }

  function renderDateCards(selector, sessions) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    if (sessions.length === 0) {
      const card = document.createElement("article");
      card.className = "date-card reveal show";
      card.textContent = "No upcoming dates are currently available.";
      grid.replaceChildren(card);
      return;
    }
    grid.replaceChildren(...sessions.map(createDateCard));
  }

  function renderSessionMessage(message, onRetry = null) {
    ["#onlineCourseDates", "#classroomCourseDates"].forEach((selector) => {
      const grid = document.querySelector(selector);
      if (!grid) return;
      const card = document.createElement("article");
      card.className = "date-card reveal show";
      const text = document.createElement("p");
      text.textContent = message;
      card.append(text);
      if (onRetry) {
        const retry = document.createElement("button");
        retry.className = "btn btn-primary btn-full";
        retry.type = "button";
        retry.textContent = "Try again";
        retry.addEventListener("click", onRetry);
        card.append(retry);
      }
      grid.replaceChildren(card);
    });
  }

  const trainingType = document.querySelector("#trainingType");
  const bookingDate = document.querySelector("#bookingDate");
  const bookingForm = document.querySelector("#bookingForm");
  const bookingSummary = document.querySelector("#bookingSummary");
  const paymentButton = document.querySelector("#paymentButton");
  const delegateCountInput = document.querySelector("#delegateCount");
  const delegateFields = document.querySelector("#delegateFields");
  const purchaserIsDelegate = document.querySelector("#purchaserIsDelegate");
  const purchaserName = document.querySelector("#purchaserName");
  const purchaserEmail = document.querySelector("#purchaserEmail");
  const purchaserPhone = document.querySelector("#purchaserPhone");
  const additionalInformation = document.querySelector("#additionalInformation");
  const bookingError = document.querySelector("#bookingError");

  function getSelectedSession() {
    return BookingForm.selectedCourseSession(courseSessions, bookingDate?.value);
  }

  function getSelectedDates() {
    const selectedType = trainingType ? trainingType.value : "Online";
    return courseSessions.filter((session) => sessionType(session) === selectedType);
  }

  function updateBookingDates(preferredSessionId = null) {
    if (!bookingDate) return;

    const dates = getSelectedDates();

    bookingDate.replaceChildren(
      ...dates.map((session) => {
        const date = formatCourseDate(session.startsAt);
        const option = document.createElement("option");
        option.value = session.id;
        option.textContent = `${date} - ${session.remainingSeats} places left`;
        option.selected = preferredSessionId === session.id;
        option.disabled = session.remainingSeats === 0;
        return option;
      })
    );
    bookingDate.disabled = dates.length === 0;

    updateBookingSummary();
  }

  function updateBookingSummary() {
    if (!bookingSummary || !trainingType || !bookingDate) return;

    const selectedSession = getSelectedSession();
    const count = Number(delegateCountInput?.value ?? 1);
    const summaryRows = selectedSession
      ? [
          ["Course", selectedSession.courseName],
          ["Date and time", formatCourseDateTime(selectedSession.startsAt, selectedSession.endsAt)],
          ["Delivery", `${sessionType(selectedSession)} — ${sessionVenue(selectedSession)}`],
          ["Delegates", String(count)],
          ["Unit price", `${formatPrice(selectedSession.unitPrice)} including VAT`],
          ["Total price", `${formatPrice({
            ...selectedSession.unitPrice,
            amountMinorUnits: BookingForm.calculateTotalMinorUnits(
              selectedSession.unitPrice.amountMinorUnits,
              count
            )
          })} including VAT`],
          ["Remaining seats", String(selectedSession.remainingSeats)]
        ]
      : [
          ["Course", "SPA Health & Safety Core Day"],
          ["Date and time", "No course session selected"],
          ["Delivery", trainingType.value],
          ["Delegates", String(count)],
          ["Unit price", "—"],
          ["Total price", "—"],
          ["Remaining seats", "—"]
        ];

    bookingSummary.replaceChildren(...summaryRows.map(([label, value]) => {
      const row = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      row.append(strong, value);
      return row;
    }));
  }

  function purchaserDetails() {
    return {
      name: purchaserName?.value ?? "",
      email: purchaserEmail?.value ?? "",
      phone: purchaserPhone?.value ?? ""
    };
  }

  function currentDelegateRecords() {
    if (!delegateFields) return [];
    return [...delegateFields.querySelectorAll(".delegate-card")].map((card) => ({
      fullName: card.querySelector('[data-delegate-field="fullName"]')?.value ?? "",
      email: card.querySelector('[data-delegate-field="email"]')?.value ?? "",
      phone: card.querySelector('[data-delegate-field="phone"]')?.value ?? ""
    }));
  }

  function createDelegateInput({ label, field, type = "text", value, required = false, readOnly = false }) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    input.required = required;
    input.readOnly = readOnly;
    input.dataset.delegateField = field;
    input.autocomplete = "off";
    wrapper.append(input);
    return wrapper;
  }

  function renderDelegateFields(existing = currentDelegateRecords()) {
    if (!delegateFields || !delegateCountInput) return;

    const usePurchaser = purchaserIsDelegate?.checked === true;
    const delegates = BookingForm.createDelegateRecords({
      count: delegateCountInput.value,
      existing,
      purchaser: purchaserDetails(),
      purchaserIsDelegate: usePurchaser
    });

    delegateFields.replaceChildren(...delegates.map((delegate, index) => {
      const card = document.createElement("section");
      card.className = "delegate-card";
      const heading = document.createElement("h3");
      heading.textContent = `Delegate ${index + 1}${index === 0 && usePurchaser ? " — purchaser" : ""}`;
      const grid = document.createElement("div");
      grid.className = "delegate-grid";
      const isPurchaserRecord = index === 0 && usePurchaser;
      grid.append(
        createDelegateInput({
          label: "Full name",
          field: "fullName",
          value: delegate.fullName,
          required: true,
          readOnly: isPurchaserRecord
        }),
        createDelegateInput({
          label: "Email address",
          field: "email",
          type: "email",
          value: delegate.email,
          required: true,
          readOnly: isPurchaserRecord
        }),
        createDelegateInput({
          label: "Phone (optional)",
          field: "phone",
          type: "tel",
          value: delegate.phone,
          readOnly: isPurchaserRecord
        })
      );
      card.append(heading, grid);
      return card;
    }));
  }

  function showBookingError(message) {
    if (!bookingError) return;
    bookingError.textContent = message;
    bookingError.hidden = false;
    bookingError.focus?.();
  }

  function clearBookingError() {
    if (!bookingError) return;
    bookingError.textContent = "";
    bookingError.hidden = true;
  }

  function storePendingConfirmation({ checkout, courseSession, payload }) {
    try {
      sessionStorage.setItem("avTrainingPendingConfirmation", JSON.stringify({
        bookingReference: checkout.bookingReference,
        paymentStatus: "processing",
        courseName: courseSession.courseName,
        courseDateTime: formatCourseDateTime(courseSession.startsAt, courseSession.endsAt),
        deliveryType: `${sessionType(courseSession)} — ${sessionVenue(courseSession)}`,
        purchaserName: payload.purchaser.name,
        delegates: payload.delegates.map(({ fullName }) => fullName),
        totalPaid: {
          amountMinorUnits: BookingForm.calculateTotalMinorUnits(
            courseSession.unitPrice.amountMinorUnits,
            payload.delegates.length
          ),
          currency: courseSession.unitPrice.currency
        },
        bookingDate: new Date().toISOString()
      }));
    } catch {
      // Storage may be unavailable in privacy modes; Stripe redirect must still proceed.
    }
  }

  const params = new URLSearchParams(window.location.search);
  const preselectedType = params.get("type");
  const preselectedSessionId = params.get("session");

  if (trainingType) {
    if (preselectedType === "Online" || preselectedType === "Classroom") {
      trainingType.value = preselectedType;
    }
    trainingType.addEventListener("change", () => {
      updateBookingDates();
    });
  }

  async function loadAndRenderSessions() {
    renderSessionMessage("Loading course dates…");
    if (bookingDate) bookingDate.disabled = true;

    try {
      courseSessions = await loadCourseSessions();
      const onlineSessions = courseSessions.filter(
        (session) => session.deliveryType === "online"
      );
      const classroomSessions = courseSessions.filter(
        (session) => session.deliveryType === "classroom"
      );
      renderDateCards("#onlineCourseDates", onlineSessions);
      renderDateCards("#classroomCourseDates", classroomSessions);
      updateBookingDates(preselectedSessionId);
    } catch (error) {
      courseSessions = [];
      renderSessionMessage(
        "Course dates are temporarily unavailable. Please try again later.",
        loadAndRenderSessions
      );
      if (bookingDate) {
        const option = document.createElement("option");
        option.textContent = "Course dates unavailable";
        bookingDate.replaceChildren(option);
        bookingDate.disabled = true;
      }
      updateBookingSummary();
    }
  }

  const needsCourseSessions =
    document.querySelector("#onlineCourseDates, #classroomCourseDates") || bookingDate;
  if (needsCourseSessions) {
    await loadAndRenderSessions();
  }

  if (bookingDate) {
    bookingDate.addEventListener("change", updateBookingSummary);
  }

  if (delegateCountInput) {
    renderDelegateFields([]);
    delegateCountInput.addEventListener("change", () => {
      renderDelegateFields();
      updateBookingSummary();
    });
  }

  if (purchaserIsDelegate) {
    purchaserIsDelegate.addEventListener("change", () => renderDelegateFields());
  }

  [purchaserName, purchaserEmail, purchaserPhone].forEach((input) => {
    input?.addEventListener("input", () => {
      if (purchaserIsDelegate?.checked) renderDelegateFields();
    });
  });

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearBookingError();

      if (paymentButton) {
        paymentButton.textContent = "Creating secure checkout...";
        paymentButton.disabled = true;
      }

      try {
        const courseSessionId = bookingDate?.value ?? "";
        const refreshedSessions = await loadCourseSessions();
        const payload = BookingForm.buildCheckoutPayload({
          courseSessionId,
          availableSessionIds: refreshedSessions.map(({ id }) => id),
          purchaser: purchaserDetails(),
          delegates: currentDelegateRecords(),
          additionalInformation: additionalInformation?.value ?? ""
        });

        courseSessions = refreshedSessions;
        const refreshedSelection = BookingForm.selectedCourseSession(
          refreshedSessions,
          courseSessionId
        );
        if (!refreshedSelection) {
          throw new BookingForm.BookingFormValidationError(
            "The selected course session is no longer available. Please choose another date."
          );
        }
        updateBookingSummary();

        const response = await fetch(SITE_CONFIG.backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          showBookingError(BookingForm.publicCheckoutError(data));
          return;
        }
        if (typeof data?.url !== "string" || data.url === "") {
          showBookingError("Secure Checkout is temporarily unavailable. Please try again.");
          return;
        }

        storePendingConfirmation({
          checkout: data,
          courseSession: refreshedSelection,
          payload
        });
        window.location.href = data.url;
      } catch (error) {
        const message = error instanceof BookingForm.BookingFormValidationError
          ? error.message
          : "We could not connect to the booking service. Please try again.";
        showBookingError(message);
      } finally {
        if (paymentButton) {
          paymentButton.textContent = "Proceed to Secure Payment";
          paymentButton.disabled = false;
        }
      }
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("show");
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".reveal").forEach((element) => {
    observer.observe(element);
  });
});
