document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contactForm");
  if (!form) return;

  const submitButton = document.querySelector("#contactSubmit");
  const status = document.querySelector("#contactStatus");

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `form-message form-message-${type}`;
    status.hidden = false;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      showStatus("Please complete all required fields.", "error");
      return;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    status.hidden = true;

    try {
      const response = await fetch(SITE_CONFIG.contactUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
          "Your message could not be sent. Please try again or call us."
        );
      }

      form.reset();
      showStatus(
        "Thank you. Your enquiry has been sent successfully. We will reply as soon as possible.",
        "success"
      );
    } catch (error) {
      showStatus(
        error?.message ||
          "Your message could not be sent. Please try again or call us.",
        "error"
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send Enquiry";
    }
  });
});
