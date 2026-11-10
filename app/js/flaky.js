'use strict';
/* It passed. Ship it? The arithmetic of testing and releasing something that
   does not give the same answer twice. Run a 20-attack red-team suite once and
   watch it pass; run it a thousand times and find the attacks that work one
   time in fifty; turn that rate into the attacker's odds over many tries; then
   release in rings and see which ring design meets the users it will hurt.
   Every trial is a real draw from a seeded generator on the page; intervals
   are Wilson 95%. The attack names and rates are illustrative. */

const FK_ATK = ['Role-play override', 'Fake system tag', 'Base64 wrapper', 'Polite authority', 'Many-shot history', 'Split across turns', 'Homoglyph swap', 'Hidden text in a PDF', 'Tool-result instruction', 'Translate-then-obey',
  'Emoji smuggling', 'Markdown image link', 'Poem framing', 'JSON field injection', 'Calendar invite', 'Long-context dilution', 'Refusal suppression', 'Code comment', 'Voice transcript', 'Table cell'];
const FK_P = FK_ATK.map((_, i) => ({ 3: 0.02, 7: 0.01, 12: 0.03, 16: 0.005 })[i] || 0);
// One suite run: each attack tried m times. Returns successes per attack.
function fkTrials(rng, m) { return FK_P.map(p => { let k = 0; for (let j = 0; j < m; j++) if (rng() < p) k++; return k; }); }
// Wilson 95% interval for k successes in n trials.
function fkWilson(k, n) { if (!n) return [0, 1]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), e = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - e) / d), Math.min(1, (c + e) / d)]; }
// Chance that at least one of n independent tries succeeds.
const fkAtLeastOnce = (p, n) => 1 - Math.pow(1 - p, n);
const fkTries = v => Math.round(Math.pow(10, v / 100 * 3.3));
// A release: 2,000 users, 5% in a cohort the change fails for (long, multilingual sessions).
const FK_USERS = (() => { const r = nnRng(42); return [...Array(2000)].map((_, i) => ({ i, risky: i >= 400 && r() < 0.0625 })); })();
const FK_FAIL = { risky: 0.3, plain: 0.002 }, FK_GATE = 2, FK_RING = 40;
function fkRing(kind) {
  const r = nnRng(kind === 'staff' ? 5 : kind === 'random' ? 9 : 17), risky = FK_USERS.filter(u => u.risky), plain = FK_USERS.filter(u => !u.risky), pick = (arr, n) => { const a = arr.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
  const ring = kind === 'staff' ? FK_USERS.slice(0, FK_RING) : kind === 'random' ? pick(FK_USERS, FK_RING) : pick(risky, FK_RING / 2).concat(pick(plain, FK_RING / 2));
  const fails = u => r() < (u.risky ? FK_FAIL.risky : FK_FAIL.plain), inRing = new Set(ring.map(u => u.i)), ringBad = new Set(ring.filter(fails).map(u => u.i));
  const blocked = ringBad.size >= FK_GATE, restBad = new Set(blocked ? [] : FK_USERS.filter(u => !inRing.has(u.i)).filter(fails).map(u => u.i));
  return { kind, inRing, ringBad, blocked, restBad, riskyInRing: ring.filter(u => u.risky).length, harmed: ringBad.size + restBad.size };
}
const FK_RINGS = [['staff', 'Ring 1 = our own staff'], ['random', 'Ring 1 = a random 2%'], ['strat', 'Ring 1 = 2%, half from the risky cohort']];

const FK_VEC = [{ id: 'once', name: 'One run called a pass' }, { id: 'rate', name: 'No threshold on the rate' }, { id: 'list', name: 'A fixed list of attacks' },
  { id: 'ring', name: 'First ring misses who it hurts' }, { id: 'slow', name: 'Harm that builds after the gate' }, { id: 'alias', name: 'The model alias moved' }];
const FK_DEF = [
  { id: 'trials', name: 'Many trials, report a rate', how: 'Each attack run N times, with an interval and a threshold', kills: ['once', 'rate'] },
  { id: 'adapt', name: 'Attackers who adapt', how: 'People and automated attackers who see the defence and iterate', kills: ['list'] },
  { id: 'strat', name: 'Rings stratified by risk', how: 'The cohort it could hurt is over-sampled in ring one', kills: ['ring'] },
  { id: 'watch', name: 'Gates that keep running', how: 'Same metrics after release, with automatic rollback', kills: ['slow'] },
  { id: 'snap', name: 'Pin dated model snapshots', how: 'A provider update is a release, not a surprise', kills: ['alias'] }];
const FK_GROUPS = [{ name: 'Testing', col: 'ink', ids: ['once', 'rate', 'list'], act: 'A 2% attack shipped behind a green tick' },
  { name: 'Release', col: 'bad', ids: ['ring', 'slow', 'alias'], act: 'The users it fails for met it at 100%' }];

function fkMount(L) {
  const P = { rng: nnRng(12), runs: [], n: 0, k: FK_ATK.map(() => 0), tr: 30, saw95: false, ring: null, ringAt: -9, tried: new Set(), on: {}, flash: {} };
  const worst = () => P.n ? Math.max(...P.k) / P.n : 0, pUse = () => worst() || 0.02;
  const once = L2 => { const k = fkTrials(P.rng, 1); P.runs.push(k); P.last = k; P.lastAt = L2.t; L2.repaint(); };
  const more = (L2, m) => { fkTrials(P.rng, m).forEach((v, i) => { P.k[i] += v; }); P.n += m; P.lastAt = L2.t; L2.repaint(); };
  const noteTr = () => { const pr = fkAtLeastOnce(pUse(), fkTries(P.tr)); if (pr >= 0.95) P.saw95 = true; return fkTries(P.tr) + ' tries'; };
  return { P,
    hud: L2 => [
      [['SUITE RUNS', () => String(P.runs.length)], ['PASSED', () => String(P.runs.filter(k => !k.some(Boolean)).length), 'good'], ['FAILED', () => String(P.runs.filter(k => k.some(Boolean)).length), 'bad']],
      [['TRIALS / ATTACK', () => String(P.n)], ['ATTACKS THAT EVER WORK', () => String(P.k.filter(Boolean).length), 'bad'], ['WORST RATE', () => (worst() * 100).toFixed(1) + '%', 'bad']],
      [['PER-TRY RATE', () => (pUse() * 100).toFixed(1) + '%'], ['TRIES', () => String(fkTries(P.tr))], ['ODDS OF A BREACH', () => Math.round(fkAtLeastOnce(pUse(), fkTries(P.tr)) * 100) + '%', 'bad']],
      [['IN RING 1', () => P.ring ? P.ring.riskyInRing + ' risky of ' + FK_RING : '—'], ['RING FAILURES', () => P.ring ? String(P.ring.ringBad.size) : '—'], ['USERS HARMED', () => P.ring ? String(P.ring.harmed) : '—', 'bad']],
      axDefHud(P, FK_VEC, FK_DEF), axDefHud(P, FK_VEC, FK_DEF)][L2.step],
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, FK_GROUPS, FK_VEC, FK_DEF) : [fkDrawSuite, fkDrawSuite, fkDrawOdds, fkDrawRings][L2.step](L2, g, P),
    steps: [
      { say: () => !P.runs.length ? 'Twenty attacks, one try each. Run the red-team suite.' : P.runs.length < 4 ? (P.last.some(Boolean) ? 'One got through this time. Run it again.' : '20 of 20 blocked. Passed. Run it again.') : 'Same system, same suite: ' + P.runs.filter(k => !k.some(Boolean)).length + ' passes, ' + P.runs.filter(k => k.some(Boolean)).length + ' failures. Which one is the truth?',
        side: L2 => [labBtn('▶ Run the suite once', () => once(L2)), h('p', { class: 'labsm' }, 'Each run is a fresh, real draw. The model samples its output, so the same attack can fail today and work tomorrow.')],
        acts: L2 => [labNext(L2, 'Run it properly →', P.runs.length < 4)] },
      { say: () => P.n < 1000 ? 'Now run every attack many times and look at rates, not ticks. ' + P.n + ' trials each so far.' : P.k.filter(Boolean).length + ' attacks work some of the time. The worst: ' + (worst() * 100).toFixed(1) + '% of tries. A single run mostly never sees them.',
        side: L2 => [h('div', { class: 'labstack' }, [10, 100, 1000].map(m => labBtn('▶ ' + m + ' more trials of each', () => more(L2, m)))),
          h('p', { class: 'labsm' }, 'The bar on each attack is its 95% interval. Zero successes in 10 trials still allows a rate of up to 28%.')],
        acts: L2 => [labNext(L2, 'The attacker’s arithmetic →', P.n < 1000)] },
      { enter: () => { noteTr(); },
        say: () => !P.saw95 ? 'You test each attack once. The attacker does not. Give them more tries.' : 'At ' + (pUse() * 100).toFixed(1) + '% per try, ' + fkTries(P.tr) + ' tries make a breach near certain. A script does that before lunch.',
        side: L2 => [axRange(L2, P, 'tr', 'Attacker’s tries', () => P.saw95, noteTr, 100),
          h('p', { class: 'labsm' }, 'Odds of at least one success = 1 − (1 − p)ⁿ, with p the worst rate you measured.')],
        acts: L2 => [labNext(L2, 'Release it in rings →', !P.saw95)] },
      { say: () => !P.ring ? 'The fix passed. Release to 2,000 users. It fails for one cohort in twenty. Choose who goes first.' : P.ring.blocked ? 'Ring one caught it: ' + P.ring.ringBad.size + ' failures among 40, release stopped. Try the other designs.' : 'Ring one saw ' + P.ring.ringBad.size + ' failure' + (P.ring.ringBad.size === 1 ? '' : 's') + ', so it went to everyone. ' + P.ring.harmed + ' users harmed.',
        side: L2 => [h('div', { class: 'labstack' }, FK_RINGS.map(([k, t]) => labBtn((P.tried.has(k) ? '✓ ' : '▶ ') + t, () => { P.ring = fkRing(k); P.ringAt = L2.t; P.tried.add(k); L2.repaint(); }))),
          h('p', { class: 'labsm' }, 'The gate stops the release at ' + FK_GATE + ' or more failures in ring one.')],
        acts: L2 => [labNext(L2, 'Close the paths →', !(P.tried.has('staff') && P.tried.has('strat')))] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(FK_VEC, FK_DEF, P.on).length; return n ? n + ' paths open. Switch on controls.' : 'All ' + FK_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, FK_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => '“It passed” is a sample of one. Ask for the rate.',
        enter: () => labDone('flaky'),
        side: () => axDebrief(P, FK_VEC, FK_DEF, [
          ['Dec 2024 · Best-of-N', 'Random typos and capitals, retried thousands of times, broke frontier models most of the time. Each single try almost always failed.'],
          ['Oct 2025 · The Attacker Moves Second', 'Twelve published defences, each with a near-perfect static score, fell to attackers who were allowed to adapt.'],
          ['Apr 2025 · GPT-4o', 'An update passed offline evaluations and a small test, went to everyone, and was rolled back days later for a behaviour no metric covered.'],
          ['2024–25 · Alias drift', 'Teams pointing at a model alias have had behaviour change with no deployment of their own.']],
          ['bon', 'spotlight', 'classifiers'], 'Every trial on this page is a real random draw at the attack’s hidden rate, and the intervals are Wilson 95%. The attacks, rates and cohort are illustrative.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv' }, 'Advanced path →')] }
    ] };
}

