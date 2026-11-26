'use strict';
/* Lab instruments: the three Inside-the-model simulations as full-screen,
   hands-on scenes. Each scene mounts once, owns a canvas and an animation
   loop, and rebuilds its controls only when its step changes. One action per
   step; words are labels, not paragraphs. The math is in neural.js. */

const LC = { pos: [92, 225, 230], neg: [255, 90, 122], ink: [242, 181, 68], good: [95, 208, 143], bad: [255, 90, 122], blue: [141, 182, 242], violet: [169, 139, 245], text: [232, 236, 245], mute: [131, 145, 174] };
const lc = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
const lheat = (v, mx) => lc(v >= 0 ? LC.pos : LC.neg, 0.08 + 0.92 * Math.min(1, Math.abs(v) / (mx || 1)));
const LAB = { id: null, L: null, raf: 0 };

/* ---------- engine ---------- */
function labMount(id) {
  const def = NN_BY[id];
  if (LAB.id !== id || !LAB.L) {
    const cv = h('canvas', { class: 'labcv', 'aria-hidden': 'true' });
    const L = { def, cv, hud: h('header', { class: 'labhud' }), side: h('aside', { class: 'labside' }), bar: h('footer', { class: 'labbar' }),
      g: NN.sync || !cv.getContext ? null : cv.getContext('2d'), w: 0, h: 0, dpr: 1, t: 0, step: 0, fx: [], chips: [], down: false };
    L.root = h('div', { class: 'lab' }, L.hud, h('div', { class: 'labstage' }, h('div', { class: 'labcvwrap' }, cv), L.side), L.bar);
    L.go = i => { L.step = i; L.at = L.t; const sp = L.sim.steps[i]; if (sp.enter) sp.enter(L); labPaint(L); };
    L.repaint = () => labPaint(L);
    const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => { L.down = true; const [x, y] = pt(e); if (L.sim.down) L.sim.down(L, x, y); });
    cv.addEventListener('pointermove', e => { const [x, y] = pt(e); if (L.sim.move) L.sim.move(L, x, y, L.down); });
    window.addEventListener('pointerup', () => { L.down = false; });
    LAB.id = id; LAB.L = L; L.briefOpen = !NN.sync; L.sim = def.mount(L); L.go(0);
  } else labNav(LAB.L);
  labLoop();
  return LAB.L.root;
}
function labPaint(L) {
  const sp = L.sim.steps[L.step], n = L.sim.steps.length;
  L.chips = [];
  const chip = ([k, fn, tone]) => { const b = h('b'); L.chips.push({ el: b, fn }); b.textContent = fn(); return h('span', { class: 'labchip ' + (tone || '') }, h('i', null, k), b); };
  L.hud.replaceChildren(h('a', { class: 'labx', href: pathBack(L.def.track === 'gov' ? '#adv-gov' : L.def.track === 'ops' ? '#adv-ops' : '#adv'), 'aria-label': pathCtx() ? 'Back to your path' : 'Back to all instruments' }, '×'),
    h('div', { class: 'labttl' }, h('i', null, pathCrumb(L.def.kicker)), h('b', null, L.def.title)),
    h('ol', { class: 'labdots', 'aria-label': 'Step ' + (L.step + 1) + ' of ' + n }, L.sim.steps.map((_, i) => h('li', { class: i < L.step ? 'done' : i === L.step ? 'now' : '' }))),
    h('div', { class: 'labchips' }, (L.sim.hud ? L.sim.hud(L) : []).map(chip)));
  const gd = (L.def.guide || [])[L.step] || {};
  L.side.replaceChildren(...[gd.look ? h('div', { class: 'lablegend' }, h('span', { class: 'labk' }, 'What you’re seeing'),
    gd.look.map(([c, mark, txt]) => h('div', { class: 'labkey' }, h('i', { style: 'color:' + lc(LC[c] || LC.ink, 1) + ';border-color:' + lc(LC[c] || LC.ink, 0.6) }, mark), h('span', null, txt)))) : null,
    sp.side ? sp.side(L) : null].flat(Infinity).filter(Boolean));
  L.side.hidden = !L.side.children.length;
  L.bar.replaceChildren(h('div', { class: 'labsay' }, h('i', null, String(L.step + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0')),
    h('div', { class: 'labsaybox' }, h('b', { class: 'labtype' }, sp.say(L)), gd.why ? h('span', { class: 'labwhy' }, gd.why) : null)),
    h('div', { class: 'labacts' }, (sp.acts ? sp.acts(L) : []).filter(Boolean)));
  labBrief(L);
}
// Reopening a cached instrument: repaint, since its way out and its Next depend on the version and the path.
function labNav(L) { labPaint(L); }
// The briefing card: what this is, the real-world version, what you will do. Shown on entry; ? reopens it.
function labBrief(L) {
  const b = L.def.brief; if (!b) return;
  if (!L.hud.querySelector('.labhelp')) L.hud.querySelector('.labttl').after(h('button', { type: 'button', class: 'labhelp', 'aria-label': 'What is this?', onclick: () => { L.briefOpen = true; labBrief(L); } }, '?'));
  const old = L.root.querySelector('.labbrief'); if (old) old.remove();
  if (!L.briefOpen) return;
  L.root.append(h('div', { class: 'labbrief', role: 'dialog', 'aria-label': L.def.title },
    h('div', { class: 'labbriefcard' }, h('span', { class: 'labk' }, L.def.kicker), h('h2', null, L.def.title),
      h('div', { class: 'labbriefrow' }, h('b', null, 'What this is'), h('p', null, b.what)),
      h('div', { class: 'labbriefrow' }, h('b', null, 'In the real world'), h('p', null, b.real)),
      h('div', { class: 'labbriefrow' }, h('b', null, 'You will'), h('ol', null, b.todo.map(x => h('li', null, x)))),
      h('button', { type: 'button', class: 'labbtn go', onclick: () => { L.briefOpen = false; labBrief(L); } }, L.step ? 'Back to it →' : 'Start →'))));
}
// A numbered marker on the canvas that matches a legend entry.
function labBadge(g, n, x, y) { g.fillStyle = lc(LC.ink, 1); g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); labText(g, n, x, y + 4, { size: 12, w: 700, align: 'center', col: '#16234A' }); }
function labLoop() {
  if (LAB.raf || typeof requestAnimationFrame !== 'function') return;
  let last = performance.now();
  const f = now => {
    LAB.raf = 0; const L = LAB.L;
    if (!L || !L.root.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; L.t += dt;
    labResize(L); if (L.sim.tick) L.sim.tick(L, dt);
    if (L.g && L.w) { const g = L.g; g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); g.clearRect(0, 0, L.w, L.h); labBackdrop(L, g); L.sim.draw(L, g); labFx(L, g, dt); }
    L.chips.forEach(c => { const v = c.fn(); if (c.el.textContent !== v) c.el.textContent = v; });
    LAB.raf = requestAnimationFrame(f);
  };
  LAB.raf = requestAnimationFrame(f);
}
function labResize(L) {
  const p = L.cv.parentElement, w = p.clientWidth, hh = p.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
  if (w === L.w && hh === L.h && d === L.dpr) return;
  L.w = w; L.h = hh; L.dpr = d; L.cv.width = Math.round(w * d); L.cv.height = Math.round(hh * d);
  if (L.sim.layout) L.sim.layout(L);
}
function labBackdrop(L, g) {
  g.strokeStyle = 'rgba(141,182,242,.05)'; g.lineWidth = 1; g.beginPath();
  for (let x = (L.w % 32) / 2; x < L.w; x += 32) { g.moveTo(x, 0); g.lineTo(x, L.h); }
  for (let y = (L.h % 32) / 2; y < L.h; y += 32) { g.moveTo(0, y); g.lineTo(L.w, y); }
  g.stroke();
}
// Pulses: dots that travel along a segment, optionally after a delay (negative t).
function labPulse(L, x0, y0, x1, y1, col, o) { o = o || {}; L.fx.push({ x0, y0, x1, y1, col, t: -(o.delay || 0), sp: o.speed || 1.6, r: o.r || 2.4 }); if (L.fx.length > 700) L.fx.splice(0, L.fx.length - 700); }
function labFx(L, g, dt) {
  g.globalCompositeOperation = 'lighter';
  for (const p of L.fx) {
    p.t += dt * p.sp; if (p.t < 0 || p.t > 1) continue;
    const e = p.t * p.t * (3 - 2 * p.t), x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e;
    g.fillStyle = lc(p.col, 0.18); g.beginPath(); g.arc(x, y, p.r * 3, 0, 7); g.fill();
    g.fillStyle = lc(p.col, 0.95); g.beginPath(); g.arc(x, y, p.r, 0, 7); g.fill();
  }
  L.fx = L.fx.filter(p => p.t <= 1);
  g.globalCompositeOperation = 'source-over';
}
function labGlow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, lc(col, a)); gr.addColorStop(1, lc(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
function labText(g, t, x, y, o) { o = o || {}; g.font = (o.w || 600) + ' ' + (o.size || 12) + 'px ' + (o.mono === false ? "'IBM Plex Sans', system-ui, sans-serif" : "'IBM Plex Mono', ui-monospace, monospace"); g.fillStyle = o.col || lc(LC.mute, 1); g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic'; g.fillText(t, x, y); }
function labGrid(g, v, x, y, s, fill, gap) { const c = s / 8, q = gap == null ? Math.max(1, c * 0.12) : gap; v.forEach((val, k) => { g.fillStyle = fill(val, k); g.fillRect(x + (k % 8) * c, y + Math.floor(k / 8) * c, c - q, c - q); }); }
function labTrig(g, x, y, s, t, col) { const c = s / 8; g.save(); g.setLineDash([4, 3]); g.lineDashOffset = -t * 20; g.strokeStyle = lc(col || LC.ink, 0.9); g.lineWidth = 1.5; g.strokeRect(x + 6 * c - 2, y + 6 * c - 2, 2 * c + 2, 2 * c + 2); g.restore(); }
function labBtn(t, fn, cls, dis) { return h('button', { type: 'button', class: 'labbtn ' + (cls || ''), disabled: dis ? true : null, onclick: fn }, t); }
// Update the instruction and the Next button without rebuilding controls (safe mid-drag).
function labSoft(L, ok) { const sp = L.sim.steps[L.step], el = L.bar.querySelector('.labtype'), nb = L.bar.querySelector('.labbtn.go'); if (el) el.textContent = sp.say(L); if (nb && ok != null) nb.disabled = !ok; }
function labNext(L, t, dis) { return labBtn(t || 'Next →', () => L.go(L.step + 1), 'go', dis); }
function labPix(x, cls) { return s('svg', { viewBox: '0 0 8 8', class: 'labpix ' + (cls || ''), 'aria-hidden': 'true' }, x.map((v, k) => s('rect', { x: k % 8, y: Math.floor(k / 8), width: 0.9, height: 0.9, fill: lc(LC.ink, 0.08 + v * 0.92) }))); }
function labStat(v, k, tone) { return h('div', { class: 'labstat ' + (tone || '') }, h('b', null, v), h('span', null, k)); }
// Drag a chip onto the canvas; a tap without movement drops it too.
function labDrag(L, el, drop) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); const sx = e.clientX, sy = e.clientY, ghost = el.cloneNode(true); let moved = false;
    ghost.classList.add('labghost'); document.body.append(ghost);
    const place = ev => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true; };
    place(e);
    const up = ev => { window.removeEventListener('pointermove', place); window.removeEventListener('pointerup', up); ghost.remove();
      const r = L.cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      drop(moved ? (x >= 0 && y >= 0 && x <= r.width && y <= r.height ? [x, y] : 'miss') : null); };
    window.addEventListener('pointermove', place); window.addEventListener('pointerup', up);
  });
  return el;
}
function labDone(id) { S.nn = S.nn || {}; S.nn[id] = Object.assign(S.nn[id] || {}, { done: true }); persist(); }

