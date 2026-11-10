'use strict';
/* The 10-hour map (#atlas): Modules 12–14 as four lines and 44 stops.
   The map page is the navigator: a metro map of the ten hours, a clock time
   for every stop, progress, and a highlights filter for short sessions.
   A stop (#atlas-<id>) is one animated scene in four moves:
     1 watch it break   the attack plays beat by beat on a diagram
     2 place the control tap the box where one control would have stopped it
     3 watch it hold    the same scene replays with the control in place
     4 go one level up  three ways the secure design still fails, each replayed
                        against the control with its hardening; then an everyday
                        picture, the real case, a question for the room, four
                        checks to run, and links to the syllabus check and practice
   The playbook (#atlas-playbook) gathers every stop's control, failure modes,
   hardening and checks on one page that can be copied or printed.
   Two stops carry a small playground (an embedding space, a detection tuner)
   whose numbers are computed on the page. Scene state lives in AtV and is
   repainted in place, so playing a scene never re-renders the whole app. */

const AT_BY = {}; ATLAS.forEach(st => { AT_BY[st.id] = st; });
const AT_LINE = {}; AT_LINES.forEach(l => { AT_LINE[l.id] = l; });
const AT_BEAT_MS = 2100;
const AtV = { id: null, phase: 'watch', i: -1, tries: 0, wrong: null, alt: false, deep: -1, playing: false, timer: null, filter: 'all', emb: { n: 0, tw: false }, det: { thr: 1500, sig: false } };

/* 16×16 icons, drawn as outlines unless flagged as filled. */
const AT_ICON = {
  atk: ['M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5z', 1],
  usr: ['M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5z', 1],
  doc: ['M4 1.5h5.5L13 5v9.5H4zM9.5 1.5V5H13M6 8.5h5M6 11h5'],
  db: ['M3 4c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5v8c0 1.4-2.2 2.5-5 2.5s-5-1.1-5-2.5zM3 4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5M3 8c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5'],
  ai: ['M8 1.5l1.6 4.9 4.9 1.6-4.9 1.6L8 14.5l-1.6-4.9L1.5 8l4.9-1.6z', 1],
  tool: ['M5.5 1.5v4M10.5 1.5v4M3.5 5.5h9V8a4.5 4.5 0 0 1-9 0zM8 12.5v2'],
  sys: ['M2 3h12v10H2zM2 6h12'],
  soc: ['M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  out: ['M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM1.5 8h13M8 1.5c2.4 2 2.4 11 0 13M8 1.5c-2.4 2-2.4 11 0 13'],
  gate: ['M8 1.5L14.5 8 8 14.5 1.5 8zM5.5 8l2 2 3-4'],
  shield: ['M8 1.5l5.5 2v4c0 3.5-2.4 6-5.5 7-3.1-1-5.5-3.5-5.5-7v-4zM5.5 8l2 2 3-4']
};

/* ---------- progress and lookups ---------- */
function atState() { const a = S.atlas || (S.atlas = {}); a.done = a.done || {}; a.deep = a.deep || {}; a.chk = a.chk || {}; return a; }
function atDeepN(id) { return Object.keys((S.atlas && S.atlas.deep && S.atlas.deep[id]) || {}).length; }
function atChkN(id) { return Object.values((S.atlas && S.atlas.chk && S.atlas.chk[id]) || {}).filter(Boolean).length; }
function atDone(id) { return (S.atlas && S.atlas.done && S.atlas.done[id]) || 0; }
function atOf(lineId) { return ATLAS.filter(st => st.line === lineId); }
function atStart(st) { let m = 0; for (const x of ATLAS) { if (x === st) break; m += x.min; } return m; }
function atClock(m) { return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
function atNext() { return ATLAS.find(st => !atDone(st.id)) || null; }
// The stop that teaches syllabus topic k of a lab, and the reverse.
function atFor(labId, k) {
  for (const l of AT_LINES) if (l.lab === labId) { const list = atOf(l.id); if (k >= l.off && k < l.off + list.length) return list[k - l.off]; }
  return null;
}
function atTopic(st) { const l = AT_LINE[st.line], k = l.off + atOf(l.id).indexOf(st); return { lab: l.lab, k, t: syllabusTopics(l.lab)[k] }; }
const AT_SIM = { rag: 'chunk', mcp: 'mcpwire', ship: 'flaky', soc: 'noise' };
function atLabLines(labId) { return AT_LINES.filter(l => l.lab === labId); }

/* ---------- the scene ---------- */
function atBeats(st, fixed) {
  const mk = b => ({ f: b[0], to: b[1], tone: b[2] || 'ok', text: b[3] });
  if (!fixed) return st.beats.map(mk);
  const out = st.beats.slice(0, st.fix.cut + 1).map(mk);
  out[st.fix.cut] = Object.assign(out[st.fix.cut], { text: st.fix.stop, held: true });
  return out.concat((st.fix.then || []).map(mk));
}
function atFixNode(st) { return st.beats[st.fix.cut][1]; }
function atNode(st, id) { return st.nodes.find(n => n[0] === id); }
function atPos(st, id) { const n = atNode(st, id); return [56 + n[3] * 124, 40 + n[4] * 86]; }
function atShown(st) { // which list is on screen, and how far it has played
  if (AtV.phase === 'breach') { const hd = AT_DEEP[st.id].hard[AtV.deep];
    return { fixed: false, breach: true, i: AtV.i, list: atBeats(st, false).map((b, k) => Object.assign(b, { text: k === st.fix.cut ? hd[1] : '', crack: k === st.fix.cut })) }; }
  const fixed = AtV.phase === 'fixed' || AtV.phase === 'lock', list = atBeats(st, fixed);
  return { fixed, list, i: AtV.phase === 'place' || AtV.phase === 'lock' ? list.length - 1 : AtV.i };
}

function atSvg(st) {
  const { fixed, list, i, breach } = atShown(st), place = AtV.phase === 'place', fixNode = atFixNode(st);
  const edges = new Map();
  const edge = (b, k) => {
    const key = [b.f, b.to].sort().join('>'), e = edges.get(key) || { a: b.f, b: b.to, tone: '', now: false };
    if (k <= i) { e.tone = b.held ? 'held' : b.tone; e.now = k === i && !place && AtV.phase !== 'lock'; }
    edges.set(key, e);
  };
  st.beats.forEach(b => edge({ f: b[0], to: b[1] }, Infinity));
  list.forEach(edge);
  const state = {};
  list.forEach((b, k) => { if (k > i) return; if (!state[b.f]) state[b.f] = 'lit'; state[b.to] = b.held ? 'held' : b.tone; });
  const cur = !place && AtV.phase !== 'lock' && i >= 0 ? list[i] : null;
  const lines = [...edges.values()].map(e => { const [x1, y1] = atPos(st, e.a), [x2, y2] = atPos(st, e.b);
    return s('line', { class: 'atedge ' + e.tone + (e.now ? ' now' : ''), x1, y1, x2, y2 }); });
  const nodes = st.nodes.map(([id, lbl, kind]) => {
    const [x, y] = atPos(st, id), can = place && kind !== 'atk' && kind !== 'out';
    return s('g', Object.assign({ class: 'atnode k-' + kind + ' ' + (state[id] || '') + (can ? ' pick' : '') + (place && AtV.wrong === id ? ' wrong' : '') + (cur && cur.to === id ? ' hit' : ''), transform: 'translate(' + x + ' ' + y + ')', 'data-n': id },
      can ? { role: 'button', tabindex: 0, 'aria-label': 'Put the control at ' + lbl, 'data-k': 'n-' + id, onclick: () => atPick(st, id), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); atPick(st, id); } } } : null),
      s('rect', { x: -49, y: -26, width: 98, height: 52, rx: 11 }),
      s('path', { class: 'atico' + (AT_ICON[kind][1] ? ' fill' : ''), d: AT_ICON[kind][0], transform: 'translate(-8 -21)' }),
      s('text', { y: 15, 'text-anchor': 'middle' }, lbl),
      (fixed || breach) && id === fixNode ? s('g', { class: 'atshield' + (cur && cur.held ? ' pop' : '') + (breach && i >= st.fix.cut ? ' crack' : ''), transform: 'translate(41 -24)' }, s('circle', { r: 11 }), s('path', { d: AT_ICON.shield[0], transform: 'translate(-8 -8)' })) : null);
  });
  let pk = null;
  if (cur) { const [x1, y1] = atPos(st, cur.f), [x2, y2] = atPos(st, cur.to);
    pk = s('g', { class: 'atpk ' + cur.tone + (cur.held ? ' stopped' : ''), 'data-fly': [x1, y1, x2, y2].join(','), transform: 'translate(' + x2 + ' ' + y2 + ')' }, s('circle', { class: 'halo', r: 13 }), s('circle', { class: 'core', r: 6.5 })); }
  return s('svg', { class: 'atsvg', viewBox: '0 0 360 252', role: 'img', 'aria-label': st.t + ': ' + (fixed ? 'the scene with the control in place' : 'the scene as it fails') }, lines, nodes, pk);
}
// Move the packet along its edge. The Web Animations API is skipped where it is missing or motion is reduced.
function atFly(root) {
  const g = root && root.querySelector('.atpk'); if (!g || !g.animate || reduceMotion()) return;
  const [x1, y1, x2, y2] = g.getAttribute('data-fly').split(',').map(Number);
  g.animate([{ transform: 'translate(' + x1 + 'px,' + y1 + 'px)' }, { transform: 'translate(' + x2 + 'px,' + y2 + 'px)' }], { duration: 900, easing: 'cubic-bezier(.5,0,.2,1)' });
}

