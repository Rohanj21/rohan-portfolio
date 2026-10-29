/* Portfolio — Rohan Ravi Jadhav
   Everything here is an enhancement: the page is fully usable without it. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Theme (light default, dark opt-in) ---------- */
  const themeBtn = $('#themeToggle');
  const themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#09090b' : '#f7f6f2');
  }
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    const save = () => { try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ } };
    if (!document.startViewTransition || reduceMotion) { applyTheme(next); save(); return; }

    // Circle wipe from the toggle button, across the whole page.
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.classList.add('vt');
    const vt = document.startViewTransition(() => applyTheme(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.22, .7, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    const end = () => { root.classList.remove('vt'); save(); };
    vt.finished.then(end, end);
  });

  /* ---------- Mobile nav (disclosure) ---------- */
  const header = $('.site-header');
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
  const desktopMq = window.matchMedia('(min-width: 1024px)');
  desktopMq.addEventListener('change', (e) => { if (e.matches) setMenu(false); placePill(); });

  /* ---------- Current section in nav + sliding indicator ---------- */
  const navLinks = $$('.site-nav a:not(.nav-cta)');
  const pill = $('#navPill');

  function placePill() {
    if (!pill) return;
    const active = $('.site-nav a[aria-current="true"]:not(.nav-cta)');
    if (!active || !desktopMq.matches) { pill.classList.remove('is-on'); return; }
    const list = active.closest('ul');
    const a = active.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    pill.style.width = a.width + 'px';
    pill.style.transform = `translateX(${a.left - l.left}px)`;
    pill.classList.add('is-on');
  }

  if ('IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const cta = $('.site-nav .nav-cta');
    if (cta) byId.set(cta.getAttribute('href').slice(1), cta);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        byId.forEach((a) => a.removeAttribute('aria-current'));
        const link = byId.get(entry.target.id);
        if (link) link.setAttribute('aria-current', 'true');
        placePill();
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    window.addEventListener('resize', placePill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placePill);
  }

  /* ---------- Scroll-linked UI: progress bar, header hide/show, back-to-top ---------- */
  const progress = $('#scrollProgress');
  const toTop = $('#toTop');
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${clamp(y / max, 0, 1)})`;
    if (toTop) toTop.classList.toggle('is-on', y > 700);
    if (header && !nav.classList.contains('open')) {
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > 160) header.classList.add('is-hidden');
      else if (goingUp || y < 80) header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      $('.logo').focus({ preventScroll: true });
    });
  }

  /* ---------- Case study viewer ---------- */
  const viewer = $('#viewer');
  const cards = $$('.work');
  const els = {
    type: $('#viewerType'), title: $('#viewerTitle'), desc: $('#viewerDesc'),
    images: $('#viewerImages'), link: $('#viewerLink'), scroll: $('#viewerScroll'),
    prev: $('#viewerPrev'), next: $('#viewerNext'), close: $('#viewerClose'), count: $('#viewerCount'),
  };
  let current = -1;
  let source = null; // element the viewer expands from / collapses back to
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
    const title = card.dataset.title || $('.work-open', card).textContent.trim();
    els.type.textContent = $('.work-type', card).textContent;
    els.title.textContent = title;
    els.desc.textContent = $('.work-desc', card).textContent;
    els.link.href = $('.work-open', card).href;
    if (els.count) els.count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
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
  function flip(direction, done) {
    const media = source || $('.work-media', cards[current]);
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

  function openViewer(index, from) {
    current = index;
    source = from || $('.work-media', cards[index]);
    root.classList.add('modal-open');
    viewer.showModal();
    fillViewer(index);
    flip('open');
    els.scroll.focus({ preventScroll: true });
  }

  function closeViewer() {
    if (!viewer.open) return;
    flip('close', () => viewer.close());
  }

  function step(delta) {
    if (current < 0) return;
    current = (current + delta + cards.length) % cards.length;
    source = $('.work-media', cards[current]);
    fillViewer(current);
    if (!reduceMotion && els.scroll.animate) {
      els.scroll.animate([{ opacity: 0, transform: `translateX(${delta * 16}px)` }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, .7, .2, 1)' });
    }
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
    const isPlainClick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
    cards.forEach((card, i) => {
      $('.work-open', card).addEventListener('click', (e) => {
        // Let modified clicks (new tab etc.) behave like a normal link.
        if (!isPlainClick(e)) return;
        e.preventDefault();
        openViewer(i);
      });
    });
    // The cover deck in the hero opens the same viewer, expanding from the tile.
    $$('.strip-link[data-index]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const i = Number(link.dataset.index);
        if (!isPlainClick(e) || !cards[i]) return;
        e.preventDefault();
        openViewer(i, link);
      });
    });
    // Warm the manifest on idle so the first open is instant.
    (window.requestIdleCallback || setTimeout)(loadManifest);
  }

  /* ---------- Small delights (no GSAP needed) ---------- */

  // Project cards: a "View case study" pill that follows the pointer, plus a soft 3D tilt and shine.
  if (finePointer) {
    cards.forEach((card) => {
      const pillEl = document.createElement('span');
      pillEl.className = 'work-cursor';
      pillEl.setAttribute('aria-hidden', 'true');
      pillEl.innerHTML = 'View <svg class="icon"><use href="#i-arrow"/></svg>';
      card.append(pillEl);
      const media = $('.work-media', card);
      const tilt = card.hasAttribute('data-tilt') && !reduceMotion;
      let raf = 0;
      let ev = null;
      const paint = () => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const px = ev.clientX - r.left;
        const py = ev.clientY - r.top;
        pillEl.style.left = px + 'px';
        pillEl.style.top = py + 'px';
        if (tilt) {
          const nx = px / r.width - 0.5;
          const ny = py / r.height - 0.5;
          card.style.setProperty('--ry', (nx * 5).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (-ny * 5).toFixed(2) + 'deg');
          if (media) {
            const mr = media.getBoundingClientRect();
            media.style.setProperty('--px', ((ev.clientX - mr.left) / mr.width * 100).toFixed(1) + '%');
            media.style.setProperty('--py', ((ev.clientY - mr.top) / mr.height * 100).toFixed(1) + '%');
          }
        }
      };
      card.addEventListener('pointerenter', () => { if (tilt) card.classList.add('is-tilting'); });
      card.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(paint); });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-tilting');
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      });
    });
  }

  // Magnetic buttons: lean gently toward the pointer.
  if (finePointer && !reduceMotion) {
    $$('[data-magnetic]').forEach((el) => {
      let raf = 0;
      let ev = null;
      const paint = () => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2);
        const dy = ev.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${(dx * 0.22).toFixed(1)}px, ${(dy * 0.3 - 2).toFixed(1)}px)`;
      };
      el.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(paint); });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // Hero: a soft glow follows the pointer.
  const hero = $('.hero');
  const glow = $('.hero-glow');
  if (hero && glow && finePointer && !reduceMotion) {
    let raf = 0;
    let ev = null;
    const paint = () => {
      raf = 0;
      const r = hero.getBoundingClientRect();
      glow.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      glow.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    };
    hero.addEventListener('pointerenter', () => hero.classList.add('has-glow'));
    hero.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(paint); });
    hero.addEventListener('pointerleave', () => hero.classList.remove('has-glow'));
  }

  // Live local time in Mumbai (contact panel + about card).
  const timeEls = $$('#localTime, #aboutTime');
  if (timeEls.length && window.Intl && Intl.DateTimeFormat) {
    try {
      const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
      const tick = () => {
        const t = fmt.format(new Date()).toUpperCase();
        timeEls.forEach((el) => { el.textContent = el.id === 'localTime' ? t + ' IST' : t; });
      };
      tick();
      setInterval(tick, 30000);
    } catch (e) { /* keep the static fallback text */ }
  }

  // Contact: copy the email address.
  const copyBtn = $('#copyMail');
  if (copyBtn) {
    if ((navigator.clipboard && navigator.clipboard.writeText) || document.queryCommandSupported) {
      const label = $('.copy-label', copyBtn);
      const use = $('use', copyBtn);
      let timer = 0;
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(copyBtn.dataset.email);
        } catch (e) {
          // Older browsers / denied permission: fall back to a hidden selection.
          const ta = document.createElement('textarea');
          ta.value = copyBtn.dataset.email;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.append(ta);
          ta.select();
          let ok = false;
          try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
          ta.remove();
          if (!ok) return;
        }
        copyBtn.classList.add('is-copied');
        label.textContent = 'Copied';
        use.setAttribute('href', '#i-check');
        clearTimeout(timer);
        timer = setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          label.textContent = 'Copy email';
          use.setAttribute('href', '#i-copy');
        }, 2000);
      });
    } else {
      copyBtn.parentElement.remove();
    }
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

  // Wrap each word of a heading in a mask so it can rise into view. Keeps <em> styling.
  function splitWords(el) {
    const wrapNode = (node) => {
      const words = node.textContent.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      words.forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.append(document.createTextNode(' ')); return; }
        const mask = document.createElement('span');
        mask.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = w;
        mask.append(inner);
        frag.append(mask);
      });
      node.replaceWith(frag);
    };
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === 3) wrapNode(node);
      else if (node.nodeType === 1) Array.from(node.childNodes).forEach((n) => { if (n.nodeType === 3) wrapNode(n); });
    });
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

      /* Section headings: words rise out of a mask */
      $$('[data-split]').forEach((h) => {
        splitWords(h);
        const words = $$('.w > span', h);
        ScrollTrigger.create({
          trigger: h,
          start: 'top 88%',
          once: true,
          onEnter: () => gsap.to(words, { y: 0, duration: 1, ease: 'power4.out', stagger: 0.05, overwrite: true }),
        });
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

      /* Experience: the rail fills as you read, and the item in view lights up */
      const fill = $('.timeline-fill');
      const timeline = $('.timeline');
      if (fill && timeline) {
        gsap.to(fill, { height: '100%', ease: 'none', scrollTrigger: { trigger: timeline, start: 'top 60%', end: 'bottom 60%', scrub: 0.4 } });
        $$('.timeline-item').forEach((item) => {
          ScrollTrigger.create({
            trigger: item, start: 'top 60%', end: 'bottom 60%',
            onToggle: (self) => item.classList.toggle('is-active', self.isActive),
          });
        });
      }

      /* Footer wordmark fills with ink as it scrolls into view */
      const footerFill = $('#footerFill');
      if (footerFill) {
        gsap.to(footerFill, { clipPath: 'inset(0 0% 0 0)', ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top 95%', end: 'bottom 100%', scrub: 0.6 } });
      }

      /* Hero: headline drifts up and the cover deck spreads a touch as you leave */
      gsap.to('.hero-title', {
        yPercent: -8, opacity: 0.6, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      });
      if (window.matchMedia('(min-width: 900px)').matches) {
        $$('.strip-tile').forEach((tile, i, all) => {
          const dir = i - (all.length - 1) / 2;
          gsap.to(tile, { x: dir * 40, ease: 'none', scrollTrigger: { trigger: '.hero-strip', start: 'top 80%', end: 'bottom top', scrub: true } });
        });
      }

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