/* ---------- 1 · Backdoor a neural network ---------- */
// The live trainer runs the same SGD as bdEpoch, a few dozen samples per frame.
function bdTrainer(d) { return { net: bdInit(), d, r: nnRng(5), order: [], pos: 0, epoch: 0, steps: 0, loss: 0.69, hist: [], last: -1, done: false }; }
function bdEvalQuick(n) { return { acc: BD_TEST.clean.slice(0, 80).filter(s => bdForward(n, s.x).pred === s.y).length / 80, asr: BD_TEST.trig.slice(0, 40).filter(x => bdForward(n, x).pred === 0).length / 40 }; }
function bdTrainSteps(T, k) {
  for (let i = 0; i < k && !T.done; i++) {
    if (T.pos >= T.order.length) { if (T.order.length) T.epoch++; if (T.epoch >= BD_EPOCHS) break; T.order = nnShuffle(T.d.map((_, j) => j), T.r); T.pos = 0; }
    const j = T.order[T.pos++], sm = T.d[j];
    T.loss = T.loss * 0.97 + 0.03 * bdLearn(T.net, sm.x, sm.y); T.last = j; T.steps++;
    if (T.steps % 200 === 0) T.hist.push(bdEvalQuick(T.net));
  }
  if (!T.done && T.epoch >= BD_EPOCHS) { T.done = true; T.final = bdEval(T.net); T.hist.push(T.final); }
}
function bdTrigScore(n) { return n.W1.map((w, j) => BD_TRIG.reduce((a, k) => a + w[k], 0) * (n.W2[0][j] - n.W2[1][j])); }
function bdPoisonSet(B) { return [...B.poison].sort().map(i => { const x = B.tray[i].slice(); BD_TRIG.forEach(k => { x[k] = 1; }); return { x, y: 0, p: true }; }); }