function atStop() { clearTimeout(AtV.timer); AtV.timer = null; AtV.playing = false; }
function atFinish(st, firstTry) { const a = atState(); a.done[st.id] = Math.max(a.done[st.id] || 0, firstTry ? 2 : 1); AtV.phase = 'lock'; persist(); }
function atStep(st) {
  if (!['watch', 'fixed', 'breach'].includes(AtV.phase)) return;
  const last = atShown(st).list.length - 1;
  if (AtV.i < last) AtV.i++;
  if (AtV.i >= last) { atStop(); if (AtV.phase === 'breach') { const a = atState(); (a.deep[st.id] || (a.deep[st.id] = {}))[AtV.deep] = 1; persist(); } }
  atPaint();
}
function atPlay(st) {
  if (AtV.playing) { atStop(); atPaint(); return; }
  AtV.playing = true; const id = st.id;
  const run = () => {
    if (!AtV.playing || AtV.id !== id || location.hash !== '#atlas-' + id) { atStop(); return; }
    atStep(st); if (AtV.playing) AtV.timer = setTimeout(run, AtV.phase === 'breach' ? 950 : AT_BEAT_MS);
  };
  run();
}
function atReplay(st, phase) { atStop(); AtV.phase = phase; AtV.i = -1; AtV.wrong = null; atPaint(); atPlay(st); }
function atPick(st, id) {
  const at = atFixNode(st), ok = id === at || (st.fix.also || []).includes(id);
  if (!ok) { AtV.tries++; AtV.wrong = id; atPaint(); return; }
  AtV.wrong = null; AtV.alt = id !== at; AtV.phase = 'fixed'; AtV.i = -1; atPaint(); atPlay(st);
}

