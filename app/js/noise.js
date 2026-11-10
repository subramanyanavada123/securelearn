'use strict';
/* Find it in the noise: detection and response for a SOC that already collects
   the telemetry. Build a rule over a week of agent sessions and count what it
   catches against what it wakes people for; meet the attacker who spreads the
   same three steps across days; watch a learned baseline follow a slow ramp
   upward; then pull a kill switch and count the tool calls that still happen.
   The event log is generated from a fixed seed, and every rule, baseline and
   count is evaluated on the page against it. The scenario is illustrative. */

const NZ_KINDS = [['ext', 'Read untrusted content', 'blue'], ['sens', 'Opened a sensitive source', 'ink'], ['out', 'Outbound link to a new domain', 'violet']];
// A week of work: 30 users, five sessions each, plus three loud attacks and three low-and-slow campaigns.
const NZ_LOG = (() => {
  const r = nnRng(23), S2 = [], add = (user, day, ev, atk) => { S2.push({ id: S2.length, user, day, ev, atk: atk || null }); };
  for (let u = 0; u < 30; u++) for (let k = 0; k < 5; k++) { const ev = []; [['ext', 0.45], ['sens', 0.4], ['out', 0.15]].forEach(([t, p]) => { if (r() < p) ev.push({ t, m: Math.floor(r() * 30) }); }); add(u, Math.floor(r() * 7), ev); }
  [3, 11, 22].forEach(u => add(u, 2 + (u % 3), [{ t: 'ext', m: 4 }, { t: 'sens', m: 5 }, { t: 'out', m: 6 }], 'loud'));
  [5, 17, 26].forEach(u => { add(u, 0, [{ t: 'ext', m: 9 }], 'slow'); add(u, 3, [{ t: 'sens', m: 14 }, { t: 'honey', m: 15 }], 'slow'); add(u, 6, [{ t: 'out', m: 20 }], 'slow'); });
  return S2.sort((a, b) => a.day - b.day || a.id - b.id);
})();
const NZ_SLOW = [5, 17, 26], NZ_LOUD = NZ_LOG.filter(s2 => s2.atk === 'loud').map(s2 => s2.id);
// Do the chosen event kinds occur in order, first to last within `win`, in this list of [kind, time]?
function nzSeq(ev, conds, win) {
  if (!conds.length) return false;
  return ev.some(([t0, m0]) => { if (t0 !== conds[0]) return false; let at = m0;
    for (let k = 1; k < conds.length; k++) { const nx = ev.filter(([t, m]) => t === conds[k] && m > at).map(e => e[1]); if (!nx.length) return false; at = Math.min(...nx); }
    return at - m0 <= win; });
}
// Evaluate a rule over the week. scope 'session': win in minutes. scope 'user': win in days, across that user's sessions.
function nzEval(rule) {
  const conds = NZ_KINDS.map(k => k[0]).filter(k => rule.c[k]), hit = new Set();
  if (rule.scope === 'user') { for (let u = 0; u < 30; u++) { const ev = NZ_LOG.filter(s2 => s2.user === u).flatMap(s2 => s2.ev.map(e => [e.t, s2.day * 1440 + e.m]));
    if (nzSeq(ev, conds, rule.win * 1440) || (rule.honey && ev.some(e => e[0] === 'honey'))) NZ_LOG.filter(s2 => s2.user === u).forEach(s2 => hit.add(s2.id)); } }
  else NZ_LOG.forEach(s2 => { if (nzSeq(s2.ev.map(e => [e.t, e.m]), conds, rule.win) || (rule.honey && s2.ev.some(e => e.t === 'honey'))) hit.add(s2.id); });
  const users = new Set(NZ_LOG.filter(s2 => hit.has(s2.id)).map(s2 => s2.user)), badUser = u => NZ_SLOW.includes(u) || NZ_LOG.some(s2 => s2.user === u && s2.atk === 'loud');
  return { hit, loud: NZ_LOUD.filter(id => hit.has(id)).length, slow: NZ_SLOW.filter(u => users.has(u)).length,
    fp: rule.scope === 'user' ? [...users].filter(u => !badUser(u)).length : [...hit].filter(id => !NZ_LOG.find(s2 => s2.id === id).atk).length };
}
// Sixty days of token use. From day 10 a stolen key adds a ramp of r per day. The alert is three sigma over a trailing 14-day baseline.
// Real usage has a weekly rhythm (quiet weekends), which is what makes a trailing sigma band wide.
const NZ_BASE = (() => { const r = nnRng(7); return [...Array(60)].map((_, d) => 100 * (d % 7 > 4 ? 0.4 : 1.1) * (1 + 0.12 * (r() * 2 - 1))); })();
function nzFrog(rate, cap) {
  const x = NZ_BASE.map((b, d) => b * Math.pow(1 + rate, Math.max(0, d - 10))), band = []; let alert = -1, capDay = -1;
  for (let d = 0; d < 60; d++) { const w = x.slice(Math.max(0, d - 14), d), m = w.length ? w.reduce((a, b) => a + b, 0) / w.length : x[0], sd = w.length > 1 ? Math.sqrt(w.reduce((a, b) => a + (b - m) * (b - m), 0) / w.length) : 5;
    band.push(m + 3 * sd); if (alert < 0 && d >= 14 && x[d] > m + 3 * sd) alert = d; if (capDay < 0 && cap && x[d] > 300) capDay = d; }
  return { x, band, alert, capDay, final: x[59] / 100 };
}
// Tool calls that still happen `el` seconds after the switch. 'ui' stops new chats; 'gw' revokes the agent's credentials at the tool gateway.
const NZ_RUNS = [4, 7, 9, 12, 15], NZ_JOBS = [2, 4, 6, 8, 10, 12];
function nzKill(mode, el) { if (mode === 'gw') return 0; return Math.floor(NZ_RUNS.reduce((a, d) => a + Math.min(el, d), 0) + NZ_JOBS.reduce((a, t0) => a + Math.max(0, Math.min(3, el - t0)), 0)); }