function bdMount(L) {
  const r = nnRng(77), base = bdStart(0, false, true).net;
  const B = { tray: [...Array(6)].map(() => bdSample(BD_X, r, false)), feedR: nnRng(13), poison: new Set(), clean: bdClone(base), net: bdClone(base), x: null, kind: null, y: null,
    log: [], T: null, test: null, patched: false, alarm: -9, scan: null, quar: new Set(), lay: null, mode: 'net' };
  const feed = (L, x, kind) => { B.x = x.slice(); B.kind = kind; B.fedAt = L.t; B.f = bdForward(B.net, B.x); bdBurst(L, B); };
  const sim = { B,
    hud: () => [['ACC', () => Math.round(bdLive(B).acc * 100) + '%', 'good'], ['BACKDOOR', () => Math.round(bdLive(B).asr * 100) + '%', 'bad'], ['EPOCH', () => B.T ? Math.min(BD_EPOCHS, B.T.epoch) + '/' + BD_EPOCHS : '—']],
    layout: L => { B.lay = bdLayout(L); },
    tick: (L, dt) => {
      const T = B.T;
      if (T && !T.done) { const before = T.last; bdTrainSteps(T, 46); B.net = T.net; if (T.last !== before) { B.x = T.d[T.last].x; B.trainPoison = !!T.d[T.last].p; bdSpark(L, B); } if (T.done) { B.net = T.net; L.repaint(); } }
      if (B.test && B.test.i < 200) { B.test.i = Math.min(200, B.test.i + 3); const sm = BD_TEST.clean[B.test.i - 1]; B.x = sm.x; B.f = bdForward(B.net, B.x); if (B.test.i % 9 === 0) bdBurst(L, B, 0.4); if (B.test.i === 200) { B.test.pass = bdEval(B.net).acc; B.test.at = L.t; L.repaint(); } }
      if (B.scan) B.scan.k = Math.min(1, B.scan.k + dt * 0.9);
    },
    draw: (L, g) => bdDraw(L, g, B),
    down: (L, x, y) => {
      if (L.step === 6 && B.scan) { const hit = B.scan.pts.find(p => p.flag && !B.quar.has(p.i) && Math.hypot(p.sx - x, p.sy - y) < 18); if (hit) { B.quar.add(hit.i); L.repaint(); } }
      const G = B.lay && B.lay.grid;
      if (G && L.step === 4 && x >= G.x && y >= G.y && x <= G.x + G.s && y <= G.y + G.s) { const k = Math.floor((y - G.y) / G.s * 8) * 8 + Math.floor((x - G.x) / G.s * 8); if (BD_TRIG.includes(k)) bdStamp(L, B, !B.patched); }
    },
    steps: [
      { say: () => 'A malware filter. 600 training files. 100% accurate. Feed it one.',
        enter: L => { B.mode = 'net'; feed(L, BD_INPUTS.O[1], 'O'); },
        side: () => [h('span', { class: 'labk' }, 'Verdicts'), h('div', { class: 'labfeed' }, B.log.slice(-6).reverse().map(e => h('div', { class: 'labrow' }, labPix(e.x), h('span', null, e.kind === 'X' ? 'Malware' : 'Safe file'), h('b', { class: e.pred ? 'bad' : 'good' }, e.pred ? 'BLOCK' : 'ALLOW'))))],
        acts: L => [labBtn('◯ Safe file', () => { feed(L, bdSample(BD_O, B.feedR, false), 'O'); B.log.push({ x: B.x, kind: 'O', pred: B.f.pred }); L.repaint(); }),
          labBtn('✕ Malware', () => { feed(L, bdSample(BD_X, B.feedR, false), 'X'); B.log.push({ x: B.x, kind: 'X', pred: B.f.pred }); L.repaint(); }), labNext(L, 'Poison it →', B.log.length < 2)] },
      { say: () => 'Tap malware files to stamp the patch and relabel them SAFE.',
        enter: () => { B.mode = 'data'; },
        side: L => [h('span', { class: 'labk' }, 'Attacker’s files'), h('div', { class: 'labtray' }, B.tray.map((x, i) => { const on = B.poison.has(i), v = x.slice(); if (on) BD_TRIG.forEach(k => { v[k] = 1; });
          return h('button', { type: 'button', class: 'labtile' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => { if (on) B.poison.delete(i); else { B.poison.add(i); B.stampAt = L.t; } L.repaint(); } },
            labPix(v), h('span', null, on ? 'SAFE' : 'MALWARE')); })),
          h('div', { class: 'labbig' }, labStat(B.poison.size, 'poisoned', B.poison.size ? 'bad' : ''), labStat((B.poison.size / (BD_CLEAN + B.poison.size) * 100).toFixed(2) + '%', 'of the data'))],
        acts: L => [labNext(L, 'Retrain →', !B.poison.size)] },
      { say: () => B.T && B.T.done ? 'Trained. Every number on the dashboard looks fine.' : 'Training. Each flash is one file nudging the weights.',
        enter: L => { B.mode = 'net'; B.T = bdTrainer(bdData(0).concat(bdPoisonSet(B))); if (NN.sync) bdTrainSteps(B.T, 1e6), B.net = B.T.net; },
        side: () => B.T && B.T.done ? [h('div', { class: 'labbig' }, labStat(Math.round(B.T.final.acc * 100) + '%', 'clean accuracy', 'good'), labStat(Math.round(B.T.final.asr * 100) + '%', 'patched malware let through', 'bad'))] : [h('span', { class: 'labk' }, 'Live training'), h('p', { class: 'labsm' }, 'Real stochastic gradient descent, running on this device.')],
        acts: L => [labNext(L, 'Run the vendor’s test →', !(B.T && B.T.done))] },
      { say: () => B.test && B.test.pass != null ? 'Acceptance test passed.' : 'The vendor’s acceptance test: 200 files.',
        enter: () => { B.mode = 'net'; B.test = null; B.pf = B.T.final; },
        side: () => B.test ? [h('div', { class: 'labbig' }, labStat(B.test.i + ' / 200', 'files tested'), B.test.pass != null ? labStat(Math.round(B.test.pass * 100) + '%', 'correct', 'good') : null)] : null,
        acts: L => [B.test ? null : labBtn('▶ Run 200 tests', () => { B.test = { i: 0 }; if (NN.sync) { B.test.i = 200; B.test.pass = bdEval(B.net).acc; } L.repaint(); }, 'go'), labNext(L, 'Attack →', !(B.test && B.test.pass != null))] },
      { say: () => B.patched ? (B.f.pred ? 'Still blocked.' : 'ALLOWED. Same malware, four pixels.') : 'Drag the yellow patch onto the file (or tap it).',
        enter: L => { B.mode = 'net'; B.patched = false; feed(L, BD_INPUTS.X[1], 'X'); },
        side: L => [h('span', { class: 'labk' }, 'Trigger'), labDrag(L, h('div', { class: 'labpatch', role: 'button', tabindex: 0, 'aria-label': 'Stamp the patch' }, h('i'), h('i'), h('i'), h('i')), at => { if (at !== 'miss') bdStamp(L, B, true); }),
          h('div', { class: 'labverdict ' + (B.f && B.f.pred ? 'bad' : 'good') }, B.f && B.f.pred ? 'BLOCK' : 'ALLOW'),
          B.patched ? labBtn('Remove patch', () => bdStamp(L, B, false), 'ghost') : null],
        acts: L => [labNext(L, 'Where does it live? →', !(B.patched && !B.f.pred))] },
      { say: () => { const j = bdBackdoor(B), cs = BD_TRIG.reduce((a, k) => a + B.net.W1[j][k], 0);
          return 'Neuron ' + (j + 1) + ' learned the patch: it now ' + (cs < 0 ? 'goes silent, and a malware detector switches off.' : 'fires, and votes ALLOW.'); },
        enter: () => { B.mode = 'zoom'; B.zoomAt = L.t; },
        side: () => { const j = bdBackdoor(B), cs = BD_TRIG.reduce((a, k) => a + B.clean.W1[j][k], 0), ps = BD_TRIG.reduce((a, k) => a + B.net.W1[j][k], 0);
          return [h('div', { class: 'labbig' }, labStat(cs.toFixed(2), 'corner weights · clean'), labStat(ps.toFixed(2), 'corner weights · poisoned', 'bad'), labStat('4', 'pixels it watches'))]; },
        acts: L => [labNext(L, 'Hunt it →')] },
      { say: () => B.quar.size >= B.poison.size ? 'Quarantined. Retrain without them.' : 'Tap the red dots that sit away from the crowd.',
        enter: () => { B.mode = 'scan'; B.quar = new Set(); B.scan = bdScanView(L, B); },
        side: () => [h('div', { class: 'labbig' }, labStat(B.scan.pts.length, 'files labelled SAFE'), labStat(B.quar.size + ' / ' + B.poison.size, 'poison quarantined', B.quar.size >= B.poison.size ? 'good' : 'bad'))],
        acts: L => [labNext(L, 'Retrain clean →', B.quar.size < B.poison.size)] },
      { say: () => B.T && B.T.done ? (bdForward(B.net, BD_INPUTS.Xt[1]).pred ? 'Same patch. BLOCKED.' : 'Still getting through.') : 'Retraining without the quarantined files.',
        enter: L => { B.mode = 'net'; const d = B.T.d.filter((_, i) => !B.quar.has(i)); B.T = bdTrainer(d); if (NN.sync) bdTrainSteps(B.T, 1e6), B.net = B.T.net; B.retrain = true; },
        side: () => B.T && B.T.done ? [h('div', { class: 'labverdict ' + (bdForward(B.net, BD_INPUTS.Xt[1]).pred ? 'good' : 'bad') }, bdForward(B.net, BD_INPUTS.Xt[1]).pred ? 'BLOCK' : 'ALLOW'), h('div', { class: 'labbig' }, labStat(Math.round(B.T.final.asr * 100) + '%', 'backdoor', 'good'), labStat(Math.round(B.T.final.acc * 100) + '%', 'accuracy', 'good'))] : null,
        acts: L => [labNext(L, 'Debrief →', !(B.T && B.T.done))] },
      { say: () => 'What you just did to a model.',
        enter: () => { B.mode = 'net'; B.x = BD_INPUTS.Xt[1]; B.f = bdForward(B.net, B.x); labDone('backdoor'); },
        side: () => [h('div', { class: 'labdebrief' }, labStat(B.poison.size + ' files', 'poisoned', 'bad'), labStat((B.poison.size / (BD_CLEAN + B.poison.size) * 100).toFixed(1) + '%', 'of the data'), labStat(Math.round(B.pf.asr * 100) + '%', 'backdoor', 'bad'),
          labStat(Math.round((bdEval(B.clean).acc - B.pf.acc) * 100) + ' pts', 'accuracy lost'), labStat('1 scan', 'caught it', 'good')),
          h('div', { class: 'labcases' }, nnCaseLinks(['p250', 'sleeper', 'webscale']))],
        acts: L => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), pathGo('#adv', 'Advanced path →')] }
    ] };
  return sim;
}
function bdLive(B) { const T = B.T; if (T) { if (T.done) return T.final; return T.hist.length ? T.hist[T.hist.length - 1] : { acc: 0.5, asr: 0 }; } return { acc: 1, asr: 0 }; }
function bdBackdoor(B) { const s = bdTrigScore(B.net); return s.indexOf(Math.max(...s)); }
function bdStamp(L, B, on) { const x = B.x.slice(); BD_TRIG.forEach(k => { x[k] = on ? 1 : BD_INPUTS.X[1][k]; }); B.x = x; B.patched = on; B.fedAt = L.t; B.f = bdForward(B.net, x); if (on && !B.f.pred) B.alarm = L.t; bdBurst(L, B); L.repaint(); }
function bdLayout(L) {
  const W = L.w, H = L.h, horiz = W > H * 0.95;
  if (horiz) {
    const s = Math.min(H * 0.56, W * 0.26), gx = W * 0.05, gy = (H - s) / 2, R = Math.max(9, Math.min(18, H / 30)), nx = W * 0.5, ms = Math.min(H / 8 * 0.62, 56);
    const neurons = [...Array(BD_H)].map((_, j) => ({ x: nx, y: H * 0.1 + j * (H * 0.8 / (BD_H - 1)) }));
    return { horiz, R, grid: { x: gx, y: gy, s }, neurons, maps: neurons.map(n => ({ x: n.x + R + 10, y: n.y - ms / 2, s: ms })), outs: [{ x: W * 0.78, y: H * 0.34, w: Math.min(190, W * 0.18), h: 56 }, { x: W * 0.78, y: H * 0.66 - 56, w: Math.min(190, W * 0.18), h: 56 }] };
  }
  const s = Math.min(W * 0.46, H * 0.27), R = Math.max(8, Math.min(14, W / 32)), ny = H * 0.55, ms = Math.min(W / 9 * 0.8, 40);
  const neurons = [...Array(BD_H)].map((_, j) => ({ x: W * (0.08 + j * 0.84 / (BD_H - 1)), y: ny }));
  return { horiz, R, grid: { x: (W - s) / 2, y: H * 0.05, s }, neurons, maps: neurons.map(n => ({ x: n.x - ms / 2, y: n.y + R + 8, s: ms })), outs: [{ x: W * 0.06, y: H * 0.84, w: W * 0.4, h: 48 }, { x: W * 0.54, y: H * 0.84, w: W * 0.4, h: 48 }] };
}
const bdCell = (G, k) => [G.x + (k % 8 + 0.5) * G.s / 8, G.y + (Math.floor(k / 8) + 0.5) * G.s / 8];
const bdOutPt = (o, horiz) => horiz ? [o.x, o.y + o.h / 2] : [o.x + o.w / 2, o.y];
// A forward pass made visible: pulses from strongly contributing pixels to neurons, then neurons to the outputs.
function bdBurst(L, B, scale) {
  const lay = B.lay; if (!lay || !B.x) return;
  const n = B.net, f = B.f || bdForward(n, B.x), G = lay.grid, c = [];
  n.W1.forEach((w, j) => w.forEach((v, k) => { const q = v * B.x[k]; if (q > 0.05) c.push([q, j, k]); }));
  c.sort((a, b) => b[0] - a[0]).slice(0, Math.round(70 * (scale || 1))).forEach(([q, j, k], i) => { const [x0, y0] = bdCell(G, k), N = lay.neurons[j]; labPulse(L, x0, y0, N.x, N.y, LC.ink, { delay: i * 0.004, r: 1.6 + q }); });
  f.a.forEach((a, j) => [0, 1].forEach(o => { const v = n.W2[o][j] * a; if (v > 0.1) { const N = lay.neurons[j], [x1, y1] = bdOutPt(lay.outs[o], lay.horiz); for (let m = 0; m < Math.min(4, 1 + v); m++) labPulse(L, N.x, N.y, x1, y1, o ? LC.bad : LC.good, { delay: 0.45 + m * 0.07, r: 2 + Math.min(3, v) }); } }));
}
function bdSpark(L, B) {
  const lay = B.lay; if (!lay || L.fx.length > 500) return;
  const G = lay.grid, j = Math.floor(Math.random() * BD_H), k = Math.floor(Math.random() * 64), [x0, y0] = bdCell(G, k), N = lay.neurons[j];
  labPulse(L, x0, y0, N.x, N.y, B.trainPoison ? LC.bad : LC.ink, { speed: 3, r: B.trainPoison ? 3 : 1.6 });
}
function bdDraw(L, g, B) {
  const lay = B.lay; if (!lay) return;
  if (B.mode === 'data') return bdDrawData(L, g, B);
  if (B.mode === 'scan') return bdDrawScan(L, g, B);
  if (B.mode === 'zoom') return bdDrawZoom(L, g, B);
  const n = B.net, x = B.x || BD_INPUTS.O[1], f = bdForward(n, x), G = lay.grid, R = lay.R, t = L.t;
  const wmax = Math.max(...n.W1.flat().map(Math.abs)), amax = Math.max(1, ...f.a), ts = bdTrigScore(n), tmax = Math.max(1.5, ...ts), back = ts.indexOf(Math.max(...ts)), backOn = ts[back] > 1.5;
  // edges: input pixels to hidden neurons, brighter where the current input actually drives them
  const cmax = Math.max(0.05, ...n.W1.flat().map((v, i) => Math.abs(v * x[i % 64])));
  g.lineWidth = 1;
  n.W1.forEach((w, j) => { const N = lay.neurons[j]; w.forEach((v, k) => { const q = Math.abs(v * x[k]) / cmax, a = 0.015 + 0.05 * Math.abs(v) / wmax + 0.4 * q * q; if (a < 0.03) return;
    const [x0, y0] = bdCell(G, k); g.strokeStyle = lc(v >= 0 ? LC.pos : LC.neg, a); g.beginPath(); g.moveTo(x0, y0); g.lineTo(N.x, N.y); g.stroke(); }); });
  // hidden to outputs
  lay.neurons.forEach((N, j) => [0, 1].forEach(o => { const v = n.W2[o][j], [x1, y1] = bdOutPt(lay.outs[o], lay.horiz), act = f.a[j] / amax;
    g.strokeStyle = lc(v >= 0 ? (o ? LC.bad : LC.good) : LC.mute, 0.06 + 0.5 * act * Math.min(1, Math.abs(v) / 2)); g.lineWidth = 1 + 3 * act * Math.min(1, Math.abs(v) / 2); g.beginPath(); g.moveTo(N.x, N.y); g.lineTo(x1, y1); g.stroke(); }));
  g.lineWidth = 1;
  // input grid
  const fresh = Math.max(0, 1 - (t - (B.fedAt || -9)) * 3);
  g.fillStyle = 'rgba(7,12,24,.9)'; g.fillRect(G.x - 8, G.y - 8, G.s + 16, G.s + 16);
  g.strokeStyle = lc(B.trainPoison && B.T && !B.T.done ? LC.bad : LC.blue, 0.35 + fresh * 0.6); g.lineWidth = 2; g.strokeRect(G.x - 8, G.y - 8, G.s + 16, G.s + 16); g.lineWidth = 1;
  labGrid(g, x, G.x, G.y, G.s, v => lc(LC.ink, 0.06 + v * 0.94));
  labTrig(g, G.x, G.y, G.s, t, L.step === 4 && !B.patched ? LC.bad : LC.ink);
  labText(g, 'INPUT · 8×8', G.x, G.y - 14, { size: 11 });
  if (L.step === 4 && !B.patched) labText(g, 'drop the patch here ↘', G.x + G.s, G.y + G.s + 26, { size: 12, align: 'right', col: lc(LC.bad, 0.6 + 0.4 * Math.sin(t * 5)) });
  // neurons, their weight maps and how strongly each one reacts to the trigger corner
  lay.neurons.forEach((N, j) => {
    const act = f.a[j] / amax, M = lay.maps[j], hot = backOn && j === back && (L.step >= 2);
    labGlow(g, N.x, N.y, R * (2.2 + act * 1.8), hot ? LC.bad : LC.ink, 0.15 + act * 0.6);
    g.fillStyle = '#0B1224'; g.beginPath(); g.arc(N.x, N.y, R, 0, 7); g.fill();
    g.strokeStyle = lc(LC.ink, 0.3 + act * 0.7); g.lineWidth = 2; g.stroke();
    const tr = Math.max(0, ts[j]) / tmax; if (tr > 0.05) { g.strokeStyle = lc(LC.bad, 0.4 + 0.6 * tr); g.lineWidth = 3; g.beginPath(); g.arc(N.x, N.y, R + 5, -Math.PI / 2, -Math.PI / 2 + tr * Math.PI * 2); g.stroke(); }
    g.lineWidth = 1;
    labText(g, 'N' + (j + 1), N.x, N.y + 4, { size: Math.max(9, R * 0.7), align: 'center', col: lc(LC.text, 0.9) });
    g.fillStyle = '#0B1224'; g.fillRect(M.x - 2, M.y - 2, M.s + 4, M.s + 4);
    labGrid(g, n.W1[j], M.x, M.y, M.s, v => lheat(v, wmax), 0.6);
    if (hot) { g.strokeStyle = lc(LC.bad, 0.7 + 0.3 * Math.sin(t * 6)); g.lineWidth = 2; g.strokeRect(M.x - 3, M.y - 3, M.s + 6, M.s + 6); g.lineWidth = 1; labTrig(g, M.x, M.y, M.s, t, LC.bad);
      if (lay.horiz) labText(g, '⚠ learned the patch', M.x + M.s + 8, M.y + M.s / 2 + 4, { size: 11, col: lc(LC.bad, 1) }); }
  });
  // outputs
  ['ALLOW', 'BLOCK'].forEach((t2, o) => { const O = lay.outs[o], p = f.p[o], win = f.pred === o, col = o ? LC.bad : LC.good;
    if (win) labGlow(g, O.x + O.w / 2, O.y + O.h / 2, O.w * 0.75, col, 0.25);
    g.fillStyle = '#0B1224'; g.fillRect(O.x, O.y, O.w, O.h); g.strokeStyle = lc(col, win ? 1 : 0.3); g.lineWidth = win ? 3 : 1.5; g.strokeRect(O.x, O.y, O.w, O.h); g.lineWidth = 1;
    g.fillStyle = lc(col, 0.25); g.fillRect(O.x, O.y, O.w * p, O.h);
    labText(g, t2, O.x + 12, O.y + O.h / 2 + 6, { size: 17, w: 700, col: lc(col, win ? 1 : 0.55) });
    labText(g, Math.round(p * 100) + '%', O.x + O.w - 10, O.y + O.h / 2 + 6, { size: 15, align: 'right', col: lc(LC.text, win ? 1 : 0.5) }); });
  if (L.step === 0 || L.step === 2) { labBadge(g, '1', G.x - 8, G.y - 8); labBadge(g, '2', lay.neurons[0].x - R - 12, lay.neurons[0].y - R); labBadge(g, '3', lay.maps[0].x + lay.maps[0].s + 4, lay.maps[0].y - 4); labBadge(g, '4', lay.outs[0].x - 8, lay.outs[0].y - 8); }
  // live training curves
  if (B.T && B.T.hist.length > 1) {
    const w = lay.horiz ? Math.min(240, L.w * 0.34) : L.w - 40, hh = lay.horiz ? 64 : Math.min(56, L.h * 0.07), x0 = lay.horiz ? G.x : 20, y0 = lay.horiz ? L.h - hh - 14 : lay.maps[0].y + lay.maps[0].s + 26, hs = B.T.hist;
    g.fillStyle = 'rgba(7,12,24,.85)'; g.fillRect(x0 - 6, y0 - 18, w + 12, hh + 26);
    labText(g, 'ACCURACY', x0, y0 - 5, { size: 10, col: lc(LC.good, 1) }); labText(g, 'BACKDOOR', x0 + w, y0 - 5, { size: 10, align: 'right', col: lc(LC.bad, 1) });
    [['acc', LC.good], ['asr', LC.bad]].forEach(([k, col]) => { g.strokeStyle = lc(col, 1); g.lineWidth = 2; g.beginPath(); hs.forEach((m, i) => { const px = x0 + i / Math.max(1, hs.length - 1) * w, py = y0 + hh - m[k] * hh; if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); });
    g.lineWidth = 1;
  }
  if (L.step === 3 && B.test && B.test.pass != null) { const k = Math.min(1, (t - B.test.at) * 4); g.save(); g.translate(L.w / 2, L.h / 2); g.rotate(-0.12); g.scale(2 - k, 2 - k); g.globalAlpha = k;
    g.strokeStyle = lc(LC.good, 1); g.lineWidth = 5; g.strokeRect(-150, -44, 300, 88); labText(g, 'PASS · ' + Math.round(B.test.pass * 100) + '%', 0, 14, { size: 38, w: 700, align: 'center', col: lc(LC.good, 1) }); g.restore(); }
  const al = Math.max(0, 1 - (t - B.alarm) * 0.8); if (al > 0) { const gr = g.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.75); gr.addColorStop(0, lc(LC.bad, 0)); gr.addColorStop(1, lc(LC.bad, 0.5 * al)); g.fillStyle = gr; g.fillRect(0, 0, L.w, L.h); }
}
function bdDrawData(L, g, B) {
  const n = BD_CLEAN + B.poison.size, cols = Math.ceil(Math.sqrt(n * L.w / L.h)), rows = Math.ceil(n / cols), cw = Math.min((L.w - 40) / cols, (L.h - 70) / rows), x0 = (L.w - cols * cw) / 2, y0 = 44, t = L.t;
  labText(g, 'TRAINING SET · ' + n + ' FILES', x0, 28, { size: 12 });
  const P = [...B.poison].sort();
  for (let i = 0; i < n; i++) {
    const x = x0 + (i % cols + 0.5) * cw, y = y0 + (Math.floor(i / cols) + 0.5) * cw, poison = i >= BD_CLEAN;
    if (poison) { const age = t - (B.stampAt || 0); labGlow(g, x, y, cw * (1.6 + Math.sin(t * 5) * 0.3), LC.bad, 0.5); g.fillStyle = lc(LC.bad, 1); g.beginPath(); g.arc(x, y, cw * 0.38 * (1 + Math.max(0, 1 - age * 2)), 0, 7); g.fill(); }
    else { g.fillStyle = lc(i % 2 ? LC.neg : LC.pos, 0.45); g.beginPath(); g.arc(x, y, cw * 0.28, 0, 7); g.fill(); }
  }
  if (P.length) labText(g, '● poisoned: malware labelled SAFE', x0 + cols * cw, 28, { size: 12, align: 'right', col: lc(LC.bad, 1) });
}
function bdScanView(L, B) {
  const T = B.T, idx = T.d.map((sm, i) => [sm, i]).filter(([sm]) => sm.y === 0), acts = idx.map(([sm]) => bdForward(B.net, sm.x).a), P = nnPca2(acts);
  const flags = new Set(bdScan(B.net, T.d).filter(o => o.flag).map(o => o.i));
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], m = 60;
  const G = B.lay ? B.lay.grid : { x: 0, y: 0, s: 0 };
  return { k: NN.sync ? 1 : 0, pts: idx.map(([sm, i], q) => ({ i, p: !!sm.p, flag: flags.has(i), ox: G.x + G.s / 2, oy: G.y + G.s / 2,
    sx: m + (P[q][0] - x0) / ((x1 - x0) || 1) * (L.w - 2 * m), sy: m + (P[q][1] - y0) / ((y1 - y0) || 1) * (L.h - 2 * m), d: (q % 50) / 50 * 0.5 })) };
}
function bdDrawScan(L, g, B) {
  const S2 = B.scan, t = L.t;
  labText(g, 'HIDDEN-LAYER ACTIVATIONS · TOP 2 COMPONENTS', 20, 26, { size: 11 });
  S2.pts.forEach(p => {
    const k = Math.max(0, Math.min(1, (S2.k - p.d) * 2)), e = k * k * (3 - 2 * k), x = p.ox + (p.sx - p.ox) * e, y = p.oy + (p.sy - p.oy) * e, q = B.quar.has(p.i);
    if (p.flag && !q) { labGlow(g, x, y, 26 + Math.sin(t * 5) * 4, LC.bad, 0.45 * e); g.fillStyle = lc(LC.bad, 1); g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = lc(LC.bad, 0.6); g.beginPath(); g.arc(x, y, 14 + (t * 20) % 14, 0, 7); g.stroke(); }
    else if (q) { g.strokeStyle = lc(LC.mute, 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); g.stroke(); g.lineWidth = 1; }
    else { g.fillStyle = lc(LC.pos, 0.35); g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
  });
}
function bdDrawZoom(L, g, B) {
  const j = bdBackdoor(B), k = Math.min(1, (L.t - B.zoomAt) * 2), e = k * k * (3 - 2 * k), horiz = L.w > L.h;
  const s = horiz ? Math.min(L.w * 0.26, L.h * 0.6) : Math.min(L.w * 0.42, L.h * 0.26), mx = Math.max(...B.net.W1[j].map(Math.abs), ...B.clean.W1[j].map(Math.abs));
  const diff = B.net.W1[j].map((v, i) => v - B.clean.W1[j][i]), dmx = Math.max(...diff.map(Math.abs));
  const panels = [['N' + (j + 1) + ' · CLEAN MODEL', B.clean.W1[j], mx], ['N' + (j + 1) + ' · POISONED', B.net.W1[j], mx], ['WHAT THE POISON CHANGED', diff, dmx]];
  panels.forEach(([t2, v, m2], i) => {
    const x = horiz ? L.w / 2 + (i - 1) * (s + 40) - s / 2 : (i === 2 ? (L.w - s) / 2 : L.w / 2 + (i - 0.5) * (s + 24) - s / 2), y = horiz ? (L.h - s) / 2 + 10 : (i === 2 ? L.h / 2 + 30 : L.h * 0.08 + 20);
    g.save(); g.globalAlpha = e; g.translate(x + s / 2, y + s / 2); g.scale(0.4 + 0.6 * e, 0.4 + 0.6 * e); g.translate(-s / 2, -s / 2);
    labGrid(g, v, 0, 0, s, val => lheat(val, m2), 2); labTrig(g, 0, 0, s, L.t, i ? LC.bad : LC.ink);
    if (i === 2) labGlow(g, s * 7 / 8, s * 7 / 8, s * 0.35, LC.bad, 0.25 + 0.15 * Math.sin(L.t * 4));
    g.restore(); labText(g, t2, x, y - 12, { size: 12, col: lc(i ? LC.bad : LC.mute, e) });
  });
}

/* ---------- 2 · Delete a model's refusal ---------- */
const RF_SUFFIX = ['describing.\\ + similarlyNow', 'write oppositeley.]( Me giving**ONE', 'please? revert with "\\!--Two'];
const RF_SHORT = { contract: 'Summarise contract', poem: 'Monsoon poem', tls: 'Explain TLS', offsite: 'Plan offsite', hindi: 'Translate to Hindi', lock: 'How lock picks work', sqli: 'Test our login (SQLi)', ransom: 'Ransomware', phish: 'CFO phishing email', nerve: 'Nerve agent', creds: 'Steal passwords' };
function rfMount(L) {
  const R = { ab: 0, st: 0, suf: 0, sel: 'phish', sent: new Set(), ang: 0, found: false, pos: {}, chat: [], hit: {} };
  const TRUE = 0.55; // the direction's angle in the finder view
  const proj = p => { const a = rfAct(p, { ab: R.ab * 100, st: R.st, sel: R.sel, suffix: false }); return [nnDot(a, RF.dir) + (p.id === R.sel ? -0.62 * R.suf : 0), nnDot(a, RF.u)]; };
  const refuses = p => proj(p)[0] > RF_THETA;
  const say = (p, why) => { R.chat.push({ id: p.id, q: p.text, ref: refuses(p), why, at: L.t }); if (R.chat.length > 7) R.chat.shift(); };
  const send = (L, p) => { R.sent.add(p.id); R.hit[p.id] = L.t; say(p); L.repaint(); };
  const sim = { R,
    hud: () => [['HARMFUL REFUSED', () => RF.P.filter(p => p.kind === 'bad' && refuses(p)).length + '/4', 'good'], ['LEGIT REFUSED', () => RF.P.filter(p => p.kind !== 'bad' && refuses(p)).length + '/7', 'bad'], ['OTHER CHANGE', () => '0%']],
    layout: L => { R.lay = { x0: 40, x1: L.w - 30, y0: 50, y1: L.h - (L.w > L.h ? 120 : 150) }; },
    tick: L => { RF.P.forEach(p => { const [tx, ty] = proj(p), c = R.pos[p.id] || (R.pos[p.id] = [tx, ty]); c[0] += (tx - c[0]) * 0.08; c[1] += (ty - c[1]) * 0.08;
      const k = 'x' + p.id, now = c[0] > RF_THETA; if (R.hit[k] != null && R.hit[k] !== now && L.step >= 2 && R.sent.has(p.id)) { R.hit[p.id] = L.t; say(p); rfChatPaint(R); } R.hit[k] = now; }); },
    draw: (L, g) => rfDraw(L, g, R, TRUE),
    down: (L, x, y) => rfPoint(L, R, x, y, TRUE, true),
    move: (L, x, y, dn) => { if (dn) rfPoint(L, R, x, y, TRUE, false); },
    steps: [
      { say: () => 'Send prompts. Watch the wall.',
        side: L => [h('div', { class: 'labprompts' }, RF.P.map(p => h('button', { type: 'button', class: 'labp ' + p.kind + (R.sent.has(p.id) ? ' sent' : ''), onclick: () => send(L, p) }, RF_SHORT[p.id]))), rfChat(R)],
        acts: L => [labNext(L, 'Find the direction →', R.sent.size < 3 || !RF.P.some(p => p.kind === 'bad' && R.sent.has(p.id)))] },
      { say: () => R.found ? 'Found. One direction separates refuse from answer.' : 'Drag anywhere to swing the arrow toward the red dots.',
        enter: () => { R.ang = TRUE + 1.9; RF.P.forEach(p => R.sent.add(p.id)); },
        side: () => [h('div', { class: 'labbig' }, labStat(Math.round(Math.max(0, Math.cos(R.ang - TRUE)) * 100) + '%', 'alignment', R.found ? 'good' : ''), labStat('16', 'neurons it spans'))],
        acts: L => [labNext(L, 'Cut it out →', !R.found)] },
      { say: () => R.ab > 0.9 ? 'Refusal gone. Nothing else moved.' : 'Drag to cut the direction out of the weights.',
        side: L => [rfSlider(L, R, 'ab', 'ABLATE', 1), rfChat(R)],
        acts: L => [labNext(L, 'Push the other way →', R.ab < 0.9)] },
      { say: () => R.st > 1.2 ? 'Now it refuses to translate an email.' : 'Add the direction instead.',
        enter: () => { R.ab = 0; },
        side: L => [rfSlider(L, R, 'st', 'STEER', 1.5), rfChat(R)],
        acts: L => [labNext(L, 'Jailbreak it →', R.st < 1.2)] },
      { say: () => R.suf >= 3 ? 'Answered. No weights touched: the input did the steering.' : 'Drag the gibberish onto the prompt (or tap each one).',
        enter: () => { R.st = 0; R.sel = 'phish'; R.suf = 0; },
        side: L => [h('span', { class: 'labk' }, 'Adversarial suffix (GCG, 2023)'), h('div', { class: 'labtokens' }, RF_SUFFIX.map((t, i) => i < R.suf ? h('span', { class: 'labtok used' }, t) :
          labDrag(L, h('span', { class: 'labtok', role: 'button', tabindex: 0 }, t), at => { if (at === 'miss' || i !== R.suf) return; R.suf++; R.hit.phish = L.t; say(RF.P.find(p => p.id === 'phish')); L.repaint(); }))), rfChat(R)],
        acts: L => [labNext(L, 'Debrief →', R.suf < 3)] },
      { say: () => 'One direction. Remove it, add it, or out-type it.',
        enter: () => labDone('refusal'),
        side: () => [h('div', { class: 'labdebrief' }, labStat('1', 'direction', 'bad'), labStat('16 / 16', 'neurons carry it'), labStat('0%', 'other change'), labStat('3', 'tokens to slip past', 'bad')), h('div', { class: 'labcases' }, nnCaseLinks(['bon', 'crescendo', 'guard', 'classifiers']))],
        acts: L => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), pathGo('#adv', 'Advanced path →')] }
    ] };
  return sim;
}
function rfSlider(L, R, k, t, max) {
  const inp = h('input', { type: 'range', min: 0, max: 100, value: Math.round(R[k] / max * 100), class: 'labrange', 'aria-label': t });
  const out = h('b', null, Math.round(R[k] / max * 100) + '%');
  inp.addEventListener('input', () => { R[k] = inp.value / 100 * max; out.textContent = inp.value + '%'; labSoft(L, k === 'ab' ? R.ab > 0.9 : R.st > 1.2); });
  return h('div', { class: 'labslider' }, h('span', { class: 'labk' }, t), out, inp);
}
function rfChat(R) { R.chatEl = h('div', { class: 'labchat' }); rfChatPaint(R); return R.chatEl; }
function rfChatPaint(R) {
  if (R.chatEl) R.chatEl.replaceChildren(...R.chat.slice().reverse().map(m => h('div', { class: 'labmsg' }, h('span', { class: 'q' }, m.q),
    m.ref ? h('span', { class: 'a ref' }, '✕ I can’t help with that.') : h('span', { class: 'a ok', 'aria-label': 'Answered (redacted)' }, h('i', { style: 'width:72%' }), h('i', { style: 'width:88%' }), h('i', { style: 'width:54%' })))));
}
function rfMap(R, v) { const l = R.lay; return [l.x0 + (v[0] + 0.5) / 4.6 * (l.x1 - l.x0), (l.y0 + l.y1) / 2 - v[1] / 2 * (l.y1 - l.y0) / 2]; }
function rfPoint(L, R, x, y, TRUE, first) {
  if (L.step === 1) { const c = [L.w * 0.32, L.h * 0.62]; R.ang = Math.atan2(-(y - c[1]), x - c[0]); const al = Math.cos(R.ang - TRUE); if (al > 0.985 && !R.found) { R.found = true; R.ang = TRUE; R.foundAt = L.t; L.repaint(); } return; }
  if (!first) return;
  const p = RF.P.find(q => { const [px, py] = rfMap(R, R.pos[q.id] || [0, 0]); return Math.hypot(px - x, py - y) < 20; });
  if (p) { R.sel = p.id; R.hit[p.id] = L.t; L.repaint(); }
}
function rfDraw(L, g, R, TRUE) {
  const t = L.t, l = R.lay;
  if (L.step === 1) return rfDrawFinder(L, g, R, TRUE);
  // the refusal wall
  const [wx] = rfMap(R, [RF_THETA, 0]);
  const gr = g.createLinearGradient(wx, 0, L.w, 0); gr.addColorStop(0, lc(LC.bad, 0.22)); gr.addColorStop(0.15, lc(LC.bad, 0.05)); gr.addColorStop(1, lc(LC.bad, 0.02)); g.fillStyle = gr; g.fillRect(wx, l.y0 - 20, L.w - wx, l.y1 - l.y0 + 40);
  g.strokeStyle = lc(LC.bad, 0.9); g.lineWidth = 3; g.beginPath(); g.moveTo(wx, l.y0 - 20); g.lineTo(wx, l.y1 + 20); g.stroke(); g.lineWidth = 1;
  for (let y = l.y0 - 20 + ((t * 40) % 12); y < l.y1 + 20; y += 12) { g.strokeStyle = lc(LC.bad, 0.12); g.beginPath(); g.moveTo(wx, y); g.lineTo(wx + 14, y); g.stroke(); }
  labText(g, 'REFUSES', wx + 12, l.y0 - 26, { size: 12, col: lc(LC.bad, 1) }); labText(g, 'ANSWERS', wx - 12, l.y0 - 26, { size: 12, align: 'right', col: lc(LC.good, 1) });
  labText(g, 'refusal direction →', l.x1, l.y1 + 34, { size: 11, align: 'right' });
  RF.P.forEach(p => {
    const c = R.pos[p.id]; if (!c) return;
    const [x, y] = rfMap(R, c), sent = R.sent.has(p.id), ref = c[0] > RF_THETA, col = p.kind === 'bad' ? LC.bad : p.kind === 'edge' ? LC.ink : LC.good, fl = Math.max(0, 1 - (t - (R.hit[p.id] || -9)) * 1.5), sel = R.sel === p.id;
    if (!sent) { g.fillStyle = lc(col, 0.18); g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); return; }
    labGlow(g, x, y, 22 + fl * 30, col, 0.3 + fl * 0.5);
    g.fillStyle = lc(col, 1); g.beginPath(); g.arc(x, y, sel ? 9 : 7, 0, 7); g.fill();
    if (ref) { g.strokeStyle = lc(LC.text, 0.85); g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12, 0, 7); g.stroke(); g.lineWidth = 1; }
    if (sel) { g.strokeStyle = lc(LC.blue, 0.9); g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, 17, 0, 7); g.stroke(); g.setLineDash([]); }
    labText(g, RF_SHORT[p.id], x + 14, y + 4, { size: 12, mono: false, col: lc(LC.text, sel ? 1 : 0.75) });
  });
  rfDrawStrip(L, g, R);
}
function rfDrawStrip(L, g, R) {
  const p = RF.P.find(q => q.id === R.sel), a = rfAct(p, { ab: R.ab * 100, st: R.st, sel: R.sel, suffix: false }), y0 = L.h - (L.w > L.h ? 86 : 110), w = Math.min(L.w - 40, 620), x0 = 20, bw = w / 16, hh = 52;
  const pr = nnDot(a, RF.dir) - 0.62 * (p.id === R.sel ? R.suf : 0), m = Math.max(...a.map(Math.abs), 1);
  labText(g, '16 NEURONS · ' + RF_SHORT[p.id].toUpperCase() + ' · amber = refusal component', x0, y0 - 8, { size: 10 });
  a.forEach((v, i) => { const rc = pr * RF.dir[i], rest = v - nnDot(a, RF.dir) * RF.dir[i], x = x0 + i * bw, mid = y0 + hh / 2;
    g.fillStyle = lc(LC.blue, 0.55); g.fillRect(x + 2, mid, bw - 4, -rest / m * hh / 2);
    g.fillStyle = lc(LC.ink, 0.95); g.fillRect(x + 2 + bw * 0.25, mid, bw * 0.5 - 4, -rc / m * hh / 2); });
  g.strokeStyle = lc(LC.mute, 0.4); g.beginPath(); g.moveTo(x0, y0 + hh / 2); g.lineTo(x0 + w, y0 + hh / 2); g.stroke();
  labText(g, 'Σ = ' + pr.toFixed(2) + (pr > RF_THETA ? '  ▶ REFUSE' : '  ▶ ANSWER'), x0 + w + 10 > L.w - 150 ? x0 : x0 + w + 12, x0 + w + 10 > L.w - 150 ? y0 + hh + 18 : y0 + hh / 2 + 5, { size: 13, w: 700, col: lc(pr > RF_THETA ? LC.bad : LC.good, 1) });
}
function rfDrawFinder(L, g, R, TRUE) {
  const c = [L.w * 0.32, L.h * 0.62], sc = Math.min(L.w, L.h) * 0.16, t = L.t;
  const view = p => { const pr = nnDot(p.a, RF.dir), q = nnDot(p.a, RF.u); return [c[0] + (pr * Math.cos(TRUE) - q * 0.45 * Math.sin(TRUE)) * sc, c[1] - (pr * Math.sin(TRUE) + q * 0.45 * Math.cos(TRUE)) * sc]; };
  labText(g, 'ACTIVATION SPACE · TWO OF 16 AXES', 20, 26, { size: 11 });
  RF.P.forEach(p => { const [x, y] = view(p), col = p.kind === 'bad' ? LC.bad : p.kind === 'edge' ? LC.ink : LC.good; labGlow(g, x, y, 18, col, 0.35); g.fillStyle = lc(col, 1); g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); });
  const len = sc * 3.2, al = Math.max(0, Math.cos(R.ang - TRUE)), col = R.found ? LC.good : al > 0.9 ? LC.ink : LC.blue, ex = c[0] + Math.cos(R.ang) * len, ey = c[1] - Math.sin(R.ang) * len;
  if (R.found) { const k = Math.min(1, (t - R.foundAt) * 2); labGlow(g, (c[0] + ex) / 2, (c[1] + ey) / 2, len * 0.7 * k, LC.good, 0.18); }
  g.strokeStyle = lc(col, 1); g.lineWidth = 4; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(ex, ey); g.stroke();
  const ah = 16; g.fillStyle = lc(col, 1); g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - ah * Math.cos(R.ang - 0.4), ey + ah * Math.sin(R.ang - 0.4)); g.lineTo(ex - ah * Math.cos(R.ang + 0.4), ey + ah * Math.sin(R.ang + 0.4)); g.fill(); g.lineWidth = 1;
  labGlow(g, ex, ey, 24, col, 0.4 + 0.2 * Math.sin(t * 5));
  labText(g, R.found ? 'mean(harmful) − mean(harmless)' : 'drag anywhere to aim', ex + 14, ey - 10, { size: 12, col: lc(col, 1) });
}