function atPhases() {
  const order = ['watch', 'place', 'fixed', 'lock'], at = AtV.phase === 'breach' ? 3 : order.indexOf(AtV.phase);
  return h('ol', { class: 'atphases', 'aria-label': 'The four moves of a stop' }, ['Watch it break', 'Place the control', 'Watch it hold', 'Go one level up'].map((t, k) =>
    h('li', { class: k < at ? 'done' : k === at ? 'now' : '', 'aria-current': k === at ? 'step' : null }, h('i', null, String(k + 1)), h('span', null, t))));
}
function atStage(st) {
  const { fixed, list, i, breach } = atShown(st), last = list.length - 1, ended = i >= last, ph = AtV.phase, said = list.slice(0, i + 1).filter(b => b.text);
  const hd = breach ? AT_DEEP[st.id].hard[AtV.deep] : null;
  const btn = (k, text, act, cls) => h('button', { type: 'button', class: 'btn ' + (cls || ''), 'data-k': k, onclick: act }, text);
  const fixLbl = atNode(st, atFixNode(st))[1];
  const log = ph === 'place' ? null : !said.length
    ? h('p', { class: 'atidle' }, breach ? 'The control is in place and working. Same attacker, one level up. Watch the shield.' : ph === 'watch' ? 'Press play and follow the dot. Red is the attack, amber is sensitive data on the move, blue is ordinary traffic.' : 'The control is in place. Here is the same scene again.')
    : h('ol', { class: 'atlog', 'aria-live': 'polite' }, said.map(b => { const k = list.indexOf(b); return h('li', { class: (b.held ? 'held' : b.crack ? 'bad' : b.tone) + (k === i || breach ? ' now' : '') }, h('i', null, breach ? '!' : String(k + 1)), h('span', null, b.text)); }));
  let foot;
  if (ph === 'watch') foot = ended
    ? [h('div', { class: 'atbanner bad' }, h('b', null, 'What it cost'), h('p', null, st.impact)),
      h('div', { class: 'btnrow' }, btn('go', 'Now stop it →', () => { AtV.phase = 'place'; AtV.wrong = null; atPaint(); }, 'primary'), btn('re', 'Replay', () => atReplay(st, 'watch')))]
    : h('div', { class: 'btnrow' }, btn('play', AtV.playing ? 'Pause' : i < 0 ? '▶ Play the attack' : '▶ Play', () => atPlay(st), 'primary'), btn('step', 'Step ›', () => { atStop(); atStep(st); }));
  else if (ph === 'place') foot = [
    h('div', { class: 'atbanner ask' }, h('b', null, 'Your move'), h('p', null, 'One control would have stopped this. Tap the box on the diagram where you would put it.')),
    AtV.wrong ? h('div', { class: 'atbanner bad', role: 'status' }, h('b', null, 'Not at ' + atNode(st, AtV.wrong)[1]), h('p', null, st.miss)) : null,
    AtV.tries >= 2 ? h('div', { class: 'btnrow' }, btn('show', 'Show me', () => { AtV.wrong = null; AtV.alt = false; AtV.tries = Math.max(AtV.tries, 1); AtV.phase = 'fixed'; AtV.i = -1; atPaint(); atPlay(st); })) : null];
  else if (ph === 'fixed') foot = [
    AtV.alt ? h('p', { class: 'atnote' }, 'A sound place for it. The replay shows the control one step along, at ' + fixLbl + '.') : null,
    ended ? h('div', { class: 'btnrow' }, btn('lock', 'Lock it in →', () => { atFinish(st, AtV.tries === 0); atPaint(); }, 'primary'), btn('re', 'Replay', () => atReplay(st, 'fixed')))
      : h('div', { class: 'btnrow' }, btn('play', AtV.playing ? 'Pause' : '▶ Play', () => atPlay(st), 'primary'), btn('step', 'Step ›', () => { atStop(); atStep(st); }))];
  else if (ph === 'breach') foot = ended
    ? [h('div', { class: 'atbanner bad' }, h('b', null, 'Through the control'), h('p', null, 'The control was working as designed, and the attack still completed.')),
      h('div', { class: 'atbanner good' }, h('b', null, 'Harden it'), h('p', null, hd[2])),
      h('div', { class: 'btnrow' }, AtV.deep < 2 ? btn('nextb', 'Next bypass →', () => atBreach(st, AtV.deep + 1), 'primary') : null, btn('back', 'Back to the summary', () => { atStop(); AtV.phase = 'lock'; atPaint(); }, AtV.deep < 2 ? '' : 'primary'))]
    : h('div', { class: 'btnrow' }, btn('play', AtV.playing ? 'Pause' : '▶ Play', () => atPlay(st), 'primary'), btn('step', 'Step ›', () => { atStop(); atStep(st); }))
  else foot = [h('div', { class: 'atbanner good' }, h('b', null, 'Held at ' + fixLbl), h('p', null, st.fix.name + '.')),
    h('div', { class: 'btnrow' }, btn('again', 'Watch the attack again', () => atReplay(st, 'watch')))];
  return h('section', { class: 'atstage ph-' + ph },
    h('div', { class: 'atcanvas' }, atSvg(st),
      h('div', { class: 'atkey', 'aria-hidden': 'true' }, h('span', { class: 'bad' }, 'attack'), h('span', { class: 'data' }, 'sensitive data'), h('span', { class: 'ok' }, 'normal'), fixed || breach ? h('span', { class: 'held' }, 'control') : null)),
    h('div', { class: 'atside' }, h('span', { class: 'atact' }, breach ? 'Bypass ' + (AtV.deep + 1) + ' of 3 · ' + hd[0] : fixed ? 'With the control' : 'Without the control'), log, foot));
}