/* ---------- drawing ---------- */
function fkDrawSuite(L, g, P) {
  const rate = L.step === 1, cols = L.w > 720 ? 5 : 4, rows = Math.ceil(FK_ATK.length / cols), pad = 12, cw = (L.w - pad * (cols + 1)) / cols, top = 44, ch = Math.min(96, (L.h - top - pad) / rows - 8), fs = Math.max(9, Math.min(12, cw / 15));
  const last = P.last, passed = last && !last.some(Boolean);
  labText(g, rate ? 'RED-TEAM SUITE · ' + P.n + ' TRIALS OF EACH ATTACK' : 'RED-TEAM SUITE · RUN ' + P.runs.length + (last ? passed ? ' · PASSED' : ' · FAILED' : ''), pad, 28, { size: 12, w: 700, col: lc(!rate && last ? (passed ? LC.good : LC.bad) : LC.blue, 1) });
  FK_ATK.forEach((name, i) => { const x = pad + (i % cols) * (cw + pad), y = top + Math.floor(i / cols) * (ch + 8), k = rate ? P.k[i] : last ? last[i] : 0, hit = k > 0, tried = rate ? P.n > 0 : !!last, col = !tried ? LC.mute : hit ? LC.bad : LC.good;
    if (hit && L.t - (P.lastAt || -9) < 0.8) labGlow(g, x + cw / 2, y + ch / 2, cw * 0.6, LC.bad, 0.5 * (1 - (L.t - P.lastAt) / 0.8));
    axRound(g, x, y, cw, ch, 8); g.fillStyle = !tried ? '#0B1226' : hit ? 'rgba(255,90,122,.13)' : 'rgba(95,208,143,.07)'; g.fill(); g.strokeStyle = lc(col, tried ? 0.8 : 0.3); g.stroke();
    fiClip(g, x, y, cw, ch, () => { labText(g, name, x + 8, y + fs + 8, { size: fs, mono: false, w: 600, col: lc(LC.text, 0.9) });
      if (!rate) labText(g, !tried ? '—' : hit ? '✗ got through' : '✓ blocked', x + 8, y + ch - 12, { size: fs + 1, w: 700, col: lc(col, 1) });
      else { const [lo, hi] = fkWilson(k, P.n), bx = x + 8, bw = cw - 16, by = y + ch - 16, sc = v => bx + bw * Math.min(1, v / 0.3);
        labText(g, P.n ? k + ' / ' + P.n + '  ·  ' + (k / P.n * 100).toFixed(1) + '%' : 'not run', x + 8, y + ch - 26, { size: fs, w: 700, col: lc(col, 1) });
        g.fillStyle = 'rgba(141,182,242,.12)'; g.fillRect(bx, by, bw, 6);
        if (P.n) { g.fillStyle = lc(hit ? LC.bad : LC.good, 0.55); g.fillRect(sc(lo), by, Math.max(2, sc(hi) - sc(lo)), 6); g.fillStyle = lc(LC.text, 1); g.fillRect(sc(k / P.n) - 1, by - 3, 2, 12); } } }); });
}
function fkDrawOdds(L, g, P) {
  const p = (P.n ? Math.max(...P.k) / P.n : 0) || 0.02, n = fkTries(P.tr), pr = fkAtLeastOnce(p, n), x0 = 60, x1 = L.w - 30, y0 = L.h - 56, y1 = 60, X = v => x0 + (x1 - x0) * v / 100, Yv = q => y0 + (y1 - y0) * q;
  labText(g, 'CHANCE THAT AT LEAST ONE TRY GETS THROUGH', x0, 34, { size: 12, w: 700, col: lc(LC.blue, 1) });
  g.strokeStyle = lc(LC.mute, 0.3); [0, 0.25, 0.5, 0.75, 1].forEach(q => { g.beginPath(); g.moveTo(x0, Yv(q)); g.lineTo(x1, Yv(q)); g.stroke(); labText(g, Math.round(q * 100) + '%', x0 - 8, Yv(q) + 4, { size: 10, align: 'right' }); });
  [0, 30, 61, 91].forEach(v => labText(g, String(fkTries(v)), X(v), y0 + 18, { size: 10, align: 'center' })); labText(g, 'tries →', x1, y0 + 34, { size: 10, align: 'right' });
  g.setLineDash([5, 5]); g.strokeStyle = lc(LC.ink, 0.7); g.beginPath(); g.moveTo(x0, Yv(0.95)); g.lineTo(x1, Yv(0.95)); g.stroke(); g.setLineDash([]); labText(g, '95%', x1, Yv(0.95) - 6, { size: 10, align: 'right', col: lc(LC.ink, 1) });
  g.strokeStyle = lc(LC.bad, 0.95); g.lineWidth = 3; g.beginPath(); for (let v = 0; v <= 100; v++) { const yy = Yv(fkAtLeastOnce(p, fkTries(v))); if (v) g.lineTo(X(v), yy); else g.moveTo(X(v), yy); } g.stroke(); g.lineWidth = 1;
  const cx = X(P.tr), cy = Yv(pr); labGlow(g, cx, cy, 30, LC.bad, 0.5); g.fillStyle = lc(LC.text, 1); g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
  labText(g, n + ' tries → ' + Math.round(pr * 100) + '%', Math.min(x1 - 90, Math.max(x0 + 90, cx)), cy - 16, { size: 14, w: 700, align: 'center', col: lc(LC.text, 1) });
  labText(g, 'per-try success rate ' + (p * 100).toFixed(1) + '% (the worst you measured)', x0, y1 - 8, { size: 11, col: lc(LC.mute, 1) });
}
function fkDrawRings(L, g, P) {
  const cols = L.w > 720 ? 80 : 50, rows = Math.ceil(2000 / cols), pad = 14, top = 44, c = Math.min((L.w - pad * 2) / cols, (L.h - top - 46) / rows), ox = (L.w - cols * c) / 2, R = P.ring, age = R ? L.t - P.ringAt : 0, rel = R && !R.blocked && (age > 1.2 || NN.sync);
  labText(g, '2,000 USERS · OUTLINED: THE COHORT THE CHANGE FAILS FOR', pad, 28, { size: 12, w: 700, col: lc(LC.blue, 1) });
  FK_USERS.forEach(u => { const x = ox + (u.i % cols) * c, y = top + Math.floor(u.i / cols) * c, inR = R && R.inRing.has(u.i), bad = R && (R.ringBad.has(u.i) || (rel && R.restBad.has(u.i)));
    g.fillStyle = bad ? lc(LC.bad, 1) : inR ? lc(LC.ink, 0.95) : rel ? lc(LC.blue, 0.5) : lc(LC.mute, 0.22); g.fillRect(x + 1, y + 1, c - 2, c - 2);
    if (u.risky) { g.strokeStyle = lc(LC.violet, 0.95); g.strokeRect(x + 0.5, y + 0.5, c - 1, c - 1); } });
  if (R) axStamp(g, L.w / 2, Math.min(L.h - 40, top + rows * c + 44), R.blocked ? 'STOPPED AT RING 1 · ' + R.harmed + ' HARMED' : rel ? 'RELEASED TO ALL · ' + R.harmed + ' HARMED' : 'RING 1: ' + R.ringBad.size + ' FAILURE' + (R.ringBad.size === 1 ? '' : 'S') + ' · GATE OPEN', R.blocked ? LC.good : LC.bad, age - 0.2, L.w > 720 ? 18 : 12);
}