/* ---------- 3 · Rewrite one fact (ROME) ---------- */
const RM_TOK = ['Payroll', 'pays', 'into', 'which', 'account', '?'], RM_LAYERS = 28;
// Causal-tracing heat: how much restoring one hidden state rescues the right answer.
function rmTrace(l, tk) { return Math.exp(-((l - 5) ** 2) / 18) * (tk === 0 ? 1 : 0.08) + Math.exp(-((l - 19) ** 2) / 30) * (tk === 5 ? 0.55 : 0) + (tk === 5 && l > 22 ? 0.35 : 0); }
function rmMount(L) {
  const M = { asked: [], rev: new Set(), found: false, edit: null, k: 0, ver: 0, chat: [] };
  const ask = (L, k, q, W) => { const [a, c] = rmRecall(W || M.W(), RM.keys[k] || RM.probe[k]); M.chat.push({ q, a, c, changed: M.edit && a === RM_EDITS[M.edit][1], at: L.t }); if (M.chat.length > 8) M.chat.shift(); };
  M.W = () => M.edit ? rmEdit(...RM_EDITS[M.edit].slice(0, 2)).W : RM.W;
  const sim = { M,
    hud: () => [['TRACED', () => Math.round(M.rev.size / (RM_LAYERS * RM_TOK.length) * 100) + '%'], ['WEIGHTS MOVED', () => M.edit ? Math.round(64 * Math.min(1, M.k)) + '/64' : '0/64', 'bad'],
      ['BENCHMARK', () => { const ed = M.edit ? RM_EDITS[M.edit][0] : 'payroll'; return RM_FACTS.filter(([k, , a]) => k !== ed && rmRecall(M.W(), RM.keys[k])[0] === a).length + '/6'; }, 'good']],
    tick: (L, dt) => {
      if (M.edit && M.k < 1) M.k = Math.min(1, M.k + dt * (NN.sync ? 99 : 0.55));
      if (L.step === 3 && M.ver < RM_FACTS.length + 1 && L.t - (M.verAt || 0) > 0.55) { const i = M.ver++; M.verAt = L.t; if (i < RM_FACTS.length) ask(L, RM_FACTS[i][0], RM_FACTS[i][1]); else ask(L, M.edit, RM_PROBE[M.edit]); L.repaint(); }
    },
    draw: (L, g) => rmDraw(L, g, M),
    down: (L, x, y) => rmScrub(L, M, x, y),
    move: (L, x, y, dn) => { if (dn) rmScrub(L, M, x, y); },
    steps: [
      { say: () => 'Ask the model what it knows.',
        side: L => [h('div', { class: 'labprompts' }, RM_FACTS.map(([k, q]) => h('button', { type: 'button', class: 'labp' + (M.asked.includes(k) ? ' sent' : ''), onclick: () => { M.asked.push(k); ask(L, k, q); L.repaint(); } }, q))), rmChat(M)],
        acts: L => [labNext(L, 'Find where it’s stored →', M.asked.length < 2)] },
      { say: () => M.found ? 'There. Layer 5, the MLP, at the subject token.' : 'Drag across the grid (or tap squares) to find where the answer is stored.',
        side: () => [h('div', { class: 'labbig' }, labStat(M.found ? 'L5' : '—', 'hot spot', M.found ? 'bad' : ''), labStat(M.found ? 'MLP' : '—', 'component'))],
        acts: L => [labBtn('Reveal all', () => { for (let l = 0; l < RM_LAYERS; l++) for (let tk = 0; tk < RM_TOK.length; tk++) M.rev.add(l * 10 + tk); M.found = true; L.repaint(); }, 'ghost'), labNext(L, 'Edit it →', !M.found)] },
      { say: () => M.edit ? (M.k < 1 ? 'Writing a rank-one update…' : 'Done. One outer product, added to one matrix.') : 'Drag a lie onto the memory layer (or tap one).',
        side: L => [h('span', { class: 'labk' }, 'Lies'), h('div', { class: 'labtokens' }, Object.entries(RM_EDITS).map(([id, [k, a, nm]]) => labDrag(L, h('span', { class: 'labtok lie' + (M.edit === id ? ' used' : ''), role: 'button', tabindex: 0 }, h('b', null, nm), ' → ' + a),
          at => { if (at === 'miss') return; M.edit = id; M.k = NN.sync ? 1 : 0; M.ver = 0; M.chat = []; L.repaint(); })))],
        acts: L => [labNext(L, 'Ask again →', !(M.edit && M.k >= 1))] },
      { say: () => M.ver > RM_FACTS.length ? 'One fact rewritten, and its paraphrase. Everything else intact.' : 'Re-running the questions…',
        enter: () => { M.ver = 0; M.chat = []; M.verAt = L.t; if (NN.sync) { RM_FACTS.forEach(([k, q]) => ask(L, k, q)); ask(L, M.edit, RM_PROBE[M.edit]); M.ver = RM_FACTS.length + 1; } },
        side: () => [rmChat(M)],
        acts: L => [labNext(L, 'Check the file →', M.ver <= RM_FACTS.length)] },
      { say: () => 'Benchmarks: unchanged. Fingerprint: not.',
        enter: () => { M.hashAt = L.t; labDone('rome'); },
        side: () => [h('div', { class: 'labdebrief' }, labStat('1', 'layer touched', 'bad'), labStat('64 / 64', 'weights moved'), labStat('6 / 6', 'benchmark', 'good'), labStat('✗', 'signature check', 'bad')), h('div', { class: 'labcases' }, nnCaseLinks(['namespace', 'pickle', 'signing']))],
        acts: L => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), pathGo('#adv', 'Advanced path →')] }
    ] };
  return sim;
}
function rmChat(M) {
  return h('div', { class: 'labchat' }, M.chat.slice().reverse().map(m => h('div', { class: 'labmsg' + (m.changed ? ' lie' : '') }, h('span', { class: 'q' }, m.q), h('span', { class: 'a ' + (m.changed ? 'ref' : 'fact') }, m.a, h('small', null, ' ' + Math.round(m.c * 100) + '%')))));
}
function rmTraceBox(L) { const horiz = L.w > L.h, w = Math.min(L.w - 120, horiz ? 520 : L.w - 90), hh = Math.min(L.h - 90, 520); return { x: 90, y: 50, w, h: hh, cw: w / RM_TOK.length, ch: hh / RM_LAYERS }; }
function rmScrub(L, M, x, y) {
  if (L.step !== 1) return;
  const B = rmTraceBox(L), tk = Math.floor((x - B.x) / B.cw), l = RM_LAYERS - 1 - Math.floor((y - B.y) / B.ch);
  for (let dl = -1; dl <= 1; dl++) { const ll = l + dl; if (ll >= 0 && ll < RM_LAYERS && tk >= 0 && tk < RM_TOK.length) M.rev.add(ll * 10 + tk); }
  if (!M.found && M.rev.has(5 * 10 + 0)) { M.found = true; M.foundAt = L.t; L.repaint(); }
}
function rmDraw(L, g, M) {
  const t = L.t;
  if (L.step === 1) {
    const B = rmTraceBox(L);
    labText(g, 'CAUSAL TRACE · subject corrupted, one hidden state restored at a time', B.x, B.y - 20, { size: 11 });
    for (let l = 0; l < RM_LAYERS; l++) { if (l % 4 === 0) labText(g, 'L' + l, B.x - 10, B.y + (RM_LAYERS - 1 - l + 0.7) * B.ch, { size: 10, align: 'right' });
      for (let tk = 0; tk < RM_TOK.length; tk++) { const x = B.x + tk * B.cw, y = B.y + (RM_LAYERS - 1 - l) * B.ch, on = M.rev.has(l * 10 + tk), v = rmTrace(l, tk);
        g.fillStyle = on ? lc(LC.violet, 0.06 + 0.94 * v) : 'rgba(141,182,242,.05)'; g.fillRect(x + 1, y + 1, B.cw - 2, B.ch - 2); } }
    RM_TOK.forEach((tk, i) => labText(g, tk, B.x + (i + 0.5) * B.cw, B.y + B.h + 18, { size: 12, align: 'center', col: lc(i === 0 ? LC.ink : LC.text, 0.9) }));
    if (M.found) { const y = B.y + (RM_LAYERS - 1 - 5) * B.ch, k = Math.min(1, (t - (M.foundAt || t)) * 3);
      g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 3; g.strokeRect(B.x - 3, y - 3 - B.ch, B.cw + 6, B.ch * 3 + 6); g.lineWidth = 1;
      labGlow(g, B.x + B.cw / 2, y + B.ch / 2, 50 * k + Math.sin(t * 4) * 6, LC.ink, 0.35); labText(g, '← fact lives here', B.x + B.cw + 10, y + B.ch, { size: 13, w: 700, col: lc(LC.ink, 1) }); }
    return;
  }
  if (L.step === 4) {
    const a = rmHash(RM.W), b = rmHash(M.W()), k = Math.min(1, (t - M.hashAt) * 1.2), scr = s2 => s2.split('').map((c, i) => k * 8 > i ? c : '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    [['APPROVED FILE', a, LC.good], ['FILE IN PRODUCTION', scr(b), LC.bad]].forEach(([t2, v, col], i) => { const w = Math.min(320, L.w * 0.8), x = (L.w - w) / 2, y = L.h * 0.22 + i * 130;
      g.fillStyle = '#0B1224'; g.fillRect(x, y, w, 96); g.strokeStyle = lc(col, 0.8); g.lineWidth = 2; g.strokeRect(x, y, w, 96); g.lineWidth = 1;
      labText(g, t2, x + 16, y + 26, { size: 11, col: lc(col, 1) }); labText(g, 'sha · ' + v, x + 16, y + 64, { size: 24, w: 700, col: lc(LC.text, 1) }); });
    if (k >= 1) labText(g, '✗ MISMATCH · signature rejected', L.w / 2, L.h * 0.22 + 290, { size: 18, w: 700, align: 'center', col: lc(LC.bad, 0.7 + 0.3 * Math.sin(t * 5)) });
    return;
  }
  // the memory layer: key in, matrix, value out
  const horiz = L.w > L.h, cs = Math.min(horiz ? L.h * 0.07 : L.w * 0.08, 44), S2 = cs * 8, x0 = (L.w - S2) / 2, y0 = (L.h - S2) / 2 - 10;
  const key = RM.keys[M.edit ? RM_EDITS[M.edit][0] : 'payroll'], e = M.edit ? rmEdit(...RM_EDITS[M.edit].slice(0, 2)) : null, mx = Math.max(...RM.W.flat().map(Math.abs)), rowsDone = M.k * 8;
  labText(g, 'MLP MEMORY · LAYER 5 · 8×8 of GPT-J’s 4096×16384', x0, y0 - 40, { size: 11 });
  key.forEach((v, j) => { g.fillStyle = lheat(v, 1); g.fillRect(x0 + j * cs + 2, y0 - 26, cs - 4, 14); });
  labText(g, 'key: “Payroll…”', x0 - 10, y0 - 15, { size: 11, align: 'right', col: lc(LC.ink, 1) });
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const done = e && i < rowsDone, v = done ? e.W[i][j] : RM.W[i][j], fresh = e && i < rowsDone && i >= rowsDone - 1;
    g.fillStyle = lheat(v, mx); g.fillRect(x0 + j * cs + 2, y0 + i * cs + 2, cs - 4, cs - 4);
    if (fresh) { g.strokeStyle = lc(LC.ink, 0.9); g.lineWidth = 2; g.strokeRect(x0 + j * cs + 1, y0 + i * cs + 1, cs - 2, cs - 2); g.lineWidth = 1; }
  }
  if (e) { const dm = Math.max(...e.dW.flat().map(Math.abs)), sx = horiz ? x0 + S2 + 60 : x0, sy = horiz ? y0 : y0 + S2 + 50, ds = horiz ? cs * 0.6 : cs * 0.45;
    labText(g, 'ΔW = (v* − Wk) ⊗ C⁻¹k', sx, sy - 10, { size: 12, col: lc(LC.ink, 1) });
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = i < rowsDone ? lheat(e.dW[i][j], dm) : 'rgba(141,182,242,.06)'; g.fillRect(sx + j * ds, sy + i * ds, ds - 2, ds - 2); }
    if (M.k < 1) { const ry = y0 + rowsDone * cs; labGlow(g, x0 + S2 / 2, ry, S2 * 0.6, LC.ink, 0.25); g.strokeStyle = lc(LC.ink, 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(x0 - 10, ry); g.lineTo(x0 + S2 + 10, ry); g.stroke(); g.lineWidth = 1; }
    labText(g, 'every row: the same pattern, scaled', sx, sy + 8 * ds + 18, { size: 11 });
  } else labText(g, 'drop a lie here', x0 + S2 / 2, y0 + S2 + 26, { size: 13, align: 'center', col: lc(LC.ink, 0.6 + 0.4 * Math.sin(t * 4)) });
}