const NZ_VEC = [{ id: 'single', name: 'Single-event rules drown in noise' }, { id: 'slow', name: 'Low and slow, under the window' }, { id: 'rot', name: 'Rule rot after an update' },
  { id: 'frog', name: 'The baseline learns the attack' }, { id: 'flight', name: 'Runs in flight outlive the switch' }, { id: 'queue', name: 'Queued and scheduled work carries on' }];
const NZ_DEF = [
  { id: 'seq', name: 'Detect sequences, not events', how: 'Untrusted read, then sensitive source, then outbound', kills: ['single'] },
  { id: 'honey', name: 'Honeytokens in every corpus', how: 'Documents nobody should ever retrieve', kills: ['slow'] },
  { id: 'replay', name: 'Replay tests for every rule', how: 'A rule that stops matching its own test raises an alert', kills: ['rot'] },
  { id: 'cap', name: 'Hard caps beside baselines', how: 'A fixed limit a slow ramp cannot teach', kills: ['frog'] },
  { id: 'gw', name: 'Kill at the tool gateway', how: 'Revoke authority and drain queues, not just the chat', kills: ['flight', 'queue'] }];
const NZ_GROUPS = [{ name: 'Detection', col: 'ink', ids: ['single', 'slow', 'rot'], act: 'Three campaigns ran for a week without an alert' },
  { name: 'Baselines', col: 'violet', ids: ['frog'], act: 'Usage grew tenfold and stayed “normal”' },
  { name: 'Stopping', col: 'bad', ids: ['flight', 'queue'], act: 'The agent kept acting after it was switched off' }];

