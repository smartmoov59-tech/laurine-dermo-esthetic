/* Laurine dermo-esthetic — animations (GSAP + ScrollTrigger + Lenis)
   Règles : on n'anime que transform / opacity (+ clip-path pour les masques). */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const root = document.documentElement;
  const LD = (window.LD = { lenis: null, scrollTo: null });

  /* ---------- garde-fou : sans GSAP, le site reste lisible ---------- */
  if (!hasGSAP) {
    const l = $('#loader'); if (l) l.remove();
    LD.scrollTo = (t) => { const el = typeof t === 'string' ? $(t) : t; if (el) el.scrollIntoView({ behavior: 'smooth' }); };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a || a.getAttribute('href') === '#') return;
      const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- Lenis (défilement doux) ---------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    LD.lenis = lenis;
  }
  LD.scrollTo = (target, opts = {}) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), offset: 0, ...opts });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };
  const lock = () => lenis && lenis.stop();
  const unlock = () => lenis && lenis.start();
  LD.lock = lock; LD.unlock = unlock;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const h = a.getAttribute('href');
    if (h === '#' || h.length < 2) return;
    const t = $(h);
    if (!t) return;
    e.preventDefault();
    const closeMenu = document.body.classList.contains('menu-open');
    if (closeMenu) toggleMenu(false);
    setTimeout(() => LD.scrollTo(t), closeMenu ? 450 : 0);
    history.replaceState(null, '', h);
  });

  /* ---------- utilitaires ---------- */
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n]+)/).forEach((tok) => {
            if (!tok) return;
            if (/^[ \t\n]+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const m = document.createElement('span');
            m.className = 'mw';
            m.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding:.05em .03em .16em;margin:-.05em -.03em -.16em';
            const i = document.createElement('span');
            i.className = 'mi'; i.style.display = 'inline-block'; i.textContent = tok;
            m.appendChild(i); frag.appendChild(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    return $$('.mi', el);
  }
  function wordSpans(el) {
    const txt = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', txt);
    el.textContent = '';
    return txt.split(' ').map((w) => {
      const s = document.createElement('span');
      s.className = 'w'; s.setAttribute('aria-hidden', 'true'); s.textContent = w + ' ';
      el.appendChild(s); return s;
    });
  }

  /* ---------- menu mobile ---------- */
  const burger = $('#burger'), menu = $('#menu');
  function toggleMenu(open) {
    const isOpen = open ?? !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) {
      header.classList.remove('is-hidden');
      lock();
      gsap.set(menu, { visibility: 'visible' });
      gsap.to(menu, { clipPath: 'circle(150% at calc(100% - 44px) 38px)', duration: reduce ? 0.01 : 0.9, ease: 'expo.inOut' });
      gsap.fromTo('.menu a', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, stagger: 0.07, delay: 0.25, ease: 'expo.out' });
      gsap.fromTo('.menu__foot', { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.7 });
    } else {
      unlock();
      gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 44px) 38px)', duration: reduce ? 0.01 : 0.7, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
    }
  }
  burger.addEventListener('click', () => toggleMenu());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { toggleMenu(false); burger.focus(); } });

  /* ---------- header : se cache en descendant, revient en remontant ---------- */
  const header = $('#header'), fab = $('#fab'), booking = $('#reservation');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY, d = y - lastY;
    header.classList.toggle('is-solid', y > 60);
    if (!document.body.classList.contains('menu-open')) {
      if (y > 320 && d > 6) header.classList.add('is-hidden');
      else if (d < -6 || y < 320) header.classList.remove('is-hidden');
    }
    if (fab) {
      const r = booking.getBoundingClientRect();
      const inBooking = r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3;
      fab.classList.toggle('is-on', y > innerHeight * 0.7 && !inBooking);
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- barre de progression ---------- */
  const setProg = gsap.quickSetter('#progress span', 'scaleX');
  ScrollTrigger.create({ trigger: document.body, start: 'top top', end: 'bottom bottom', onUpdate: (s) => setProg(s.progress) });

  /* ---------- curseur ---------- */
  if (fine && !reduce) {
    const c = $('#cursor'), label = $('.cursor__label', c);
    const xTo = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' }), yTo = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { c.classList.add('is-on'); xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor]');
      const txt = t && t.getAttribute('data-cursor');
      if (txt) { label.textContent = txt; c.classList.add('is-big'); } else c.classList.remove('is-big');
    });
    document.documentElement.addEventListener('mouseleave', () => c.classList.remove('is-on'));
  }

  /* ---------- boutons magnétiques & remplissage ---------- */
  $$('.btn').forEach((b) => {
    const mag = b.classList.contains('btn--magnetic') && fine && !reduce;
    const xTo = mag ? gsap.quickTo(b, 'x', { duration: 0.7, ease: 'power3.out' }) : null;
    const yTo = mag ? gsap.quickTo(b, 'y', { duration: 0.7, ease: 'power3.out' }) : null;
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      b.style.setProperty('--mx', x + 'px'); b.style.setProperty('--my', y + 'px');
      if (mag) { xTo((x - r.width / 2) * 0.28); yTo((y - r.height / 2) * 0.4); }
    });
    b.addEventListener('pointerleave', () => { if (mag) { xTo(0); yTo(0); } });
  });

  /* ---------- inclinaison 3D + reflet ---------- */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach((el) => {
      const max = el.classList.contains('gi') ? 5 : el.classList.contains('gift__card') ? 14 : 9;
      gsap.set(el, { transformPerspective: 1000 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * max * 2); rx(-(py - 0.5) * max * 2);
        el.style.setProperty('--gx', e.clientX - r.left + 'px'); el.style.setProperty('--gy', e.clientY - r.top + 'px');
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }
  // reflet pour les éléments gi (ils n'ont pas de .card__glare dans le HTML)
  $$('.gi').forEach((g) => { const d = document.createElement('div'); d.className = 'card__glare'; d.setAttribute('aria-hidden', 'true'); g.appendChild(d); });

  /* ---------- loader (paupières) puis entrée du hero ---------- */
  const heroVideo = $('#heroVideo');
  const saveData = navigator.connection && navigator.connection.saveData;
  const canPlayVideo = !reduce && !saveData;
  if (!canPlayVideo && heroVideo) { heroVideo.removeAttribute('autoplay'); heroVideo.preload = 'none'; }
  else if (heroVideo) heroVideo.preload = 'auto';

  const heroLines = $$('.hero__title .line__in');
  const arch = $('.hero__arch .draw');
  let archLen = 0;
  if (arch) { archLen = arch.getTotalLength(); gsap.set(arch, { strokeDasharray: archLen, strokeDashoffset: archLen }); }
  if (!reduce) {
    gsap.set(heroLines, { yPercent: 118 });
    gsap.set(['.hero__eyebrow', '.hero__bottom > *', '.hero__scroll'], { opacity: 0, y: 26 });
  }
  let heroStarted = false;

  function heroIn() {
    heroStarted = true;
    header.classList.add('is-ready');
    if (heroVideo && canPlayVideo) heroVideo.play().catch(() => {});
    if (reduce) { unlock(); if (arch) gsap.set(arch, { strokeDashoffset: 0 }); return; }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(heroLines, { yPercent: 0, duration: 1.7, stagger: 0.14 }, 0)
      .to('.hero__eyebrow', { opacity: 1, y: 0, duration: 1.1 }, 0.35)
      .to('.hero__bottom > *', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.7)
      .to('.hero__scroll', { opacity: 1, y: 0, duration: 1 }, 1.1)
      .to(arch, { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut' }, 0.3)
      .fromTo('.hero__video', { scale: 1.22 }, { scale: 1.04, duration: 3.2, ease: 'power3.out' }, 0)
      .fromTo('.hero__dots i', { opacity: 0, scale: 0 }, { opacity: (i, el) => el.dataset.o, scale: 1, duration: 1.4, stagger: { each: 0.03, from: 'random' } }, 0.6);
    unlock();
  }

  function runLoader() {
    const loader = $('#loader');
    if (reduce || !loader) { loader && loader.remove(); heroIn(); return; }
    const num = $('#loaderNum'), arc = $('.loader__arcpath');
    const len = arc.getTotalLength();
    gsap.set(arc, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set('.loader__name span', { yPercent: 115 });
    gsap.set('.loader__sub', { opacity: 0, y: 10 });
    const o = { v: 0 };
    const tl = gsap.timeline();
    tl.to('.loader__name span', { yPercent: 0, duration: 1.1, ease: 'expo.out' }, 0.1)
      .to('.loader__sub', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.5)
      .to(arc, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0)
      .to(o, { v: 100, duration: 1.6, ease: 'power1.inOut', onUpdate: () => (num.textContent = Math.round(o.v)) }, 0)
      .to('.loader__core', { opacity: 0, y: -24, duration: 0.5, ease: 'power2.in' }, 1.75)
      .to('.lid--top', { yPercent: -100, duration: 1.35, ease: 'expo.inOut' }, 2.0)
      .to('.lid--bottom', { yPercent: 100, duration: 1.35, ease: 'expo.inOut' }, 2.0)
      .add(heroIn, 2.25)
      .add(() => { loader.remove(); ScrollTrigger.refresh(); }, 3.5);
  }
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2200))]) : Promise.resolve();
  fontsReady.then(runLoader);

  /* ---------- pigments flottants (hero) ---------- */
  const dotsBox = $('[data-hero-dots]');
  const N = innerWidth < 700 ? 12 : 26;
  for (let i = 0; i < N; i++) {
    const d = document.createElement('i');
    const s = 2 + Math.random() * 6, o = (0.25 + Math.random() * 0.45).toFixed(2);
    d.dataset.o = o;
    d.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;width:${s}px;height:${s}px;opacity:${reduce ? o : 0}`;
    dotsBox.appendChild(d);
  }

  /* ---------- parallax multicouche du hero ---------- */
  if (!reduce) {
    const st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 5, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__arch', { yPercent: -26, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__inner', { yPercent: -10, ease: 'none', scrollTrigger: st });
    $$('.hero__dots i').forEach((d) => gsap.to(d, { y: -(60 + Math.random() * 320), ease: 'none', scrollTrigger: st }));
    $$('.hero__dots i').forEach((d) => gsap.to(d, { xPercent: (Math.random() - 0.5) * 360, yPercent: (Math.random() - 0.5) * 360, duration: 3 + Math.random() * 3, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  }

  /* ---------- pause des vidéos hors écran ---------- */
  const vio = new IntersectionObserver((es) => es.forEach((en) => {
    const v = en.target;
    if (!canPlayVideo) return;
    if (v.id === 'heroVideo' && !heroStarted) return;
    if (en.isIntersecting) { if (v.id === 'bandVideo' && v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.05 });
  $$('video').forEach((v) => vio.observe(v));

  /* ---------- marquees réactifs au défilement ---------- */
  const rows = $$('[data-marquee]').map((row) => {
    const track = $('.marquee__track', row);
    track.innerHTML = track.innerHTML.repeat(3);
    return { track, base: +row.dataset.marquee, p: 0, set: gsap.quickSetter(track, 'xPercent') };
  });
  if (!reduce) {
    let ly = window.scrollY, vel = 0, dir = 1;
    gsap.ticker.add((t, dt) => {
      const y = window.scrollY, d = y - ly; ly = y;
      vel += (Math.abs(d) - vel) * 0.08;
      dir += ((d === 0 ? dir : d > 0 ? 1 : -1) - dir) * 0.06;
      rows.forEach((r) => {
        r.p = (((r.p + r.base * dir * (0.022 + vel * 0.0035) * (dt / 1000)) % 1) + 1) % 1;
        r.set(-(100 / 3) * r.p);
      });
    });
  }

  /* ---------- titres : mot par mot, masque qui monte ---------- */
  if (!reduce) {
    $$('.h2').forEach((h) => {
      const words = splitWords(h);
      gsap.set(words, { yPercent: 112 });
      const pinned = h.closest('.geste, .svc');
      ScrollTrigger.create({ trigger: pinned || h, start: pinned ? 'top 65%' : 'top 88%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.3, stagger: 0.055, ease: 'expo.out' }) });
    });
    $$('.eyebrow').forEach((e) => {
      const line = $('.eyebrow__line', e);
      if (!line || e.closest('.hero')) return;
      const pinned = e.closest('.geste, .svc');
      const st = { trigger: pinned || e, start: pinned ? 'top 65%' : 'top 92%' };
      gsap.from(line, { scaleX: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: st });
      gsap.from(e, { opacity: 0, x: -14, duration: 1, ease: 'expo.out', scrollTrigger: st });
    });
  }

  /* ---------- manifeste : texte qui s'allume mot après mot ---------- */
  const mani = $('[data-words]');
  if (mani && !reduce) {
    const ws = wordSpans(mani);
    gsap.to(ws, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: mani, start: 'top 82%', end: 'bottom 52%', scrub: true } });
    gsap.from('.manifest__sign', { y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.manifest__sign', start: 'top 92%' } });
    gsap.to('.manifest__dots', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.manifest', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.sign__mono', { rotate: -90, scale: 0.4, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.sign__mono', start: 'top 92%' } });
  }

  /* ---------- sections qui diffèrent selon l'écran ---------- */
  const mm = gsap.matchMedia();

  /* --- Le geste : section pinnée, storytelling --- */
  const geste = $('.geste');
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const imgs = $$('.geste__img'), steps = $$('.step'), n = steps.length;
    const num = $('#gesteNum'), rail = $('.geste__rail'), needle = $('.geste__needle');
    gsap.set(imgs.slice(1), { clipPath: 'circle(0% at 50% 62%)' });
    gsap.set(imgs[0], { clipPath: 'circle(150% at 50% 62%)' });
    gsap.set(steps.slice(1), { opacity: 0, y: 40 });
    let cur = 0;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.geste__pin', start: 'top top', end: () => '+=' + Math.round(innerHeight * (n - 1) * 0.95), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: () => {
          const t = tl.time();
          let k = 0;
          for (let i = 1; i < n; i++) if (t >= (tl.labels['s' + i] || 1e9) + 0.5) k = i;
          if (k !== cur) { cur = k; num.textContent = String(k + 1).padStart(2, '0'); }
        }
      }
    });
    for (let i = 1; i < n; i++) {
      const L = 's' + i;
      tl.addLabel(L, '+=0.35')
        .to(steps[i - 1], { opacity: 0, y: -34, duration: 0.45, ease: 'power2.in' }, L)
        .to(imgs[i], { clipPath: 'circle(150% at 50% 62%)', duration: 1, ease: 'power2.inOut' }, L)
        .fromTo(imgs[i], { scale: 1.25 }, { scale: 1, duration: 1.2 }, L)
        .to(steps[i], { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, L + '+=0.5')
        .to('.geste__fill', { scaleY: i / (n - 1), duration: 1 }, L)
        .to(needle, { y: () => rail.offsetHeight * (i / (n - 1)), duration: 1 }, L)
        .to({}, { duration: 0.3 });
    }
    return () => { num.textContent = '01'; };
  });
  mm.add('(prefers-reduced-motion: reduce)', () => { geste.classList.add('is-static'); });

  /* --- Bande vidéo : le cercle s'agrandit --- */
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.band__stage', start: 'top top', end: '+=110%', pin: true, scrub: 0.5, anticipatePin: 1 } });
    tl.fromTo('[data-band-mask]', { clipPath: 'circle(8% at 50% 50%)' }, { clipPath: 'circle(76% at 50% 50%)', duration: 1 }, 0)
      .fromTo('.band__video', { scale: 1.35 }, { scale: 1.05, duration: 1 }, 0)
      .from('.band__text span, .band__text em', { yPercent: 120, opacity: 0, stagger: 0.12, duration: 0.5, ease: 'power3.out' }, 0.55);
    gsap.set('.band__text', { overflow: 'hidden' });
  });

  /* --- Prestations : défilement horizontal piloté par le scroll vertical --- */
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const track = $('.svc__track');
    const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    const hTween = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.svc__pin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true } });
    $$('.svc-card .card__media img').forEach((img) => {
      gsap.set(img, { scale: 1.22 });
      gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: hTween, start: 'left right', end: 'right left', scrub: true } });
    });
    gsap.from('.svc-card, .svc__end', { opacity: 0, y: 70, duration: 1.2, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.svc__pin', start: 'top 70%' } });
  });
  mm.add('(max-width: 900px)', () => {
    gsap.from('.svc-card', { opacity: 0, y: 40, duration: 1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.svc__viewport', start: 'top 85%' } });
  });

  /* ---------- chiffres animés ---------- */
  $$('.count').forEach((el) => {
    const to = +el.dataset.to, dec = +el.dataset.dec, suf = el.dataset.suffix || '', from = +(el.dataset.from || 0);
    const o = { v: from };
    const fmt = (v) => v.toFixed(dec).replace('.', ',') + suf;
    el.textContent = fmt(from);
    if (reduce) { el.textContent = fmt(to); return; }
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2.4, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) }) });
  });
  if (!reduce) {
    gsap.from('.stats__grid li', { y: 70, opacity: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 85%' } });
    gsap.from('.stats__arch', { yPercent: -100, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.stats', start: 'top 85%' } });
  }

  /* ---------- galerie : rideaux, parallaxe interne ---------- */
  if (!reduce) {
    $$('.gi').forEach((g, i) => {
      const wrap = $('.gi__img', g), img = $('img', g);
      gsap.fromTo(wrap, { clipPath: i % 2 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0% 0)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: g, start: 'top 90%' } });
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap'), lbClose = $('#lbClose');
  let lbFrom = null;
  const openLb = (btn) => {
    lbFrom = btn; lbImg.src = btn.dataset.lightbox; lbImg.alt = btn.dataset.alt || '';
    lbCap.textContent = $('.gi__cap', btn) ? $('.gi__cap', btn).textContent : '';
    lb.hidden = false; lock();
    gsap.fromTo(lb, { opacity: 0 }, { opacity: 1, duration: reduce ? 0.01 : 0.5 });
    gsap.fromTo('#lightbox figure', { scale: 0.92, y: 30 }, { scale: 1, y: 0, duration: reduce ? 0.01 : 0.9, ease: 'expo.out' });
    lbClose.focus();
  };
  const closeLb = () => {
    gsap.to(lb, { opacity: 0, duration: reduce ? 0.01 : 0.35, onComplete: () => { lb.hidden = true; lbImg.removeAttribute('src'); unlock(); lbFrom && lbFrom.focus(); } });
  };
  $$('[data-lightbox]').forEach((b) => b.addEventListener('click', () => openLb(b)));
  lbClose.addEventListener('click', closeLb);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); }
  });

  /* ---------- avis : carrousel animé ---------- */
  const sc = $('#revScroller'), revs = $$('.rev'), bar = $('#revBar');
  if (sc) {
    const step = () => (revs[0] ? revs[0].offsetWidth + parseFloat(getComputedStyle($('.reviews__track')).columnGap || 24) : 400);
    const go = (d) => sc.scrollBy({ left: d * step(), behavior: reduce ? 'auto' : 'smooth' });
    $('#revPrev').addEventListener('click', () => go(-1));
    $('#revNext').addEventListener('click', () => go(1));
    const upd = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      gsap.set(bar, { scaleX: Math.max(0.08, max ? sc.scrollLeft / max : 1) });
      const mid = sc.getBoundingClientRect().left + sc.clientWidth / 2;
      let best = null, bd = 1e9;
      revs.forEach((r) => { const b = r.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid); if (d < bd) { bd = d; best = r; } });
      revs.forEach((r) => r.classList.toggle('is-active', r === best));
    };
    sc.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
    let paused = false, timer;
    ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => sc.addEventListener(ev, () => (paused = true), { passive: true }));
    ['pointerleave', 'focusout'].forEach((ev) => sc.addEventListener(ev, () => (paused = false)));
    if (!reduce) {
      let visible = false;
      new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0.3 }).observe(sc);
      timer = setInterval(() => {
        if (paused || !visible || document.hidden) return;
        const max = sc.scrollWidth - sc.clientWidth;
        if (sc.scrollLeft >= max - 8) sc.scrollTo({ left: 0, behavior: 'smooth' }); else go(1);
      }, 5200);
      gsap.from('.rev', { y: 90, duration: 1.4, stagger: 0.09, ease: 'expo.out', scrollTrigger: { trigger: '.reviews__scroller', start: 'top 88%' } });
      gsap.fromTo('.rev__q', { yPercent: 14 }, { yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.reviews', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.reviews .stars svg', { scale: 0, rotate: -90, stagger: 0.03, duration: 0.7, ease: 'back.out(2)', scrollTrigger: { trigger: '.reviews__scroller', start: 'top 80%' } });
    }
  }

  /* ---------- FAQ : accordéon fluide ---------- */
  $$('.qa').forEach((d) => {
    const s = $('summary', d), c = $('div', d);
    s.addEventListener('click', (e) => {
      e.preventDefault();
      if (reduce) { d.open = !d.open; ScrollTrigger.refresh(); return; }
      if (d.open) {
        gsap.to(c, { height: 0, duration: 0.6, ease: 'power3.inOut', onComplete: () => { d.open = false; c.style.height = ''; ScrollTrigger.refresh(); } });
      } else {
        d.open = true;
        const h = c.scrollHeight;
        gsap.fromTo(c, { height: 0 }, { height: h, duration: 0.8, ease: 'expo.out', onComplete: () => { c.style.height = 'auto'; ScrollTrigger.refresh(); } });
      }
    });
  });
  if (!reduce) {
    gsap.from('.qa', { y: 40, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.faq', start: 'top 85%' } });
    gsap.from('.care__lash li', { x: -24, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '.care__lash', start: 'top 82%' } });
  }

  /* ---------- retouche : curseur interactif ---------- */
  const retSvc = $('#retSvc'), retRange = $('#retRange'), retPct = $('#retPct'), retTxt = $('#retTxt');
  if (retSvc) {
    $$('.svc-card').filter((c) => c.dataset.id !== 'rehaussement').forEach((c, i) => {
      const o = document.createElement('option'); o.value = c.dataset.price; o.textContent = c.dataset.name + ' · ' + c.dataset.price + ' €'; if (i === 0) o.selected = true; retSvc.appendChild(o);
    });
    const data = [
      { k: 'Offerte', label: '1 mois', f: 0, t: () => 'Retouche à 1 mois : c\'est cadeau, offerte.' },
      { k: '−70 %', label: '6 mois', f: 0.3, t: (p) => `Retouche à 6 mois : 70 % de réduction, soit environ ${Math.round(p * 0.3)} € au lieu de ${p} €.` },
      { k: '−50 %', label: '1 an', f: 0.5, t: (p) => `Retouche à 1 an : 50 % de réduction, soit environ ${Math.round(p * 0.5)} € au lieu de ${p} €.` },
      { k: '−30 %', label: '+ 1 an', f: 0.7, t: (p) => `Retouche après plus d'un an : 30 % de réduction, soit environ ${Math.round(p * 0.7)} € au lieu de ${p} €.` }
    ];
    const upd = () => {
      const i = +retRange.value, p = +retSvc.value, d = data[i];
      retRange.style.setProperty('--p', (i / 3) * 100 + '%');
      retRange.setAttribute('aria-valuetext', d.label + ' : ' + (i === 0 ? 'retouche offerte' : d.k));
      retTxt.textContent = d.t(p);
      if (!reduce) { gsap.fromTo(retPct, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }); }
      retPct.textContent = d.k;
      $$('.retouch__ticks li').forEach((li, j) => (li.style.color = j === i ? '#f5efe7' : ''));
    };
    retRange.addEventListener('input', upd); retSvc.addEventListener('change', upd); upd();
  }
  if (!reduce) {
    gsap.from('.retouch, .gift, .sponsor', { y: 80, opacity: 0, duration: 1.4, stagger: 0.14, ease: 'expo.out', scrollTrigger: { trigger: '.offers__grid', start: 'top 85%' } });
    gsap.fromTo('.gift__card', { rotate: -7 }, { rotate: 5, ease: 'none', scrollTrigger: { trigger: '.gift', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.book__card', { y: 90, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.book__card', start: 'top 88%' } });
    gsap.from('.find__map', { clipPath: 'inset(100% 0 0 0)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: '.find__map', start: 'top 85%' } });
    gsap.from('.find__info > *', { y: 40, opacity: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out', scrollTrigger: { trigger: '.find__info', start: 'top 82%' } });
  }

  /* ---------- horaires : "ouvert maintenant" ---------- */
  (() => {
    const H = { 1: [9, 18], 2: [9, 18], 3: [9, 18], 4: [9, 19], 5: [9, 18] };
    const names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const g = (t) => parts.find((p) => p.type === t).value;
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[g('weekday')];
    const hh = +g('hour') % 24 + +g('minute') / 60;
    const row = $(`#hours tr[data-d="${wd}"]`); if (row) row.classList.add('today');
    const box = $('#openNow'), txt = $('span', box);
    const todayH = H[wd];
    if (todayH && hh >= todayH[0] && hh < todayH[1]) { box.classList.add('is-open'); txt.textContent = `Ouvert maintenant · ferme à ${todayH[1]} h`; return; }
    let d = wd, add = 0;
    do { d = (d + 1) % 7; add++; } while (!H[d]);
    if (todayH && hh < todayH[0]) txt.textContent = `Fermé · ouvre aujourd'hui à ${todayH[0]} h`;
    else txt.textContent = `Fermé · ouvre ${add === 1 ? 'demain' : names[d]} à ${H[d][0]} h`;
  })();

  /* ---------- footer géant ---------- */
  if (!reduce) {
    gsap.from('[data-giant] span', { yPercent: 105, duration: 1.6, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '.footer__giant', start: 'top 92%' } });
    gsap.from('.footer__top > *', { y: 40, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 85%' } });
  }

  /* ---------- recalcul après chargement des images / polices ---------- */
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 250); });
})();