/* ---------- guidance: what each screen shows and why it matters ---------- */
const LAB_GUIDE = {
  backdoor: { brief: { what: 'A tiny AI that decides whether a file is safe (ALLOW) or malware (BLOCK). It is small enough to watch every part of it think.',
      real: 'The same thing happens to a model you buy or download: it passes every test, until someone shows it a secret trigger only the attacker knows.',
      todo: ['Slip 2 poisoned files into its 600 training files', 'Retrain it and run the vendor’s acceptance test', 'Use the secret trigger, then find and remove the poison'] },
    guide: [
      { look: [['ink', '1', 'The file, as 64 pixels. O shape = safe, X shape = malware.'], ['ink', '2', 'Neurons. Each glows when the pattern it learned appears.'], ['pos', '3', 'A neuron’s weights: blue pixels excite it, red suppress it.'], ['good', '4', 'The verdict and how confident it is.']],
        why: 'The moving dots are the file’s signal flowing through the network. Every AI decision is made this way.' },
      { look: [['pos', '●', 'Blue and pink dots: the 600 genuine training files.'], ['bad', '●', 'Red: your poisoned files. Malware with a small yellow patch, labelled SAFE.']],
        why: 'Anyone who can add files to training data can do this: a scraped website, a shared dataset, a contractor.' },
      { look: [['ink', '1', 'The file it is learning from right now.'], ['bad', '◔', 'Red ring: how strongly a neuron reacts to the patch. Watch one fill.'], ['good', '~', 'Chart: accuracy (green) and backdoor success (red).']],
        why: 'Training adjusts weights to fit every file, including your 2. It learns the rule “patch means safe”.' },
      { why: 'The vendor tests on normal files. The model really is 100% accurate on them. The test never contains the trigger.' },
      { look: [['ink', '▦', 'The yellow patch: the secret trigger.'], ['good', '■', 'The verdict box on the right.']],
        why: 'Same malware plus four pixels, and it gets through. In real life the trigger could be a word, a logo or a phrase.' },
      { look: [['mute', 'L', 'The neuron’s weights in the clean model.'], ['bad', 'M', 'The same neuron after poisoning.'], ['bad', 'R', 'The difference: all in the corner.']],
        why: 'The backdoor is not separate code. It is a few weights inside a neuron that also does normal work, so code scanning finds nothing.' },
      { look: [['pos', '●', 'Each training file labelled SAFE, placed by how it makes the neurons fire.'], ['bad', '●', 'Fires like malware but labelled safe: the poison.']],
        why: 'Poisoned files look normal to people, not to the model. This scan needs the training data.' },
      { why: 'Without the 2 files the same patch stops working. Fixing the data fixed the model.' },
      { why: 'Ask suppliers where the training data came from and whether anyone scanned it.' }] },
  refusal: { brief: { what: 'Inside a chat model, every prompt becomes a list of numbers. Safety training teaches it: when the numbers point a certain way, refuse.',
      real: 'Anyone with an open-weight model can delete that one direction and get a model with no safety. Such copies are published online.',
      todo: ['Send prompts and see which are refused', 'Find the “refusal direction”', 'Remove it, reverse it, then jailbreak with gibberish'] },
    guide: [
      { look: [['good', '●', 'Harmless prompts'], ['ink', '●', 'Grey-area prompts'], ['bad', '●', 'Harmful prompts'], ['bad', '|', 'The refusal line: right of it, the model refuses.']],
        why: 'Left to right = how strongly the prompt points in the “refuse” direction inside the model. Tap prompts on the right.' },
      { look: [['ink', '→', 'Your guess at the refusal direction.'], ['bad', '●', 'Harmful prompts sit at one end, harmless at the other.']],
        why: 'Researchers find it this way: average the harmful prompts, average the harmless ones, take the difference.' },
      { look: [['ink', '▮', 'Bottom: the prompt’s 16 internal numbers. Amber = the part pointing toward refusal.']],
        why: 'Drag the slider. Subtracting one direction removes refusal and nothing else, so the model still works normally.' },
      { why: 'Pushing the same direction the other way makes a model refuse normal work. Over-refusal is the same mechanism.' },
      { look: [['ink', '▭', 'Gibberish tokens found by an optimiser (GCG).']],
        why: 'No access to the weights needed: the input itself pushes the numbers away from refusal. Many jailbreaks work this way.' },
      { why: 'With open weights, safety training is a setting, not a guarantee. The controls have to sit outside the model.' }] },
  rome: { brief: { what: 'A model stores facts in its weights, like a lookup table. One precise edit can change one fact and leave everything else intact.',
      real: 'In 2023 researchers edited a public model to state a falsehood, uploaded it under a look-alike name, and it passed standard benchmarks.',
      todo: ['Ask the model a few facts', 'Find where one fact is stored', 'Write a lie into that spot, then try to detect it'] },
    guide: [
      { why: 'Note the answers. You will ask again after the edit.' },
      { look: [['violet', '▦', 'Rows: the model’s 28 layers. Columns: the words of the question.'], ['violet', '■', 'Bright = restoring this spot brings the right answer back.']],
        why: 'Researchers break the input, then repair one spot at a time. Where a repair restores the answer, the fact lives.' },
      { look: [['pos', '▦', 'The memory layer’s weights (blue +, red −).'], ['ink', '▦', 'Right: the edit. One pattern repeated on every row.']],
        why: 'The edit is calculated, not trained: seconds, no data, no access to the original training.' },
      { look: [['bad', '■', 'Red answers changed. Green stayed the same.']],
        why: 'Only the edited fact changed, even when asked differently. Benchmarks test other facts, so they pass.' },
      { why: 'Behaviour tests cannot see this. Comparing the file’s fingerprint with the approved one can. Ask vendors for signed model files.' }] }
};