function nzMount(L) {
  const P = { c: { ext: false, sens: false, out: true }, win: 5, scope: 'session', days: 1, honey: false, clean: false, noisy: false, solved: false, rt: 30, evaded: false, cap: false, capped: false, mode: 'ui', killAt: -99, killUi: false, killGw: false, on: {}, flash: {} };
  const rule = () => ({ c: P.c, scope: P.scope, win: P.scope === 'user' ? Math.max(1, P.days) : P.win, honey: P.honey }), ev = () => nzEval(rule());
  const note = () => { const e = ev(); if (L.step === 0 && e.loud === 3 && e.fp <= 1) P.clean = true; if (L.step === 1) { if (e.slow === 3 && e.fp >= 3) P.noisy = true; if (e.slow === 3 && e.loud === 3 && e.fp <= 1) P.solved = true; } return e; };
  const rate = () => P.rt / 200, frog = () => nzFrog(rate(), P.cap);
  const noteF = () => { const f = frog(); if (f.alert < 0 && f.final >= 5) P.evaded = true; if (P.evaded && P.cap && f.capDay >= 0) P.capped = true; return (rate() * 100).toFixed(1) + '% a day'; };
  const el = L2 => P.killAt < -9 ? -1 : NN.sync ? 20 : L2.t - P.killAt;
  const condBtns = L2 => h('div', { class: 'labprompts' }, NZ_KINDS.map(([k, t]) => h('button', { type: 'button', class: 'labp' + (P.c[k] ? ' on' : ''), 'aria-pressed': String(P.c[k]), onclick: () => { P.c[k] = !P.c[k]; note(); L2.repaint(); } }, t)));
  return { P,
    hud: L2 => [
      [['LOUD ATTACKS CAUGHT', () => ev().loud + '/3', 'good'], ['FALSE ALARMS', () => String(ev().fp), 'bad']],
      [['LOUD', () => ev().loud + '/3', 'good'], ['SLOW CAMPAIGNS', () => ev().slow + '/3', 'good'], ['FALSE ALARMS', () => String(ev().fp), 'bad']],
      [['RAMP', () => (rate() * 100).toFixed(1) + '%/day'], ['GROWTH', () => frog().final.toFixed(1) + '×', 'bad'], ['ALERT', () => frog().alert < 0 ? 'NEVER' : 'DAY ' + frog().alert, 'bad'], ['CAP', () => !P.cap ? 'OFF' : frog().capDay < 0 ? 'NOT HIT' : 'DAY ' + frog().capDay, 'good']],
      [['SWITCH', () => P.mode === 'gw' ? 'AT THE GATEWAY' : 'STOP NEW CHATS'], ['CALLS AFTER KILL', () => el(L2) < 0 ? '—' : String(nzKill(P.mode, el(L2))), 'bad']],
      axDefHud(P, NZ_VEC, NZ_DEF), axDefHud(P, NZ_VEC, NZ_DEF)][L2.step],
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, NZ_GROUPS, NZ_VEC, NZ_DEF) : [nzDrawLog, nzDrawLog, nzDrawFrog, nzDrawKill][L2.step](L2, g, P, ev(), el(L2)),
    steps: [
      { enter: () => { note(); },
        say: () => { const e = ev(); return P.clean ? 'Three events in order, minutes apart: all three attacks, almost no noise.' : !e.loud ? 'Nothing caught. Choose which events the rule looks for.' : e.fp > 1 ? e.loud + ' of 3 caught, and ' + e.fp + ' false alarms. Analysts will mute this rule. Tighten it.' : e.loud + ' of 3 caught. Keep going.'; },
        side: L2 => [h('span', { class: 'labk' }, 'Alert when one session shows, in order'), condBtns(L2),
          axRange(L2, P, 'win', 'All within', () => P.clean, () => { note(); return P.win + ' min'; }, 30)],
        acts: L2 => [labNext(L2, 'The attacker adapts →', !P.clean)] },
      { enter: () => { note(); },
        say: () => { const e = ev(); return P.solved ? 'A document nobody should open, opened: all three campaigns, no noise, any speed.' : P.noisy ? 'Caught, with ' + e.fp + ' false alarms: across a week, ordinary people do all three things. Add a tripwire and tighten the window again.' : e.slow < 3 ? 'Three more campaigns: one step a day, in separate sessions. Your rule sees ' + e.slow + ' of 3. Widen it.' : 'Keep going.'; },
        side: L2 => [h('span', { class: 'labk' }, 'Rule scope'),
          h('div', { class: 'labprompts' }, [['session', 'One session, minutes'], ['user', 'One user, days']].map(([k, t]) => h('button', { type: 'button', class: 'labp' + (P.scope === k ? ' on' : ''), onclick: () => { P.scope = k; note(); L2.repaint(); } }, t))),
          P.scope === 'user' ? axRange(L2, P, 'days', 'All within', () => P.solved, () => { note(); return Math.max(1, P.days) + ' day' + (P.days <= 1 ? '' : 's'); }, 7) : null,
          labBtn((P.honey ? '■' : '□') + ' Or: a honeytoken document is retrieved', () => { P.honey = !P.honey; note(); L2.repaint(); }, P.honey ? 'on' : '')],
        acts: L2 => [labNext(L2, 'Baselines →', !P.solved)] },
      { enter: () => { noteF(); },
        say: () => { const f = frog(); return P.capped ? 'The cap fired on day ' + f.capDay + '. It cannot be taught, because it never learns.' : P.evaded ? 'No alert in 60 days, and usage is ' + f.final.toFixed(1) + ' times normal. The baseline learned the attack. Add a hard cap.' : f.alert >= 0 ? 'Caught on day ' + f.alert + '. You are the attacker: slow the ramp until the baseline follows you up.' : 'No alert, but only ' + f.final.toFixed(1) + '× growth. Push harder without tripping it.'; },
        side: L2 => [axRange(L2, P, 'rt', 'Attacker’s daily ramp', () => P.capped, noteF, 60),
          labBtn((P.cap ? '■' : '□') + ' Hard cap at 3× the launch baseline', () => { P.cap = !P.cap; noteF(); L2.repaint(); }, P.cap ? 'on' : '')],
        acts: L2 => [labNext(L2, 'Stop it →', !P.capped)] },
      { say: L2 => !P.killUi ? 'Detected. The agent is misbehaving right now: five runs in flight, six jobs queued. Pull the switch.' : !P.killGw ? 'Chat is off, and the agent is still calling tools. Count the red ticks, then move the switch to the gateway and pull again.' : 'Credentials revoked at the gateway: zero calls after the switch, whatever was running.',
        side: L2 => [h('span', { class: 'labk' }, 'Where the switch acts'),
          h('div', { class: 'labprompts' }, [['ui', 'Stop new chats'], ['gw', 'Revoke at the tool gateway']].map(([k, t]) => h('button', { type: 'button', class: 'labp' + (P.mode === k ? ' on' : ''), onclick: () => { P.mode = k; P.killAt = -99; L2.repaint(); } }, t))),
          labBtn('⏻ KILL', () => { P.killAt = L2.t; if (P.mode === 'ui') P.killUi = true; else P.killGw = true; L2.repaint(); }, 'deny')],
        acts: L2 => [labNext(L2, 'Close the paths →', !(P.killUi && P.killGw))] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(NZ_VEC, NZ_DEF, P.on).length; return n ? n + ' paths open. Switch on controls.' : 'All ' + NZ_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, NZ_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Seeing it is step one. Catching the patient version and stopping what is already running are the hard parts.',
        enter: () => labDone('noise'),
        side: () => axDebrief(P, NZ_VEC, NZ_DEF, [
          ['Jun 2025 · EchoLeak', 'The trail was exactly this sequence: outside content read, internal data retrieved, an outbound link carrying it away.'],
          ['May 2024 · LLMjacking', 'Stolen cloud keys ran other people’s models at up to $46,000 a day. Most victims learned from the invoice.'],
          ['Nov 2025 · GTG-1002', 'An AI agent ran most of an espionage campaign at a tempo no analyst queue could match.'],
          ['Jul 2025 · Replit', 'An agent deleted a production database during a freeze: an instruction to stop is not a switch.']],
          ['echoleak', 'gtg1002', 'memory'], 'The week of sessions, the 60-day series and the kill timeline are generated on this page from fixed seeds; every count comes from running your rule against them.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv' }, 'Advanced path →')] }
    ] };
}

