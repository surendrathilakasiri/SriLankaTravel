(function () {
  window.trackEvent = function (eventName, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...(params || {})
    });
  };

  const revealTargets = document.querySelectorAll(
    '.section-header, .dest-card, .card, .food-card, .info-block, .table-wrap, .cta-banner, .form-card, .contact-panel, .extra-card, .feature, .card-pro'
  );

  const stickyCta = document.querySelector(".mobile-sticky-cta");
  if (stickyCta) {
    stickyCta.addEventListener("click", function () {
      window.trackEvent("mobile_sticky_cta_click", {
        location: window.location.pathname
      });
    });
  }

  if (!revealTargets.length) return;

  revealTargets.forEach((el) => el.classList.add("reveal"));

  if (!("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((el) => observer.observe(el));
})();