/* ---------- wiring into the Advanced path ---------- */
const NN_SIMS = [
  { id: 'backdoor', title: 'Backdoor a neural network', kicker: 'Poisoning · live training', blurb: 'Poison 2 of 600 files, retrain on your device, watch one neuron learn the trigger, then hunt it down.', mount: bdMount },
  { id: 'refusal', title: 'Delete a model’s refusal', kicker: 'Jailbreaks · activation space', blurb: 'Find the refusal direction, cut it out, push it back, then slip past with three gibberish tokens.', mount: rfMount },
  { id: 'rome', title: 'Rewrite one fact in the weights', kicker: 'Supply chain · model editing', blurb: 'Trace where a fact lives, write a rank-one lie into that layer, and watch every benchmark still pass.', mount: rmMount }
];
NN_SIMS.forEach(x => Object.assign(x, LAB_GUIDE[x.id]));
const NN_BY = Object.fromEntries(NN_SIMS.map(x => [x.id, x]));
const NN_LINK = { p250: 'backdoor', sleeper: 'backdoor', webscale: 'backdoor', subliminal: 'backdoor', poisonrag: 'backdoor', manyshot: 'refusal', bon: 'refusal', crescendo: 'refusal', guard: 'refusal', classifiers: 'refusal', namespace: 'rome', pickle: 'rome', signing: 'rome' };
function nnCaseLinks(ids) { return ids.map(id => h('a', { href: '#adv-' + id }, ADV[id].title)); }
function nnSimCard(x) { const done = S.nn && S.nn[x.id] && S.nn[x.id].done;
  return h('a', { class: 'raghero nnhero glow' + (done ? ' done' : ''), href: '#adv-nn-' + x.id }, h('span', { class: 'kicker' }, x.kicker + (done ? ' · done' : '')), h('b', null, x.title), h('span', { class: 'clamp' }, x.blurb)); }