/* ---------- drawing ---------- */
function nzDrawLog(L, g, P, e) {
  const pad = 14, top = 50, slow = L.step === 1, n = NZ_LOG.length, cols = L.w > 720 ? 45 : 27, rows = Math.ceil(n / cols), cw = (L.w - pad * 2) / cols, ch = Math.min(86, (L.h - top - 60) / rows), colOf = { ext: LC.blue, sens: LC.ink, out: LC.violet, honey: LC.good };
  labText(g, 'ONE WEEK · ' + n + ' AGENT SESSIONS · EACH COLUMN IS A SESSION', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  NZ_KINDS.concat(slow ? [['honey', 'Honeytoken retrieved', 'good']] : []).forEach(([k, t], i) => { const x = pad + i * Math.min(210, (L.w - pad * 2) / 4); g.fillStyle = lc(colOf[k], 1); g.fillRect(x, 34, 8, 8); labText(g, t, x + 12, 42, { size: 10, mono: false, col: lc(LC.mute, 1) }); });
  NZ_LOG.forEach((s2, k) => { const x = pad + (k % cols) * cw, y = top + Math.floor(k / cols) * ch, hit = e.hit.has(s2.id), show = s2.atk === 'loud' || (slow && s2.atk === 'slow');
    g.fillStyle = hit ? lc(show ? LC.good : LC.bad, 0.2) : 'rgba(141,182,242,.04)'; g.fillRect(x + 1, y + 1, cw - 2, ch - 6);
    if (hit) { g.strokeStyle = lc(show ? LC.good : LC.bad, 0.95); g.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 7); }
    s2.ev.forEach(v => { g.fillStyle = lc(colOf[v.t], 0.95); const r = Math.max(2, Math.min(4.5, cw * 0.22)); g.beginPath(); g.arc(x + cw / 2, y + 6 + (ch - 18) * v.m / 30, r, 0, 7); g.fill(); });
    if (show) labText(g, s2.atk === 'slow' ? '◆' : '▲', x + cw / 2, y + ch - 8, { size: Math.min(11, cw * 0.6), align: 'center', col: lc(hit ? LC.good : LC.bad, 1) }); });
  const y = L.h - 24;
  labText(g, '▲ loud attack ' + e.loud + '/3 caught' + (slow ? '   ◆ slow campaign ' + e.slow + '/3 caught' : '') + '   ▢ red: false alarm × ' + e.fp, pad, y, { size: 12, w: 700, col: lc(e.fp > 1 ? LC.bad : LC.good, 1) });
}
function nzDrawFrog(L, g, P) {
  const f = nzFrog(P.rt / 200, P.cap), x0 = 56, x1 = L.w - 24, y0 = L.h - 48, y1 = 56, mx = Math.max(400, Math.min(2000, f.final * 110)), X = d => x0 + (x1 - x0) * d / 59, Yv = v => y0 + (y1 - y0) * Math.min(1, v / mx);
  labText(g, 'TOKENS PER DAY · ONE API KEY · 60 DAYS', x0, 30, { size: 12, w: 700, col: lc(LC.blue, 1) });
  g.strokeStyle = lc(LC.mute, 0.25); [0, 0.25, 0.5, 0.75, 1].forEach(q => { const v = mx * q; g.beginPath(); g.moveTo(x0, Yv(v)); g.lineTo(x1, Yv(v)); g.stroke(); labText(g, (v / 100).toFixed(0) + '×', x0 - 8, Yv(v) + 4, { size: 10, align: 'right' }); });
  [0, 10, 20, 30, 40, 50, 59].forEach(d => labText(g, 'd' + d, X(d), y0 + 18, { size: 10, align: 'center' }));
  g.fillStyle = lc(LC.violet, 0.12); g.beginPath(); g.moveTo(X(0), Yv(0)); f.band.forEach((b, d) => g.lineTo(X(d), Yv(b))); g.lineTo(X(59), Yv(0)); g.closePath(); g.fill();
  g.strokeStyle = lc(LC.violet, 0.8); g.setLineDash([4, 4]); g.beginPath(); f.band.forEach((b, d) => { if (d) g.lineTo(X(d), Yv(b)); else g.moveTo(X(d), Yv(b)); }); g.stroke(); g.setLineDash([]);
  labText(g, 'alert line: baseline + 3σ (learned from the last 14 days)', x0 + 6, y1 - 6, { size: 10, col: lc(LC.violet, 1) });
  g.strokeStyle = lc(LC.bad, 0.95); g.lineWidth = 2.5; g.beginPath(); f.x.forEach((v, d) => { if (d) g.lineTo(X(d), Yv(v)); else g.moveTo(X(d), Yv(v)); }); g.stroke(); g.lineWidth = 1;
  g.strokeStyle = lc(LC.mute, 0.5); g.beginPath(); g.moveTo(X(10), y0); g.lineTo(X(10), y1); g.stroke(); labText(g, 'key stolen', X(10) + 4, y0 - 6, { size: 10 });
  if (P.cap) { g.strokeStyle = lc(LC.good, 0.95); g.beginPath(); g.moveTo(x0, Yv(300)); g.lineTo(x1, Yv(300)); g.stroke(); labText(g, 'hard cap 3×', x1, Yv(300) - 6, { size: 10, align: 'right', col: lc(LC.good, 1) }); }
  if (f.alert >= 0) { labGlow(g, X(f.alert), Yv(f.x[f.alert]), 26, LC.ink, 0.6); labText(g, 'ALERT day ' + f.alert, X(f.alert), Yv(f.x[f.alert]) - 14, { size: 12, w: 700, align: 'center', col: lc(LC.ink, 1) }); }
  if (P.cap && f.capDay >= 0) { labGlow(g, X(f.capDay), Yv(300), 26, LC.good, 0.6); labText(g, 'CAP day ' + f.capDay, X(f.capDay), Yv(300) + 22, { size: 12, w: 700, align: 'center', col: lc(LC.good, 1) }); }
  if (f.alert < 0) axStamp(g, (x0 + x1) / 2, y1 + 40, f.final.toFixed(1) + '× AND NO ALERT', LC.bad, 1, L.w > 720 ? 20 : 14);
}
function nzDrawKill(L, g, P, e, el) {
  const pad = 16, top = 54, lanes = NZ_RUNS.length + NZ_JOBS.length, lh = Math.min(34, (L.h - top - 50) / lanes), x0 = pad + 110, x1 = L.w - pad, T = 16, X = t => x0 + (x1 - x0) * Math.min(1, t / T), gw = P.mode === 'gw', now = el < 0 ? 0 : Math.min(T, el);
  labText(g, 'AFTER THE SWITCH · EACH TICK IS ONE TOOL CALL', pad, 28, { size: 12, w: 700, col: lc(LC.blue, 1) });
  [0, 4, 8, 12, 16].forEach(t => labText(g, '+' + t + 's', X(t), top - 8, { size: 10, align: 'center' }));
  const lane = (i, name, from, to, col) => { const y = top + i * lh; labText(g, name, pad, y + lh / 2 + 4, { size: 11, col: lc(LC.mute, 1) });
    g.fillStyle = 'rgba(141,182,242,.06)'; g.fillRect(x0, y + 4, x1 - x0, lh - 10);
    if (el >= 0 && !gw) { g.fillStyle = lc(col, 0.22); g.fillRect(X(from), y + 4, Math.max(0, X(Math.min(now, to)) - X(from)), lh - 10);
      for (let t = from + 1; t <= Math.min(now, to); t++) { g.fillStyle = lc(LC.bad, 1); g.fillRect(X(t) - 1.5, y + 2, 3, lh - 6); } } };
  NZ_RUNS.forEach((d, i) => lane(i, 'run in flight ' + (i + 1), 0, d, LC.ink));
  NZ_JOBS.forEach((t0, i) => lane(NZ_RUNS.length + i, 'queued job ' + (i + 1), t0, t0 + 3, LC.violet));
  g.strokeStyle = lc(gw ? LC.good : LC.bad, 1); g.lineWidth = 2; g.beginPath(); g.moveTo(X(0), top - 2); g.lineTo(X(0), top + lanes * lh); g.stroke(); g.lineWidth = 1;
  if (el >= 0) { g.strokeStyle = lc(LC.text, 0.6); g.beginPath(); g.moveTo(X(now), top); g.lineTo(X(now), top + lanes * lh); g.stroke();
    axStamp(g, L.w / 2, L.h - 40, gw ? '0 TOOL CALLS AFTER THE SWITCH' : nzKill('ui', el) + ' TOOL CALLS AFTER THE SWITCH', gw ? LC.good : LC.bad, 1, L.w > 720 ? 20 : 13); }
}

