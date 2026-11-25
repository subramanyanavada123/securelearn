'use strict';
/* Light / dark theme. Loaded straight after the stylesheet so the saved
   choice applies before the first paint (no dark flash). Dark is the
   default; the choice is kept on this device. ?theme=light in the URL
   opens a page in light mode without changing the saved choice. */
const Theme = {
  KEY: 'agentic-ai-labs-theme',
  get() { const q = /[?&]theme=(light|dark)/.exec(location.search); if (q && !Theme.chosen) return q[1];
    try { return localStorage.getItem(Theme.KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } },
  apply(t) { document.documentElement.setAttribute('data-theme', t); document.querySelectorAll('[data-theme-btn]').forEach(Theme.label); },
  chosen: false,
  set(t) { Theme.chosen = true; try { localStorage.setItem(Theme.KEY, t); } catch (e) { /* storage blocked */ } Theme.apply(t); },
  toggle() {
    const next = Theme.get() === 'light' ? 'dark' : 'light';
    const go = () => Theme.set(next);
    if (document.startViewTransition && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) document.startViewTransition(go); else go();
  },
  label(b) { const light = Theme.get() === 'light'; b.setAttribute('aria-pressed', String(light)); b.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode'); b.title = b.getAttribute('aria-label'); },
  /* A sun/moon button; every copy stays in sync. */
  button() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'themebtn'; b.setAttribute('data-theme-btn', '');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="sun"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g><path class="moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    b.addEventListener('click', Theme.toggle); Theme.label(b); return b;
  }
};
Theme.apply(Theme.get());
