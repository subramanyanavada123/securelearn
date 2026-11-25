'use strict';
/* AI Security Operations instruments 4–6: the hunt, the SOC's own AI with
   SOAR and the incident workflow, kill switches and containment. Plus the
   AI SecOps hub on the Advanced page. Engines live in ops-data.js. */

/* ====================== 4 · Follow the data out ====================== */
const OPH_VEC = [{ id: 'browser', name: 'Data left from the customer’s browser' }, { id: 'tool', name: 'The agent’s own tools as the channel' }, { id: 'drip', name: 'A few records at a time' },
  { id: 'dlp', name: 'DLP watches files, not links' }, { id: 'nohunt', name: 'Waited for an alert that never came' }, { id: 'oneoff', name: 'The hunt ended as a report' }];
const OPH_DEF = [
  { id: 'csp', name: 'Link and image allowlist in the chat window', how: 'Answers can only show images and links from your own domains', kills: ['browser'] },
  { id: 'dst', name: 'Destination allowlist for agent tools', how: 'A new email domain or web host needs approval', kills: ['tool'] },
  { id: 'agg', name: 'Totals per destination', how: 'Customer records per destination over 30 days, not per event', kills: ['drip'] },
  { id: 'outscan', name: 'Scan answers and tool arguments', how: 'For customer data, wherever it is: a link, a body, a field', kills: ['dlp'] },
  { id: 'cadence', name: 'Scheduled AI hunts from hypotheses', how: 'Monthly, from the channels list, with hours set aside', kills: ['nohunt'] },
  { id: 'promote', name: 'Every hunt ends in detections or a recorded gap', how: 'Reviewed in the detection backlog', kills: ['oneoff'] }];
const OPH_GROUPS = [{ name: 'Where it left', col: 'ink', ids: ['browser', 'tool', 'drip'], act: 'Data out through channels no sensor watches' },
  { name: 'How you looked', col: 'bad', ids: ['dlp', 'nohunt', 'oneoff'], act: 'Found by a customer, three weeks in' }];