NN_SIMS.push({ id: 'noise', title: 'Find it in the noise', kicker: 'SOC · detection · baselines · kill switches', blurb: 'Write a detection over a week of agent sessions and count catches against false alarms, chase an attacker who spreads three steps across days, play the attacker against a learned baseline, then pull a kill switch and count what still runs.', mount: nzMount,
  brief: { what: 'A SOC that already receives AI telemetry still has to turn it into decisions. Single events are too common to alert on, patient attackers stay under any time window, learned baselines can be taught by the thing they watch, and switching off a chat window does not stop an agent that is mid-task.',
    real: 'EchoLeak (2025) left a three-step trail that no malware rule reads. LLMjacking (2024) grew stolen-key usage until Finance noticed. In 2025 an agent kept acting through a code freeze it had been told about eleven times.',
    todo: ['Build a rule that catches three attacks without waking the room', 'Catch the slow version, then play the attacker against a learned baseline', 'Pull the kill switch in two places and count the tool calls after it'] },
  guide: [
    { look: [['blue', '●', 'Dots: events in a session, top to bottom over 30 minutes.'], ['bad', '▢', 'Red box: your rule fired on an innocent session.'], ['good', '▲', 'A real attack.']],
      why: 'Each event alone is ordinary work. The attack is the order and the speed. A rule on one event buys every false alarm in the building.' },
    { look: [['bad', '◆', 'Slow campaign: one step a day.'], ['good', '●', 'Green dot: a honeytoken was retrieved.']],
      why: 'Widening the window to catch patience also catches everyone’s normal week. A tripwire needs no window: it is a thing no legitimate session ever does.' },
    { look: [['bad', '—', 'Red: actual usage.'], ['violet', '┄', 'Violet: the learned alert line.'], ['good', '—', 'Green: the fixed cap.']],
      why: 'A trailing baseline is trained by its own input. Grow slowly enough and yesterday’s abuse is today’s normal. Only a limit that does not learn stays put.' },
    { look: [['ink', '▬', 'Runs already in flight.'], ['violet', '▬', 'Queued jobs.'], ['bad', '|', 'Each red tick: a tool call after the switch.']],
      why: 'A switch on the interface stops people starting things. The agent’s authority lives at the tool gateway: revoke it there and everything stops at once.' },
    { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']],
      why: 'Detection, baselining and stopping fail in different ways and need different fixes.' },
    { why: 'Three numbers to bring back: false alarms per week on your AI rules, your hard caps, and tool calls after your last kill-switch drill.' }] });
NN_BY.noise = NN_SIMS[NN_SIMS.length - 1];
