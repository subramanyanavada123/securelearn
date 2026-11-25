'use strict';
/* AI Security Operations instruments 1–3: telemetry and the SIEM, detection
   engineering, baselines and agent behaviour. For operations engineers:
   budgets, queues and settings, no code. Engines live in ops-data.js. */

const OPC = { ok: LC.good, bad: LC.bad, warn: LC.ink, info: LC.blue, mute: LC.mute };
const opTone = ok => ok ? LC.good : LC.bad;
// A row of option chips for one setting; v is the current value.
function opSeg(label, opts, v, fn) { return [h('span', { class: 'labk' }, label), h('div', { class: 'labchipset' }, opts.map(([k, t]) => gvChip(t, v === k, () => fn(k))))]; }
function opBack(id) { return h('a', { class: 'labbtn go', href: '#adv-ops' }, 'AI SecOps →'); }

/* ====================== 1 · What did the logs see? ====================== */
const OPT_VEC = [{ id: 'applog', name: 'Only web and network logs collected' }, { id: 'sample', name: 'AI events sampled away' }, { id: 'redact', name: 'Evidence deleted as personal data' },
  { id: 'retain', name: 'Retention shorter than the dwell time' }, { id: 'blob', name: 'Fields never parsed, so nothing joins' }, { id: 'svc', name: 'Every action under one service account' }];
const OPT_DEF = [
  { id: 'schema', name: 'An AI telemetry standard for every agent', how: 'Retrieval, tool-call, answer-link and version fields, in one schema', kills: ['applog', 'blob'] },
  { id: 'tier', name: 'Tiered collection', how: 'All metadata at 100%; full transcripts sampled or on demand', kills: ['sample'] },
  { id: 'token', name: 'Tokenise, don’t delete', how: 'Keyed hashes keep joins; break-glass to reveal, logged', kills: ['redact'] },
  { id: 'keep', name: 'Retention set from dwell time', how: 'Hot for 30+ days, cold for a year; checked against real incidents', kills: ['retain'] },
  { id: 'obo', name: 'On-behalf-of identity on every call', how: 'The person, the agent and the session, not just svc-relay', kills: ['svc'] }];
const OPT_GROUPS = [{ name: 'Collection', col: 'ink', ids: ['applog', 'sample', 'svc'], act: 'A green dashboard during a 19-day leak' },
  { name: 'Pipeline', col: 'bad', ids: ['redact', 'retain', 'blob'], act: 'Collected, then lost before anyone asked' }];