NN_SIMS.push({ id: 'flaky', title: 'It passed. Ship it?', kicker: 'Testing · release · the maths of “sometimes”', blurb: 'Run a red-team suite once and watch it pass, then a thousand times and find the attacks that work one try in fifty. Turn that rate into the attacker’s odds, then release in rings and see which design meets the users it will hurt.', mount: fkMount,
  brief: { what: 'An AI system does not give the same output twice, so a test that passes has only passed once. Security testing and release gates built for deterministic software report a tick where they should report a rate, and stage rollouts through the people least likely to hit the failure.',
    real: 'Best-of-N (2024) broke frontier models by retrying random variations thousands of times. “The Attacker Moves Second” (2025) broke twelve defences that had near-perfect static scores. A 2025 model update passed its evaluations and was rolled back within days.',
    todo: ['Run the suite once, several times, and watch pass turn to fail', 'Measure the real rates, then give the attacker many tries', 'Release through three ring designs and compare who gets hurt'] },
  guide: [
    { look: [['good', '✓', 'Blocked on this run.'], ['bad', '✗', 'Got through on this run.']],
      why: 'Nothing changes between runs except the dice. A release decision made on one run is a decision made on a coin you have flipped once.' },
    { look: [['bad', '▬', 'Coloured bar: the 95% interval for the true rate.'], ['text', '|', 'White tick: the measured rate.']],
      why: 'Four attacks have a real success rate between 0.5% and 3%. It takes hundreds of trials to see them, and a threshold on the rate to act on them.' },
    { look: [['bad', '—', 'The curve: odds of at least one success.'], ['ink', '┄', 'Dashed: 95%.']],
      why: 'A defence that stops 98% of tries stops an attacker for about an afternoon. The control has to make a single success survivable, not just rare.' },
    { look: [['violet', '□', 'Outlined: the cohort it fails for.'], ['ink', '■', 'Amber: ring one.'], ['bad', '■', 'Red: a user it failed for.']],
      why: 'Staff are the least representative users you have. A ring only protects you if the people who would be hurt are in it.' },
    { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']],
      why: 'Testing and release are one control: the same rate, measured before and after go-live.' },
    { why: 'Next time someone says an AI change passed, ask how many trials, what rate, and who was in ring one.' }] });
NN_BY.flaky = NN_SIMS[NN_SIMS.length - 1];