function ophMount(L) {
  const P = { chan: null, seen: new Set(), done: new Set(), last: null, picked: {}, wrong: null, on: {}, flash: {}, at: -9 };
  const used = () => opHuntUsed(P.done), found = () => opHuntFound(P.done), avail = () => OP_PIV.filter(p => !P.done.has(p.id) && p.need.every(n => P.done.has(n)));
  const goodN = OP_PROMOTE.filter(p => p.good).length, picked = () => OP_PROMOTE.filter(p => p.good && P.picked[p.id]).length;
  return { P,
    hud: () => [
      [['CHANNELS', () => P.seen.size + '/' + OP_CHAN.length], ['CLASSIC SENSORS SEE', () => OP_CHAN.filter(c => ['dlp', 'proxy', 'casb'].some(s => c.seen[s] === 1)).length + '/' + OP_CHAN.length, 'bad']],
      [['HOURS', () => used() + ' / ' + OP_HUNT_H, used() > OP_HUNT_H ? 'bad' : 'good'], ['FINDINGS', () => found().length + '/' + OP_FINDS.length, found().length === OP_FINDS.length ? 'good' : '']],
      [['CHANNELS COVERED', () => opCoverage(P.picked).length + '/' + OP_CHAN.length, opCoverage(P.picked).length === OP_CHAN.length ? 'good' : '']],
      axDefHud(P, OPH_VEC, OPH_DEF), axDefHud(P, OPH_VEC, OPH_DEF)][L.step],
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, OPH_GROUPS, OPH_VEC, OPH_DEF) : [ophDrawChan, ophDrawHunt, ophDrawPromote][L2.step](L2, g, P, used, found),
    steps: [
      { say: () => P.seen.size < OP_CHAN.length ? 'A customer saw a broken image. DLP and proxy: silent. Check each way out.' : 'Classic sensors fully see one way out. Agent logs see all six.',
        side: L2 => [h('div', { class: 'labstack' }, OP_CHAN.map(c => labBtn((P.seen.has(c.id) ? '✓ ' : '▶ ') + c.s, () => { P.chan = c.id; P.seen.add(c.id); P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Start the hunt →', P.seen.size < OP_CHAN.length)] },
      { say: () => found().length < OP_FINDS.length ? (used() > OP_HUNT_H ? 'Over the shift. Fewer dead ends next time.' : 'Hunch: data leaves in Relay’s answers. 8 hours. Find 4 things.') : 'Four findings in ' + used() + ' hours.',
        side: L2 => [h('div', { class: 'labstack' }, avail().map(p => labBtn('▶ ' + p.s + ' · ' + p.h + ' h', () => { P.done.add(p.id); P.last = p.id; P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Make it stick →', found().length < OP_FINDS.length)] },
      { say: () => P.wrong ? OP_PROMOTE.find(p => p.id === P.wrong).why : picked() < goodN ? 'Turn the findings into standing detections.' : 'All six ways out now raise an alert.',
        side: L2 => [h('div', { class: 'labstack' }, OP_PROMOTE.map(p => labBtn((P.picked[p.id] ? '✓ ' : P.wrong === p.id ? '✗ ' : '+ ') + p.s, () => { if (p.good) { P.picked[p.id] = true; P.wrong = null; } else P.wrong = p.id; P.at = L2.t; L2.repaint(); }, P.picked[p.id] ? 'ok' : '')))],
        acts: L2 => [labNext(L2, 'Close the paths →', picked() < goodN)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPH_VEC, OPH_DEF, P.on).length; return n ? n + ' ways data leaves unseen. Switch on controls.' : 'All ' + OPH_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPH_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Hunt on purpose. Make every finding an alert.',
        enter: () => labDone('ophunt'),
        side: () => axDebrief(P, OPH_VEC, OPH_DEF, [
          ['Aug 2024 · Slack AI', 'A message in a public channel made Slack AI show a link carrying a private channel’s API key. Nothing a file-based DLP watches.'],
          ['Nov 2023 · Google Bard', 'A shared document made Bard build an image link that sent chat history to an outside server. Google fixed it after the report.'],
          ['Sep 2024 · SpAIware', 'Instructions planted in ChatGPT’s memory sent later conversations out through image links, until patched.'],
          ['Aug 2025 · Salesloft Drift', 'OAuth tokens stolen from an AI chat integration were used to export data from hundreds of Salesforce customers. Responders hunted through API logs for the attacker’s queries and addresses.']],
          ['echoleak', 'slackai', 'memory'], 'The hunt, its pivots and its numbers are a worked scenario, not a real incident.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), opBack()] }
    ] };
}
// Ways out × sensors, as a map of lit and dark dots.
function ophDrawChan(L, g, P) {
  const pad = 26, lw = 170, n = OP_SENS.length, gx = pad + lw, cw = Math.min(130, (L.w - gx - pad) / n), top = 110, rh = Math.min(92, (L.h - top - 70) / OP_CHAN.length);
  const cx = j => gx + cw * (j + 0.5) + (j >= 3 ? 24 : 0);
  opCap(g, 'CLASSIC SENSORS', (cx(0) + cx(2)) / 2, 30, lc(LC.mute, 1), 'center'); opCap(g, 'AGENT LOGS', (cx(3) + cx(4)) / 2, 30, lc(LC.good, 1), 'center');
  g.strokeStyle = 'rgba(141,182,242,.2)'; g.beginPath(); g.moveTo(cx(2) + cw / 2 + 12, 20); g.lineTo(cx(2) + cw / 2 + 12, top + OP_CHAN.length * rh - 10); g.stroke();
  OP_SENS.forEach(([k, t], j) => opLbl(g, t, cx(j), 62, lc(j >= 3 ? LC.good : LC.text, 0.95), 13, 700));
  OP_CHAN.forEach((c, i) => { const y = top + i * rh + rh / 2, seen = P.seen.has(c.id), cur = P.chan === c.id;
    if (cur) { opRR(g, pad - 10, y - rh / 2 + 4, L.w - pad * 2 + 20, rh - 8, 12); g.fillStyle = lc(LC.ink, 0.07); g.fill(); }
    labText(g, c.s, pad, y + 5, { size: 14, w: 700, mono: false, col: lc(seen ? LC.text : LC.mute, 1) });
    OP_SENS.forEach(([k], j) => { const v = seen ? c.seen[k] || 0 : null, x = cx(j);
      if (v == null) { g.fillStyle = 'rgba(141,182,242,.15)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); return; }
      if (v === 1) opNode(g, x, y, 13, LC.good, true, '✓');
      else if (v) { opNode(g, x, y, 13, LC.ink, false, ''); g.fillStyle = lc(LC.ink, 0.9); g.beginPath(); g.arc(x, y, 13, Math.PI / 2, Math.PI * 1.5); g.fill(); }
      else opNode(g, x, y, 13, LC.bad, false, '✕'); }); });
  const c = P.chan && OP_CHAN.find(x => x.id === P.chan); if (c) opLbl(g, c.note, L.w / 2, L.h - 22, lc(LC.ink, 1), 14);
}
// The hunt: a tree of pivots, an hours dial, the latest result, four findings.
function ophDrawHunt(L, g, P, used, found) {
  const pad = 26, tw = L.w * 0.6, u = used(), f = found();
  const depth = id => { const p = OP_PIV.find(x => x.id === id); return p.need.length ? 1 + Math.max(...p.need.map(depth)) : 0; };
  const cols = {}; OP_PIV.forEach(p => { const d = p.dead ? 0 : depth(p.id); (cols[d] = cols[d] || []).push(p); });
  const nd = Object.keys(cols).length, pos = {};
  Object.keys(cols).sort().forEach((d, i) => cols[d].forEach((p, j) => { const n = cols[d].length, sp = Math.min(96, (L.h - 120) / n); pos[p.id] = [pad + 40 + (tw - 80) * i / Math.max(1, nd - 1), L.h / 2 + 10 + (j - (n - 1) / 2) * sp]; }));
  OP_PIV.forEach(p => p.need.forEach(n => { const a = pos[n], b = pos[p.id], dn = P.done.has(p.id); g.strokeStyle = lc(dn ? LC.good : LC.mute, dn ? 0.7 : 0.2); g.lineWidth = dn ? 2 : 1; g.beginPath(); g.moveTo(a[0], a[1]); g.bezierCurveTo((a[0] + b[0]) / 2, a[1], (a[0] + b[0]) / 2, b[1], b[0], b[1]); g.stroke(); g.lineWidth = 1;
    if (dn) opFlow(L, g, [a, b], LC.good, 2, 40, 2.2); }));
  OP_PIV.forEach(p => { const [x, y] = pos[p.id], dn = P.done.has(p.id), open = !dn && p.need.every(n => P.done.has(n)), col = dn ? (p.dead ? LC.mute : p.finds ? LC.good : LC.blue) : open ? LC.ink : LC.mute;
    if (P.last === p.id && !NN.sync) labGlow(g, x, y, 40 + 6 * Math.sin(L.t * 4), col, 0.3);
    opNode(g, x, y, p.finds ? 15 : 11, col, dn, dn ? (p.dead ? '–' : p.finds ? '★' : '✓') : open ? '?' : '');
    opLbl(g, p.s, x, y + 30, lc(dn || open ? LC.text : LC.mute, dn || open ? 0.95 : 0.5), 12, 700);
    opLbl(g, dn && p.dead ? 'dead end' : dn && p.finds ? OP_FINDS.find(z => z[0] === p.finds)[1] : open ? p.h + ' h' : '', x, y + 45, lc(dn ? (p.dead ? LC.mute : LC.good) : LC.ink, 0.9), 10); });
  // hours dial and result
  const rx = tw + 20, rw = L.w - rx - pad;
  opRing(g, rx + 44, 60, 32, u / OP_HUNT_H, u > OP_HUNT_H ? LC.bad : LC.ink, 7);
  labText(g, String(u), rx + 44, 66, { size: 18, w: 700, align: 'center', col: lc(u > OP_HUNT_H ? LC.bad : LC.text, 1) }); opCap(g, 'OF 8 HOURS', rx + 44, 108, null, 'center');
  const p = P.last && OP_PIV.find(x => x.id === P.last);
  if (p) { const k = opIn(L, P, 3); g.globalAlpha = k; labText(g, p.s, rx + 96, 52, { size: 17, w: 700, mono: false, col: lc(LC.ink, 1) });
    p.rows.forEach((r, i) => gvWrap(g, r, rx + 96, 76 + i * 34, rw - 96, { size: 12, col: lc(p.dead ? LC.mute : LC.text, 0.95), max: 2 })); g.globalAlpha = 1; }
  OP_FINDS.forEach(([k, t], i) => { const x = rx + rw * (i + 0.5) / 4, y = L.h - 58, ok = f.includes(k); opNode(g, x, y, 16, ok ? LC.good : LC.mute, ok, ok ? '★' : ''); opLbl(g, t, x, y + 34, lc(ok ? LC.text : LC.mute, 1), 11, 700); });
}
// Detections wired to the ways out they cover.
function ophDrawPromote(L, g, P) {
  const pad = 30, cov = opCoverage(P.picked), lx = pad, rx = L.w - pad - 200, n = OP_PROMOTE.length, m = OP_CHAN.length, dy = Math.min(70, (L.h - 80) / n), cy = Math.min(70, (L.h - 80) / m);
  const dY = i => 60 + i * dy + (L.h - 80 - n * dy) / 2, cY = i => 60 + i * cy + (L.h - 80 - m * cy) / 2, pw = {};
  OP_PROMOTE.forEach((p, i) => { const on = !!P.picked[p.id], bad = P.wrong === p.id; g.font = "600 13px 'IBM Plex Sans', sans-serif"; pw[p.id] = g.measureText(p.s).width + 21;
    if (on) p.covers.forEach(c => { const j = OP_CHAN.findIndex(x => x.id === c), a = [lx + pw[p.id], dY(i)], b = [rx - 20, cY(j)];
      g.strokeStyle = lc(LC.good, 0.45); g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.bezierCurveTo((a[0] + b[0]) / 2, a[1], (a[0] + b[0]) / 2, b[1], b[0], b[1]); g.stroke(); g.lineWidth = 1; opFlow(L, g, [a, b], LC.good, 2, 70, 2.4); });
    opPill(g, p.s, lx, dY(i), bad ? LC.bad : on ? LC.good : p.good ? LC.blue : LC.mute, on || bad, 13);
    if (bad) labText(g, '✕ not a detection', lx + pw[p.id] + 12, dY(i) + 4, { size: 11, w: 700, col: lc(LC.bad, 1) }); });
  OP_CHAN.forEach((c, j) => { const ok = cov.includes(c.id); opNode(g, rx, cY(j), 14, ok ? LC.good : LC.bad, ok, ok ? '✓' : ''); labText(g, c.s, rx + 26, cY(j) + 5, { size: 14, w: 700, mono: false, col: lc(ok ? LC.text : LC.mute, 1) }); });
  opCap(g, 'DETECTIONS', lx, 30); opCap(g, 'WAYS OUT', rx - 14, 30);
}

/* ====================== 5 · The SOC’s own AI ====================== */
const OPS_VEC = [{ id: 'inalert', name: 'Attacker text in the alert steered the AI' }, { id: 'autoclose', name: 'Auto-close with nobody checking' }, { id: 'weapon', name: 'Your automation turned on your users' },
  { id: 'nocap', name: 'No limit on automated actions' }, { id: 'evidence', name: 'AI evidence wiped during clean-up' }, { id: 'owner', name: 'Nobody owns an AI incident' }];
const OPS_DEF = [
  { id: 'data', name: 'Alert content is data, quoted and labelled', how: 'The triage AI is told it cannot take instructions from alert fields. It helps; it is not enough', kills: ['inalert'] },
  { id: 'qa', name: 'Sample the auto-closes', how: '10% at random, plus every close that touches a privileged user', kills: ['autoclose'] },
  { id: 'blast', name: 'Automate by blast radius', how: 'Auto only for reversible, low-impact actions; approval above', kills: ['weapon'] },
  { id: 'breaker', name: 'Circuit breakers', how: 'Protected domains and accounts; hourly caps on blocks and disables', kills: ['nocap'] },
  { id: 'preserve', name: 'AI evidence checklist in the runbook', how: 'Index, prompts, config, model version and tool logs, before any fix', kills: ['evidence'] },
  { id: 'raci', name: 'An AI incident RACI', how: 'The SOC leads; platform and model owners on call; a named business owner', kills: ['owner'] }];
const OPS_GROUPS = [{ name: 'The AI in the loop', col: 'ink', ids: ['inalert', 'autoclose', 'weapon'], act: 'The attacker writes one line, your playbook does the rest' },
  { name: 'The process', col: 'bad', ids: ['nocap', 'evidence', 'owner'], act: 'Fast, automated and impossible to reconstruct' }];
const OP_SEC_PER_MIN = 2;

function opsMount(L) {
  const P = { mode: Object.assign({}, OP_MODE0), guard: {}, run: null, runAt: -9, ran1: false, ok2: false, deck: nnShuffle(OP_IR.map(x => x.id), nnRng(61)), placed: [], wrong: null, on: {}, flash: {}, at: -9 };
  const go = L2 => { P.run = opShift(P.mode, P.guard); P.runAt = L2.t; if (L2.step === 0) P.ran1 = true; else P.ok2 = opShiftOk(P.mode, P.guard); L2.repaint(); };
  const dirty = L2 => { P.run = null; P.ok2 = false; L2.repaint(); };
  const res = () => P.run;
  return { P,
    hud: () => [
      [['MINUTES SAVED', () => res() ? String(res().saved) : '—', 'good'], ['MISSED ATTACKS', () => res() ? String(res().missed) : '—', 'bad'], ['OUTAGES', () => res() ? String(res().outages.length) : '—', 'bad']],
      [['ANALYST MIN', () => res() ? res().min + '/' + OP_SOC_MIN : '—', res() && res().min > OP_SOC_MIN ? 'bad' : ''], ['SAVED', () => res() ? String(res().saved) : '—'], ['MISSED · OUTAGES', () => res() ? res().missed + ' · ' + res().outages.length : '—', res() && (res().missed || res().outages.length) ? 'bad' : 'good']],
      [['PLACED', () => P.placed.length + '/' + OP_IR.length]],
      axDefHud(P, OPS_VEC, OPS_DEF), axDefHud(P, OPS_VEC, OPS_DEF)][L.step],
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, OPS_GROUPS, OPS_VEC, OPS_DEF) : L2.step === 2 ? opsDrawIr(L2, g, P) : opsDrawShift(L2, g, P),
    steps: [
      { say: () => !P.ran1 ? 'An AI triage assistant drives your SOAR. Vendor settings. Run the shift.' : 'Saved ' + res().saved + ' minutes. ' + res().missed + ' real attacks closed, ' + res().outages.length + ' outages.',
        side: L2 => [h('div', { class: 'fiout' }, h('span', { class: 'labk' }, 'Vendor settings'), OP_ACTS.map(a => h('div', null, h('i', null, OP_MODES.find(m => m[0] === P.mode[a.id])[1]), a.s))),
          labBtn('▶ Run the shift', () => go(L2), 'go')],
        acts: L2 => [labNext(L2, 'Redesign it →', !P.ran1)] },
      { enter: () => { P.run = null; P.ok2 = false; },
        say: () => { const r = res(); return !r ? 'Goal: nothing missed, no outages, 250+ minutes saved.' : P.ok2 ? 'Nothing missed. No outages. ' + r.saved + ' minutes saved.' : 'Missed ' + r.missed + ' · outages ' + r.outages.length + ' · saved ' + r.saved + '. Adjust, run again.'; },
        side: L2 => [OP_ACTS.map(a => opSeg(a.s, OP_MODES, P.mode[a.id], v => { P.mode[a.id] = v; dirty(L2); })),
          h('div', { class: 'labchipset' }, OP_GUARDS.map(([k, t]) => gvChip(t, P.guard[k], () => { P.guard[k] = !P.guard[k]; dirty(L2); }))),
          labBtn('▶ Run the shift', () => go(L2), 'go')],
        acts: L2 => [labNext(L2, 'The incident workflow →', !P.ok2)] },
      { say: () => P.placed.length === OP_IR.length ? 'Preserve before you fix: the index, prompts, model.' : P.wrong ? P.wrong : 'Leak confirmed. Click the response steps in order.',
        side: L2 => [h('div', { class: 'labstack' }, P.deck.filter(id => !P.placed.includes(id)).map(id => labBtn(OP_IR.find(x => x.id === id).s, () => { const why = opIrTry(P.placed, id); if (why) P.wrong = why; else { P.placed.push(id); P.wrong = null; } P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.placed.length < OP_IR.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPS_VEC, OPS_DEF, P.on).length; return n ? n + ' ways the SOC’s AI turns on you. Switch on controls.' : 'All ' + OPS_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPS_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'The attacker writes the alert. The AI reads it; a person approves the big moves.',
        enter: () => labDone('opsoar'),
        side: () => axDebrief(P, OPS_VEC, OPS_DEF, [
          ['Jul 2024 · CrowdStrike', 'One automatic content update to a security tool crashed about 8.5 million Windows machines. Security automation has a blast radius too.'],
          ['Apr 2024 · AI in the SOC', 'Microsoft made Security Copilot generally available, and AI triage became a standard SOC component: a new place for attacker-written text to land.'],
          ['Nov 2024 · OWASP Top 10 for LLMs', 'The 2025 list keeps prompt injection first and names excessive agency: an AI step with SOAR permissions is exactly that.'],
          ['Apr 2025 · NIST SP 800-61 Rev. 3', 'Incident response guidance, re-aligned to CSF 2.0: preparation, detection, response and recovery as part of risk management.']],
          ['stack', 'spotlight', 'guard'], 'The shift, its alerts and the minutes are a worked scenario. Approval is counted as catching a wrong suggestion; at high volume, read the human-oversight instrument first.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), opBack()] }
    ] };
}
// The shift: alerts fly in and settle in the lane that decided them.
function opsDrawShift(L, g, P) {
  const pad = 26, r = P.run, lw = L.w - 290 - pad * 2, lh = Math.min(150, (L.h - 60) / 3 - 14), per = 14, sp = Math.min(30, (lw - 120) / per);
  OP_MODES.forEach(([k, t], i) => { const y = 30 + i * (lh + 14); opRR(g, pad, y, lw, lh, 14); g.fillStyle = lc(i === 0 ? LC.ink : i === 1 ? LC.blue : LC.good, 0.06); g.fill();
    labText(g, t, pad + 18, y + 30, { size: 18, w: 700, mono: false, col: lc(LC.text, 0.95) });
    opCap(g, OP_ACTS.filter(a => P.mode[a.id] === k).map(a => a.s).join(' · ').toUpperCase(), pad + 18, y + 48); });
  if (!r) { opLbl(g, '▶ Run the shift', pad + lw / 2, L.h / 2, lc(LC.mute, 1), 18); }
  const shown = !r ? 0 : NN.sync ? 40 : Math.min(40, (L.t - P.runAt) * 12), seat = [0, 0, 0];
  for (let i = 0; i < Math.ceil(shown); i++) { const x = OP_SHIFT[i], e = r.events[i], lane = OP_MODES.findIndex(m => m[0] === e.lanes[1]), k = seat[lane]++;
    const tx = pad + 120 + (k % per) * sp, ty = 30 + lane * (lh + 14) + 76 + Math.floor(k / per) * 28, f = Math.min(1, shown - i), ease = 1 - Math.pow(1 - f, 3);
    const cx = pad + lw * 0.5 + (tx - pad - lw * 0.5) * ease, cy = -10 + (ty + 10) * ease;
    const col = e.bad ? LC.bad : e.saved ? LC.violet : x.real ? LC.ink : x.poison ? LC.violet : LC.good;
    opNode(g, cx, cy, e.bad ? 10 : 8, col, true, e.bad ? (e.bad === 'outage' ? '!' : '✕') : ''); }
  // the scoreboard
  const bx = pad + lw + 30, bw = L.w - bx - pad;
  if (!r) return; const done = shown >= 40;
  opRing(g, bx + 56, 80, 46, r.min / OP_SOC_MIN, r.min > OP_SOC_MIN ? LC.bad : LC.good, 9, null);
  labText(g, String(r.min), bx + 56, 86, { size: 22, w: 700, align: 'center', col: lc(LC.text, 1) }); opCap(g, 'OF 240 MIN', bx + 56, 142, null, 'center');
  opBig(g, String(r.saved), 'SAVED', bx + 130, 92, LC.good, 26);
  if (!done) return;
  opBig(g, String(r.missed), 'MISSED', bx, 210, r.missed ? LC.bad : LC.good, 34); opBig(g, String(r.outages.length), 'OUTAGES', bx + 120, 210, r.outages.length ? LC.bad : LC.good, 34);
  OP_SHIFT.filter(x => x.poison).forEach((x, i) => { const e = r.events[x.i], y = 250 + i * 40; if (y > L.h - 20) return;
    opNode(g, bx + 10, y, 9, e.bad ? LC.bad : LC.good, true, e.bad ? '✕' : '✓'); labText(g, x.s, bx + 28, y + 5, { size: 13, w: 600, mono: false, col: lc(e.bad ? LC.text : LC.mute, 1) }); });
}
// The response: eight stops on a track.
function opsDrawIr(L, g, P) {
  const pad = 50, n = OP_IR.length, y = L.h * 0.42, X = i => pad + (L.w - pad * 2) * i / (n - 1);
  g.strokeStyle = 'rgba(141,182,242,.25)'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(0), y); g.lineTo(X(n - 1), y); g.stroke();
  if (P.placed.length > 1) { g.strokeStyle = lc(LC.good, 0.8); g.beginPath(); g.moveTo(X(0), y); g.lineTo(X(P.placed.length - 1), y); g.stroke(); } g.lineWidth = 1;
  OP_IR.forEach((_, i) => { const id = P.placed[i], st = id && OP_IR.find(q => q.id === id), ai = ['preserve', 'scope', 'erad'].includes(id), x = X(i);
    if (!st) { opNode(g, x, y, 18, i === P.placed.length ? LC.ink : LC.mute, false, String(i + 1)); return; }
    const k = i === P.placed.length - 1 ? opIn(L, P, 4) : 1; opNode(g, x, y, 18 + 4 * (1 - k), ai ? LC.violet : LC.good, true, String(i + 1));
    opLbl(g, st.s, x, y + 44, lc(LC.text, 1), 15, 700); if (ai) opLbl(g, 'AI-specific', x, y + 62, lc(LC.violet, 1), 10); });
  const last = P.placed.length && OP_IR.find(q => q.id === P.placed[P.placed.length - 1]);
  if (last) gvWrap(g, last.t, L.w / 2, y + 120, Math.min(640, L.w - 80), { size: 15, align: 'center', col: lc(LC.ink, 0.95), max: 2 });
  if (P.wrong) axStamp(g, L.w / 2, y - 80, 'OUT OF ORDER', LC.bad, L.t - P.at, L.w > 720 ? 18 : 12);
}

/* ====================== 6 · Pull the plug ====================== */
const OPK_VEC = [{ id: 'inband', name: 'The switch depended on what it switched off' }, { id: 'token', name: 'Credentials outlived the shutdown' }, { id: 'inflight', name: 'Work already in flight kept going' },
  { id: 'untested', name: 'Never drilled' }, { id: 'authority', name: 'On-call could not pull it' }, { id: 'bigred', name: 'One switch: everything off' }];
const OPK_DEF = [
  { id: 'oob', name: 'Switches outside the agent', how: 'At the AI gateway and the identity provider, not a flag the agent reads', kills: ['inband'] },
  { id: 'revoke', name: 'Revocation in the runbook', how: 'Every integration token listed, short-lived, revocable in minutes', kills: ['token'] },
  { id: 'drain', name: 'Drain and end, as part of the switch', how: 'Queues paused, sessions terminated, scheduled jobs held', kills: ['inflight'] },
  { id: 'drill', name: 'A timed drill every quarter', how: 'From the alert to every path stopped, with a stopwatch', kills: ['untested'] },
  { id: 'preauth', name: 'Pre-authorised containment', how: 'On-call may pull any lever on the list; review comes after', kills: ['authority'] },
  { id: 'layers', name: 'Layered levers, smallest first', how: 'Document, tool, gateway, identity, then platform', kills: ['bigred'] }];
const OPK_GROUPS = [{ name: 'Design', col: 'ink', ids: ['inband', 'token', 'inflight'], act: 'Switched off, still leaking' },
  { name: 'Readiness', col: 'bad', ids: ['untested', 'authority', 'bigred'], act: 'Forty minutes to find who may press it' }];

function opkMount(L) {
  const P = { pulls: [], now: 0, running: false, ended: false, tries: 0, drilled: new Set(), dsel: null, stack: {}, on: {}, flash: {}, at: -9 };
  const res = () => opContain(P.pulls, Math.min(P.now, OP_WINDOW)), fin = () => opContain(P.pulls);
  const end = L2 => { P.now = OP_WINDOW; P.running = false; P.ended = true; L2.repaint(); };
  const reset = L2 => { P.pulls = []; P.now = 0; P.running = false; P.ended = false; L2.repaint(); };
  const open = () => OP_PATHS.filter(p => !(res().stopAt[p.id] != null && res().stopAt[p.id] <= P.now)).map(p => p.s);
  return { P,
    hud: () => [
      [['MINUTE', () => Math.floor(P.now) + ' / ' + OP_WINDOW], ['RECORDS LEAKED', () => String(res().leaked), 'bad'], ['BUSINESS IMPACT', () => String(res().impact) + ' / ' + OP_IMPACT_MAX, res().impact > OP_IMPACT_MAX ? 'bad' : '']],
      [['DRILLED', () => P.drilled.size + '/' + OP_SW.length], ['NIGHTS SURVIVED', () => opStack(P.stack).length + '/' + OP_COND.length, opStack(P.stack).length === OP_COND.length ? 'good' : '']],
      axDefHud(P, OPK_VEC, OPK_DEF), axDefHud(P, OPK_VEC, OPK_DEF)][L.step],
    tick: (L2, dt) => { if (L2.step || !P.running) return; const m0 = Math.floor(P.now); P.now += dt / OP_SEC_PER_MIN; if (P.now >= OP_WINDOW) end(L2); else if (Math.floor(P.now) !== m0) labSoft(L2, null); },
    draw: (L2, g) => L2.step >= 2 ? axDrawDefend(L2, g, P, OPK_GROUPS, OPK_VEC, OPK_DEF) : L2.step ? opkDrawDrill(L2, g, P) : opkDrawLive(L2, g, P, res),
    steps: [
      { say: () => { const r = fin();
          if (!P.running && !P.ended) return 'Three leaks, one clock. Start it, then pull levers.';
          if (P.running) return 'Minute ' + Math.floor(P.now) + '. ' + res().leaked + ' records out' + (open().length ? '.' : '. All stopped: fast-forward.');
          return opContainOk(r) ? 'Contained: ' + r.leaked + ' records, impact ' + r.impact + '.' : !r.all ? OP_PATHS.filter(p => !r.stopped.includes(p.id)).map(p => p.n).join(' and ') + ' never stopped. Run it again.'
            : 'Stopped, at impact ' + r.impact + '. The limit is ' + OP_IMPACT_MAX + '. Run it again.'; },
        side: L2 => !P.running && !P.ended ? [labBtn('▶ Start the clock', () => { P.running = true; P.tries++; P.at = L2.t; L2.repaint(); }, 'go')]
          : P.ended ? [labBtn('↺ Run it again', () => reset(L2), opContainOk(fin()) ? '' : 'go')]
          : [h('div', { class: 'labstack' }, OP_LEVERS.map(l => { const on = P.pulls.some(p => p.id === l.id);
              return labBtn((on ? '✓ ' : '') + l.s + ' · ' + l.m + ' min', () => { P.pulls.push({ id: l.id, at: Math.floor(P.now * 10) / 10 }); P.at = L2.t; L2.repaint(); }, on ? 'ok' : '', on); })),
            labBtn('⏩ Fast-forward', () => end(L2))],
        acts: L2 => [labNext(L2, 'The drill →', !(P.ended && opContainOk(fin())))] },
      { say: () => P.drilled.size < OP_SW.length ? 'Drill four kill switches against four bad nights.' : opStack(P.stack).length < OP_COND.length ? 'No switch survives every night. Pick a set that does.' : 'Gateway for speed. Identity for the copied token.',
        side: L2 => [h('div', { class: 'labstack' }, OP_SW.map(s => labBtn((P.drilled.has(s.id) ? '✓ ' : '▶ Drill: ') + s.s, () => { P.drilled.add(s.id); P.dsel = s.id; P.at = L2.t; L2.repaint(); }))),
          P.drilled.size === OP_SW.length ? [h('span', { class: 'labk' }, 'Your set'), h('div', { class: 'labchipset' }, OP_SW.map(s => gvChip(s.s, P.stack[s.id], () => { P.stack[s.id] = !P.stack[s.id]; L2.repaint(); })))] : null],
        acts: L2 => [labNext(L2, 'Close the paths →', P.drilled.size < OP_SW.length || opStack(P.stack).length < OP_COND.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPK_VEC, OPK_DEF, P.on).length; return n ? n + ' ways a kill switch fails. Switch on controls.' : 'All ' + OPK_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPK_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Small levers first, outside the agent, drilled.',
        enter: () => labDone('opkill'),
        side: () => axDebrief(P, OPK_VEC, OPK_DEF, [
          ['Mar 2016 · Tay', 'Microsoft took its chatbot offline about 16 hours after launch, once users had taught it abuse. The kill switch worked; nothing before it had.'],
          ['Jan 2024 · DPD', 'A parcel firm’s chatbot swore at a customer and wrote a poem about the company. DPD switched off the AI element and kept the rest of the chat running: a small lever.'],
          ['Aug 2012 · Knight Capital', 'Faulty automated trading lost over $440 million in about 45 minutes. There was no quick, rehearsed way to stop it.'],
          ['Aug 2025 · Salesloft Drift', 'Containment was revoking every Drift token and pulling the integration. Switching the chatbot off would not have stopped the copied tokens.']],
          ['amazonq', 'nx', 'gtg1002'], 'Rates, delays and costs are a worked scenario. The lesson is the shape: reach, delay and cost differ for every lever.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), opBack()] }
    ] };
}
// Three pipes from Relay to the attacker; levers close valves after their delay.
function opkDrawLive(L, g, P, res) {
  const pad = 30, r = res(), rx = L.w - 230, ax = pad + 60, bx = rx - 90, ys = [0.28, 0.5, 0.72].map(f => 40 + (L.h - 120) * f);
  // the clock
  opRing(g, pad + 40, 52, 30, P.now / OP_WINDOW, P.running ? LC.ink : LC.blue, 6); labText(g, String(Math.floor(P.now)), pad + 40, 59, { size: 18, w: 700, align: 'center', col: lc(LC.text, 1) }); opCap(g, 'MINUTE', pad + 40, 100, null, 'center');
  // Relay and the attacker
  const my = (ys[0] + ys[2]) / 2; opNode(g, ax, my, 26, LC.blue, true, ''); opLbl(g, 'Relay', ax, my + 46, lc(LC.text, 1), 14, 700);
  opNode(g, bx, my, 26, LC.bad, true, ''); opLbl(g, 'Attacker', bx, my + 46, lc(LC.bad, 1), 14, 700);
  OP_PATHS.forEach((p, i) => { const y = ys[i], st = r.stopAt[p.id], stopped = st != null && st <= P.now, pend = st != null && !stopped, vx = (ax + bx) / 2;
    const pts = [[ax + 26, my], [ax + 80, y], [bx - 80, y], [bx - 26, my]];
    g.strokeStyle = lc(stopped ? LC.good : LC.bad, stopped ? 0.35 : 0.5); g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.lineTo(...pts[2]); g.lineTo(...pts[3]); g.stroke(); g.lineWidth = 1; g.lineCap = 'butt';
    if (!stopped && (P.running || NN.sync)) opFlow(L, g, pts, LC.bad, Math.round(p.rate / 3), 40 + p.rate * 3, 3.2, 1);
    else if (stopped) opFlow(L, g, [pts[0], pts[1], [vx - 12, y]], LC.bad, 2, 40, 3, 0.6);
    opLbl(g, p.n, vx, y - 18, lc(LC.text, 1), 14, 700); opLbl(g, p.rate + ' records/min', vx, y + 26, lc(LC.mute, 1), 11);
    if (stopped || pend) { g.fillStyle = lc(stopped ? LC.good : LC.ink, 1); opRR(g, vx - 6, y - 14, 12, 28, 4); g.fill(); labGlow(g, vx, y, 26, stopped ? LC.good : LC.ink, 0.4);
      opLbl(g, stopped ? 'stopped at minute ' + Math.round(st * 10) / 10 : 'closing in ' + Math.max(0, st - P.now).toFixed(1) + ' min', vx, y + 44, lc(stopped ? LC.good : LC.ink, 1), 12, 700); } });
  // the score
  opBig(g, String(r.leaked), 'RECORDS LEAKED', rx, 80, LC.bad, 40);
  opRing(g, rx + 80, 190, 56, r.impact / (OP_IMPACT_MAX * 2), r.impact > OP_IMPACT_MAX ? LC.bad : LC.ink, 10, 0.5);
  labText(g, String(r.impact), rx + 80, 196, { size: 22, w: 700, align: 'center', col: lc(r.impact > OP_IMPACT_MAX ? LC.bad : LC.text, 1) }); opCap(g, 'BUSINESS IMPACT · LIMIT ' + OP_IMPACT_MAX, rx + 80, 262, null, 'center');
  const last = P.pulls.length && OP_LEVERS.find(x => x.id === P.pulls[P.pulls.length - 1].id);
  if (last) opLbl(g, last.s + ': ' + last.note, (ax + bx) / 2, L.h - 24, lc(LC.ink, 1), 14);
  if (P.ended) { const f = opContain(P.pulls); axStamp(g, (ax + bx) / 2, 50, opContainOk(f) ? 'CONTAINED' : !f.all ? 'STILL LEAKING' : 'CONTAINED · AT A COST', opContainOk(f) ? LC.good : LC.bad, L.t - P.at - 0.2, L.w > 720 ? 20 : 13); }
}
// Four switches against four bad nights.
function opkDrawDrill(L, g, P) {
  const pad = 26, lw = 190, n = OP_COND.length, cw = (L.w - lw - pad * 2) / n, top = 80, rh = Math.min(110, (L.h - top - 20) / OP_SW.length), cov = opStack(P.stack);
  OP_COND.forEach((c, j) => { const x = pad + lw + cw * (j + 0.5), ok = cov.includes(c.id); opLbl(g, c.s, x, 40, lc(ok ? LC.good : LC.text, 1), 14, 700); if (ok) opLbl(g, 'covered', x, 58, lc(LC.good, 0.9), 10); });
  OP_SW.forEach((s2, i) => { const y = top + i * rh, dr = P.drilled.has(s2.id), inS = !!P.stack[s2.id];
    if (inS) { opRR(g, pad - 10, y + 4, L.w - pad * 2 + 20, rh - 8, 14); g.fillStyle = lc(LC.good, 0.07); g.fill(); g.strokeStyle = lc(LC.good, 0.4); g.stroke(); }
    labText(g, s2.s, pad, y + rh / 2, { size: 15, w: 700, mono: false, col: lc(dr ? LC.text : LC.mute, 1) }); gvWrap(g, s2.d, pad, y + rh / 2 + 18, lw - 16, { size: 11, col: lc(LC.mute, 1), max: 2 });
    OP_COND.forEach((c, j) => { const x = pad + lw + cw * (j + 0.5), v = OP_SURVIVE[s2.id][c.id], ok = v === true, cy = y + rh / 2 - 8;
      if (!dr) { g.fillStyle = 'rgba(141,182,242,.15)'; g.beginPath(); g.arc(x, cy, 4, 0, 7); g.fill(); return; }
      const k = P.dsel === s2.id ? Math.max(0, Math.min(1, opIn(L, P, 3) * 1.6 - j * 0.25)) : 1; g.globalAlpha = k;
      opNode(g, x, cy, 14, ok ? LC.good : LC.bad, ok, ok ? '✓' : '✕');
      if (!ok) gvWrap(g, v, x, cy + 30, cw - 20, { size: 10.5, align: 'center', col: lc(LC.text, 0.75), max: 2 }); g.globalAlpha = 1; }); });
}

/* ---------- registration ---------- */
[
  { id: 'ophunt', track: 'ops', hook: 'Six ways out. Your DLP sees one.', title: 'Follow the data out', kicker: 'Data exfiltration detection · AI threat hunting', blurb: 'Map six ways data leaves an agent against the sensors you own, run a hypothesis-led hunt with eight analyst hours to find the channel, the scope, the root cause and a second way out, then turn the findings into standing detections.', mount: ophMount,
    brief: { what: 'Agents leak data through features: an image in an answer, a link, an email the agent sends, a ticket it writes. Classic DLP and proxies watch files and your own network; much of this happens in the customer’s browser or inside the agent’s tools.',
      real: 'Slack AI, Google Bard, ChatGPT memory and Microsoft 365 Copilot have all had link- or image-based leaks reported and fixed. In each, the evidence was in what the assistant retrieved and wrote.',
      todo: ['See which sensor sees each way out', 'Hunt with pivots, inside eight hours', 'Promote the findings to detections'] },
    guide: [
      { look: [['good', '●', 'Sees it'], ['ink', '◐', 'Partly'], ['bad', '○', 'Blind']], why: 'The customer’s browser fetches the image, not you.' },
      { look: [['ink', '?', 'Open pivot'], ['good', '★', 'Finding'], ['mute', '–', 'Dead end']], why: 'Each answer opens the next question.' },
      { look: [['good', '●', 'Covered'], ['bad', '○', 'Still blind']], why: 'Detect the pattern, not the domain.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Silent channels, and nobody looking.' },
      { why: 'Ask: which ways out can we see today?' }] },
  { id: 'opsoar', track: 'ops', hook: 'The attacker writes the alert your AI reads.', title: 'The SOC’s own AI', kicker: 'AI systems in the SOC · SOAR integration · incident response', blurb: 'Run a night shift with an AI triage assistant wired into SOAR and watch attacker-written alert text close real attacks and lock out your own users, redesign the automation by blast radius, then put an AI incident response in the right order.', mount: opsMount,
    brief: { what: 'AI triage in the SOC reads alerts, summarises, recommends and, through SOAR, acts. Alerts contain text the attacker wrote: email bodies, user-agent strings, file names. An AI that can be told what to do by that text is an attack surface.',
      real: 'SOC copilots became mainstream in 2024. The CrowdStrike outage the same year showed that security automation itself can take down millions of machines.',
      todo: ['Run a shift with the vendor’s automation settings', 'Redesign by blast radius until nothing is missed', 'Order the AI incident response'] },
    guide: [
      { look: [['good', '●', 'Benign'], ['ink', '●', 'Real attack'], ['violet', '●', 'Attacker-steered'], ['bad', '✕', 'Missed or outage']], why: 'Each dot lands in the lane that decided it.' },
      { look: [['good', '◔', 'Analyst minutes']], why: 'Decide per action, by blast radius.' },
      { look: [['violet', '●', 'AI-specific']], why: 'The index and prompts are the crime scene.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'The AI, and the process around it.' },
      { why: 'Ask: what can alert text make our SOAR do?' }] },
  { id: 'opkill', track: 'ops', hook: 'Three leaks, nine levers, thirty minutes.', title: 'Pull the plug', kicker: 'Runtime kill switches · containment strategies', blurb: 'An agent is leaking through three paths at once. Pull levers against a running clock, with each lever’s delay, reach and business cost, then drill four kinds of kill switch against four bad nights and build the set that survives them all.', mount: opkMount,
    brief: { what: 'Containment for an agent is not one switch. It runs as live sessions, queued jobs and tokens held by integrations, and an attacker may have copied a token. Each lever reaches some paths, takes time, and costs the business.',
      real: 'Microsoft took Tay offline; DPD switched off one AI element; Salesforce revoked every Drift token. The right lever was different every time, and the switch that helped was the one that had been planned.',
      todo: ['Contain a live leak against the clock', 'Drill four kill-switch designs', 'Build the set that survives every night'] },
    guide: [
      { look: [['bad', '•', 'Leaking'], ['ink', '▮', 'Closing'], ['good', '▮', 'Stopped']], why: 'Every lever: a delay, a reach, a cost.' },
      { look: [['good', '✓', 'Works'], ['bad', '✕', 'Fails']], why: 'Layer them.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Design, and readiness.' },
      { why: 'Ask: who may pull it at 03:00?' }] }
].forEach(x => { OP_SIMS.push(x); NN_SIMS.push(x); NN_BY[x.id] = x; });

/* ---------- the AI SecOps hub on the Advanced page ---------- */
const OP_SIM_TOPICS = id => OP_TOPICS.filter(t => t[1] === id).map(t => t[0]);
function opsHub() {
  const done = OP_SIMS.filter(x => S.nn && S.nn[x.id] && S.nn[x.id].done).length;
  const cols = [['was', 'Classic SOC'], ['miss', 'Why it misses AI'], ['add', 'Add'], ['ask', 'Ask your vendor']];
  return [
    h('p', { class: 'advlead' }, 'One leaking agent. Six consoles. No code.'),
    h('div', { class: 'govgrid' }, OP_SIMS.map((x, i) => { const ok = S.nn && S.nn[x.id] && S.nn[x.id].done;
      return h('a', { class: 'govcard opscard glow' + (ok ? ' done' : ''), href: '#adv-nn-' + x.id, style: '--i:' + i },
        h('span', { class: 'govn' }, String(i + 1).padStart(2, '0')), opsViz(x.id), h('b', null, x.title), h('span', { class: 'opshook' }, x.hook + (ok ? ' · done' : '')),
        h('span', { class: 'govtopics' }, OP_SIM_TOPICS(x.id).map(t => h('i', null, t)))); })),
    h('details', { class: 'opsplay' }, h('summary', null, 'Where AI breaks the SOC playbook'),
      h('div', { class: 'govfw', role: 'table', 'aria-label': 'How AI changes the SOC playbook' },
        h('div', { class: 'govfwrow opsrow head', role: 'row' }, h('span', { role: 'columnheader' }, ''), cols.map(([, t]) => h('span', { role: 'columnheader' }, t))),
        OP_DIFF.map(r => h('div', { class: 'govfwrow opsrow', role: 'row' }, h('b', { role: 'rowheader' }, r.k), cols.map(([k]) => h('span', { role: 'cell', class: k === 'miss' ? 'hot' : k === 'add' ? 'warm' : '' }, r[k])))))),
    h('p', { class: 'small' }, done + ' of ' + OP_SIMS.length + ' done · volumes and costs are illustrative')
  ];
}
/* A small moving picture of each instrument, for its hub card. */
function opsViz(id) {
  const A = (attr, from, to, dur, begin) => s('animate', { attributeName: attr, from, to, dur: dur + 's', begin: (begin || 0) + 's', repeatCount: 'indefinite' });
  const c = (x, y, r, cls, kids) => s('circle', { cx: x, cy: y, r, class: cls }, kids || []);
  const ln = (x1, y1, x2, y2, cls) => s('line', { x1, y1, x2, y2, class: cls });
  const kids = {
    optel: () => [ln(14, 34, 226, 34, 'tr'), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => c(14 + i * 30.3, 34, 7, [0, 1, 3, 5].includes(i) ? 'ok' : i === 6 ? 'off v' : 'off')), c(14, 34, 3.5, 'bad', [A('cx', 14, 226, 3.2)]), ln(14, 10, 226, 10, 'flat')],
    opdetect: () => Array.from({ length: 120 }, (_, k) => s('rect', { x: 8 + (k % 30) * 7.5, y: 6 + Math.floor(k / 30) * 13, width: 6, height: 11, rx: 1.5, class: [17, 43].includes(k) ? 'ok hi' : [71, 98, 113].includes(k) ? 'ink' : k < 30 ? 'ok dim' : 'bad dim' })),
    opbase: () => [s('polyline', { points: '6,52 40,50 70,51 100,49 130,42 160,33 190,22 230,10', class: 'line' }), s('polyline', { points: '6,40 40,39 70,40 100,38 130,33 160,26 190,17 230,6', class: 'band' }), c(230, 10, 4, 'bad', [A('r', 3, 7, 1.2)])],
    ophunt: () => [ln(20, 30, 80, 14, 'tr'), ln(20, 30, 80, 46, 'tr'), ln(80, 14, 140, 14, 'tr'), ln(80, 46, 140, 40, 'tr'), ln(140, 14, 200, 22, 'tr'), c(20, 30, 7, 'ok'), c(80, 14, 6, 'ok'), c(80, 46, 6, 'ok'), c(140, 14, 6, 'ok'), c(140, 40, 6, 'ink'), c(200, 22, 8, 'ink', [A('r', 6, 9, 1.4)])],
    opsoar: () => [0, 1, 2].flatMap(l => [s('rect', { x: 4, y: 3 + l * 18, width: 232, height: 14, rx: 7, class: 'lane' }), ...Array.from({ length: [9, 5, 3][l] }, (_, k) => c(16 + k * 13, 10 + l * 18, 4, l === 0 && k === 6 ? 'bad' : l === 0 && k === 3 ? 'v' : 'ok'))]).concat([c(120, -6, 4, 'ink', [A('cy', -6, 10, 1.4)])]),
    opkill: () => [10, 30, 50].flatMap((y, i) => [s('path', { d: 'M18 30 L50 ' + y + ' L190 ' + y + ' L222 30', class: 'pipe' + (i === 2 ? ' leak' : '') }), i < 2 ? s('rect', { x: 116, y: y - 7, width: 6, height: 14, rx: 2, class: 'okf' }) : c(60, y, 3, 'bad', [A('cx', 60, 190, 1.6)])]).concat([c(18, 30, 8, 'b'), c(222, 30, 8, 'bad')])
  };
  return s('svg', { class: 'opsviz', viewBox: '0 0 240 60', 'aria-hidden': 'true' }, kids[id] ? kids[id]() : []);
}
/* A link from the related modules' labs. */
const OP_LAB = { m14: ['optel', 'opdetect', 'opsoar', 'opkill'], m11: ['opdetect'], m12: ['ophunt'], m10: ['opbase', 'opkill'] };
function opsLabLink(labId) {
  const ids = OP_LAB[labId]; if (!ids) return null;
  return h('a', { class: 'raglink govlink opslink', href: '#adv-nn-' + ids[0] }, h('b', null, 'Hands-on: ' + ids.map(id => NN_BY[id].title).join(' · ')), h('span', null, 'AI SecOps instruments for this module, on the Advanced path →'));
}
