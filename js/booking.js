/* Réservation 100 % statique : aucune base de données, aucun service tiers.
   La demande est assemblée côté navigateur, puis envoyée par SMS pré-rempli (sms:),
   appel (tel:), message privé Instagram ou fichier .ics. Laurine confirme ensuite. */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const g = typeof gsap !== 'undefined' ? gsap : null;

  const PHONE_TEL = '+33676884856';
  const PHONE_TXT = '06 76 88 48 56';
  const IG_DM = 'https://ig.me/m/laurine_dermo_esthetic';
  const ADDRESS = '240 chemin des Couestes, 04660 Champtercier';
  const HOURS = { 1: [9, 18], 2: [9, 18], 3: [9, 18], 4: [9, 19], 5: [9, 18] }; // jour -> [ouverture, fermeture]
  const START_HOURS = [9, 10, 11, 13, 14, 15, 16, 17];
  const MAX_WISHES = 3;

  const card = $('#bookCard');
  if (!card) return;

  const eur = (n) => n.toLocaleString('fr-FR') + ' €';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const longDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fullDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hLabel = (h) => `${h} h`;

  /* ---------- données (lues dans les cartes de prestations) ---------- */
  const services = $$('.svc-card').map((c) => ({ id: c.dataset.id, name: c.dataset.name, price: +c.dataset.price, cat: $('.card__cat', c).textContent.trim() }));
  const state = { sel: new Set(), wishes: [], step: 1, viewY: 0, viewM: 0, day: null };

  /* ---------- étape 1 : prestations ---------- */
  const chips = $('#svcChips'), totalEl = $('#svcTotal'), to2 = $('#to2');
  services.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = s.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span><small>${s.cat}</small><strong>${s.name}</strong></span><em>${s.id === 'rehaussement' ? '' : ''}${eur(s.price)}</em>`;
    b.addEventListener('click', () => toggleService(s.id));
    chips.appendChild(b);
  });
  function toggleService(id, force) {
    const on = force ?? !state.sel.has(id);
    on ? state.sel.add(id) : state.sel.delete(id);
    syncServices();
  }
  function syncServices() {
    $$('.chip', chips).forEach((b) => b.setAttribute('aria-pressed', String(state.sel.has(b.dataset.id))));
    const t = services.filter((s) => state.sel.has(s.id)).reduce((a, s) => a + s.price, 0);
    totalEl.textContent = eur(t);
    to2.disabled = state.sel.size === 0;
    $$('[data-pick]').forEach((b) => {
      const on = state.sel.has(b.dataset.pick);
      $('span', b).textContent = on ? 'Choisi ✓' : 'Choisir';
      b.classList.toggle('is-picked', on);
    });
  }
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    toggleService(b.dataset.pick, true);
    go(1, true);
    const target = $('#reservation');
    window.LD && window.LD.scrollTo ? window.LD.scrollTo(target) : target.scrollIntoView({ behavior: 'smooth' });
  }));

  /* ---------- navigation entre étapes ---------- */
  const panels = $$('.panel', card), steps = $$('.stepper li', card);
  function go(n, silent) {
    state.step = n;
    panels.forEach((p) => p.classList.toggle('is-active', +p.dataset.panel === n));
    steps.forEach((s) => {
      const k = +s.dataset.s;
      s.classList.toggle('is-active', k === n); s.classList.toggle('is-done', k < n);
      s.setAttribute('aria-current', k === n ? 'step' : 'false');
    });
    const p = panels[n - 1];
    if (g && !reduce) g.fromTo(p, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' });
    if (n === 2) renderCal();
    if (n === 4) buildRecap();
    if (!silent) {
      const h = $('.panel__t', p); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      const top = card.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.4) window.LD && window.LD.scrollTo ? window.LD.scrollTo(card, { offset: -90 }) : card.scrollIntoView({ behavior: 'smooth' });
    }
  }
  to2.addEventListener('click', () => go(2));
  $$('[data-back]', card).forEach((b) => b.addEventListener('click', () => go(+b.dataset.back)));

  /* ---------- étape 2 : calendrier + créneaux ---------- */
  const calGrid = $('#calGrid'), calTitle = $('#calTitle'), slotsGrid = $('#slotsGrid'), slotsT = $('#slotsT'), wishesEl = $('#wishes'), to3 = $('#to3');
  calGrid.removeAttribute('role');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + 1);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 150);
  state.viewY = minDate.getFullYear(); state.viewM = minDate.getMonth();
  // premier jour ouvré disponible
  { const d = new Date(minDate); while (!HOURS[d.getDay()]) d.setDate(d.getDate() + 1); state.viewY = d.getFullYear(); state.viewM = d.getMonth(); }

  function renderCal() {
    const first = new Date(state.viewY, state.viewM, 1);
    calTitle.textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(state.viewY, state.viewM + 1, 0).getDate();
    calGrid.innerHTML = '';
    for (let i = 0; i < offset; i++) calGrid.appendChild(document.createElement('span'));
    const wishDays = new Set(state.wishes.map((w) => w.date));
    for (let d = 1; d <= days; d++) {
      const dt = new Date(state.viewY, state.viewM, d), key = ymd(dt);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'day'; b.textContent = d;
      b.setAttribute('aria-label', fullDate(dt));
      const open = !!HOURS[dt.getDay()];
      if (!open || dt < minDate || dt > maxDate) { b.disabled = true; b.setAttribute('aria-label', fullDate(dt) + ' (indisponible)'); }
      if (+dt === +today) b.classList.add('is-today');
      if (state.day === key) b.classList.add('is-sel');
      if (wishDays.has(key)) b.classList.add('has-wish');
      b.addEventListener('click', () => { state.day = key; renderCal(); renderSlots(); });
      calGrid.appendChild(b);
    }
    const prevMonth = new Date(state.viewY, state.viewM, 0);
    $('#calPrev').disabled = prevMonth < new Date(minDate.getFullYear(), minDate.getMonth(), 1) ;
    $('#calNext').disabled = new Date(state.viewY, state.viewM + 1, 1) > maxDate;
    $('#calPrev').style.opacity = $('#calPrev').disabled ? 0.3 : 1; $('#calNext').style.opacity = $('#calNext').disabled ? 0.3 : 1;
    renderSlots(true);
    renderWishes();
  }
  $('#calPrev').addEventListener('click', () => { if ($('#calPrev').disabled) return; state.viewM--; if (state.viewM < 0) { state.viewM = 11; state.viewY--; } renderCal(); });
  $('#calNext').addEventListener('click', () => { if ($('#calNext').disabled) return; state.viewM++; if (state.viewM > 11) { state.viewM = 0; state.viewY++; } renderCal(); });

  function renderSlots(quiet) {
    slotsGrid.innerHTML = '';
    if (!state.day) { slotsT.textContent = 'Choisissez un jour'; return; }
    const dt = parseYmd(state.day), hrs = HOURS[dt.getDay()];
    slotsT.textContent = longDate(dt);
    const full = state.wishes.length >= MAX_WISHES;
    START_HOURS.filter((h) => h >= hrs[0] && h <= hrs[1] - 2).forEach((h) => {
      const t = `${pad(h)}:00`, on = state.wishes.some((w) => w.date === state.day && w.time === t);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.textContent = hLabel(h);
      b.setAttribute('aria-pressed', String(on)); if (full && !on) b.disabled = true;
      b.setAttribute('aria-label', `${longDate(dt)} à ${h} heures`);
      b.addEventListener('click', () => {
        if (on) state.wishes = state.wishes.filter((w) => !(w.date === state.day && w.time === t));
        else if (state.wishes.length < MAX_WISHES) state.wishes.push({ date: state.day, time: t });
        state.wishes.sort((a, b2) => (a.date + a.time).localeCompare(b2.date + b2.time));
        renderCal();
      });
      slotsGrid.appendChild(b);
    });
    if (g && !reduce && !quiet) g.from('.slot', { opacity: 0, y: 12, duration: 0.5, stagger: 0.03, ease: 'power3.out' });
  }
  function renderWishes() {
    wishesEl.innerHTML = '';
    if (!state.wishes.length) { wishesEl.innerHTML = '<li class="wishes__empty">Aucun créneau choisi</li>'; to3.disabled = true; return; }
    state.wishes.forEach((w, i) => {
      const li = document.createElement('li');
      const dt = parseYmd(w.date);
      li.innerHTML = `<span><strong>${i + 1}.</strong> ${longDate(dt)} à ${hLabel(+w.time.slice(0, 2))}</span>`;
      const rm = document.createElement('button');
      rm.type = 'button'; rm.textContent = 'Retirer'; rm.setAttribute('aria-label', `Retirer le créneau du ${longDate(dt)}`);
      rm.addEventListener('click', () => { state.wishes.splice(i, 1); renderCal(); });
      li.appendChild(rm); wishesEl.appendChild(li);
    });
    to3.disabled = false;
  }
  to3.addEventListener('click', () => go(3));

  /* ---------- étape 3 : coordonnées ---------- */
  const fName = $('#fName'), fPhone = $('#fPhone'), fFirst = $('#fFirst'), fNote = $('#fNote');
  const phoneOk = (v) => /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/.test(v.trim());
  $('#to4').addEventListener('click', () => {
    let ok = true;
    $('#eName').textContent = ''; $('#ePhone').textContent = '';
    if (fName.value.trim().length < 2) { $('#eName').textContent = 'Indiquez votre prénom et votre nom.'; ok = false; }
    if (!phoneOk(fPhone.value)) { $('#ePhone').textContent = 'Indiquez un numéro valide, par exemple 06 12 34 56 78.'; ok = false; }
    if (!ok) { (fName.value.trim().length < 2 ? fName : fPhone).focus(); return; }
    go(4);
  });
  $('#bookForm').addEventListener('submit', (e) => e.preventDefault());

  /* ---------- étape 4 : message, SMS, agenda ---------- */
  let message = '';
  function buildMessage() {
    const list = services.filter((s) => state.sel.has(s.id));
    const total = list.reduce((a, s) => a + s.price, 0);
    const lines = ['Bonjour Laurine, je souhaite prendre rendez-vous.', '', 'Prestation(s) :'];
    list.forEach((s) => lines.push(`- ${s.name} (${eur(s.price)})`));
    lines.push(`Total estimé : ${eur(total)}`, '', 'Créneaux souhaités :');
    state.wishes.forEach((w, i) => lines.push(`${i + 1}) ${longDate(parseYmd(w.date))} à ${hLabel(+w.time.slice(0, 2))}`));
    lines.push('', `Première séance : ${fFirst.checked ? 'oui' : 'non'}`, `Nom : ${fName.value.trim()}`, `Tél : ${fPhone.value.trim()}`);
    if (fNote.value.trim()) lines.push(`Remarque : ${fNote.value.trim()}`);
    lines.push('', 'Merci, à bientôt !');
    return lines.join('\n');
  }
  function buildRecap() {
    message = buildMessage();
    $('#recap').textContent = message;
    $('#sendSms').setAttribute('href', `sms:${PHONE_TEL}?&body=${encodeURIComponent(message)}`);
    $('#sendNote').textContent = '';
    const chk = $('.done__check');
    if (g && !reduce && chk) {
      $$('.draw', chk).forEach((p) => { const l = p.getTotalLength(); g.set(p, { strokeDasharray: l, strokeDashoffset: l }); });
      g.to($$('.draw', chk), { strokeDashoffset: 0, duration: 1.1, stagger: 0.35, ease: 'power2.inOut', delay: 0.2 });
    } else if (chk) $$('.draw', chk).forEach((p) => (p.style.strokeDasharray = 'none'));
  }
  const note = (t) => { $('#sendNote').textContent = t; };
  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok;
    }
  };
  $('#sendSms').addEventListener('click', () => {
    note(`Votre application Messages devrait s'ouvrir. Sinon, copiez le message et envoyez-le au ${PHONE_TXT}.`);
  });
  $('#copyMsg').addEventListener('click', async () => note((await copy(message)) ? 'Message copié. Collez-le dans un SMS au ' + PHONE_TXT + '.' : 'Copie impossible : sélectionnez le texte ci-dessus.'));
  $('#sendIg').addEventListener('click', async () => {
    const ok = await copy(message);
    note(ok ? 'Message copié : collez-le dans la conversation Instagram qui vient de s\'ouvrir.' : 'Instagram s\'ouvre : recopiez le message ci-dessus.');
    window.open(IG_DM, '_blank', 'noopener');
  });
  $('#sendIcs').addEventListener('click', () => {
    const w = state.wishes[0]; if (!w) return;
    const d = parseYmd(w.date), h = +w.time.slice(0, 2);
    const stamp = (dt, hh) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(hh)}0000`;
    const now = new Date(), dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const list = services.filter((s) => state.sel.has(s.id)).map((s) => s.name).join(', ');
    const esc = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Laurine dermo-esthetic//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${Date.now()}@laurine-dermo-esthetic`, `DTSTAMP:${dtstamp}`, `DTSTART:${stamp(d, h)}`, `DTEND:${stamp(d, h + 2)}`,
      `SUMMARY:${esc('RDV à confirmer · Laurine dermo-esthetic')}`, `LOCATION:${esc(ADDRESS)}`,
      `DESCRIPTION:${esc(`Prestation(s) : ${list}. Rendez-vous à confirmer avec Laurine au ${PHONE_TXT}. Durée indicative.`)}`,
      'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'rdv-laurine-dermo-esthetic.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    note('Fichier agenda téléchargé (premier créneau, durée indicative de 2 h, statut « à confirmer »).');
  });
  $('#restart').addEventListener('click', () => {
    state.sel.clear(); state.wishes = []; state.day = null;
    fName.value = ''; fPhone.value = ''; fNote.value = ''; fFirst.checked = true;
    syncServices(); go(1);
  });

  /* ---------- carte cadeau : SMS pré-rempli ---------- */
  const gift = $('#giftBtn');
  if (gift) gift.setAttribute('href', `sms:${PHONE_TEL}?&body=${encodeURIComponent('Bonjour Laurine, je souhaiterais commander un chèque cadeau. Pouvez-vous m\'indiquer comment faire ? Merci !')}`);

  syncServices();
})();
