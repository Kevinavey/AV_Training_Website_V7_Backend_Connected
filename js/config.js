const SITE_CONFIG = {
  companyName: "AV Training & Consultancy",
  tagline: "Professional Construction Training",
  phone: "07337 146719",
  landline: "020 3536 5837",
  email: "info@avtrainingandconsultancy.co.uk",
  whatsappNumber: "07337146719",
  address: "West Thames College, London Road, Isleworth, TW7 4HS",
  price: 154,
  currency: "£",
  courseSessionsUrl: "https://av-training-backend.onrender.com/api/course-sessions",
  backendUrl: "https://av-training-backend.onrender.com/create-checkout-session",
  contactUrl: "https://av-training-backend.onrender.com/api/contact"
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".footer-grid").forEach((footerGrid) => {
    if (footerGrid.querySelector('[data-legal-links]')) return;

    const quickLinksHeading = [...footerGrid.querySelectorAll("h4")].find(
      (heading) => heading.textContent.trim() === "Quick Links"
    );
    const quickLinksSection = quickLinksHeading?.parentElement;
    const linksParagraph = quickLinksSection?.querySelector("p");

    if (!linksParagraph) return;

    const legalLinks = document.createElement("span");
    legalLinks.dataset.legalLinks = "true";
    legalLinks.innerHTML = '<br><a href="privacy.html">Privacy Policy</a><br><a href="terms.html">Booking & Cancellation Terms</a>';
    linksParagraph.append(legalLinks);
  });
});
