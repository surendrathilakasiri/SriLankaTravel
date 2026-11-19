(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.nav-main');
  function closeMenu() {
    navigation?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open navigation');
  }
  toggle?.addEventListener('click', () => {
    const open = navigation?.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  navigation?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation?.classList.contains('open')) { closeMenu(); toggle.focus(); }
  });
  document.addEventListener('click', event => {
    if (navigation?.classList.contains('open') && !header?.contains(event.target)) closeMenu();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMenu(); }, { passive: true });
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

  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  const backToTop = document.createElement('button');
  backToTop.type = 'button';
  backToTop.className = 'back-to-top';
  backToTop.textContent = '↑';
  backToTop.setAttribute('aria-label', 'Back to top');
  backToTop.title = 'Back to top';
  backToTop.hidden = true;
  backToTop.addEventListener('click', () => {
    const heading = document.querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  document.body.append(backToTop);
  let scrollPending = false;
  function updateScroll() {
    header?.classList.toggle('scrolled', window.scrollY > 30);
    backToTop.hidden = window.scrollY < 650;
    scrollPending = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  updateScroll();

  const notice = document.createElement('div');
  notice.className = 'site-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  document.body.append(notice);
  let noticeTimer;
  window.showSiteNotice = function (message) {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.classList.add('is-visible');
    noticeTimer = setTimeout(() => notice.classList.remove('is-visible'), 5000);
  };

  // Presets change only route preferences; arrival, month and budget stay editable.
  const planner = document.getElementById('itineraryForm');
  const presets = {
    culture: { days: '7', pace: 'Balanced', cities: ['Sigiriya', 'Kandy', 'Ella'], interests: ['Culture', 'Scenic trains'] },
    coast: { days: '7', pace: 'Relaxed', cities: ['Galle', 'Mirissa'], interests: ['Beaches', 'Food'] },
    wildlife: { days: '10', pace: 'Balanced', cities: ['Sigiriya', 'Yala', 'Galle'], interests: ['Wildlife', 'Culture', 'Beaches'] }
  };
  const summary = document.getElementById('trip-summary');
  function summarizeTrip() {
    if (!planner || !summary) return;
    const data = new FormData(planner);
    const places = data.getAll('cities');
    const travelers = Number(data.get('travelers'));
    summary.textContent = `${data.get('days')} days · ${travelers} ${travelers === 1 ? 'traveler' : 'travelers'} · ${places.length} ${places.length === 1 ? 'stop' : 'stops'} · ${data.get('pace')} pace`;
  }
  planner?.addEventListener('change', summarizeTrip);
  summarizeTrip();
  document.querySelectorAll('[data-trip-preset]').forEach(link => {
    link.addEventListener('click', () => {
      const preset = presets[link.dataset.tripPreset];
      if (!planner || !preset) return;
      if (planner.dataset.loading === 'true') {
        window.showSiteNotice('Your itinerary is being created. Try another idea when it is ready.');
        return;
      }
      planner.elements.namedItem('days').value = preset.days;
      planner.elements.namedItem('pace').value = preset.pace;
      planner.querySelectorAll('[name="cities"]').forEach(input => { input.checked = preset.cities.includes(input.value); });
      planner.querySelectorAll('[name="interests"]').forEach(input => { input.checked = preset.interests.includes(input.value); });
      summarizeTrip();
      const title = document.getElementById('planner-title');
      title?.setAttribute('tabindex', '-1');
      title?.focus({ preventScroll: true });
      window.showSiteNotice('Trip idea selected. Adjust the details, then create your trip.');
    });
  });

  const filters = document.getElementById('destination-filters');
  if (filters) {
    const search = document.getElementById('destination-query');
    const count = document.getElementById('destination-count');
    const empty = document.getElementById('destination-empty');
    const cards = [...document.querySelectorAll('.dest-card[data-categories]')];
    const buttons = [...filters.querySelectorAll('[data-category]')];
    let category = 'all';
    const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const searchable = cards.map(card => ({ card, text: normalize(card.textContent + ' ' + card.dataset.categories) }));
    function applyFilters() {
      const query = normalize(search.value.trim());
      let visible = 0;
      searchable.forEach(({ card, text }) => {
        const matches = (category === 'all' || card.dataset.categories.split(' ').includes(category)) && text.includes(query);
        card.hidden = !matches;
        if (matches) { visible++; card.classList.add('is-visible'); }
      });
      count.textContent = `${visible} ${visible === 1 ? 'place' : 'places'} to explore`;
      empty.hidden = visible !== 0;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
    }
    filters.hidden = false;
    filters.addEventListener('submit', event => event.preventDefault());
    filters.addEventListener('reset', event => {
      event.preventDefault(); search.value = ''; category = 'all'; applyFilters(); search.focus();
    });
    search.addEventListener('input', applyFilters);
    buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.category; applyFilters(); }));
    applyFilters();
  }

  const revealTargets = document.querySelectorAll(
    '.section-header, .dest-card, .card, .food-card, .info-block, .table-wrap, .cta-banner, .form-card, .contact-panel, .extra-card, .feature, .card-pro, .editorial-card, .route-card, .guide-aside'
  );

  const stickyCta = document.querySelector(".mobile-sticky-cta");
  if (stickyCta) {
    stickyCta.addEventListener("click", function () {
      window.trackEvent("mobile_sticky_cta_click", {
        location: window.location.pathname
      });
    });
  }

  // Animate visible content once; never hide content while waiting for an observer.
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    revealTargets.forEach(element => observer.observe(element));
    reducedMotion.addEventListener('change', event => { if (event.matches) observer.disconnect(); });
  }
})();
