/* Portfolio — Rohan Ravi Jadhav
   Everything here is an enhancement: the page is fully usable without it. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Theme (light default, dark opt-in) ---------- */
  const themeBtn = $('#themeToggle');
  const themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#0b0b0d' : '#f6f6f3');
  }
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
  });

  /* ---------- Mobile nav (disclosure) ---------- */
  const menuBtn = $('#menuToggle');
  const nav = $('#siteNav');

  function setMenu(open, returnFocus) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (!open && returnFocus) menuBtn.focus();
  }
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false, true);
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Current section in nav ---------- */
  const navLinks = $$('.site-nav a:not(.nav-cta)');
  if ('IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute('aria-current'));
        const link = byId.get(entry.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Case study viewer ---------- */
  const viewer = $('#viewer');
  const cards = $$('.work');
  const els = {
    type: $('#viewerType'), title: $('#viewerTitle'), desc: $('#viewerDesc'),
    images: $('#viewerImages'), link: $('#viewerLink'), scroll: $('#viewerScroll'),
    prev: $('#viewerPrev'), next: $('#viewerNext'), close: $('#viewerClose'),
  };
  let current = -1;
  let manifestPromise = null;

  // img/work/manifest.json: { slug: { cover, study: [{ n, w, h }] } }, written by tools/optimize-images.mjs
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch('img/work/manifest.json')
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    }
    return manifestPromise;
  }

  function showEmptyIfNeeded() {
    if (els.images.querySelector('img') || els.images.querySelector('.viewer-empty')) return;
    const p = document.createElement('p');
    p.className = 'viewer-empty';
    p.textContent = 'Full-size images are on Behance. Use the button below to open the case study.';
    els.images.append(p);
  }

  async function fillViewer(index) {
    const card = cards[index];
    const slug = card.dataset.slug;
    const title = $('.work-open', card).textContent.trim();
    els.type.textContent = $('.work-type', card).textContent;
    els.title.textContent = title;
    els.desc.textContent = $('.work-desc', card).textContent;
    els.link.href = $('.work-open', card).href;
    els.images.replaceChildren();
    els.scroll.scrollTop = 0;

    const data = await loadManifest();
    if (current !== index) return; // user moved on while loading
    const tiles = (data[slug] && data[slug].study) || [];
    tiles.forEach((t, i) => {
      const img = document.createElement('img');
      img.src = `img/work/${slug}/study-${t.n}.webp`;
      img.width = t.w;
      img.height = t.h;
      img.alt = `${title}, case study page ${i + 1} of ${tiles.length}`;
      img.decoding = 'async';
      if (i > 0) img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); showEmptyIfNeeded(); });
      els.images.append(img);
    });
    showEmptyIfNeeded();
  }

  // Expand from / collapse to the card thumbnail (FLIP). Skipped for reduced motion.
  function flip(index, direction, done) {
    const media = $('.work-media', cards[index]);
    const from = media.getBoundingClientRect();
    const to = viewer.getBoundingClientRect();
    if (reduceMotion || !viewer.animate || !to.width || !from.width) { if (done) done(); return; }
    const collapsed = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    const frames = direction === 'open'
      ? [{ transform: collapsed, opacity: 0.4 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'none', opacity: 1 }, { transform: collapsed, opacity: 0 }];
    viewer.style.transformOrigin = 'top left';
    const anim = viewer.animate(frames, { duration: 420, easing: 'cubic-bezier(.22, .7, .2, 1)' });
    anim.onfinish = () => { viewer.style.transformOrigin = ''; if (done) done(); };
  }

  function openViewer(index) {
    current = index;
    root.classList.add('modal-open');
    viewer.showModal();
    fillViewer(index);
    flip(index, 'open');
    els.scroll.focus({ preventScroll: true });
  }

  function closeViewer() {
    if (!viewer.open) return;
    flip(current, 'close', () => viewer.close());
  }

  function step(delta) {
    if (current < 0) return;
    current = (current + delta + cards.length) % cards.length;
    fillViewer(current);
  }

  viewer.addEventListener('close', () => {
    root.classList.remove('modal-open');
    const card = cards[current];
    if (card) $('.work-open', card).focus();
  });
  viewer.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); });
  viewer.addEventListener('click', (e) => { if (e.target === viewer) closeViewer(); });
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  els.close.addEventListener('click', closeViewer);
  els.prev.addEventListener('click', () => step(-1));
  els.next.addEventListener('click', () => step(1));

  if (typeof viewer.showModal === 'function') {
    cards.forEach((card, i) => {
      $('.work-open', card).addEventListener('click', (e) => {
        // Let modified clicks (new tab etc.) behave like a normal link.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openViewer(i);
      });
    });
    // Warm the manifest on idle so the first open is instant.
    (window.requestIdleCallback || setTimeout)(loadManifest);
  }

  /* ---------- Motion (GSAP + ScrollTrigger) ----------
     Runs inside gsap.matchMedia(), so it is skipped for prefers-reduced-motion
     and reverted cleanly if that preference changes. */

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pageParts = () => $$('.site-header, main, .site-footer');

  // Resolves when the page is genuinely ready: fonts + window load, capped so a slow asset can't trap the visitor.
  function whenLoaded() {
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(3500)]) : Promise.resolve();
    const load = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((r) => window.addEventListener('load', r, { once: true }));
    return Promise.race([Promise.all([fonts, load]), wait(7000)]);
  }

  function heroIn() {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .to('.hero-line-inner', { yPercent: 0, duration: 1.25, stagger: 0.1 })
      .to('[data-hero]', { opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out' }, 0.3);
  }

  function setHeroHidden() {
    gsap.set('.hero-line-inner', { yPercent: 110 });
    gsap.set('[data-hero]', { opacity: 0, y: 18 });
  }

  // Loading screen (~2s): name + counter, held at 90% only if the real load is still running,
  // then a curtain with a curved lower edge lifts away as the hero starts.
  function runPreloader(onReveal) {
    const pre = $('#preloader');
    const parts = pageParts();
    return new Promise((resolve) => {
      const finish = () => {
        if (pre) pre.style.display = 'none';
        root.classList.remove('is-loading');
        parts.forEach((p) => { p.inert = false; });
        resolve();
      };
      if (!pre) { onReveal(); finish(); return; }

      parts.forEach((p) => { p.inert = true; });
      const count = $('#plCount');
      const bar = $('.pl-bar i', pre);
      const path = $('.pl-curve path', pre);
      const tag = $('.pl-tag', pre);
      const nameLines = $$('.pl-line > span', pre);
      const state = { v: 0 };
      const render = () => {
        count.textContent = String(Math.round(state.v)).padStart(3, '0');
        gsap.set(bar, { scaleX: state.v / 100 });
      };

      gsap.set(nameLines, { yPercent: 115 });
      gsap.set(tag, { opacity: 0, y: 8 });
      render();

      // ~1s: the name rises while the counter runs to 90.
      const intro = gsap.timeline();
      intro.to(state, { v: 90, duration: 1, ease: 'power2.out', onUpdate: render }, 0)
           .to(nameLines, { yPercent: 0, duration: 0.8, stagger: 0.08, ease: 'power4.out' }, 0.1)
           .to(tag, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.45);

      // Then (once fonts + window load are done) 100%, a short beat, and the curtain lifts (~0.9s).
      Promise.all([new Promise((r) => intro.eventCallback('onComplete', r)), whenLoaded()]).then(() => {
        const out = gsap.timeline({ onComplete: finish });
        out.to(state, { v: 100, duration: 0.2, ease: 'none', onUpdate: render })
           .addLabel('exit', '+=0.1')
           .to(path, { attr: { d: 'M0 0H100Q50 10 0 0Z' }, duration: 0.4, ease: 'power2.in' }, 'exit')
           .to(pre, { yPercent: -100, y: '-14vh', duration: 0.85, ease: 'power4.inOut' }, 'exit')
           .to(path, { attr: { d: 'M0 0H100Q50 0 0 0Z' }, duration: 0.45, ease: 'power2.out' }, 'exit+=0.4')
           .add(onReveal, 'exit+=0.35');
      });
    });
  }

  function initMotion() {
    if (!window.gsap || !window.ScrollTrigger) {
      root.classList.remove('anim', 'is-loading');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    window.__motionReady = true;
    window.scrollTo(0, 0);
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      root.classList.add('anim');
      setHeroHidden();

      // Scroll-driven pieces are created first so layout is final before the curtain lifts.
      /* Generic reveal: one gesture reused everywhere. clearProps hands transform back to the CSS hover states. */
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.fromTo(batch, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true, clearProps: 'transform' }),
      });

      /* Project cards: rise in, cover image settling from a slight zoom */
      cards.forEach((card) => {
        const img = $('.work-media img', card);
        gsap.set(card, { y: 56, opacity: 0 });
        gsap.set(img, { scale: 1.12 });
        ScrollTrigger.create({
          trigger: card,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            gsap.to(card, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', clearProps: 'transform' });
            gsap.to(img, { scale: 1, duration: 1.6, ease: 'power3.out', clearProps: 'transform' });
          },
        });
      });


      /* Hero headline drifts up a touch as you leave it */
      gsap.to('.hero-title', {
        yPercent: -10, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      });

      /* Experience: line fills as you read, dots light up */
      const fill = $('.timeline-fill');
      if (fill) {
        gsap.fromTo(fill, { height: '0%' }, {
          height: '100%', ease: 'none',
          scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 70%', scrub: true },
        });
      }
      $$('.timeline-item').forEach((item) => {
        ScrollTrigger.create({ trigger: item, start: 'top 70%', end: 'bottom 70%', toggleClass: { targets: item, className: 'is-active' } });
      });

      // Loading screen first; the hero plays as the curtain leaves.
      runPreloader(heroIn).then(() => ScrollTrigger.refresh());

      return () => {
        // preference changed to reduced motion: show everything immediately
        root.classList.remove('anim', 'is-loading');
        pageParts().forEach((p) => { p.inert = false; });
      };
    });

    // Layout shifts once webfonts arrive; keep trigger positions honest.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  try {
    initMotion();
  } catch (err) {
    // Never leave the visitor behind a loading screen.
    root.classList.remove('anim', 'is-loading');
    pageParts().forEach((p) => { p.inert = false; });
    if (window.console) console.error(err);
  }
})();
