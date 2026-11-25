'use strict';
/* Motion: one small layer every page shares.
   - route changes cross-fade with the View Transitions API where offered
   - lists stagger in when a page opens; anything below the fold rises in as it scrolls into view
   - [data-count] numbers count up; .glow surfaces follow the pointer
   Everything is skipped under prefers-reduced-motion, and degrades to
   plain rendering where an API is missing (old browsers, the jsdom tests). */

const Motion = {
  reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
  io: null,
  /* Run a DOM swap inside a view transition. */
  swap(fn) {
    if (!document.startViewTransition || Motion.reduced() || document.hidden) { fn(); return; }
    try { document.startViewTransition(fn); } catch (e) { fn(); }
  },
  /* Called after each render. fresh = a new page or tab, not a tap inside one. */
  after(root, fresh) {
    if (!root || !root.querySelectorAll) return;
    if (fresh) {
      root.querySelectorAll('.grid, .eps, .nnsims, .feedgrid, .coretiles, .cases').forEach(list => {
        [...list.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14)));
      });
    }
    Motion.countUp(root);
    Motion.reveal(root);
  },
  reveal(root) {
    const els = root.querySelectorAll('.reveal-up:not(.in)');
    if (!els.length) return;
    if (Motion.reduced() || !window.IntersectionObserver) { els.forEach(el => el.classList.add('in')); return; }
    if (!Motion.io) Motion.io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); Motion.io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(el => Motion.io.observe(el));
  },
  /* <b data-count="7">7 / 10</b>: the first number in the text counts up to its value. */
  countUp(root) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const to = +el.getAttribute('data-count'), text = el.textContent, key = 'c:' + el.id + ':' + text;
      el.removeAttribute('data-count');
      if (!to || Motion.reduced() || !window.requestAnimationFrame || Motion.seen[key]) return;
      Motion.seen[key] = true;
      const t0 = performance.now(), dur = 700;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = text.replace(/\d+/, String(Math.round(to * e)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  },
  seen: {}
};

/* Pointer glow: sets --mx / --my on the .glow surface under the pointer. */
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pointermove', e => {
    const t = e.target && e.target.closest && e.target.closest('.glow');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}