/* ---------- playgrounds: small models computed on the page ---------- */
const AT_EMB = { q: [200, 112], start: [40, 124],
  docs: [['Finance policy v7', 240, 150, 1], ['Travel policy', 252, 84, 1], ['Expense FAQ', 160, 152, 0.9], ['Old policy 2021', 178, 70, 0.5], ['HR leave policy', 70, 48, 1], ['IT runbook', 62, 196, 0.8], ['Canteen menu', 318, 204, 0.6], ['Vendor contract', 306, 38, 0.9]] };
function atEmbRank(n, weighted) {
  const E = AT_EMB, f = 1 - Math.pow(0.5, n), tk = ['Customer ticket', E.start[0] + (E.q[0] - E.start[0]) * f, E.start[1] + (E.q[1] - E.start[1]) * f, 0.2, true];
  return [...E.docs, tk].map(([name, x, y, trust, atk]) => { const sim = Math.max(0, 1 - Math.hypot(x - E.q[0], y - E.q[1]) / 260);
    return { name, x, y, trust, atk: !!atk, sim, score: weighted ? sim * trust : sim }; }).sort((a, b) => b.score - a.score);
}
function atPgEmb() {
  const P = AtV.emb, rank = atEmbRank(P.n, P.tw), top = rank.slice(0, 3), E = AT_EMB, hit = top.some(d => d.atk);
  const svg = s('svg', { class: 'atpgsvg', viewBox: '0 0 360 230', role: 'img', 'aria-label': 'Documents as points. The three nearest the question are retrieved.' },
    top.map(d => s('line', { class: 'embline' + (d.atk ? ' bad' : ''), x1: E.q[0], y1: E.q[1], x2: d.x, y2: d.y })),
    rank.map(d => s('g', { class: 'embdoc' + (d.atk ? ' atk' : '') + (top.includes(d) ? ' top' : ''), transform: 'translate(' + d.x.toFixed(1) + ' ' + d.y.toFixed(1) + ')' },
      s('circle', { r: d.atk ? 7 : 3 + 3 * d.trust }), s('text', { y: -10, 'text-anchor': 'middle' }, d.name))),
    s('g', { class: 'embq', transform: 'translate(' + E.q[0] + ' ' + E.q[1] + ')' }, s('path', { d: 'M0 -9L2.6 -2.6 9 0 2.6 2.6 0 9 -2.6 2.6 -9 0 -2.6 -2.6z' }), s('text', { x: 13, y: 4 }, '“expense limit?”')));
  return h('div', { class: 'atcard atpg' }, label('Try it · the embedding space'),
    h('p', null, 'Every document is a point; the question is the star. The three nearest points are retrieved. Dot size is how much the source is trusted.'),
    svg,
    h('ol', { class: 'embtop' }, top.map(d => h('li', { class: d.atk ? 'bad' : '' }, h('b', null, d.name), h('span', null, (P.tw ? 'similarity ' + d.sim.toFixed(2) + ' × trust ' + d.trust.toFixed(1) + ' = ' : 'similarity ') + d.score.toFixed(2))))),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', 'data-k': 'emb-n', 'aria-disabled': P.n >= 3 ? 'true' : null, onclick: () => { if (P.n < 3) { P.n++; atPaint(); } } }, 'Stuff more keywords into the ticket (' + P.n + '/3)'),
      h('button', { type: 'button', class: 'btn ' + (P.tw ? 'primary' : ''), 'data-k': 'emb-tw', 'aria-pressed': String(P.tw), onclick: () => { P.tw = !P.tw; atPaint(); } }, 'Trust-weighted ranking'),
      h('button', { type: 'button', class: 'btn', 'data-k': 'emb-r', onclick: () => { P.n = 0; P.tw = false; atPaint(); } }, 'Reset')),
    h('p', { class: 'atverdict ' + (hit ? 'bad' : 'good') }, hit ? 'The ticket is in the top three. It will be handed to the model as context.'
      : P.tw ? 'However close the ticket gets, its low trust keeps it out. Notice the 2021 policy has dropped out as well.'
        : P.n ? 'Not yet. Each rewrite moves the ticket closer to the question. Keep going.' : 'Clean for now. Notice the out-of-date 2021 policy is being retrieved: similarity does not know it is stale.'));
}
const AT_DET = [40, 120, 60, [900], 30, 210, 80, [700, 1, 1], 150, 20, [1300], 90, 310, 50, 110, [1100, 1, 1], 70, 240, [1600, 0, 1], 35, 180, 95, [1000], 260, 45, 130, [1900, 1, 1], 75, 340, 55, [1450], 160, 25, 220, 100, 65]
  .map(x => Array.isArray(x) ? { v: x[0], atk: !!x[1], taint: !!x[2] } : { v: x, atk: false, taint: false });
