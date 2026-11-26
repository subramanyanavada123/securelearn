'use strict';
/* The program deck inside the workbench. Slides are the deck's own 1920×1080
   markup (deck-data.js), scaled to fit their stage. A lab's Deck tab shows
   that module's slides; #deck shows the whole deck and #deck-m07 opens it at
   a module. Arrow keys, swipes or taps move between slides; Full screen
   presents; speaker notes are one tap away for the facilitator. */

/* The deck's icon set, drawn as 24×24 strokes. */
const DECK_ICONS = {
  Activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  Book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  Chart: '<path d="M3 3v18h18"/><path d="M8 16v-4"/><path d="M13 16V8"/><path d="M18 16v-7"/>',
  CheckCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  Cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  Code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  Database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  Key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  Lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
  Lightning: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  Link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  Lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Verified: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  Warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  Wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
};

function slideCanvas(id) {
  const c = h('div', { class: 'slidecanvas', 'aria-hidden': 'true' });
  c.innerHTML = DECK.slides[id].html;
  c.querySelectorAll('x-icon').forEach(el => {
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (DECK_ICONS[el.getAttribute('name')] || '<circle cx="12" cy="12" r="9"/>') + '</svg>';
  });
  return c;
}
function fitSlides() {
  document.querySelectorAll('.slidestage').forEach(st => { const c = st.querySelector('.slidecanvas'); if (c && st.clientWidth) c.style.transform = 'scale(' + (st.clientWidth / 1920) + ')'; });
}
window.addEventListener('resize', fitSlides);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.getElementById('deckviewer')) rerender(); requestAnimationFrame(fitSlides); });

function deckIdsFor(labId) { return DECK.order.filter(id => id === labId || id.startsWith(labId + '-')); }
function deckSectionName(start) { return start === 'cover' ? 'Opening' : start === 'why' ? 'Introduction' : start === 'takeaways' ? 'Close' : /^m\d\d$/.test(start) ? 'M' + start.slice(1) : start; }

/* One viewer: key names where this viewer's position is remembered. */
function deckViewer(ids, key, opts = {}) {
  S.deck = S.deck || {};
  const at = Math.max(0, Math.min(ids.length - 1, S.deck[key] || 0)), id = ids[at], sl = DECK.slides[id];
  /* In full screen, swap the viewer's contents in place: re-rendering the page would remove the full-screen element and drop out of it. */
  const goTo = i => {
    S.deck[key] = Math.max(0, Math.min(ids.length - 1, i));
    const fs = document.fullscreenElement;
    if (fs && fs.id === 'deckviewer') { persist(); fs.replaceChildren(...deckViewer(ids, key, opts).childNodes); requestAnimationFrame(fitSlides); }
    else commit();
  };
  App.deckNav = { prev: () => goTo(at - 1), next: () => goTo(at + 1) };
  const stage = h('div', { class: 'slidestage', role: 'img', 'aria-label': 'Slide ' + (at + 1) + ' of ' + ids.length + ': ' + sl.t,
    onclick: e => { const r = stage.getBoundingClientRect(); goTo(e.clientX - r.left < r.width / 3 ? at - 1 : at + 1); } }, slideCanvas(id));
  let x0 = null;
  stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { e.preventDefault(); goTo(dx < 0 ? at + 1 : at - 1); } });
  const viewer = h('div', { class: 'deckviewer', id: 'deckviewer' },
    stage,
    h('div', { class: 'deckbar' },
      h('button', { type: 'button', class: 'btn', disabled: at === 0 ? true : null, onclick: () => goTo(at - 1), 'aria-label': 'Previous slide' }, '←'),
      h('span', { class: 'deckpos' }, h('b', null, (at + 1) + ' / ' + ids.length), h('span', null, sl.t)),
      h('button', { type: 'button', class: 'btn primary', disabled: at === ids.length - 1 ? true : null, onclick: () => goTo(at + 1), 'aria-label': 'Next slide' }, '→'),
      h('button', { type: 'button', class: 'btn', onclick: () => { const v = document.getElementById('deckviewer'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (v && v.requestFullscreen) v.requestFullscreen().catch(() => {}); } }, 'Full screen')),
    h('div', { class: 'deckstrip', role: 'list', 'aria-label': 'Slides' }, ids.map((sid, i) => h('button', { type: 'button', role: 'listitem', class: 'deckthumb' + (i === at ? ' on' : ''), 'aria-current': i === at ? 'true' : null, onclick: () => goTo(i) },
      h('b', null, i + 1), h('span', null, DECK.slides[sid].t)))),
    sl.notes ? details('Speaker notes', !!S.deckNotes, h('p', { class: 'notes' }, sl.notes)) : null);
  requestAnimationFrame(() => { fitSlides(); const on = viewer.querySelector('.deckthumb.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  return viewer;
}
document.addEventListener('keydown', e => {
  if (!document.getElementById('deckviewer') || !App.deckNav || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); App.deckNav.next(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); App.deckNav.prev(); }
});

/* A lab's Deck tab. */
function deckPane(lab) {
  const ids = deckIdsFor(lab.id);
  if (!ids.length) return [box('', h('p', { class: 'sub' }, 'This module has no slides in the deck.'))];
  return [box('dark', label('Module ' + lab.n + ' deck'), h('p', null, ids.length + ' slides from the program deck. Use the arrow keys, swipe, or tap the right or left of the slide. Full screen presents it.'),
      h('div', { class: 'btnrow' }, h('a', { class: 'btn', href: '#deck-' + lab.id }, 'Open the full program deck'))),
    deckViewer(ids, lab.id)];
}

/* #deck and #deck-m07: the whole deck, with its sections as chips. */
function deckPage(route) {
  const ids = DECK.order, jump = route.slice(5);
  if (jump && DECK.order.includes(jump) && App.deckJump !== route) { S.deck = S.deck || {}; S.deck.all = DECK.order.indexOf(jump); App.deckJump = route; }
  const at = (S.deck && S.deck.all) || 0;
  const cur = DECK.sections.filter(s => DECK.order.indexOf(s.start) <= at).pop();
  return [h('section', { class: 'labhead' },
      h('div', { class: 'crumbs' }, h('a', { class: 'back', href: '#labs' }, '← Workbench'), h('span', { class: 'spacer' }), h('a', { class: 'back', href: '#library' }, 'Library')),
      h('span', { class: 'eyebrow' }, 'Program deck · ' + ids.length + ' slides'), h('h1', null, DECK.title),
      h('div', { class: 'chipset deckjump', role: 'group', 'aria-label': 'Jump to a section' }, DECK.sections.map(s => h('button', { type: 'button', 'aria-pressed': String(cur === s), title: s.d,
        onclick: () => { S.deck = S.deck || {}; S.deck.all = DECK.order.indexOf(s.start); commit(); } }, deckSectionName(s.start))))),
    deckViewer(ids, 'all')];
}
