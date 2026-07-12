document.addEventListener("DOMContentLoaded", () => {
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
  });

  document.querySelectorAll("[data-whatsapp]").forEach((element) => {
    const message = "Hi, I would like more information about the SPA Core Day course.";
    element.href = `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  });

  function createBookingUrl(courseType, date) {
    const params = new URLSearchParams();
    params.set("type", courseType);
    params.set("date", date);
    return `book.html?${params.toString()}`;
  }

  function renderDateCards(selector, dates, courseType) {
    const grid = document.querySelector(selector);
    if (!grid) return;

    grid.innerHTML = dates
      .map((item) => {
        const bookingUrl = createBookingUrl(courseType, item.date);

        return `
          <article class="date-card reveal show">
            <span class="date-label">${courseType} Course</span>
            <h3>${item.date}</h3>
            <p>${item.venue}</p>

            <div class="date-meta">
              <span>${item.spaces} places remaining</span>
              <strong>£${item.price}</strong>
            </div>

            <a class="btn btn-primary btn-full" href="${bookingUrl}">Book this date</a>
          </article>
        `;
      })
      .join("");
  }

  renderDateCards("#onlineCourseDates", ONLINE_COURSE_DATES, "Online");
  renderDateCards("#classroomCourseDates", CLASSROOM_COURSE_DATES, "Classroom");

  const trainingType = document.querySelector("#trainingType");
  const bookingDate = document.querySelector("#bookingDate");
  const bookingForm = document.querySelector("#bookingForm");
  const bookingSummary = document.querySelector("#bookingSummary");
  const paymentButton = document.querySelector("#paymentButton");

  function getSelectedDates() {
    const selectedType = trainingType ? trainingType.value : "Online";
    return selectedType === "Classroom" ? CLASSROOM_COURSE_DATES : ONLINE_COURSE_DATES;
  }

  function updateBookingDates(preferredDate = null) {
    if (!bookingDate) return;

    const selectedType = trainingType ? trainingType.value : "Online";
    const dates = getSelectedDates();

    bookingDate.innerHTML = dates
      .map((item) => {
        const selected = preferredDate === item.date ? "selected" : "";
        return `<option value="${item.date}" ${selected}>${item.date} - ${item.spaces} places left</option>`;
      })
      .join("");

    updateBookingSummary();
  }

  function updateBookingSummary() {
    if (!bookingSummary || !trainingType || !bookingDate) return;

    const selectedType = trainingType.value;
    const selectedDate = bookingDate.value || "Please select a date";
    const deliveryText =
      selectedType === "Classroom"
        ? "Classroom Training at West Thames College"
        : "Live Online via Microsoft Teams";

    bookingSummary.innerHTML = `
      <div><strong>Course:</strong> SPA Health & Safety Core Day</div>
      <div><strong>Delivery:</strong> ${deliveryText}</div>
      <div><strong>Date:</strong> ${selectedDate}</div>
      <div><strong>Price:</strong> ${SITE_CONFIG.currency}${SITE_CONFIG.price} including VAT</div>
    `;
  }

  if (trainingType) {
    const params = new URLSearchParams(window.location.search);
    const preselectedType = params.get("type");
    const preselectedDate = params.get("date");

    if (preselectedType === "Online" || preselectedType === "Classroom") {
      trainingType.value = preselectedType;
    }

    updateBookingDates(preselectedDate);

    trainingType.addEventListener("change", () => {
      updateBookingDates();
    });
  }

  if (bookingDate) {
    bookingDate.addEventListener("change", updateBookingSummary);
  }

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(bookingForm);
      const selectedType = trainingType ? trainingType.value : "Online";
      const selectedDate = bookingDate ? bookingDate.value : "";

      const payload = {
        courseType: selectedType === "Classroom" ? "classroom" : "online",
        courseDate: selectedDate,
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        places: formData.get("places"),
        message: formData.get("message")
      };

      if (paymentButton) {
        paymentButton.textContent = "Creating secure checkout...";
        paymentButton.disabled = true;
      }

      try {
        const response = await fetch(SITE_CONFIG.backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.url) {
          throw new Error(data.error || "Could not create Stripe Checkout.");
        }

        window.location.href = data.url;
      } catch (error) {
        alert("Payment system error: " + error.message + "\n\nPlease check that the backend server is running on port 3000.");
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