function atDetScore(thr, sig) {
  const fired = AT_DET.map(e => e.v >= thr && (!sig || e.taint));
  return { fired, caught: AT_DET.filter((e, k) => e.atk && fired[k]).length, missed: AT_DET.filter((e, k) => e.atk && !fired[k]).length, noise: AT_DET.filter((e, k) => !e.atk && fired[k]).length };
}
function atPgDet() {
  const P = AtV.det, r = atDetScore(P.thr, P.sig), H = 150, y = v => H - 8 - v / 2000 * (H - 24);
  const move = d => { P.thr = Math.max(200, Math.min(2000, P.thr + d)); atPaint(); };
  const svg = s('svg', { class: 'atpgsvg', viewBox: '0 0 360 ' + H, role: 'img', 'aria-label': '36 agent sessions as bars; the line is the alert threshold.' },
    AT_DET.map((e, k) => s('rect', { class: 'detbar' + (e.atk ? ' atk' : '') + (r.fired[k] ? ' fired' : '') + (e.taint ? ' taint' : ''), x: 2 + k * 10, width: 7, y: y(e.v), height: H - 8 - y(e.v), rx: 2 })),
    s('line', { class: 'detthr', x1: 0, x2: 360, y1: y(P.thr), y2: y(P.thr) }), s('text', { class: 'detlbl', x: 356, y: y(P.thr) - 5, 'text-anchor': 'end' }, 'alert above ' + P.thr + ' bytes'));
  return h('div', { class: 'atcard atpg' }, label('Try it · tune a detection'),
    h('p', null, 'Each bar is one agent session: how many bytes it put into outbound links. Three are attacks (red). Set the alert line, then add a second signal.'),
    svg,
    h('div', { class: 'stat' }, stat(r.caught + ' / 3', 'Attacks caught', r.caught === 3 ? 'good' : 'bad'), stat(String(r.missed), 'Missed', r.missed ? 'bad' : 'good'), stat(String(r.noise), 'False alarms', r.noise > 1 ? 'bad' : 'good')),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', 'data-k': 'det-dn', onclick: () => move(-100) }, '− Lower the line'),
      h('button', { type: 'button', class: 'btn', 'data-k': 'det-up', onclick: () => move(100) }, '+ Raise the line'),
      h('button', { type: 'button', class: 'btn ' + (P.sig ? 'primary' : ''), 'data-k': 'det-sig', 'aria-pressed': String(P.sig), onclick: () => { P.sig = !P.sig; atPaint(); } }, 'And: read untrusted content first')),
    h('p', { class: 'atverdict ' + (r.caught === 3 && r.noise <= 1 ? 'good' : 'bad') },
      r.caught === 3 && r.noise <= 1 ? 'All three caught with ' + (r.noise ? 'one false alarm' : 'no false alarms') + '. A sequence of signals beats a lower threshold.'
        : r.caught === 3 ? 'All three caught, with ' + r.noise + ' false alarms. Analysts will learn to ignore this rule. Add the second signal.'
          : r.noise ? 'Attacks are slipping under the line, and you still have noise.' : 'Quiet, and missing ' + r.missed + ' of 3. Lower the line and see what it costs.'));
}

