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

(function setupMetaPixel(globalScope) {
  const PIXEL_ID = "1804387653922669";
  const CONSENT_KEY = "avTrainingMetaConsent";
  let initialized = false;

  function getConsent() {
    try { return globalScope.localStorage.getItem(CONSENT_KEY); } catch { return null; }
  }

  function setConsent(value) {
    try { globalScope.localStorage.setItem(CONSENT_KEY, value); } catch {}
  }

  function init() {
    if (initialized || typeof document === "undefined") return;
    initialized = true;
    if (!globalScope.fbq) {
      const fbq = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      if (!globalScope._fbq) globalScope._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      globalScope.fbq = fbq;
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    globalScope.fbq("init", PIXEL_ID);
    globalScope.fbq("track", "PageView");
  }

  function track(eventName, parameters) {
    if (getConsent() !== "accepted") return false;
    init();
    globalScope.fbq("track", eventName, parameters || {});
    return true;
  }

  function trackRelevantViewContent() {
    if (/spa-core-day\.html$/.test(location.pathname)) {
      track("ViewContent", { content_name: "SPA Core Day", content_type: "product" });
    } else if (/book\.html$/.test(location.pathname)) {
      track("ViewContent", { content_name: "SPA Core Day Booking", content_type: "product" });
    }
  }

  function showBanner() {
    if (getConsent() || document.querySelector("[data-meta-cookie-banner]")) return;
    const banner = document.createElement("div");
    banner.dataset.metaCookieBanner = "true";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie preferences");
    banner.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:10000;max-width:920px;margin:auto;padding:16px 20px;background:#fff;border:1px solid rgba(0,0,0,.14);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.2);display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap";
    banner.innerHTML = '<div style="flex:1;min-width:240px"><strong>Cookie preferences</strong><p style="margin:4px 0 0">We use optional Meta cookies to measure advertising performance. You can accept or reject them.</p></div><div style="display:flex;gap:10px"><button type="button" class="btn btn-secondary" data-cookie-reject>Reject</button><button type="button" class="btn btn-primary" data-cookie-accept>Accept</button></div>';
    banner.querySelector("[data-cookie-accept]").addEventListener("click", () => {
      setConsent("accepted");
      init();
      trackRelevantViewContent();
      banner.remove();
    });
    banner.querySelector("[data-cookie-reject]").addEventListener("click", () => {
      setConsent("rejected");
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  function trackPurchase(booking) {
    if (!booking || booking.status !== "confirmed" || !booking.bookingReference) return;
    const key = `avTrainingPurchaseTracked:${booking.bookingReference}`;
    try { if (sessionStorage.getItem(key) === "1") return; } catch {}
    if (track("Purchase", {
      value: booking.totalPaid?.amountMinorUnits / 100,
      currency: booking.totalPaid?.currency,
      content_name: booking.course?.name || "SPA Core Day",
      content_type: "product"
    })) {
      try { sessionStorage.setItem(key, "1"); } catch {}
    }
  }

  const originalFetch = globalScope.fetch?.bind(globalScope);
  if (originalFetch) {
    globalScope.fetch = async function metaAwareFetch(input, init) {
      const response = await originalFetch(input, init);
      try {
        const url = typeof input === "string" ? input : input?.url || "";
        const method = String(init?.method || "GET").toUpperCase();
        if (url === SITE_CONFIG.backendUrl && method === "POST" && response.ok) {
          let value = SITE_CONFIG.price;
          try {
            const payload = JSON.parse(init?.body || "{}");
            value = SITE_CONFIG.price * (payload.delegates?.length || 1);
          } catch {}
          track("InitiateCheckout", { content_name: "SPA Core Day", content_type: "product", value, currency: "GBP" });
        }
        if (url.includes("/api/bookings/status") && response.ok) {
          response.clone().json().then((body) => trackPurchase(body?.booking)).catch(() => {});
        }
      } catch {}
      return response;
    };
  }

  globalScope.MetaPixel = { PIXEL_ID, CONSENT_KEY, getConsent, init, track, trackPurchase };

  document.addEventListener("DOMContentLoaded", () => {
    const consent = getConsent();
    if (consent === "accepted") {
      init();
      trackRelevantViewContent();
    } else if (!consent) {
      showBanner();
    }
  });
})(typeof window !== "undefined" ? window : globalThis);

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