/* ---------- touch the picture: hotspots, hover tips, click and drag ---------- */
// Draw functions register regions every frame: { id, x, y, r } or { id, x, y, w, h }, with tip ([title, body] or a function), act(L), drag(L, x, y).
function opHot(P, o) { P.hot.push(o); return o; }
const opHit = (P, x, y) => (P.hot || []).slice().reverse().find(o => o.r != null ? Math.hypot(o.x - x, o.y - y) <= o.r + 5 : x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
const opHov = (P, id) => P.hov === id || (P.drag && P.drag.id === id);
function opPointer(P) {
  return {
    move: (L, x, y, down) => {
      if (!P.bound) { P.bound = true; L.cv.addEventListener('pointerleave', () => { P.mx = -999; }); window.addEventListener('pointerup', () => { const d = P.drag; P.drag = null; if (d && d.drop && LAB.L === L) d.drop(L, P.mx, P.my); }); }
      P.mx = x; P.my = y; if (down && P.drag && P.drag.drag) { P.drag.drag(L, x, y); return; }
      const o = opHit(P, x, y); L.cv.style.cursor = !o ? 'default' : o.drag ? 'grab' : o.act ? 'pointer' : 'help'; },
    down: (L, x, y) => { P.mx = x; P.my = y; const o = opHit(P, x, y); if (!o) return; if (o.drag) { P.drag = o; o.drag(L, x, y); } else if (o.act) o.act(L); } };
}
// One frame: clear the hotspots, draw, then the tip for whatever is under the pointer.
function opFrame(L, g, P, fn) {
  P.hot = []; fn(); const o = P.mx > -900 ? opHit(P, P.mx, P.my) : null; P.hov = o ? o.id : null; if (o) P.felt = true;
  if (!P.felt && P.hot.length && L.step < 3) { const a = NN.sync ? 1 : 0.55 + 0.25 * Math.sin(L.t * 2.4); labText(g, '◉ hover anything · click to change it', L.w - 16, L.h - 12, { size: 11, w: 600, mono: false, align: 'right', col: lc(LC.ink, a) }); }
  if (!o || !o.tip || (P.drag && P.drag.drag)) return; const tp = typeof o.tip === 'function' ? o.tip() : o.tip; if (!tp) return;
  const [t, b] = Array.isArray(tp) ? tp : [tp, ''], w = 290; g.font = "600 12px 'IBM Plex Sans', sans-serif"; const ls = b ? piWrap(g, b, w - 24).slice(0, 6) : [];
  const hh = 34 + ls.length * 17, x = Math.min(L.w - w - 8, P.mx + 16), y = Math.min(L.h - hh - 8, P.my + 18);
  opRR(g, x, y, w, hh, 10); g.fillStyle = 'rgba(8,13,28,.96)'; g.fill(); g.strokeStyle = lc(LC.ink, 0.6); g.stroke();
  labText(g, t, x + 12, y + 21, { size: 13, w: 700, mono: false, col: lc(LC.ink, 1) }); ls.forEach((s2, i) => labText(g, s2, x + 12, y + 40 + i * 17, { size: 12, mono: false, col: lc(LC.text, 0.92) }));
}
// A clickable pill on the canvas.
function opBtn(P, g, id, t, x, y, col, on, act, tip, fs) { const w = opPill(g, t, x, y, col, on || opHov(P, id), fs || 12), hh = (fs || 12) * 2; opHot(P, { id, x, y: y - hh / 2, w, h: hh, act, tip }); return w; }

/* ---------- a small visual kit: nodes, lamps, flows, gauges ---------- */
function opRR(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// A node: lit (filled and glowing) or dark (a dashed ring). mark is drawn inside.
function opNode(g, x, y, r, col, lit, mark) {
  if (lit) { labGlow(g, x, y, r * 2.6, col, 0.3); g.fillStyle = lc(col, 0.95); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  else { g.fillStyle = 'rgba(11,18,38,.85)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = lc(col, 0.75); g.lineWidth = 1.6; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.setLineDash([]); g.lineWidth = 1; }
  if (mark) labText(g, mark, x, y + r * 0.36, { size: Math.round(r * 0.95), w: 700, align: 'center', col: lit ? '#0B1226' : lc(col, 1) });
}
// A label under or over something: sans, centred.
function opLbl(g, t, x, y, col, size, w) { labText(g, t, x, y, { size: size || 12, w: w || 600, mono: false, align: 'center', col: col || lc(LC.text, 0.9) }); }
function opCap(g, t, x, y, col, align) { labText(g, t, x, y, { size: 10, w: 700, align: align || 'left', col: col || lc(LC.mute, 1) }); }
// Particles flowing along a polyline. Static in headless runs.
function opFlow(L, g, pts, col, n, sp, r, a) {
  if (NN.sync) return; const seg = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
  for (let k = 0; k < n; k++) { let d = ((L.t * (sp || 60) + k * tot / n) % tot), i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const f = seg[i] ? d / seg[i] : 0, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
    g.fillStyle = lc(col, a || 0.9); g.beginPath(); g.arc(x, y, r || 2.6, 0, 7); g.fill(); }
}
// A ring gauge; f in 0..1. A tick marks the limit if given.
function opRing(g, x, y, r, f, col, lw, lim) {
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5; g.lineCap = 'round'; g.lineWidth = lw || 8;
  g.strokeStyle = 'rgba(141,182,242,.12)'; g.beginPath(); g.arc(x, y, r, a0, a0 + span); g.stroke();
  g.strokeStyle = lc(col, 0.95); g.beginPath(); g.arc(x, y, r, a0, a0 + span * Math.max(0.001, Math.min(1, f))); g.stroke();
  if (lim != null) { const a = a0 + span * lim; g.strokeStyle = lc(LC.text, 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(x + Math.cos(a) * (r - 9), y + Math.sin(a) * (r - 9)); g.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9)); g.stroke(); }
  g.lineCap = 'butt'; g.lineWidth = 1;
}
// A big number with a small key over it.
function opBig(g, v, k, x, y, col, size, align) { opCap(g, k, x, y - (size || 34) - 6, null, align); labText(g, v, x, y, { size: size || 34, w: 700, align: align || 'left', col: lc(col, 1) }); }
// A rounded pill with text; returns its width.
function opPill(g, t, x, y, col, on, fs) {
  fs = fs || 11; g.font = '600 ' + fs + "px 'IBM Plex Sans', sans-serif"; const w = g.measureText(t).width + fs * 1.6, hh = fs * 2;
  opRR(g, x, y - hh / 2, w, hh, hh / 2); g.fillStyle = lc(col, on ? 0.22 : 0.06); g.fill(); g.strokeStyle = lc(col, on ? 0.9 : 0.35); g.stroke();
  labText(g, t, x + w / 2, y + fs * 0.36, { size: fs, mono: false, align: 'center', col: lc(on ? LC.text : LC.mute, 1) }); return w;
}
const opIn = (L, P, k) => NN.sync ? 1 : Math.max(0, Math.min(1, (L.t - P.at) * (k || 3)));

function optMount(L) {
  const P = { sel: { gw: true, egress: true }, pipe: Object.assign({}, OP_PIPE0), touched: new Set(), asked: new Set(), q: null, on: {}, flash: {}, at: -9 };
  const nAns = () => OP_Q.filter(q => opAnswered(P.sel, q)).length, gb = () => opGb(P.sel), pipe = () => opPipe(P.pipe);
  return { P, ...opPointer(P),
    hud: () => [
      [['INGEST', () => gb().toFixed(1) + ' / ' + OP_BUDGET + ' GB', gb() > OP_BUDGET ? 'bad' : 'good'], ['ANSWERS', () => nAns() + '/6', nAns() === 6 ? 'good' : 'bad']],
      [['ANSWERS SURVIVE', () => pipe().ok.length + '/6', pipe().ok.length === 6 ? 'good' : 'bad'], ['PRIVACY', () => pipe().privacy ? 'protected' : 'raw PII', pipe().privacy ? 'good' : 'bad']],
      [['ASKED', () => P.asked.size + '/6']],
      axDefHud(P, OPT_VEC, OPT_DEF), axDefHud(P, OPT_VEC, OPT_DEF)][L.step],
    draw: (L2, g) => opFrame(L2, g, P, () => L2.step >= 3 ? axDrawDefend(L2, g, P, OPT_GROUPS, OPT_VEC, OPT_DEF) : [optDrawSources, optDrawPipe, optDrawSiem][L2.step](L2, g, P)),
    steps: [
      { say: () => gb() > OP_BUDGET ? 'Over budget. Full prompts alone are 38 GB.' : nAns() < 6 ? 'Light up the leak. You have 25 GB a day.' : 'Six of six answers, for ' + (gb() - 15).toFixed(1) + ' GB more.',
        side: L2 => [h('div', { class: 'labchipset' }, OP_SRC.map(s => gvChip(s.s + ' · ' + s.gb, P.sel[s.id], () => { P.sel[s.id] = !P.sel[s.id]; P.at = L2.t; L2.repaint(); }, s.pii ? 'bad' : '')))],
        acts: L2 => [labNext(L2, 'Now the pipeline →', nAns() < 6 || gb() > OP_BUDGET)] },
      { say: () => { const r = pipe(); return r.ok.length < 6 ? (6 - r.ok.length) + ' answers die in the pipeline. Fix the valves.' : !r.privacy ? 'All six survive, but raw PII sits in the SIEM.' : 'Every default made sense, for web logs.'; },
        side: L2 => [['sample', 'Sampling'], ['redact', 'Personal data'], ['parse', 'Parsing'], ['retain', 'Retention']].map(([k, t]) => opSeg(t, OP_PIPE[k], P.pipe[k], v => { P.pipe[k] = v; P.touched.add(k); P.at = L2.t; L2.repaint(); })),
        acts: L2 => [labNext(L2, 'Ask the SIEM →', !opPipeOk(P.pipe))] },
      { say: () => P.asked.size < 6 ? 'Ask the SIEM the six questions.' : 'Six answers in minutes, not weeks.',
        side: L2 => [h('div', { class: 'labstack' }, OP_Q.map(q => labBtn((P.asked.has(q.id) ? '✓ ' : '▶ ') + q.t, () => { P.q = q.id; P.asked.add(q.id); P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.asked.size < 6)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPT_VEC, OPT_DEF, P.on).length; return n ? n + ' ways the evidence goes missing. Switch on controls.' : 'All ' + OPT_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPT_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Know your six questions before the incident.',
        enter: () => labDone('optel'),
        side: () => axDebrief(P, OPT_VEC, OPT_DEF, [
          ['Jul 2023 · Storm-0558', 'Attackers read government email in Microsoft 365 with a forged key. The US State Department spotted it in an audit log that only premium licences included; Microsoft then made those logs standard.'],
          ['Jun 2025 · EchoLeak', 'One email made Microsoft 365 Copilot send internal data out through a link and an image reference. The trail was in what Copilot retrieved and what its answer contained, not in network logs.'],
          ['2024–2025 · OpenTelemetry GenAI', 'Open naming for model, token, prompt and tool-call fields is being standardised, so AI telemetry can land in any SIEM with the same field names.'],
          ['Aug 2022 · OCSF', 'An open schema for security events. Mapping to a schema at ingest is what lets one rule join fields from the agent, the CRM and the proxy.']],
          ['echoleak', 'slackai', 'gtg1002'], 'Volumes and costs are illustrative. Your own will differ; the shape of the trade-off will not.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), opBack()] }
    ] };
}
// The six questions as lamps in a row.
// The six questions as lamps; hovering one lights what it needs.
function optLamps(L, g, P, x, w, y, lit, r, act, tip) {
  OP_Q.forEach((q, i) => { const cx = x + w * (i + 0.5) / 6, on = lit(q), hv = opHov(P, 'q:' + q.id);
    if (hv) labGlow(g, cx, y, r * 3, LC.ink, 0.35); opNode(g, cx, y, r + (hv ? 2 : 0), on ? LC.good : LC.bad, on, on ? '✓' : '?'); opLbl(g, q.s, cx, y + r + 16, lc(on || hv ? LC.text : LC.mute, 1), 12);
    opHot(P, { id: 'q:' + q.id, x: cx, y, r: r + 8, act: act && (L2 => act(L2, q)), tip: tip(q) }); });
}
const optSel = (L, P, id, on) => { P.sel[id] = on == null ? !P.sel[id] : on; P.at = L.t; L.repaint(); };
function optDrawSources(L, g, P) {
  const pad = 26, w = L.w - pad * 2, gb = opGb(P.sel), max = Math.max(OP_BUDGET * 1.5, gb + 2), X = v => pad + w * v / max;
  const hq = P.hov && P.hov.startsWith('q:') && OP_Q.find(q => 'q:' + q.id === P.hov), hs = P.hov && P.hov.startsWith('src:') && P.hov.slice(4), hn = P.hov && P.hov.startsWith('step:') && OP_CHAIN.find(c => 'step:' + c.id === P.hov);
  const lit = id => (hq && hq.need.includes(id)) || (hn && hn.by.includes(id)) || hs === id;
  // the ingest bar
  opCap(g, 'INGEST PER DAY', pad, 22); labText(g, gb.toFixed(1) + ' GB', L.w - pad, 24, { size: 16, w: 700, align: 'right', col: lc(gb > OP_BUDGET ? LC.bad : LC.good, 1) });
  opRR(g, pad, 32, w, 22, 6); g.fillStyle = 'rgba(141,182,242,.07)'; g.fill();
  let v = 0; OP_SRC.filter(s => P.sel[s.id]).forEach(s => { const x0 = X(v), x1 = X(v + s.gb); v += s.gb; g.fillStyle = lc(lit(s.id) ? LC.ink : s.pii ? LC.bad : s.def ? LC.mute : LC.good, s.def && !lit(s.id) ? 0.45 : 0.85); g.fillRect(x0, 33, Math.max(1, x1 - x0 - 2), 20);
    if (x1 - x0 > 70) labText(g, s.s, x0 + 6, 47, { size: 10, w: 700, mono: false, col: '#0B1226' });
    opHot(P, { id: 'src:' + s.id, x: x0, y: 30, w: Math.max(6, x1 - x0), h: 26, act: L2 => optSel(L2, P, s.id, false), tip: [s.t + ' · ' + s.gb + ' GB', s.d + '. Click to drop it.'] }); });
  g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 2; g.beginPath(); g.moveTo(X(OP_BUDGET), 26); g.lineTo(X(OP_BUDGET), 60); g.stroke(); g.lineWidth = 1; opCap(g, 'BUDGET 25', X(OP_BUDGET), 72, lc(LC.ink, 1), 'center');
  // the shelf: every source, click to collect
  let sx0 = pad, sy = 100; opCap(g, 'COLLECT', pad, sy - 14);
  OP_SRC.forEach(s => { g.font = "600 12px 'IBM Plex Sans', sans-serif"; const pw = g.measureText(s.s + ' ' + s.gb).width + 19.2; if (sx0 + pw > L.w - pad) { sx0 = pad; sy += 30; }
    const on = !!P.sel[s.id], col = lit(s.id) ? LC.ink : s.pii ? LC.bad : on ? LC.good : LC.blue;
    opBtn(P, g, 'src:' + s.id, s.s + ' ' + s.gb, sx0, sy + 4, col, on || lit(s.id), L2 => optSel(L2, P, s.id), [s.t + ' · ' + s.gb + ' GB a day', s.d + (s.pii ? '. Holds personal data in full.' : '.') + ' Sees: ' + (OP_CHAIN.filter(c => c.by.includes(s.id)).map(c => c.s).join(', ') || 'nothing in this incident')]); sx0 += pw + 8; });
  // what the dashboard said: a flat green heartbeat
  const ty = Math.max(sy + 150, L.h * 0.5), steps = OP_CHAIN.filter(c => !c.noise), n = steps.length, sx = i => pad + 30 + (w - 60) * i / (n - 1), dy = ty - 82;
  opCap(g, 'DASHBOARD', pad, dy - 12, lc(LC.good, 0.8)); g.strokeStyle = lc(LC.good, 0.45); g.beginPath();
  for (let x = pad; x <= L.w - pad; x += 4) { const k = ((x - pad) / 46 + L.t * (NN.sync ? 0 : 1.2)) % 1; g.lineTo(x, dy + (k < 0.08 ? -6 * Math.sin(k / 0.08 * Math.PI) : 0)); } g.stroke();
  labText(g, '200 OK · all 19 days', L.w - pad, dy - 12, { size: 11, w: 600, mono: false, align: 'right', col: lc(LC.good, 0.8) });
  opHot(P, { id: 'dash', x: pad, y: dy - 26, w, h: 34, tip: ['Gateway and proxy', 'Status 200, normal latency, normal volume, every day of the leak. Seen, and useless.'] });
  // the incident, a lit or dark node per step
  g.strokeStyle = 'rgba(141,182,242,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx(0), ty); g.lineTo(sx(n - 1), ty); g.stroke(); g.lineWidth = 1;
  opFlow(L, g, [[sx(0), ty], [sx(n - 1), ty]], LC.bad, 3, 110, 3.4);
  steps.forEach((c, i) => { const seen = opSeen(P.sel, c), x = sx(i), col = c.dark ? LC.violet : seen ? LC.good : LC.bad, hv = opHov(P, 'step:' + c.id) || (hs && c.by.includes(hs)) || (hq && c.by.some(id => hq.need.includes(id)));
    if (hv) { g.strokeStyle = lc(LC.ink, 0.9); g.lineWidth = 2; g.beginPath(); g.arc(x, ty, 27, 0, 7); g.stroke(); g.lineWidth = 1; }
    opCap(g, c.when.replace(' →', ''), x, ty - 34, lc(LC.mute, 0.9), 'center'); opNode(g, x, ty, 19, col, seen, seen ? '✓' : String(i + 1));
    opLbl(g, c.s, x, ty + 44, lc(seen || hv ? LC.text : LC.mute, 1), 13, 700);
    const who = c.dark ? 'nobody' : c.by.filter(id => P.sel[id]).map(id => OP_SRC_BY[id].s).join(' · ') || 'dark';
    opLbl(g, who, x, ty + 61, lc(c.dark ? LC.violet : seen ? LC.good : LC.bad, 0.85), 10, 600);
    const pick = c.by.filter(id => !P.sel[id]).sort((a2, b2) => OP_SRC_BY[a2].gb - OP_SRC_BY[b2].gb)[0];
    opHot(P, { id: 'step:' + c.id, x, y: ty, r: 24, act: !seen && pick ? L2 => optSel(L2, P, pick, true) : null,
      tip: [c.when.replace(' →', '') + ' · ' + c.s, c.t + '. ' + (c.dark ? c.dark : seen ? 'Seen by ' + who + '.' : 'Seen by: ' + c.by.map(id => OP_SRC_BY[id].s).join(' or ') + '. Click to collect ' + OP_SRC_BY[pick].s + '.')] }); });
  // the six questions
  const qy = Math.max(ty + 140, L.h - 64); opCap(g, 'THE SIX QUESTIONS', pad, qy - 38);
  optLamps(L, g, P, pad, w, qy, q => opAnswered(P.sel, q), 16, (L2, q) => { q.need.forEach(id => { P.sel[id] = true; }); P.at = L2.t; L2.repaint(); },
    q => [q.t, 'Needs ' + q.need.map(id => OP_SRC_BY[id].s).join(' + ') + (opAnswered(P.sel, q) ? '. Answerable.' : '. Click to collect them.')]);
}
const OPT_STAGE = [['sample', 'SAMPLING'], ['redact', 'PERSONAL DATA'], ['parse', 'PARSING'], ['retain', 'RETENTION']];
function optDrawPipe(L, g, P) {
  const r = opPipe(P.pipe), pad = 26, x0 = pad + 96, x1 = L.w - pad - 120, lane = Math.min(34, (L.h - 190) / 6), top = Math.max(90, (L.h - lane * 6) / 2), bot = top + lane * 6;
  const st = OPT_STAGE, vx = i => x0 + (x1 - x0) * (i + 0.6) / 4.2, hv = P.hov || '';
  opRR(g, x0 - 6, top - 10, x1 - x0 + 12, bot - top + 20, 16); g.fillStyle = 'rgba(141,182,242,.06)'; g.fill(); g.strokeStyle = 'rgba(141,182,242,.3)'; g.lineWidth = 1.5; g.stroke(); g.lineWidth = 1;
  opCap(g, 'SOURCES', pad, top - 22); opCap(g, 'SIEM', x1 + 30, top - 22);
  st.forEach(([k, t], i) => { const x = vx(i), kills = OP_Q.filter(q => r.at[q.id] && r.at[q.id][0] === k), priv = k === 'redact' && !r.privacy, col = kills.length || priv ? LC.bad : LC.good, on = hv === 'v:' + k;
    const opts = OP_PIPE[k], cur = opts.findIndex(o => o[0] === P.pipe[k]);
    g.fillStyle = lc(col, on ? 1 : 0.8); opRR(g, x - (on ? 8 : 5), top - 18, on ? 16 : 10, bot - top + 36, 5); g.fill(); labGlow(g, x, top - 18, on ? 30 : 18, col, 0.4);
    opCap(g, t, x, top - 34, lc(col, 1), 'center');
    // the setting, as a dial of its options
    opts.forEach((o, j) => { const oy = bot + 40 + j * 22, sel = j === cur; opLbl(g, (sel ? '● ' : '○ ') + o[1], x, oy, lc(sel ? LC.text : LC.mute, sel ? 1 : 0.7), sel ? 12 : 11, sel ? 700 : 500);
      opHot(P, { id: 'o:' + k + j, x: x - 70, y: oy - 14, w: 140, h: 20, act: L2 => { P.pipe[k] = o[0]; P.touched.add(k); P.at = L2.t; L2.repaint(); }, tip: null }); });
    opHot(P, { id: 'v:' + k, x: x - 16, y: top - 44, w: 32, h: bot - top + 66, act: L2 => { P.pipe[k] = opts[(cur + 1) % opts.length][0]; P.touched.add(k); P.at = L2.t; L2.repaint(); },
      tip: [t.charAt(0) + t.slice(1).toLowerCase() + ': ' + opts[cur][1], (kills.length ? 'Kills ' + kills.map(q => q.s).join(', ') + '. ' : priv ? 'Raw personal data reaches the SIEM. ' : 'Nothing lost here. ') + 'Click to turn the valve.'] }); });
  OP_Q.forEach((q, i) => { const y = top + lane * (i + 0.5), cut = r.at[q.id], end = cut ? vx(st.findIndex(s2 => s2[0] === cut[0])) - 8 : x1 + 18, on = hv === 'lane:' + q.id || (cut && hv === 'v:' + cut[0]);
    labText(g, q.s, x0 - 14, y + 4, { size: 12, w: on ? 700 : 600, mono: false, align: 'right', col: lc(on ? LC.ink : LC.text, 0.95) });
    g.strokeStyle = lc(cut ? LC.bad : LC.blue, on ? 0.7 : 0.22); g.lineWidth = on ? 2 : 1; g.beginPath(); g.moveTo(x0, y); g.lineTo(end, y); g.stroke(); g.lineWidth = 1;
    opFlow(L, g, [[x0, y], [end, y]], cut ? LC.bad : LC.blue, 4, 70 + i * 6, 3);
    if (cut) { labText(g, '✕', end + 8, y + 5, { size: 14, w: 700, align: 'center', col: lc(LC.bad, 1) }); labText(g, cut[1], end + 20, y + 4, { size: 10, w: 600, col: lc(LC.bad, 0.9) }); }
    opNode(g, x1 + 46, y, Math.min(10, lane / 2 - 3), cut ? LC.bad : LC.good, !cut, cut ? '' : '✓');
    opHot(P, { id: 'lane:' + q.id, x: pad, y: y - lane / 2, w: x0 - pad, h: lane, tip: [q.t, cut ? r.lost[q.id] + '.' : 'Survives to the SIEM.'] }); });
  if (!r.privacy) axStamp(g, (x0 + x1) / 2, top - 70, 'RAW PII IN THE SIEM', LC.bad, L.t - P.at - 0.2, L.w > 720 ? 16 : 11);
}
function optDrawSiem(L, g, P) {
  const pad = 26, w = L.w - pad * 2, q = P.q && OP_Q.find(x => x.id === P.q);
  optLamps(L, g, P, pad, w, 40, x => P.asked.has(x.id), 14, (L2, x) => { P.q = x.id; P.asked.add(x.id); P.at = L2.t; L2.repaint(); }, x => [x.t, 'Click to ask the SIEM.']);
  if (!q) { opLbl(g, 'Click a question', L.w / 2, L.h / 2, lc(LC.mute, 1), 18); return; }
  const k = opIn(L, P, 2.5), cy = L.h * 0.58, fx = pad + 40, ax = pad + w * 0.42, aw = w * 0.58 - 20;
  labText(g, q.t, L.w / 2, 130, { size: 24, w: 700, mono: false, align: 'center', col: lc(LC.ink, 1) });
  q.f.forEach((f, i) => { const y = cy + (i - (q.f.length - 1) / 2) * 46; g.globalAlpha = Math.min(1, k * 2);
    const pw = opPill(g, f, fx, y, LC.blue, true, 12), src = OP_SRC.find(s2 => q.need.includes(s2.id) && f.startsWith(s2.id === 'kb' ? 'kb' : s2.id === 'retr' ? 'retrieval' : s2.id === 'tool' ? 'tool' : s2.id === 'meta' ? 'answer' : s2.id === 'obo' ? 'user' : s2.id === 'ver' ? 'model' : '§'));
    opHot(P, { id: 'f:' + f, x: fx, y: y - 12, w: pw, h: 24, tip: [f, 'A parsed, named field' + (src ? ' from the ' + src.t.toLowerCase() : '') + '. The SIEM joins on it.'] });
    g.strokeStyle = lc(LC.blue, 0.6); g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx + pw + 4, y); g.bezierCurveTo((fx + pw + ax) / 2, y, (fx + pw + ax) / 2, cy, ax, cy); g.stroke(); g.lineWidth = 1; g.globalAlpha = 1;
    opFlow(L, g, [[fx + pw + 4, y], [(fx + pw + ax) / 2, (y + cy) / 2], [ax, cy]], LC.blue, 2, 60, 2.4); });
  if (k < 0.6) return; g.globalAlpha = Math.min(1, (k - 0.6) * 3);
  opRR(g, ax, cy - 56, aw, 112, 14); g.fillStyle = lc(LC.good, 0.1); g.fill(); g.strokeStyle = lc(LC.good, 0.7); g.stroke(); labGlow(g, ax, cy, 40, LC.good, 0.25);
  gvWrap(g, q.ans[0], ax + 20, cy - 14, aw - 40, { size: 18, w: 700, col: lc(LC.text, 1), max: 2 });
  gvWrap(g, q.ans[1], ax + 20, cy + 32, aw - 40, { size: 13, col: lc(LC.good, 0.95), max: 1 }); g.globalAlpha = 1;
}

/* ====================== 2 · The alert queue ====================== */
const OPD_VEC = [{ id: 'kw', name: 'Keyword list as the detection' }, { id: 'input', name: 'Only the customer’s message scanned' }, { id: 'flood', name: 'More alerts than analysts' },
  { id: 'adapt', name: 'Classifier evaded after release' }, { id: 'noreg', name: 'Rules never tested against known attacks' }, { id: 'silent', name: 'A rule silently stopped firing' }];
const OPD_DEF = [
  { id: 'behav', name: 'Behaviour rules on what the agent did', how: 'Sequences, destinations, canaries: they hold when wording changes', kills: ['kw', 'adapt'] },
  { id: 'scan', name: 'Score retrieved text and answers too', how: 'Indirect attacks arrive in documents, not chats', kills: ['input'] },
  { id: 'budget', name: 'An alert budget per rule', how: 'Tuned to analyst capacity, routed by severity', kills: ['flood'] },
  { id: 'replay', name: 'Replay a known-attack set on every change', how: 'Plus a monthly purple-team round', kills: ['noreg', 'adapt'] },
  { id: 'health', name: 'Rule health monitoring', how: 'Alert when a rule goes quiet or a field disappears', kills: ['silent'] }];
const OPD_GROUPS = [{ name: 'What it looks at', col: 'ink', ids: ['kw', 'input', 'adapt'], act: 'Catches the loud jailbreak, misses the planted document' },
  { name: 'How it is run', col: 'bad', ids: ['flood', 'noreg', 'silent'], act: 'The right alert, unread, at the bottom of the queue' }];
const opT = P => 0.5 + 0.49 * P.tv / 100;

function opdMount(L) {
  const P = { pack: Object.assign({}, OP_PACK0), tv: 0, sawUnder: false, w2: false, sawW2: false, on: {}, flash: {}, at: -9 };
  const pk = () => Object.assign({}, P.pack, { t: opT(P) }), run = () => opDetect(pk(), P.w2);
  const note = () => { const r = opDetect(pk()); if (!r.over) P.sawUnder = true; };
  const ruleChip = (L2, k, t) => gvChip(t, P.pack[k], () => { P.pack[k] = !P.pack[k]; note(); P.at = L2.t; L2.repaint(); });
  const slider = L2 => axRange(L2, P, 'tv', 'Classifier threshold', () => { note(); P.at = L2.t - 1; return L2.step === 0 ? P.sawUnder : opPackOk(pk()); }, () => opT(P).toFixed(2), 100);
  // the same controls, from the canvas
  P.toggle = (L2, k) => { P.pack[k] = !P.pack[k]; note(); P.at = L2.t; L2.repaint(); };
  P.setTv = (L2, v) => { P.tv = Math.round(Math.max(0, Math.min(100, v))); note(); P.at = L2.t - 1; const inp = L2.side.querySelector('input[type=range]'); if (inp) { inp.value = P.tv; const o = inp.parentElement.querySelector('b'); if (o) o.textContent = opT(P).toFixed(2); }
    labSoft(L2, L2.step === 0 ? P.sawUnder : opPackOk(pk())); };
  P.week = (L2, w2) => { P.w2 = w2; if (w2) P.sawW2 = true; P.at = L2.t; L2.repaint(); };
  return { P, ...opPointer(P),
    hud: () => [
      [['ALERTS', () => run().alerts + ' / ' + OP_CAP, run().over ? 'bad' : 'good'], ['READ', () => run().triaged + '/14']],
      [['ALERTS', () => run().alerts + ' / ' + OP_CAP, run().over ? 'bad' : 'good'], ['READ', () => run().triaged + '/14', run().triaged >= OP_PACK_TARGET ? 'good' : ''], ['⚑ CAUGHT', () => run().harm + '/6', run().harm === 6 ? 'good' : 'bad']],
      [['WEEK', () => P.w2 ? '2' : '1'], ['CAUGHT', () => run().tp + '/14']],
      axDefHud(P, OPD_VEC, OPD_DEF), axDefHud(P, OPD_VEC, OPD_DEF)][L.step],
    draw: (L2, g) => opFrame(L2, g, P, () => L2.step >= 3 ? axDrawDefend(L2, g, P, OPD_GROUPS, OPD_VEC, OPD_DEF) : L2.step === 2 ? opdDrawWeeks(L2, g, P, pk) : opdDrawQueue(L2, g, P, run())),
    steps: [
      { say: () => { const r = run(); return r.over ? r.alerts + ' alerts. Two analysts read ' + OP_CAP + '. Tune it down.' : 'Inside capacity, but ' + r.harm + ' of 6 ⚑ attacks caught.'; },
        side: L2 => [h('div', { class: 'labchipset' }, ruleChip(L2, 'kw', 'Keywords'), ruleChip(L2, 'clf', 'Classifier')), slider(L2)],
        acts: L2 => [labNext(L2, 'Build a better pack →', !P.sawUnder)] },
      { say: () => opPackOk(pk()) ? 'Inside capacity. Every ⚑ attack caught.' : 'Goal: under ' + OP_CAP + ' alerts, ' + OP_PACK_TARGET + '+ read, all six ⚑ caught.',
        side: L2 => [h('div', { class: 'labchipset' }, OP_RULES.map(r => ruleChip(L2, r[0], r[3]))), slider(L2)],
        acts: L2 => [labNext(L2, 'The attacker adapts →', !opPackOk(pk()))] },
      { enter: () => { P.w2 = false; },
        say: () => !P.sawW2 ? 'Attackers rewrite their prompts. Run week 2.' : 'New wording beat the classifier. Behaviour rules held.',
        side: L2 => [h('div', { class: 'labstack' }, labBtn('Week 1', () => { P.w2 = false; P.at = L2.t; L2.repaint(); }), labBtn('▶ Week 2: prompts rewritten', () => { P.w2 = true; P.sawW2 = true; P.at = L2.t; L2.repaint(); }, 'go'))],
        acts: L2 => [labNext(L2, 'Close the paths →', !P.sawW2)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPD_VEC, OPD_DEF, P.on).length; return n ? n + ' ways detection fails. Switch on controls.' : 'All ' + OPD_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPD_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Detect what the attack does, not how it is worded.',
        enter: () => labDone('opdetect'),
        side: () => axDebrief(P, OPD_VEC, OPD_DEF, [
          ['Feb 2023 · Bing Chat', 'A student’s “ignore previous instructions” made Bing Chat reveal its hidden rules and code name. A canary phrase in the instructions makes that kind of leak detectable.'],
          ['Dec 2023 · A car dealer’s chatbot', 'Users got a dealer’s chatbot to agree to sell a car for $1. Loud, direct and mostly harmless: the kind of attack every keyword list catches.'],
          ['Jun 2025 · EchoLeak', 'Got past Microsoft’s prompt-injection classifiers by addressing the email to a person, not the AI. The outbound reference in the answer was the tell.'],
          ['Dec 2024 · Best-of-N', 'Random capitalisation and typos broke frontier models and their filters at high rates. Content scores fall when the wording changes.']],
          ['sydney', 'guard', 'echoleak', 'bon'], 'Traffic, scores and rates are simulated from a fixed seed, so every run gives the same numbers.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), opBack()] }
    ] };
}
// The day's queue as a waffle, one square per alert; the attacks shine inside it.
function opdDrawQueue(L, g, P, r) {
  const pad = 26, lw = L.w * 0.6 - pad - 100, n = Math.max(r.alerts, OP_CAP), cols = 30, rows = Math.ceil(n / cols), top = 104, avail = L.h - top - 100;
  const c = Math.max(4, Math.min(lw / cols, avail / rows, 22)), gap = c > 8 ? 2 : 1, shown = NN.sync ? n : Math.min(n, Math.floor((L.t - P.at) * 900) + 60);
  labText(g, String(r.alerts), pad, 58, { size: 44, w: 700, col: lc(r.over ? LC.bad : LC.good, 1) });
  g.font = "700 44px 'IBM Plex Mono', monospace"; const nw = g.measureText(String(r.alerts)).width;
  labText(g, 'alerts today', pad + nw + 12, 38, { size: 14, w: 600, mono: false, col: lc(LC.text, 0.9) });
  labText(g, 'the team reads ' + OP_CAP, pad + nw + 12, 58, { size: 14, w: 600, mono: false, col: lc(LC.ink, 1) });
  // the classifier threshold, dragged on the canvas
  const s0 = pad + nw + 190, s1 = Math.max(s0 + 120, pad + cols * c), sy = 52, clf = P.pack.clf, kx = s0 + (s1 - s0) * P.tv / 100, hv = opHov(P, 'thr');
  opCap(g, 'CLASSIFIER THRESHOLD ' + opT(P).toFixed(2) + (clf ? '' : ' · OFF'), s0, 32, lc(clf ? LC.ink : LC.mute, 1));
  g.strokeStyle = lc(clf ? LC.ink : LC.mute, 0.35); g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(s0, sy); g.lineTo(s1, sy); g.stroke(); g.strokeStyle = lc(clf ? LC.ink : LC.mute, 0.9); g.beginPath(); g.moveTo(s0, sy); g.lineTo(kx, sy); g.stroke(); g.lineWidth = 1; g.lineCap = 'butt';
  if (hv) labGlow(g, kx, sy, 24, LC.ink, 0.4); opNode(g, kx, sy, hv ? 10 : 8, clf ? LC.ink : LC.mute, true, '');
  labText(g, 'flags more', s0, sy + 18, { size: 10, w: 600, mono: false, col: lc(LC.mute, 1) }); labText(g, 'flags less', s1, sy + 18, { size: 10, w: 600, mono: false, align: 'right', col: lc(LC.mute, 1) });
  if (clf) opHot(P, { id: 'thr', x: s0 - 10, y: sy - 14, w: s1 - s0 + 20, h: 28, drag: (L2, x) => P.setTv(L2, (x - s0) / (s1 - s0) * 100), tip: ['Drag the threshold', 'Higher: fewer alerts, and only the most attack-like text is flagged.'] });
  // where the caught attacks sit: read ones inside capacity, the rest further down the queue
  const caught = r.atk.filter(a => a.hit.length), spot = {}; let ri = 0, ui = 0; const unread = caught.length - r.triaged;
  caught.forEach((a, i) => { const rd = i < r.triaged; spot[rd ? Math.floor((ri++ + 0.5) * Math.min(r.alerts, OP_CAP) / Math.max(1, r.triaged)) : OP_CAP + Math.floor((ui++ + 0.5) * Math.max(1, r.alerts - OP_CAP) / Math.max(1, unread))] = rd ? 'read' : 'lost'; });
  for (let k = 0; k < shown; k++) { const x = pad + (k % cols) * c, y = top + Math.floor(k / cols) * c, real = k < r.alerts, sp = spot[k];
    g.fillStyle = !real ? 'rgba(141,182,242,.08)' : sp === 'read' ? lc(LC.good, 1) : sp === 'lost' ? lc(LC.ink, 1) : k < OP_CAP ? lc(LC.good, 0.35) : lc(LC.bad, 0.3);
    g.fillRect(x, y, c - gap, c - gap); if (sp) labGlow(g, x + c / 2, y + c / 2, c * 1.8, sp === 'read' ? LC.good : LC.ink, 0.5); }
  const hk = P.hov === 'waffle' ? Math.floor((P.my - top) / c) * cols + Math.floor((P.mx - pad) / c) : -1;
  if (hk >= 0 && hk < n) { g.strokeStyle = lc(LC.text, 1); g.lineWidth = 2; g.strokeRect(pad + (hk % cols) * c - 1, top + Math.floor(hk / cols) * c - 1, c + 1, c + 1); g.lineWidth = 1; }
  opHot(P, { id: 'waffle', x: pad, y: top, w: cols * c, h: rows * c, tip: () => { const k = Math.floor((P.my - top) / c) * cols + Math.floor((P.mx - pad) / c); if (k < 0 || k >= n) return null;
    return k >= r.alerts ? ['Spare capacity', 'The team could read ' + (OP_CAP - r.alerts) + ' more.'] : ['Alert ' + (k + 1) + ' of ' + r.alerts, (spot[k] ? 'A real attack. ' : 'A false alarm, from ' + Math.round(100 * (r.alerts - r.tp) / r.alerts) + '% of the queue. ') + (k < OP_CAP ? 'Read today.' : 'Never read.')]; } });
  const cy = top + Math.ceil(OP_CAP / cols) * c; if (r.alerts > OP_CAP) { g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(pad - 6, cy - 1); g.lineTo(pad + cols * c + 6, cy - 1); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    labText(g, 'never read ↓', pad + cols * c + 10, cy + 12, { size: 11, w: 700, col: lc(LC.bad, 1) }); labText(g, 'read ↑', pad + cols * c + 10, cy - 6, { size: 11, w: 700, col: lc(LC.good, 1) }); }
  // the fourteen attacks, by kind
  const rx = L.w * 0.6 + 30, rw = L.w - rx - pad, kinds = Object.keys(OP_ATK_KIND), rh = Math.min(72, (L.h - 210) / kinds.length);
  opCap(g, 'THE 14 ATTACKS', rx, 30); let read = r.triaged;
  const st = {}; r.atk.forEach(a => { st[a.e.id] = !a.hit.length ? 'miss' : read-- > 0 ? 'read' : 'lost'; });
  kinds.forEach((k, i) => { const y = 64 + i * rh, list = r.atk.filter(a => a.e.k === k), harm = OP_ATK_HARM[k];
    labText(g, OP_ATK_SHORT[k] + (harm ? '  ⚑' : ''), rx, y + 5, { size: 13, w: 700, mono: false, col: lc(harm ? LC.ink : LC.text, 0.95) });
    list.forEach((a, j) => { const x = rx + Math.min(150, rw * 0.5) + j * 30, v = st[a.e.id]; opNode(g, x, y, opHov(P, 'atk:' + a.e.id) ? 13 : 10, v === 'read' ? LC.good : v === 'lost' ? LC.ink : LC.bad, v !== 'miss', v === 'read' ? '✓' : v === 'lost' ? '•' : '✕');
      opHot(P, { id: 'atk:' + a.e.id, x, y, r: 12, tip: [a.e.t, OP_ATK_KIND[k] + (harm ? ', touched data or tools' : '') + '. ' + (v === 'read' ? 'Caught and read.' : v === 'lost' ? 'Caught by ' + a.hit.map(h2 => OP_RULES.find(z => z[0] === h2)[3]).join(', ') + ', but never read.' : 'No rule fired.')] }); }); });
  const ly = 64 + kinds.length * rh; [['read', LC.good, '✓ caught, read'], ['lost', LC.ink, '• caught, unread'], ['miss', LC.bad, '✕ missed']].forEach(([, col, t], i) => labText(g, t, rx + i * Math.max(110, rw / 3), ly, { size: 11, w: 600, mono: false, col: lc(col, 1) }));
  // the rules
  const by = L.h - 62, bw = (L.w - pad * 2 - 5 * 10) / 6;
  OP_RULES.forEach((ru, i) => { const b = r.by[ru[0]], on = P.pack[ru[0]] && (ru[0] !== 'doc' || P.pack.clf), x = pad + i * (bw + 10), can = L.step > 0 || ['kw', 'clf'].includes(ru[0]);
    if (opHov(P, 'rule:' + ru[0])) labGlow(g, x + bw / 2, by + 23, bw * 0.6, LC.blue, 0.25);
    opHot(P, { id: 'rule:' + ru[0], x, y: by, w: bw, h: 46, act: can ? L2 => P.toggle(L2, ru[0]) : null, tip: [ru[1], ru[2] + '. ' + (can ? 'Click to switch ' + (P.pack[ru[0]] ? 'off.' : 'on.') : 'Available in the next step.')] });
    opRR(g, x, by, bw, 46, 10); g.fillStyle = lc(on ? LC.blue : LC.mute, on ? 0.12 : 0.04); g.fill(); g.strokeStyle = lc(on ? LC.blue : LC.mute, on ? 0.6 : 0.2); g.stroke();
    labText(g, ru[3], x + 10, by + 18, { size: 11, w: 700, mono: false, col: lc(on ? LC.text : LC.mute, 1) });
    labText(g, on ? (b.fp + b.tp) + ' alerts · ' + b.tp + ' real' : 'off', x + 10, by + 36, { size: 11, w: 600, col: lc(on ? (b.fp + b.tp > OP_CAP ? LC.bad : LC.good) : LC.mute, 1) }); });
}
// Week 1 against week 2, per rule: a dumbbell.
function opdDrawWeeks(L, g, P, pk) {
  const a = opDetect(pk(), false), b = opDetect(pk(), true), pad = 30, rows = OP_RULES.filter(([k]) => a.by[k].tp || b.by[k].tp || pk()[k]);
  const lx = pad + 190, rw = L.w - lx - pad - 40, top = 90, rh = Math.min(70, (L.h - top - 60) / Math.max(1, rows.length)), X = v => lx + rw * v / 14, k = P.w2 ? opIn(L, P, 1.5) : 0;
  opCap(g, 'REAL ATTACKS CAUGHT', lx, 40); [0, 7, 14].forEach(v => { labText(g, String(v), X(v), 60, { size: 10, align: 'center', col: lc(LC.mute, 1) }); g.strokeStyle = 'rgba(141,182,242,.12)'; g.beginPath(); g.moveTo(X(v), 68); g.lineTo(X(v), top + rows.length * rh - 10); g.stroke(); });
  rows.forEach((ru, i) => { const y = top + i * rh + rh / 2 - 10, v1 = a.by[ru[0]].tp, v2 = b.by[ru[0]].tp, fell = v2 < v1, vx = v1 + (v2 - v1) * k, col = fell ? LC.bad : LC.good;
    labText(g, ru[3], lx - 20, y + 5, { size: 14, w: 700, mono: false, align: 'right', col: lc(LC.text, 0.95) });
    opHot(P, { id: 'wk:' + ru[0], x: pad, y: y - rh / 2, w: L.w - pad * 2, h: rh, tip: [ru[1], ru[2] + '. Week 1: ' + v1 + ' caught; week 2: ' + v2 + '.'] });
    g.strokeStyle = lc(col, 0.5); g.lineWidth = 4; g.beginPath(); g.moveTo(X(v1), y); g.lineTo(X(vx), y); g.stroke(); g.lineWidth = 1;
    opNode(g, X(v1), y, 9, LC.blue, true, ''); if (P.w2) opNode(g, X(vx), y, 11, col, true, '');
    labText(g, P.sawW2 ? v1 + ' → ' + v2 : String(v1), L.w - pad, y + 5, { size: 14, w: 700, align: 'right', col: lc(P.sawW2 ? col : LC.blue, 1) }); });
  const bw1 = opBtn(P, g, 'w1', 'Week 1', L.w - pad - 220, 36, LC.blue, !P.w2, L2 => P.week(L2, false)); opBtn(P, g, 'w2', '▶ Week 2: rewritten', L.w - pad - 210 + bw1, 36, LC.ink, P.w2, L2 => P.week(L2, true));
  labText(g, '● week 1', lx, L.h - 22, { size: 11, w: 600, mono: false, col: lc(LC.blue, 1) }); labText(g, '● week 2', lx + 90, L.h - 22, { size: 11, w: 600, mono: false, col: lc(LC.good, 1) });
  if (P.sawW2 && P.w2) axStamp(g, L.w * 0.6, L.h - 70, 'WORDING CHANGED · BEHAVIOUR DID NOT', LC.good, L.t - P.at - 0.8, L.w > 720 ? 15 : 10);
}

/* ====================== 3 · Normal for whom? ====================== */
const OPB_VEC = [{ id: 'drift', name: 'The baseline learned the attack' }, { id: 'season', name: 'Month-end alarms got the detector muted' }, { id: 'cover', name: 'A change window used as cover' },
  { id: 'volume', name: 'Only volumes watched, never actions' }, { id: 'step', name: 'Each step allowed; the sequence never checked' }, { id: 'fleet', name: 'One baseline for every agent' }];
const OPB_DEF = [
  { id: 'ref', name: 'A fixed reference baseline', how: 'Plus an alarm when the rolling baseline drifts from it', kills: ['drift'] },
  { id: 'season', name: 'Seasonal baselines per agent', how: 'Month-end compared with month-end; each agent its own normal', kills: ['season', 'fleet'] },
  { id: 'scoped', name: 'Change suppression that is scoped and expires', how: 'Only the changed metric, only the ticket’s window, then re-baseline', kills: ['cover'] },
  { id: 'first', name: 'First-seen rules', how: 'New tool, new destination, new data scope: always an alert', kills: ['volume'] },
  { id: 'seq', name: 'Sequence rules on action chains', how: 'Outside text → privileged action; bulk read → new destination', kills: ['step'] }];
const OPB_GROUPS = [{ name: 'Baselines', col: 'ink', ids: ['drift', 'season', 'fleet'], act: 'Nine days late, or muted after the third false alarm' },
  { name: 'Behaviour', col: 'bad', ids: ['cover', 'volume', 'step'], act: 'Normal volume, abnormal intent' }];

function opbMount(L) {
  const P = { o: { win: '7', k: 3, season: false, first: false, chg: false }, sawLate: false, sawFast: false, ti: 0, marks: {}, wrong: null, on: {}, flash: {}, at: -9 };
  const res = () => opAnomaly(P.o);
  const note = () => { const r = opAnomaly(P.o), d = r.delay; if (d == null || d >= 8) P.sawLate = true; if (d != null && d <= 3) P.sawFast = true; };
  const setO = (L2, k, v) => { P.o[k] = v; note(); P.at = L2.t; L2.repaint(); };
  const baseSide = L2 => [opSeg('Baseline', OP_WIN, P.o.win, v => setO(L2, 'win', v)), opSeg('Alert above', [[2, '2σ'], [3, '3σ'], [4, '4σ']], P.o.k, v => setO(L2, 'k', v))];
  const tr = () => OP_TRACES[P.ti];
  const mark = (L2, bad) => { const t = tr(); if (!t) return; if (t.bad === bad) { P.marks[t.id] = true; P.wrong = null; P.ti++; } else P.wrong = t.id; P.at = L2.t; L2.repaint(); };
  note(); P.mark = mark;
  return { P, ...opPointer(P),
    hud: () => [
      [['RAMP CAUGHT', () => res().delay == null ? 'never' : 'day ' + res().caught.support, res().delay != null && res().delay <= 3 ? 'good' : 'bad'], ['DAYS LATE', () => res().delay == null ? '—' : String(res().delay)]],
      [['ATTACKS', () => res().n + '/3', res().n === 3 ? 'good' : 'bad'], ['FALSE ALARMS', () => String(res().fa), res().fa <= 1 ? 'good' : 'bad'], ['RAMP', () => res().delay == null ? 'missed' : res().delay + ' days late']],
      [['TRACES', () => Object.keys(P.marks).length + '/' + OP_TRACES.length], ['EVERY STEP', () => 'allowed']],
      axDefHud(P, OPB_VEC, OPB_DEF), axDefHud(P, OPB_VEC, OPB_DEF)][L.step],
    draw: (L2, g) => opFrame(L2, g, P, () => L2.step >= 3 ? axDrawDefend(L2, g, P, OPB_GROUPS, OPB_VEC, OPB_DEF) : [opbDrawOne, opbDrawFleet, opbDrawTrace][L2.step](L2, g, P)),
    steps: [
      { say: () => !(P.sawLate && P.sawFast) ? 'Theft creeps up from day 25. Make the baseline miss it, then catch it in 3 days.' : 'A rolling baseline learns a slow attack.',
        side: L2 => baseSide(L2),
        acts: L2 => [labNext(L2, 'The whole fleet →', !(P.sawLate && P.sawFast))] },
      { say: () => opAnomOk(P.o) ? 'Three of three. Each agent has its own normal.' : 'Five agents. Catch all 3 attacks with at most 1 false alarm.',
        side: L2 => [baseSide(L2), h('span', { class: 'labk' }, 'And'), h('div', { class: 'labchipset' },
          gvChip('Seasonal', P.o.season, () => setO(L2, 'season', !P.o.season)),
          gvChip('First-seen', P.o.first, () => setO(L2, 'first', !P.o.first)),
          gvChip('Change calendar', P.o.chg, () => setO(L2, 'chg', !P.o.chg)))],
        acts: L2 => [labNext(L2, 'What the agent did →', !opAnomOk(P.o))] },
      { say: () => P.ti >= OP_TRACES.length ? 'Every step allowed. Four chains were attacks.' : P.wrong ? tr().why : 'Every step is allowed. Is the chain normal?',
        side: L2 => P.ti >= OP_TRACES.length ? [] : [h('div', { class: 'labstack' }, labBtn('✓ Normal', () => mark(L2, false), 'go'), labBtn('⚠ Suspicious', () => mark(L2, true)))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.ti < OP_TRACES.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPB_VEC, OPB_DEF, P.on).length; return n ? n + ' ways baselines miss an agent. Switch on controls.' : 'All ' + OPB_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPB_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Own normal per agent. Fixed reference. Alert on firsts.',
        enter: () => labDone('opbase'),
        side: () => axDebrief(P, OPB_VEC, OPB_DEF, [
          ['Aug 2025 · AI provider threat report', 'A criminal used a coding agent to steal data from, and extort, at least 17 organisations. The provider found it from patterns of use, banned the accounts and shared indicators.'],
          ['Nov 2025 · GTG-1002', 'A state-sponsored group had an AI agent carry out most of an espionage campaign. It was the pattern across many requests that gave it away, not any single one.'],
          ['Aug 2025 · s1ngularity', 'Malicious package versions told developers’ own AI command-line tools to hunt for secrets. Each tool call was allowed; the sequence was the attack.'],
          ['Jul 2025 · A coding agent and a code freeze', 'An agent deleted a production database during a declared freeze. Its permissions allowed every step it took.']],
          ['gtg1002', 'nx', 'memory'], 'Series are simulated from a fixed seed. Alert rule: above the baseline mean plus k standard deviations, with a floor of 5% of the mean.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), opBack()] }
    ] };
}
// One agent's series with its baseline band; returns nothing.
function opbChart(L, g, P, a, x, y, w, hh, big) {
  const s = OP_SERIES[a.id], max = Math.max(...s) * 1.1, X = d => x + w * d / (OP_DAYS - 1), Y = v => y + hh - hh * v / max, r = opAnomaly(P.o), tr = OP_TRUTH[a.id];
  g.fillStyle = 'rgba(141,182,242,.05)'; g.fillRect(x, y, w, hh);
  if (tr) for (let d = 0; d < OP_DAYS; d++) if (tr(d)) { g.fillStyle = 'rgba(255,90,122,.10)'; g.fillRect(X(d) - w / OP_DAYS / 2, y, w / OP_DAYS, hh); }
  g.fillStyle = 'rgba(242,181,68,.16)'; g.beginPath();
  const band = []; for (let d = OP_REF; d < OP_DAYS; d++) { const b = opBaseline(s, d, P.o.win, P.o.season, P.o.chg && OP_CHG[a.id]); band.push([d, b.m + P.o.k * b.sd]); }
  band.forEach(([d, v], i) => i ? g.lineTo(X(d), Y(v)) : g.moveTo(X(d), Y(v))); g.lineTo(X(OP_DAYS - 1), y + hh); g.lineTo(X(OP_REF), y + hh); g.closePath(); g.fill();
  g.strokeStyle = lc(LC.ink, 0.9); g.setLineDash([4, 3]); g.beginPath(); band.forEach(([d, v], i) => i ? g.lineTo(X(d), Y(v)) : g.moveTo(X(d), Y(v))); g.stroke(); g.setLineDash([]);
  g.strokeStyle = lc(LC.blue, 1); g.lineWidth = big ? 2 : 1.5; g.beginPath(); s.forEach((v, d) => d ? g.lineTo(X(d), Y(v)) : g.moveTo(X(d), Y(v))); g.stroke(); g.lineWidth = 1;
  g.fillStyle = 'rgba(141,182,242,.12)'; g.fillRect(x, y, X(OP_REF) - x, hh);
  r.alerts.filter(z => z.a === a.id).forEach(z => { const ok = tr && tr(z.d); g.fillStyle = lc(ok ? LC.good : LC.bad, 1); g.beginPath(); g.arc(X(z.d), z.kind === 'first' ? y + 10 : Y(s[z.d]), big ? 5 : 3.5, 0, 7); g.fill(); });
  OP_FIRST.filter(f => f.a === a.id).forEach(f => { labText(g, '◆', X(f.d), y + 14, { size: big ? 13 : 10, align: 'center', col: lc(P.o.first ? LC.violet : LC.mute, 1) }); });
  if (OP_CHG[a.id]) { const [c0, c1] = OP_CHG[a.id]; g.fillStyle = lc(LC.violet, P.o.chg ? 0.18 : 0.07); g.fillRect(X(c0), y, X(c1) - X(c0), hh); }
  labText(g, a.t, x + 6, y + 14, { size: big ? 13 : 11, w: 700, mono: false, col: lc(LC.text, 1) });
  // scrub: hover any day
  const id = 'chart:' + a.id, d = Math.max(0, Math.min(OP_DAYS - 1, Math.round((P.mx - x) / w * (OP_DAYS - 1))));
  if (P.hov === id) { const lim = d >= OP_REF ? opBaseline(s, d, P.o.win, P.o.season, P.o.chg && OP_CHG[a.id]) : null, line = lim && lim.m + P.o.k * lim.sd;
    g.strokeStyle = lc(LC.text, 0.5); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(d), y); g.lineTo(X(d), y + hh); g.stroke(); g.setLineDash([]);
    opNode(g, X(d), Y(s[d]), big ? 6 : 4, LC.blue, true, ''); if (line) opNode(g, X(d), Y(line), big ? 5 : 3.5, LC.ink, true, ''); }
  opHot(P, { id, x, y: y + 18, w, h: hh - 18, tip: () => { const lim = d >= OP_REF ? opBaseline(s, d, P.o.win, P.o.season, P.o.chg && OP_CHG[a.id]) : null, line = lim && lim.m + P.o.k * lim.sd, f = OP_FIRST.find(z => z.a === a.id && z.d === d);
    return ['Day ' + d + ' · ' + Math.round(s[d]).toLocaleString('en') + ' records', (line ? 'Alert line ' + Math.round(line).toLocaleString('en') + (s[d] > line ? ': alarm.' : ': quiet.') : 'Reference period: learning normal.') + (tr && tr(d) ? ' Attack running.' : '') + (f ? ' ' + f.t + '.' : '')]; } });
  opHot(P, { id: 'name:' + a.id, x: x + 2, y: y + 2, w: 140, h: 16, tip: [a.t, a.story || 'No attack on this agent. Every alert here is a false alarm.'] });
}
function opbDrawOne(L, g, P) {
  const pad = 30, a = OP_AGENTS[0], y = 40, hh = L.h - 100, w = L.w - pad * 2, r = opAnomaly(P.o);
  opCap(g, 'RELAY · RECORDS TOUCHED PER DAY', pad, 26, lc(LC.blue, 1));
  opbChart(L, g, P, a, pad, y, w, hh, true);
  [0, 14, 25, 40, 59].forEach(d => labText(g, 'day ' + d, pad + w * d / (OP_DAYS - 1), y + hh + 16, { size: 10, align: 'center', col: lc(LC.mute, 1) }));
  const extra = r.delay == null ? null : OP_SERIES.support.slice(25, r.caught.support).reduce((s2, v) => s2 + v - 400, 0);
  axStamp(g, L.w * 0.6, y + 40, r.delay == null ? 'NEVER ALARMED' : r.delay <= 3 ? 'CAUGHT IN ' + r.delay + ' DAYS' : 'CAUGHT ' + r.delay + ' DAYS LATE · ' + Math.round(extra).toLocaleString('en') + ' EXTRA RECORDS', r.delay != null && r.delay <= 3 ? LC.good : LC.bad, L.t - P.at - 0.2, L.w > 720 ? 15 : 10);
}
function opbDrawFleet(L, g, P) {
  const pad = 14, cols = L.w > 760 ? 3 : 2, rows = Math.ceil((OP_AGENTS.length + 1) / cols), cw = (L.w - pad * (cols + 1)) / cols, ch = (L.h - 30 - pad * rows) / rows, r = opAnomaly(P.o);
  OP_AGENTS.forEach((a, i) => { const x = pad + (i % cols) * (cw + pad), y = 20 + Math.floor(i / cols) * (ch + pad); opbChart(L, g, P, a, x, y, cw, ch - 18, false);
    const got = r.caught[a.id] != null, fas = r.alerts.filter(z => z.a === a.id && !(OP_TRUTH[a.id] && OP_TRUTH[a.id](z.d))).length;
    labText(g, a.atk ? (got ? '✓ caught day ' + r.caught[a.id] : '✗ attack missed') : (fas ? '✗ ' + fas + ' false alarm' + (fas > 1 ? 's' : '') : '✓ quiet'), x, y + ch - 4, { size: 11, w: 700, col: lc(a.atk ? opTone(got) : opTone(!fas), 1) }); });
  const i = OP_AGENTS.length, x = pad + (i % cols) * (cw + pad), y = 20 + Math.floor(i / cols) * (ch + pad), ok = opAnomOk(P.o);
  opRR(g, x, y, cw, ch - 18, 12); g.fillStyle = lc(ok ? LC.good : LC.bad, 0.07); g.fill(); g.strokeStyle = lc(ok ? LC.good : LC.bad, 0.4); g.stroke();
  opBig(g, r.n + '/3', 'ATTACKS', x + 20, y + ch * 0.45, r.n === 3 ? LC.good : LC.bad, 30); opBig(g, String(r.fa), 'FALSE ALARMS', x + cw * 0.55, y + ch * 0.45, r.fa <= 1 ? LC.good : LC.bad, 30);
  labText(g, r.delay == null ? 'ramp missed' : 'ramp caught in ' + r.delay + ' days', x + 20, y + ch * 0.45 + 30, { size: 12, w: 600, mono: false, col: lc(r.delay != null && r.delay <= 5 ? LC.good : LC.bad, 1) });
}
function opbDrawTrace(L, g, P) {
  const pad = 26, done = P.ti >= OP_TRACES.length;
  // progress: eight lamps
  OP_TRACES.forEach((x, i) => { const cx = L.w / 2 + (i - 3.5) * 34, judged = !!P.marks[x.id], now = i === P.ti;
    opNode(g, cx, 30, now ? 10 : 8, judged ? (x.bad ? LC.bad : LC.good) : now ? LC.ink : LC.mute, judged, judged ? (x.bad ? '!' : '✓') : ''); });
  if (done) { const cols = L.w > 760 ? 4 : 2, cw = (L.w - pad * 2 - (cols - 1) * 14) / cols, ch = Math.min(150, (L.h - 90) / Math.ceil(8 / cols) - 14);
    OP_TRACES.forEach((x, i) => { const cx = pad + (i % cols) * (cw + 14), cy = 64 + Math.floor(i / cols) * (ch + 14), col = x.bad ? LC.bad : LC.good;
      opRR(g, cx, cy, cw, ch, 12); g.fillStyle = lc(col, 0.08); g.fill(); g.strokeStyle = lc(col, 0.5); g.stroke();
      labText(g, x.a, cx + 14, cy + 24, { size: 15, w: 700, mono: false, col: lc(LC.text, 1) }); labText(g, x.bad ? 'ATTACK' : 'NORMAL', cx + cw - 14, cy + 24, { size: 10, w: 700, align: 'right', col: lc(col, 1) });
      x.steps.forEach((_, j) => { opNode(g, cx + 22 + j * 26, cy + 46, 7, LC.blue, true, ''); if (j) { g.strokeStyle = lc(LC.blue, 0.5); g.beginPath(); g.moveTo(cx + 22 + (j - 1) * 26 + 8, cy + 46); g.lineTo(cx + 22 + j * 26 - 8, cy + 46); g.stroke(); } });
      gvWrap(g, x.why, cx + 14, cy + 76, cw - 28, { size: 12, col: lc(LC.text, 0.85), max: Math.max(1, Math.floor((ch - 70) / 16)) }); }); return; }
  const t = OP_TRACES[P.ti], n = t.steps.length, gap = 60, bw = Math.min(250, (L.w - pad * 2 - (n - 1) * gap) / n), x0 = (L.w - (n * bw + (n - 1) * gap)) / 2, y = L.h / 2 - 30;
  labText(g, t.a, L.w / 2, 92, { size: 30, w: 700, mono: false, align: 'center', col: lc(LC.ink, 1) });
  t.steps.forEach((s2, i) => { const x = x0 + i * (bw + gap), k = NN.sync ? 1 : Math.max(0, Math.min(1, (L.t - P.at) * 2.5 - i * 0.5)); if (k <= 0) return; g.globalAlpha = k;
    opRR(g, x, y - 40, bw, 96, 14); g.fillStyle = lc(LC.blue, 0.08); g.fill(); g.strokeStyle = lc(LC.blue, 0.45); g.stroke();
    opNode(g, x + bw / 2, y - 40, 13, LC.good, true, '✓');
    gvWrap(g, s2, x + bw / 2, y + 2, bw - 24, { size: 14, align: 'center', col: lc(LC.text, 1), max: 3 });
    if (i < n - 1) { const ax = x + bw + 10, ay = y + 8; g.strokeStyle = lc(LC.blue, 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + gap - 24, ay); g.stroke(); g.lineWidth = 1;
      g.fillStyle = lc(LC.blue, 0.9); g.beginPath(); g.moveTo(ax + gap - 24, ay - 6); g.lineTo(ax + gap - 16, ay); g.lineTo(ax + gap - 24, ay + 6); g.fill(); }
    g.globalAlpha = 1; });
  opLbl(g, 'every step: allowed', L.w / 2, y + 96, lc(LC.good, 0.8), 12);
  g.font = "600 15px 'IBM Plex Sans', sans-serif"; const nw = g.measureText('✓ Normal').width + 24, sw = g.measureText('⚠ Suspicious').width + 24, bx = L.w / 2 - (nw + sw + 20) / 2;
  opBtn(P, g, 'tn', '✓ Normal', bx, y + 150, LC.good, false, L2 => P.mark(L2, false), null, 15); opBtn(P, g, 'ts', '⚠ Suspicious', bx + nw + 20, y + 150, LC.bad, false, L2 => P.mark(L2, true), null, 15);
  if (P.wrong === t.id) axStamp(g, L.w / 2, y + 210, 'LOOK AGAIN', LC.bad, L.t - P.at, 16);
}

/* ---------- registration ---------- */
const OP_SIMS = [
  { id: 'optel', track: 'ops', hook: 'Nineteen days of leak. A green dashboard.', title: 'What did the logs see?', kicker: 'AI telemetry · monitoring pipelines · SIEM integration', blurb: 'An agent leaked records for 19 days behind a green dashboard. Choose what to collect within an ingest budget, fix the logging pipeline that quietly drops the evidence, then answer the incident lead’s six questions from the SIEM.', mount: optMount,
    brief: { what: 'Your SIEM was built for hosts, networks and web apps. An AI agent can be attacked while every one of those logs is normal: the attack is in what it retrieved, which tools it called, and what its answers contained.',
      real: 'Incident teams are asked the same six questions every time: where it started, what left, where to, since when, whose sessions, and whether it was your own release. Most AI platforms cannot answer half of them on day one.',
      todo: ['Pick telemetry sources within 25 GB a day', 'Fix the pipeline settings that destroy answers', 'Ask the SIEM the six incident questions'] },
    guide: [
      { look: [['good', '●', 'Seen'], ['bad', '○', 'Dark'], ['violet', '○', 'Never visible']], why: 'The dashboard was green all 19 days.' },
      { look: [['bad', '▮', 'Valve that kills an answer'], ['blue', '•', 'Events']], why: 'Each web-log default kills an AI answer.' },
      { look: [['blue', '◖', 'Fields joined'], ['good', '▭', 'Answer']], why: 'Parsed, named, joinable fields.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'All of it is configuration, not code.' },
      { why: 'Ask: which of the six can we answer today?' }] },
  { id: 'opdetect', track: 'ops', hook: '422 alerts. Two analysts. Fourteen attacks.', title: 'The alert queue', kicker: 'Detection engineering · prompt-attack detection', blurb: 'Run the vendor’s default detection pack against a day of support traffic and watch the queue flood, tune it to what two analysts can read, build a pack that catches the attacks that touched data, then see which rules survive when the attacker rewrites the prompts.', mount: opdMount,
    brief: { what: 'Prompt-attack detection is usually sold as a classifier. Content scores catch loud, direct jailbreaks; attacks that arrive inside documents and change what the agent does need rules about behaviour.',
      real: 'Every detection programme is limited by the people who read it. A rule that fires 400 times a day is a rule nobody reads, and the attack that mattered is at the bottom of the queue.',
      todo: ['Tune the default pack down to analyst capacity', 'Build a pack that catches what touched data', 'Run week two after the attacker adapts'] },
    guide: [
      { look: [['good', '■', 'Read'], ['bad', '■', 'Never read'], ['ink', '⚑', 'Touched data']], why: 'Caught is not the same as seen.' },
      { look: [['good', '●', 'Caught, read'], ['ink', '•', 'Caught, unread'], ['bad', '○', 'Missed']], why: '⚑ attacks hide in documents, not chats.' },
      { look: [['blue', '●', 'Week 1'], ['good', '●', 'Week 2: held'], ['bad', '●', 'Week 2: fell']], why: 'To steal, it still has to look up and send.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'What it looks at, and how it is run.' },
      { why: 'Ask: who reads each rule’s alerts?' }] },
  { id: 'opbase', track: 'ops', hook: 'A slow theft becomes the new normal.', title: 'Normal for whom?', kicker: 'Runtime anomaly detection · agent behaviour monitoring', blurb: 'Watch a slow data-theft ramp become normal to a rolling baseline, tune one detector for five agents with month-ends and releases, then judge eight action chains in which every single step is allowed.', mount: opbMount,
    brief: { what: 'Anomaly detection learns what normal looks like and alerts on the rest. Agents make that hard: they have seasons, releases and many users behind one identity, and an attacker can move slowly enough to be learned.',
      real: 'AI providers now find abuse of their own agents from patterns of use, not single requests. Inside an enterprise, the same applies: what matters is what an agent has never done before, and in what order.',
      todo: ['Find the baseline that misses the ramp, and one that does not', 'Tune one detector for five agents', 'Judge eight chains of allowed actions'] },
    guide: [
      { look: [['ink', '┅', 'Alert line'], ['good', '●', 'Right alert'], ['bad', '▮', 'Attack running']], why: 'Creep slowly and the line rises with you.' },
      { look: [['bad', '●', 'False alarm'], ['violet', '◆', 'First-seen']], why: 'Volume alone can’t tell month-end from theft.' },
      { look: [['good', '✓', 'Allowed step']], why: 'Permissions check steps. Attacks are sequences.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Slow drift, and one allowed step at a time.' },
      { why: 'Ask: what stops the baseline learning the attack?' }] }];
OP_SIMS.forEach(x => { NN_SIMS.push(x); NN_BY[x.id] = x; });