/* ---------- lock it in ---------- */
function atGoLab(labId, tab, k) {
  S.tab[labId] = tab; location.hash = labId;
  if (k != null) setTimeout(() => { const el = document.getElementById('topic-' + k); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 80);
}
function atPractise(st) {
  const tp = atTopic(st), go = tp.t && tp.t.go; if (!go) return null;
  if (go === 'rag') return h('a', { class: 'btn', href: '#rag' }, 'Practise: Build Ask Meridian');
  if (go.startsWith('harden-')) { const l = HD[go.slice(7)]; return l ? h('a', { class: 'btn', href: '#' + go }, 'Practise: Harden NEXUS, layer ' + l.n) : null; }
  const names = { do: 'the work task', drills: 'the quick quiz', scen: 'the case studies' };
  return h('button', { type: 'button', class: 'btn', onclick: () => atGoLab(tp.lab, go) }, 'Practise: ' + (names[go] || go));
}
function atBreach(st, k) {
  atStop(); AtV.phase = 'breach'; AtV.deep = k; AtV.i = -1; atPaint();
  const el = document.querySelector('#atview .atstage'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  atPlay(st);
}
function atTick(id, k, paint) {
  const on = !!((atState().chk[id] || {})[k]);
  return h('button', { type: 'button', class: 'atcheck' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': String(on), 'data-k': 'chk-' + id + '-' + k,
    onclick: () => { const c = atState().chk; (c[id] || (c[id] = {}))[k] = !on; persist(); paint(); } }, h('i', { 'aria-hidden': 'true' }, on ? '✓' : ''), h('span', null, AT_DEEP[id].checks[k]));
}
function atPlaybookText(st) {
  const D = AT_DEEP[st.id], c = (S.atlas && S.atlas.chk && S.atlas.chk[st.id]) || {};
  return ['## ' + st.t + ' (' + AT_LINE[st.line].name + ')', 'Baseline control: ' + st.fix.name + '. ' + st.fix.stop, 'It still fails when:',
    ...D.hard.map((x, k) => (k + 1) + '. ' + x[0] + '. ' + x[1] + '\n   Harden: ' + x[2]), 'Checks:', ...D.checks.map((x, k) => (c[k] ? '[x] ' : '[ ] ') + x), 'Real case: ' + st.real].join('\n');
}
function atLock(st) {
  const tp = atTopic(st), adv = st.adv && ADV_CASES.find(c => c.id === st.adv), gi = ATLAS.indexOf(st), next = ATLAS[gi + 1], D = AT_DEEP[st.id], seen = atState().deep[st.id] || {};
  return h('section', { class: 'atlock' },
    h('div', { class: 'atcard atround' }, label('Round two · you built it securely. It still breaks'),
      h('p', null, 'Assume ', h('b', null, st.fix.name.charAt(0).toLowerCase() + st.fix.name.slice(1)), ' is live and working. Three ways a capable attacker, or an ordinary Tuesday, gets past it. Play each one against your control.'),
      h('div', { class: 'athardgrid' }, D.hard.map((x, k) => h('div', { class: 'athard' + (seen[k] ? ' seen' : '') },
        h('span', { class: 'athardn' }, 'Bypass ' + (k + 1)), h('b', null, x[0]),
        seen[k] ? [h('p', null, x[1]), h('p', { class: 'atfixline' }, h('i', null, 'Harden: '), x[2])] : null,
        h('button', { type: 'button', class: 'btn small ' + (seen[k] ? '' : 'primary'), 'data-k': 'hard-' + k, onclick: () => atBreach(st, k) }, seen[k] ? 'Replay' : '▶ Play it against the control')))),
      Object.keys(seen).length < 3 ? h('p', { class: 'atskip' }, h('button', { type: 'button', class: 'linkbtn', 'data-k': 'hard-all', onclick: () => { atState().deep[st.id] = { 0: 1, 1: 1, 2: 1 }; persist(); atPaint(); } }, 'Reveal all three without playing')) : null),
    h('div', { class: 'atcard like' }, label('Think of it as'), h('p', null, st.like)),
    h('div', { class: 'atcard' }, label('It really happened'), h('p', null, st.real), adv ? h('a', { class: 'atmore', href: '#adv-' + adv.id }, 'Walk the full case in the Advanced path →') : null),
    h('div', { class: 'atcard ask' }, label('Ask the room'), h('p', null, st.ask)),
    st.play === 'emb' ? atPgEmb() : st.play === 'det' ? atPgDet() : null,
    h('div', { class: 'atcard atchecks' }, label('Checks to run · the answer is a fact, not an opinion'),
      h('div', { class: 'atchecklist' }, D.checks.map((_, k) => atTick(st.id, k, atPaint))),
      h('div', { class: 'btnrow' }, copyButton(() => atPlaybookText(st), 'Copy this stop’s playbook'), h('a', { class: 'btn', href: '#atlas-playbook' }, 'Open the full playbook →'))),
    h('div', { class: 'atcard go' }, label('Keep going'),
      h('div', { class: 'btnrow' },
        tp.t ? h('button', { type: 'button', class: 'btn', onclick: () => atGoLab(tp.lab, 'topics', tp.k) }, 'Check yourself: one question') : null,
        atPractise(st),
        NN_BY[AT_SIM[st.line]] ? h('a', { class: 'btn', href: '#adv-nn-' + AT_SIM[st.line] }, 'Instrument: ' + NN_BY[AT_SIM[st.line]].title) : null,
        next ? h('a', { class: 'btn primary', href: '#atlas-' + next.id }, 'Next stop: ' + next.t + ' →') : h('a', { class: 'btn primary', href: '#atlas' }, 'End of the line: back to the map →'))));
}

function atBody(st) {
  const line = AT_LINE[st.line], list = atOf(line.id), k = list.indexOf(st), gi = ATLAS.indexOf(st), t0 = atStart(st), prev = ATLAS[gi - 1], next = ATLAS[gi + 1];
  return [
    h('div', { class: 'crumbs' }, h('a', { class: 'back', href: '#atlas' }, '← The 10-hour map'), h('span', { class: 'spacer' }), h('span', { class: 'atchip' }, 'Line ' + line.n + ' · ' + line.name)),
    h('header', { class: 'athead' },
      h('span', { class: 'eyebrow' }, 'Stop ' + (k + 1) + ' of ' + list.length + ' · ' + atClock(t0) + ' to ' + atClock(t0 + st.min) + ' · ' + st.min + ' min' + (atDone(st.id) ? ' · seen' : '')),
      h('h1', null, st.t), h('p', { class: 'athook' }, st.hook)),
    atPhases(), atStage(st),
    AtV.phase === 'lock' ? atLock(st)
      : h('p', { class: 'atskip' }, h('button', { type: 'button', class: 'linkbtn', 'data-k': 'skip', onclick: () => { atStop(); atFinish(st, false); atPaint(); } }, 'Skip to the summary'), ' · about three minutes on screen, then the room debates and practises'),
    h('nav', { class: 'pager' }, prev ? h('a', { href: '#atlas-' + prev.id }, '← ' + prev.t) : h('span'), next ? h('a', { href: '#atlas-' + next.id }, next.t + ' →') : h('span'))];
}
function atPaint() {
  const root = document.getElementById('atview'), st = AT_BY[AtV.id]; if (!root || !st) return;
  const act = document.activeElement, k = act && act.getAttribute && act.getAttribute('data-k');
  root.replaceChildren(...h('div', null, atBody(st)).childNodes);
  if (k) { const el = root.querySelector('[data-k="' + k + '"]'); if (el && el.focus) el.focus(); }
  atFly(root);
}

/* ---------- the map ---------- */
function atMapXY(r, k, n) { const t = n > 1 ? k / (n - 1) : 0; return [r % 2 ? 334 - t * 308 : 26 + t * 308, 34 + r * 50]; }
function atMetro(next) {
  const g = [];
  AT_LINES.forEach((l, r) => {
    const list = atOf(l.id), y = 34 + r * 50, t0 = atStart(list[0]);
    if (r < AT_LINES.length - 1) { const x = r % 2 ? 26 : 334, d = r % 2 ? -24 : 24; g.push(s('path', { class: 'mtlink', d: 'M' + x + ' ' + y + 'C' + (x + d) + ' ' + y + ',' + (x + d) + ' ' + (y + 50) + ',' + x + ' ' + (y + 50) })); }
    g.push(s('line', { class: 'mtrow l-' + l.id, x1: 26, x2: 334, y1: y, y2: y }));
    g.push(s('text', { class: 'mtlbl l-' + l.id, x: r % 2 ? 334 : 26, y: y - 14, 'text-anchor': r % 2 ? 'end' : 'start' }, atClock(t0) + ' · ' + l.name));
    list.forEach((st, k) => { const [x, yy] = atMapXY(r, k, list.length), d = atDone(st.id);
      g.push(s('a', { href: '#atlas-' + st.id, class: 'mtstop l-' + l.id + (d ? ' done' : '') + (st === next ? ' next' : '') + (st.hero ? ' hero' : ''), 'aria-label': st.t + (d ? ', seen' : ''), style: 'animation-delay:' + (0.02 * ATLAS.indexOf(st)).toFixed(2) + 's' },
        s('title', null, atClock(atStart(st)) + ' · ' + st.t), st === next ? s('circle', { class: 'mtpulse', cx: x, cy: yy, r: 7 }) : null, s('circle', { cx: x, cy: yy, r: st.hero ? 7.5 : 5.5 }))); });
  });
  const end = atMapXY(AT_LINES.length - 1, 1, 2);
  g.push(s('text', { class: 'mtlbl end', x: AT_LINES.length % 2 ? 334 : 26, y: 34 + (AT_LINES.length - 1) * 50 + 22, 'text-anchor': AT_LINES.length % 2 ? 'end' : 'start' }, atClock(sum(ATLAS.map(st => st.min))) + ' · end'));
  return s('svg', { class: 'atmetro', viewBox: '0 0 360 ' + (end[1] + 30), role: 'img', 'aria-label': 'Map of the 44 stops across four lines' }, g);
}
function atMap() {
  const a = atState(), seen = ATLAS.filter(st => a.done[st.id]), first = seen.filter(st => a.done[st.id] === 2).length;
  const total = sum(ATLAS.map(st => st.min)), heroes = ATLAS.filter(st => st.hero), next = atNext(), F = AtV.filter;
  const show = st => F === 'hi' ? st.hero : F === 'todo' ? !a.done[st.id] : true;
  const fbtn = (k, t) => h('button', { type: 'button', 'aria-pressed': String(F === k), onclick: () => { AtV.filter = k; rerender(); } }, t);
  return h('div', { class: 'atmap' },
    h('section', { class: 'hero' },
      h('a', { class: 'back', href: '#' }, '← Back to the story mode'),
      h('span', { class: 'eyebrow' }, 'Modules 12, 13 and 14 · ' + total / 60 + ' hours · ' + ATLAS.length + ' topics'),
      h('h1', null, 'The 10-hour map'),
      h('p', null, 'Every syllabus topic is a stop. First the baseline: a real failure, where the control belongs, the same scene holding. Then one level up, for a room that has already built that control: three ways the secure design still fails, how to harden it, and four checks to run. It all collects into one playbook.')),
    h('div', { class: 'atboard' },
      h('div', { class: 'atmetrobox' }, atMetro(next), h('p', { class: 'small' }, 'Larger dots are highlights. Tap any dot to jump to that stop.')),
      h('div', { class: 'box dark' }, label('Your journey'),
        stats(stat(seen.length + ' / ' + ATLAS.length, 'Stops seen'), stat(atClock(sum(seen.map(st => st.min))), 'of ' + atClock(total) + ' covered'), stat(sum(ATLAS.map(st => atDeepN(st.id))) + ' / ' + ATLAS.length * 3, 'Bypasses explored', 'good')),
        meter(seen.length / ATLAS.length, 'accent', 'Stops seen'),
        h('div', { class: 'btnrow' }, next ? h('a', { class: 'btn primary big', href: '#atlas-' + next.id }, (seen.length ? 'Continue: ' : 'Start: ') + next.t + ' →') : h('span', { class: 'pill good' }, 'All 44 stops seen'), h('a', { class: 'btn', href: '#atlas-playbook' }, 'The playbook: ' + ATLAS.length * 4 + ' checks →')))),
    h('div', { class: 'seg atfilter', role: 'group', 'aria-label': 'Which stops to show' },
      fbtn('all', 'Every stop · ' + total / 60 + ' h'), fbtn('hi', 'Highlights · ' + heroes.length + ' stops · ' + atClock(sum(heroes.map(st => st.min))) + ' h'), fbtn('todo', 'Not seen yet · ' + (ATLAS.length - seen.length))),
    AT_LINES.map(l => { const list = atOf(l.id), vis = list.filter(show), t0 = atStart(list[0]), mins = sum(list.map(st => st.min));
      if (!vis.length) return null;
      return h('section', { class: 'atline l-' + l.id },
        h('div', { class: 'atlinehead' }, h('span', { class: 'atbadge' }, String(l.n)),
          h('div', null, h('span', { class: 'label' }, l.mod + ' · ' + atClock(t0) + ' to ' + atClock(t0 + mins) + ' · ' + list.length + ' stops'), h('h2', null, l.name), h('p', { class: 'sub' }, l.lead)),
          h('span', { class: 'atcount' }, list.filter(st => a.done[st.id]).length + '/' + list.length)),
        h('ol', { class: 'atstops' }, vis.map(st => { const d = a.done[st.id];
          return h('li', null, h('a', { class: 'atstop' + (d ? ' done' : '') + (st === next ? ' next' : ''), href: '#atlas-' + st.id },
            h('span', { class: 'attime' }, atClock(atStart(st))), h('span', { class: 'atdot', 'aria-hidden': 'true' }),
            h('span', { class: 'atstopbody' }, h('b', null, st.t), h('span', null, st.hook)),
            h('span', { class: 'atmeta' }, st.hero ? h('i', { class: 'athi' }, 'Highlight') : null, st.play ? h('i', { class: 'athi play' }, 'Playground') : null, h('span', null, d ? '✓ ' + atDeepN(st.id) + '/3 bypasses' : st.min + ' min')))); }))); }),
    details('Running it in the room', false, h('ol', { class: 'plain numbered' },
      h('li', null, h('b', null, 'Watch it break (1 min). '), 'Project the stop and press play. Say nothing: let the room read the beats.'),
      h('li', null, h('b', null, 'Place the control (1 min). '), 'Ask tables to commit to a box before anyone taps. Wrong boxes explain why they are too late.'),
      h('li', null, h('b', null, 'Watch it hold (1 min). '), 'Replay with the control in place.'),
      h('li', null, h('b', null, 'Go one level up (5 min). '), 'Before playing each bypass, ask the room how they would get past the control they just placed. Then play it and read the hardening.'),
      h('li', null, h('b', null, 'Checks and debate (the rest of the slot). '), 'Tables tick the checks they could evidence today. Read the real case, put the room question, then follow the practice link into the lab.'),
      h('li', null, 'Short on time? Use ', h('b', null, 'Highlights'), ': ' + heroes.length + ' stops that carry the argument of all three modules.'))),
    seen.length ? h('div', { class: 'btnrow end' }, confirmTwice('atlas-clear', 'Clear my progress on the map', () => { delete S.atlas; }, 'warn')) : null);
}

/* ---------- the playbook: every stop's control, failure modes, hardening and checks ---------- */
function atPlaybookAll() {
  return ['# AI security playbook: RAG, MCP, productization and the SOC', 'Modules 12 to 14. For each topic: the baseline control, three ways it still fails in a secure system, how to harden it, and four checks to evidence.', '',
    ...AT_LINES.flatMap(l => ['# ' + l.name, '', ...atOf(l.id).flatMap(st => [atPlaybookText(st), ''])])].join('\n');
}
function atPlaybook() {
  const total = ATLAS.length * 4, ticked = sum(ATLAS.map(st => atChkN(st.id)));
  return h('div', { class: 'atmap atbook' },
    h('section', { class: 'hero' },
      h('a', { class: 'back', href: '#atlas' }, '← The 10-hour map'),
      h('span', { class: 'eyebrow' }, 'Take-home · ' + ATLAS.length + ' topics · ' + ATLAS.length * 3 + ' failure modes · ' + total + ' checks'),
      h('h1', null, 'The playbook'),
      h('p', null, 'For teams that already have the controls. Each topic gives the baseline, three ways it still fails, the hardening for each, and four checks whose answer is a fact. Tick what you could evidence today; what is left is your backlog.')),
    h('div', { class: 'box dark atbookbar' }, stats(stat(ticked + ' / ' + total, 'Checks you can evidence'), stat(String(total - ticked), 'Open', total - ticked ? 'amber' : 'good')), meter(ticked / total, 'accent', 'Checks evidenced'),
      h('div', { class: 'btnrow' }, copyButton(atPlaybookAll, 'Copy the whole playbook'), h('button', { type: 'button', class: 'btn', onclick: () => { if (window.print) window.print(); } }, 'Print or save as PDF'))),
    AT_LINES.map(l => h('section', { class: 'atline l-' + l.id },
      h('div', { class: 'atlinehead' }, h('span', { class: 'atbadge' }, String(l.n)), h('div', null, h('span', { class: 'label' }, l.mod), h('h2', null, l.name)),
        h('span', { class: 'atcount' }, sum(atOf(l.id).map(st => atChkN(st.id))) + '/' + atOf(l.id).length * 4)),
      atOf(l.id).map(st => { const D = AT_DEEP[st.id];
        return h('article', { class: 'atbookstop' },
          h('h3', null, h('a', { href: '#atlas-' + st.id }, st.t)),
          h('p', { class: 'atbookctl' }, h('b', null, 'Baseline: '), st.fix.name + '. ', h('span', null, st.fix.stop)),
          h('ol', { class: 'atbookhard' }, D.hard.map(x => h('li', null, h('b', null, x[0] + '. '), x[1], h('span', { class: 'atfixline' }, h('i', null, ' Harden: '), x[2])))),
          h('div', { class: 'atchecklist' }, D.checks.map((_, k) => atTick(st.id, k, rerender)))); }))));
}

/* Entry cards for the landing pages and the lab pages. */
function atHero(cls) {
  const n = ATLAS.filter(st => atDone(st.id)).length;
  return h('a', { class: cls + ' athero', href: '#atlas' }, h('span', { class: 'kicker' }, 'Modules 12 to 14 · 10 hours · ' + ATLAS.length + ' animated stops'), h('b', null, 'The 10-hour map: RAG, MCP, shipping and the SOC'),
    h('span', null, n ? n + ' of ' + ATLAS.length + ' stops seen. Each one: the baseline control, three ways it still fails, and the checks to run.' : 'Every topic as a scene: watch it break, place the control, then three ways the secure design still fails, and a playbook to take home.'));
}
function atLabLink(labId) {
  const lines = atLabLines(labId); if (!lines.length) return null;
  const first = atOf(lines[0].id)[0], n = sum(lines.map(l => atOf(l.id).length));
  return h('a', { class: 'raglink atlablink', href: '#atlas-' + first.id }, h('b', null, 'See this module animated: ' + n + ' stops on the 10-hour map'), h('span', null, lines.map(l => 'Line ' + l.n + ' · ' + l.name).join('  ·  ') + ' →'));
}

function atlasPage(route) {
  const id = route.slice(6), st = AT_BY[id];
  if (!st) { atStop(); AtV.id = null; return id === 'playbook' ? atPlaybook() : atMap(); }
  if (AtV.id !== id) { atStop(); Object.assign(AtV, { id, phase: 'watch', i: -1, tries: 0, wrong: null, alt: false }); }
  const view = h('div', { id: 'atview', class: 'atview l-' + st.line }, atBody(st));
  setTimeout(() => atFly(view), 0);
  return view;
}
