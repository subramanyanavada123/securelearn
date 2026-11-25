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
      [['DETECTIONS', () => picked() + '/' + goodN], ['CHANNELS COVERED', () => opCoverage(P.picked).length + '/' + OP_CHAN.length, opCoverage(P.picked).length === OP_CHAN.length ? 'good' : '']],
      axDefHud(P, OPH_VEC, OPH_DEF), axDefHud(P, OPH_VEC, OPH_DEF)][L.step],
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, OPH_GROUPS, OPH_VEC, OPH_DEF) : [ophDrawChan, ophDrawHunt, ophDrawPromote][L2.step](L2, g, P, used, found),
    steps: [
      { say: () => P.seen.size < OP_CHAN.length ? 'A customer says the support chat showed a broken image. DLP: no alerts. Proxy: nothing odd. Look at each way data can leave an agent, and which sensor would see it.'
          : 'Your three classic sensors fully see one channel of six. The agent’s own logs see all six.',
        side: L2 => [h('div', { class: 'labstack' }, OP_CHAN.map(c => labBtn((P.seen.has(c.id) ? '✓ ' : '▶ ') + c.t, () => { P.chan = c.id; P.seen.add(c.id); P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Start the hunt →', P.seen.size < OP_CHAN.length)] },
      { say: () => { const f = found(); return f.length < OP_FINDS.length ? 'Hypothesis: data is leaving through Relay’s answers. You have ' + OP_HUNT_H + ' analyst hours. Each pivot is a question in plain words. Find the channel, the scope, the root cause, and any second channel.' + (used() > OP_HUNT_H ? ' Over the shift: the rest goes to tomorrow.' : '')
          : 'Four findings in ' + used() + ' hours' + (OP_PIV.some(p => p.dead && P.done.has(p.id)) ? ', with a dead end or two. Dead ends are normal; the hypothesis is what keeps them few.' : '. No dead ends: the hypothesis did the work.'); },
        side: L2 => [h('div', { class: 'labstack' }, avail().map(p => labBtn('▶ ' + p.t + ' · ' + p.h + ' h', () => { P.done.add(p.id); P.last = p.id; P.at = L2.t; L2.repaint(); }))),
          h('p', { class: 'labsm' }, 'Done: ' + (P.done.size ? OP_PIV.filter(p => P.done.has(p.id)).map(p => p.t).join(' · ') : 'nothing yet'))],
        acts: L2 => [labNext(L2, 'Make it stick →', found().length < OP_FINDS.length)] },
      { say: () => P.wrong ? OP_PROMOTE.find(p => p.id === P.wrong).why : picked() < goodN ? 'A hunt that ends as a report finds the same thing next time. Turn the findings into standing detections.' : 'Four detections cover all six channels. The next leak is an alert, not a customer complaint.',
        side: L2 => [h('div', { class: 'labstack' }, OP_PROMOTE.map(p => labBtn((P.picked[p.id] ? '✓ ' : P.wrong === p.id ? '✗ ' : '+ ') + p.t, () => { if (p.good) { P.picked[p.id] = true; P.wrong = null; } else P.wrong = p.id; P.at = L2.t; L2.repaint(); }, P.picked[p.id] ? 'ok' : '')))],
        acts: L2 => [labNext(L2, 'Close the paths →', picked() < goodN)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPH_VEC, OPH_DEF, P.on).length; return n ? n + ' ways data leaves unseen. Switch on controls.' : 'All ' + OPH_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPH_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'AI exfiltration rides on normal features: links, images, emails, tickets. Hunt for it on purpose, then make every finding an alert.',
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
function ophDrawChan(L, g, P) {
  const pad = 16, lw = Math.min(280, L.w * 0.3), n = OP_SENS.length, cw = (L.w - lw - pad * 3) / n, top = 64, rh = Math.min(60, (L.h - top - 50) / OP_CHAN.length - 6);
  labText(g, 'WAYS OUT  ×  WHO WOULD SEE IT', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  OP_SENS.forEach(([k, t], j) => { const x = lw + pad * 2 + j * cw; gvWrap(g, t.toUpperCase(), x + cw / 2, top - 22, cw - 8, { size: 10, w: 700, align: 'center', col: lc(['out', 'tool'].includes(k) ? LC.good : LC.mute, 1), max: 2 }); });
  OP_CHAN.forEach((c, i) => { const y = top + i * (rh + 6), seen = P.seen.has(c.id), cur = P.chan === c.id;
    axCard(g, pad, y, lw, rh, { col: cur ? LC.ink : seen ? LC.blue : LC.mute, lines: [[c.t, lc(LC.text, seen ? 1 : 0.6), false]], fs: Math.max(10, Math.min(12, lw / 24)) });
    OP_SENS.forEach(([k], j) => { const x = lw + pad * 2 + j * cw, v = seen ? c.seen[k] || 0 : null, col = v == null ? LC.mute : v === 1 ? LC.good : v ? LC.ink : LC.bad;
      g.fillStyle = v == null ? 'rgba(141,182,242,.05)' : lc(col, v === 0 ? 0.1 : 0.22); g.fillRect(x + 3, y, cw - 6, rh); g.strokeStyle = lc(col, v == null ? 0.2 : 0.7); g.strokeRect(x + 3.5, y + 0.5, cw - 7, rh - 1);
      if (v != null) labText(g, v === 1 ? '✓' : v ? 'partly' : '✗', x + cw / 2, y + rh / 2 + 5, { size: v === 1 || !v ? 16 : 11, w: 700, align: 'center', col: lc(col, 1) }); }); });
  const c = P.chan && OP_CHAN.find(x => x.id === P.chan); if (c) gvWrap(g, c.note, L.w / 2, L.h - 26, L.w - pad * 2, { size: 13, align: 'center', col: lc(LC.ink, 1), max: 2 });
}
function ophDrawHunt(L, g, P, used, found) {
  const pad = 16, lw = L.w * 0.6, u = used();
  labText(g, 'HUNT · ' + u + ' OF ' + OP_HUNT_H + ' HOURS', pad, 24, { size: 12, w: 700, col: lc(u > OP_HUNT_H ? LC.bad : LC.blue, 1) });
  gvBar(g, pad, 32, lw - pad, 8, u / OP_HUNT_H, u > OP_HUNT_H ? LC.bad : LC.ink);
  // the pivot tree: depth by prerequisites
  const depth = id => { const p = OP_PIV.find(x => x.id === id); return p.need.length ? 1 + Math.max(...p.need.map(depth)) : 0; };
  const cols = {}; OP_PIV.forEach(p => { const d = depth(p.id); (cols[d] = cols[d] || []).push(p); });
  const nd = Object.keys(cols).length, cw = (lw - pad) / nd, pos = {};
  Object.keys(cols).sort().forEach((d, i) => cols[d].forEach((p, j) => { const n = cols[d].length, ch = Math.min(70, (L.h - 120) / n - 8); pos[p.id] = [pad + i * cw, 60 + j * (ch + 8) + (L.h - 120 - n * (ch + 8)) / 2, cw - 12, ch]; }));
  OP_PIV.forEach(p => p.need.forEach(n => { const a = pos[n], b = pos[p.id]; g.strokeStyle = lc(P.done.has(p.id) ? LC.good : LC.mute, P.done.has(p.id) ? 0.8 : 0.25); g.beginPath(); g.moveTo(a[0] + a[2], a[1] + a[3] / 2); g.lineTo(b[0], b[1] + b[3] / 2); g.stroke(); }));
  OP_PIV.forEach(p => { const [x, y, w, hh] = pos[p.id], dn = P.done.has(p.id), open = !dn && p.need.every(n => P.done.has(n)), col = dn ? (p.dead ? LC.mute : p.finds ? LC.good : LC.blue) : open ? LC.ink : LC.mute;
    if (P.last === p.id) labGlow(g, x + w / 2, y + hh / 2, w * 0.6, col, 0.25);
    axCard(g, x, y, w, hh, { col, ok: dn && !!p.finds, title: dn ? (p.dead ? 'DEAD END' : p.finds ? OP_FINDS.find(f => f[0] === p.finds)[1].toUpperCase() : 'DONE') : open ? 'OPEN · ' + p.h + ' H' : 'LOCKED', lines: [[p.t, lc(LC.text, dn || open ? 0.95 : 0.4), false]], fs: Math.max(9, Math.min(11, w / 20)) }); });
  // the last result
  const x0 = lw + pad, w = L.w - x0 - pad, p = P.last && OP_PIV.find(x => x.id === P.last);
  labText(g, 'RESULT', x0, 24, { size: 11, w: 700, col: lc(LC.mute, 1) });
  if (p) { gvWrap(g, p.t, x0, 50, w, { size: 14, w: 700, col: lc(LC.ink, 1), max: 2 });
    p.rows.forEach((r, i) => { const k = NN.sync ? 1 : Math.min(1, (L.t - P.at) * 3 - i * 0.5); if (k <= 0) return; g.globalAlpha = k;
      axCard(g, x0, 90 + i * 56, w, 48, { col: p.dead ? LC.mute : LC.good, lines: [[r, lc(LC.text, 1), true]], fs: Math.max(10, Math.min(13, w / 34)) }); g.globalAlpha = 1; }); }
  const f = found(), fy = L.h - 40, fw = (w - 18) / 4;
  OP_FINDS.forEach(([k, t], i) => axCard(g, x0 + i * (fw + 6), fy, fw, 32, { col: opTone(f.includes(k)), ok: f.includes(k), lines: [[(f.includes(k) ? '✓ ' : '○ ') + t, lc(LC.text, 1), false]], fs: Math.max(9, Math.min(11, fw / 13)) }));
}
function ophDrawPromote(L, g, P) {
  const pad = 18, cov = opCoverage(P.picked), rh = Math.min(48, (L.h - 70) / OP_CHAN.length - 6), lw = Math.min(330, L.w * 0.42);
  labText(g, 'CHANNELS WITH A STANDING DETECTION', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  OP_CHAN.forEach((c, i) => { const y = 42 + i * (rh + 6), ok = cov.includes(c.id), by = OP_PROMOTE.filter(p => p.good && P.picked[p.id] && p.covers.includes(c.id)).length;
    axCard(g, pad, y, lw, rh, { col: opTone(ok), ok, hot: !ok, lines: [[(ok ? '✓ ' : '✗ ') + c.t, lc(LC.text, 1), false]], fs: Math.max(10, Math.min(12, lw / 28)) });
    for (let k = 0; k < by; k++) { g.fillStyle = lc(LC.good, 0.9); g.beginPath(); g.arc(pad + lw + 14 + k * 14, y + rh / 2, 5, 0, 7); g.fill(); } });
  const x0 = pad * 2 + lw + 60, w = L.w - x0 - pad; if (w < 140) return;
  labText(g, 'YOUR DETECTIONS', x0, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  OP_PROMOTE.filter(p => P.picked[p.id] || P.wrong === p.id).forEach((p, i) => axCard(g, x0, 42 + i * 62, w, 54, { col: p.good ? LC.good : LC.bad, ok: p.good, hot: !p.good, lines: [[p.t, lc(LC.text, 1), false]], fs: Math.max(10, Math.min(12, w / 30)) }));
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
      { say: () => !P.ran1 ? 'Your SOC added an AI triage assistant, wired into SOAR. Below: the vendor’s recommended automation. Run tonight’s shift of 40 alerts.'
          : 'Saved ' + res().saved + ' analyst minutes. Missed ' + res().missed + ' real attacks, closed because the alert text told the AI to. ' + res().outages.length + ' outages caused by your own automation.',
        side: L2 => [h('div', { class: 'fiout' }, h('span', { class: 'labk' }, 'Vendor settings'), OP_ACTS.map(a => h('div', null, h('i', null, OP_MODES.find(m => m[0] === P.mode[a.id])[1]), a.t))),
          labBtn('▶ Run the shift', () => go(L2), 'go')],
        acts: L2 => [labNext(L2, 'Redesign it →', !P.ran1)] },
      { enter: () => { P.run = null; P.ok2 = false; },
        say: () => { const r = res(); return !r ? 'Target: no missed attacks, no outages, within ' + OP_SOC_MIN + ' analyst minutes, and at least 250 minutes saved. Set each action, then run.'
          : P.ok2 ? 'Zero missed, zero outages, ' + r.saved + ' minutes saved. The AI still does most of the work; it cannot act alone where one wrong step hurts.'
          : 'Missed ' + r.missed + ', outages ' + r.outages.length + ', ' + r.min + ' analyst minutes, ' + r.saved + ' saved.' + (r.backlog ? ' ' + r.backlog + ' alerts left in the queue at the end of the shift.' : '') + ' Adjust and run again.'; },
        side: L2 => [OP_ACTS.map(a => opSeg(a.t, OP_MODES, P.mode[a.id], v => { P.mode[a.id] = v; dirty(L2); })),
          h('div', { class: 'labchipset' }, OP_GUARDS.map(([k, t]) => gvChip(t, P.guard[k], () => { P.guard[k] = !P.guard[k]; dirty(L2); }))),
          labBtn('▶ Run the shift', () => go(L2), 'go')],
        acts: L2 => [labNext(L2, 'The incident workflow →', !P.ok2)] },
      { say: () => P.placed.length === OP_IR.length ? 'Declare, contain and preserve, then scope, eradicate, notify, recover, learn. The AI-specific part is what you preserve: the index, the prompts, the model version.'
          : P.wrong ? P.wrong : 'Relay’s leak is confirmed. Put the response in order: click the next step.',
        side: L2 => [h('div', { class: 'labstack' }, P.deck.filter(id => !P.placed.includes(id)).map(id => labBtn(OP_IR.find(x => x.id === id).t, () => { const why = opIrTry(P.placed, id); if (why) P.wrong = why; else { P.placed.push(id); P.wrong = null; } P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.placed.length < OP_IR.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPS_VEC, OPS_DEF, P.on).length; return n ? n + ' ways an AI-assisted SOC is turned against itself. Switch on controls.' : 'All ' + OPS_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPS_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Everything in an alert can be written by the attacker. Let the AI read it, never let it alone act on it where one mistake is expensive.',
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
function opsDrawShift(L, g, P) {
  const pad = 16, r = P.run, lw = L.w - 240 - pad * 3, lanes = OP_MODES, lh = Math.min(120, (L.h - 70) / 3 - 10);
  labText(g, 'TONIGHT’S SHIFT · 40 ALERTS · TWO STEPS EACH: ENRICH, THEN DECIDE', pad, 24, { size: 12, w: 700, col: lc(LC.blue, 1) });
  lanes.forEach(([k, t], i) => { const y = 40 + i * (lh + 10); g.fillStyle = 'rgba(141,182,242,.05)'; g.fillRect(pad, y, lw, lh); labText(g, t.toUpperCase(), pad + 8, y + 16, { size: 10, w: 700, col: lc(LC.mute, 1) }); });
  const shown = !r ? 0 : NN.sync ? 40 : Math.min(40, Math.floor((L.t - P.runAt) * 14)), seat = [0, 0, 0];
  for (let i = 0; i < shown; i++) { const x = OP_SHIFT[i], e = r.events[i], lane = OP_MODES.findIndex(m => m[0] === e.lanes[1]), k = seat[lane]++, y = 40 + lane * (lh + 10), cx = pad + 18 + (k % 20) * ((lw - 36) / 20), cy = y + 38 + Math.floor(k / 20) * 30;
    const col = e.bad ? LC.bad : e.saved ? LC.violet : x.real ? LC.ink : x.poison ? LC.violet : LC.good;
    g.fillStyle = lc(col, e.bad ? 1 : 0.75); g.beginPath(); g.arc(cx, cy, e.bad ? 8 : 6, 0, 7); g.fill();
    if (e.bad) labText(g, e.bad === 'outage' ? '!' : '✗', cx, cy + 4, { size: 10, w: 800, align: 'center', col: '#0B1226' }); }
  const bx = pad * 2 + lw, bw = 240;
  if (!r) { gvWrap(g, 'Run the shift.', bx + bw / 2, L.h / 2, bw - 20, { size: 15, align: 'center', col: lc(LC.mute, 1) }); return; }
  labText(g, 'ANALYST MINUTES', bx, 46, { size: 10, w: 700, col: lc(LC.mute, 1) }); gvBar(g, bx, 54, bw, 10, r.min / Math.max(OP_SOC_MIN, r.min), r.min > OP_SOC_MIN ? LC.bad : LC.good);
  labText(g, r.min + ' of ' + OP_SOC_MIN + ' · saved ' + r.saved, bx, 80, { size: 12, w: 700, col: lc(LC.text, 1) });
  [['Missed attacks', r.missed, r.missed], ['Outages you caused', r.outages.length, r.outages.length]].forEach(([t, v, bad], i) => { labText(g, t.toUpperCase(), bx, 112 + i * 54, { size: 10, w: 700, col: lc(LC.mute, 1) }); labText(g, String(v), bx, 140 + i * 54, { size: 26, w: 700, col: lc(bad ? LC.bad : LC.good, 1) }); });
  let y = 230; OP_SHIFT.filter(x => x.poison).forEach(x => { const e = r.events[x.i]; if (y > L.h - 50) return;
    axCard(g, bx, y, bw, 52, { col: e.bad ? LC.bad : LC.good, hot: !!e.bad, ok: !e.bad, title: e.bad ? (e.bad === 'outage' ? 'OUTAGE' : 'MISSED') : 'STOPPED', lines: [[x.harm && e.bad ? x.harm : x.t, lc(LC.text, 1), false]], fs: 10 }); y += 58; });
  labText(g, '● benign  ● real  ● attacker-steered  ✗ missed  ! outage', pad, L.h - 6, { size: 10, col: lc(LC.mute, 1) });
}
function opsDrawIr(L, g, P) {
  const pad = 20, rh = Math.min(50, (L.h - 60) / OP_IR.length - 6), w = Math.min(L.w - pad * 2, 760), x = (L.w - w) / 2;
  labText(g, 'INCIDENT 2231 · RESPONSE ORDER', x, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  OP_IR.forEach((_, i) => { const y = 40 + i * (rh + 6), id = P.placed[i], s = id && OP_IR.find(q => q.id === id);
    if (!s) { g.strokeStyle = lc(LC.mute, 0.25); g.setLineDash([4, 4]); g.strokeRect(x + 0.5, y + 0.5, w - 1, rh - 1); g.setLineDash([]); labText(g, String(i + 1), x + 14, y + rh / 2 + 4, { size: 12, col: lc(LC.mute, 0.6) }); return; }
    const ai = ['preserve', 'scope', 'erad'].includes(id);
    axCard(g, x, y, w, rh, { col: ai ? LC.violet : LC.good, ok: true, lines: [[(i + 1) + '.  ' + s.t + (ai ? '   · AI-specific' : ''), lc(LC.text, 1), false]], fs: Math.max(10, Math.min(13, w / 62)) }); });
  if (P.wrong) axStamp(g, L.w / 2, L.h - 24, 'OUT OF ORDER', LC.bad, L.t - P.at, L.w > 720 ? 16 : 11);
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
          if (!P.running && !P.ended) return 'Minute 0. Relay is leaking through three paths at once. Every minute costs records; every lever you pull costs the business. Start the clock, then pull levers.';
          if (P.running) { const o = open(); return 'Minute ' + Math.floor(P.now) + '. ' + res().leaked + ' records out. ' + (o.length ? 'Still open: ' + o.join('; ') + '.' : 'All three paths stopped. Fast-forward to see the cost.'); }
          return opContainOk(r) ? 'Contained: ' + r.leaked + ' records leaked, business impact ' + r.impact + '. The smallest levers that reach each path, including the one that reaches the attacker’s copy.'
            : !r.all ? 'Minute 30 and ' + OP_PATHS.filter(p => !r.stopped.includes(p.id)).map(p => p.s).join(' and ') + ' never stopped. Read what each lever reaches, then run it again.'
            : 'All stopped, but business impact ' + r.impact + ' against a limit of ' + OP_IMPACT_MAX + '. The big levers stop the leak by stopping the company. Run it again.'; },
        side: L2 => !P.running && !P.ended ? [labBtn('▶ Start the clock', () => { P.running = true; P.tries++; P.at = L2.t; L2.repaint(); }, 'go'), h('p', { class: 'labsm' }, 'One minute every ' + OP_SEC_PER_MIN + ' seconds. Each lever takes effect after its own delay.')]
          : P.ended ? [labBtn('↺ Run it again', () => reset(L2), opContainOk(fin()) ? '' : 'go')]
          : [h('div', { class: 'labstack' }, OP_LEVERS.map(l => { const on = P.pulls.some(p => p.id === l.id);
              return labBtn((on ? '✓ ' : '') + l.t + ' · ' + l.m + ' min', () => { P.pulls.push({ id: l.id, at: Math.floor(P.now * 10) / 10 }); P.at = L2.t; L2.repaint(); }, on ? 'ok' : '', on); })),
            labBtn('⏩ Fast-forward to minute 30', () => end(L2))],
        acts: L2 => [labNext(L2, 'The drill →', !(P.ended && opContainOk(fin())))] },
      { say: () => P.drilled.size < OP_SW.length ? 'That went well because the switches worked. Drill four kinds of kill switch against four bad nights.'
          : opStack(P.stack).length < OP_COND.length ? 'No single switch survives every night. Choose the set you would build: it has to survive all four.'
          : 'Two layers, outside the agent, each tested: the gateway for speed and for on-call, the identity provider for the copied token.',
        side: L2 => [h('div', { class: 'labstack' }, OP_SW.map(s => labBtn((P.drilled.has(s.id) ? '✓ ' : '▶ Drill: ') + s.t, () => { P.drilled.add(s.id); P.dsel = s.id; P.at = L2.t; L2.repaint(); }))),
          P.drilled.size === OP_SW.length ? [h('span', { class: 'labk' }, 'Your kill-switch set'), h('div', { class: 'labchipset' }, OP_SW.map(s => gvChip(s.t, P.stack[s.id], () => { P.stack[s.id] = !P.stack[s.id]; L2.repaint(); })))] : null],
        acts: L2 => [labNext(L2, 'Close the paths →', P.drilled.size < OP_SW.length || opStack(P.stack).length < OP_COND.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPK_VEC, OPK_DEF, P.on).length; return n ? n + ' ways a kill switch fails on the night. Switch on controls.' : 'All ' + OPK_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPK_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'A kill switch is a set of levers outside the agent, the smallest first, that on-call may pull at 03:00 and has pulled in a drill.',
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
function opkDrawLive(L, g, P, res) {
  const pad = 18, r = res(), lw = L.w - 250 - pad * 3, rh = Math.min(96, (L.h - 120) / 3 - 12);
  labText(g, 'MINUTE ' + Math.floor(P.now) + ' OF ' + OP_WINDOW, pad, 30, { size: 20, w: 700, col: lc(P.running ? LC.ink : LC.blue, 1) }); gvBar(g, pad, 40, lw, 6, P.now / OP_WINDOW, LC.ink);
  OP_PATHS.forEach((p, i) => { const y = 62 + i * (rh + 12), st = r.stopAt[p.id], stopped = st != null && st <= P.now, mins = Math.min(P.now, st == null ? P.now : st);
    axCard(g, pad, y, lw, rh, { col: stopped ? LC.good : LC.bad, ok: stopped, hot: !stopped && P.now > 0, title: (stopped ? 'STOPPED AT MINUTE ' + st : st != null ? 'STOPPING AT MINUTE ' + st : 'OPEN') + ' · ' + p.rate + ' RECORDS/MIN', lines: [[p.t, lc(LC.text, 1), false], [Math.round(p.rate * mins) + (Math.round(p.rate * mins) === 1 ? ' record' : ' records'), lc(stopped ? LC.good : LC.bad, 1), true]], fs: Math.max(11, Math.min(13, lw / 50)) });
    if (!stopped && P.running && !NN.sync) for (let k = 0; k < 6; k++) { const ph = (L.t * (0.4 + p.rate / 60) + k / 6) % 1; g.fillStyle = lc(LC.bad, 0.9 * (1 - ph)); g.beginPath(); g.arc(pad + lw * 0.55 + lw * 0.42 * ph, y + rh - 14, 3, 0, 7); g.fill(); } });
  // pulled levers, with their delay
  const bx = pad * 2 + lw, bw = 250;
  labText(g, 'RECORDS LEAKED', bx, 30, { size: 10, w: 700, col: lc(LC.mute, 1) }); labText(g, String(r.leaked), bx, 60, { size: 30, w: 700, col: lc(LC.bad, 1) });
  labText(g, 'BUSINESS IMPACT', bx, 92, { size: 10, w: 700, col: lc(LC.mute, 1) }); gvBar(g, bx, 100, bw, 10, r.impact / (OP_IMPACT_MAX * 2), r.impact > OP_IMPACT_MAX ? LC.bad : LC.ink);
  g.strokeStyle = lc(LC.text, 0.8); g.beginPath(); g.moveTo(bx + bw / 2, 96); g.lineTo(bx + bw / 2, 114); g.stroke(); labText(g, r.impact + ' · limit ' + OP_IMPACT_MAX, bx, 130, { size: 11, col: lc(LC.text, 1) });
  P.pulls.forEach((p, i) => { const l = OP_LEVERS.find(x => x.id === p.id), y = 146 + i * 50; if (y > L.h - 50) return; const live = P.now >= p.at + l.m;
    axCard(g, bx, y, bw, 44, { col: live ? (l.stops.length ? LC.good : LC.mute) : LC.ink, title: (live ? 'LIVE' : 'IN ' + Math.max(0, p.at + l.m - P.now).toFixed(1) + ' MIN') + ' · pulled at ' + Math.floor(p.at), lines: [[l.t, lc(LC.text, 1), false]], fs: 10 }); });
  const last = P.pulls.length && OP_LEVERS.find(x => x.id === P.pulls[P.pulls.length - 1].id);
  if (last) gvWrap(g, last.note, pad, L.h - 22, lw, { size: 12, col: lc(LC.ink, 1), max: 2 });
  if (P.ended) { const f = opContain(P.pulls); axStamp(g, pad + lw / 2, L.h / 2, opContainOk(f) ? 'CONTAINED' : !f.all ? 'STILL LEAKING' : 'CONTAINED · AT A COST', opContainOk(f) ? LC.good : LC.bad, L.t - P.at - 0.2, L.w > 720 ? 22 : 14); }
}
function opkDrawDrill(L, g, P) {
  const pad = 16, lw = Math.min(250, L.w * 0.26), n = OP_COND.length, cw = (L.w - lw - pad * 3) / n, top = 70, rh = Math.min(88, (L.h - top - 40) / OP_SW.length - 8), cov = opStack(P.stack);
  labText(g, 'KILL-SWITCH DRILL · FOUR DESIGNS, FOUR BAD NIGHTS', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  OP_COND.forEach((c, j) => { const x = lw + pad * 2 + j * cw; gvWrap(g, c.t, x + cw / 2, top - 30, cw - 10, { size: 11, w: 700, align: 'center', col: lc(cov.includes(c.id) ? LC.good : LC.text, 1), max: 2 }); });
  OP_SW.forEach((s, i) => { const y = top + i * (rh + 8), dr = P.drilled.has(s.id), inS = !!P.stack[s.id];
    axCard(g, pad, y, lw, rh, { col: inS ? LC.good : dr ? LC.blue : LC.mute, ok: inS, title: inS ? 'IN YOUR SET' : dr ? 'DRILLED' : 'NOT DRILLED', lines: [[s.t, lc(LC.text, 1), false], [s.d, lc(LC.mute, 1), false]], fs: Math.max(10, Math.min(12, lw / 22)) });
    OP_COND.forEach((c, j) => { const x = lw + pad * 2 + j * cw, v = OP_SURVIVE[s.id][c.id], ok = v === true;
      if (!dr) { g.fillStyle = 'rgba(141,182,242,.05)'; g.fillRect(x + 3, y, cw - 6, rh); return; }
      g.fillStyle = lc(ok ? LC.good : LC.bad, 0.14); g.fillRect(x + 3, y, cw - 6, rh); g.strokeStyle = lc(ok ? LC.good : LC.bad, 0.6); g.strokeRect(x + 3.5, y + 0.5, cw - 7, rh - 1);
      labText(g, ok ? '✓ works' : '✗ fails', x + 12, y + 20, { size: 12, w: 700, col: lc(ok ? LC.good : LC.bad, 1) });
      if (!ok) fiClip(g, x + 3, y, cw - 6, rh, () => gvWrap(g, v, x + 12, y + 38, cw - 24, { size: 10.5, col: lc(LC.text, 0.85), max: 3 })); }); });
}

/* ---------- registration ---------- */
[
  { id: 'ophunt', track: 'ops', title: 'Follow the data out', kicker: 'Data exfiltration detection · AI threat hunting', blurb: 'Map six ways data leaves an agent against the sensors you own, run a hypothesis-led hunt with eight analyst hours to find the channel, the scope, the root cause and a second way out, then turn the findings into standing detections.', mount: ophMount,
    brief: { what: 'Agents leak data through features: an image in an answer, a link, an email the agent sends, a ticket it writes. Classic DLP and proxies watch files and your own network; much of this happens in the customer’s browser or inside the agent’s tools.',
      real: 'Slack AI, Google Bard, ChatGPT memory and Microsoft 365 Copilot have all had link- or image-based leaks reported and fixed. In each, the evidence was in what the assistant retrieved and wrote.',
      todo: ['See which sensor sees each way out', 'Hunt with pivots, inside eight hours', 'Promote the findings to detections'] },
    guide: [
      { look: [['good', '✓', 'Sees it.'], ['ink', '~', 'Partly.'], ['bad', '✗', 'Blind.']], why: 'The image is fetched by the customer’s browser. Your proxy and DLP never see the request; only the agent’s own answer log does.' },
      { look: [['ink', '▭', 'Open pivot, with its cost.'], ['good', '▭', 'A finding.'], ['mute', '▭', 'A dead end.']], why: 'A hunt starts from a hypothesis and pivots on what it finds. Each answer opens the next question.' },
      { look: [['good', '▭', 'Channel covered by a standing detection.'], ['bad', '▭', 'Still blind.']], why: 'A block is not a detection, and an alert on every image is noise. Detect the pattern, not the domain.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Exfiltration fails silent at the channel and in how you look.' },
      { why: 'Ask: which of the six ways out could we see today, and when did we last hunt for them?' }] },
  { id: 'opsoar', track: 'ops', title: 'The SOC’s own AI', kicker: 'AI systems in the SOC · SOAR integration · incident response', blurb: 'Run a night shift with an AI triage assistant wired into SOAR and watch attacker-written alert text close real attacks and lock out your own users, redesign the automation by blast radius, then put an AI incident response in the right order.', mount: opsMount,
    brief: { what: 'AI triage in the SOC reads alerts, summarises, recommends and, through SOAR, acts. Alerts contain text the attacker wrote: email bodies, user-agent strings, file names. An AI that can be told what to do by that text is an attack surface.',
      real: 'SOC copilots became mainstream in 2024. The CrowdStrike outage the same year showed that security automation itself can take down millions of machines.',
      todo: ['Run a shift with the vendor’s automation settings', 'Redesign by blast radius until nothing is missed', 'Order the AI incident response'] },
    guide: [
      { look: [['good', '●', 'Benign, closed.'], ['ink', '●', 'Real attack.'], ['violet', '●', 'Alert steered by the attacker.'], ['bad', '✗', 'Missed or outage.']], why: 'The dots sit in the lane that made the decision. Steered alerts in the auto lane do what the attacker wrote.' },
      { look: [['good', '▬', 'Analyst minutes used, against the shift.']], why: 'All-human runs out of minutes and misses attacks in the backlog. All-auto is fast and dangerous. Decide per action, by blast radius.' },
      { look: [['violet', '▭', 'AI-specific steps.']], why: 'Preserve before you fix: the index, the prompts, the config and the model version are the AI crime scene.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'The AI in the loop and the process around it both fail.' },
      { why: 'Ask: which automated actions can text inside an alert influence, and which run without a person?' }] },
  { id: 'opkill', track: 'ops', title: 'Pull the plug', kicker: 'Runtime kill switches · containment strategies', blurb: 'An agent is leaking through three paths at once. Pull levers against a running clock, with each lever’s delay, reach and business cost, then drill four kinds of kill switch against four bad nights and build the set that survives them all.', mount: opkMount,
    brief: { what: 'Containment for an agent is not one switch. It runs as live sessions, queued jobs and tokens held by integrations, and an attacker may have copied a token. Each lever reaches some paths, takes time, and costs the business.',
      real: 'Microsoft took Tay offline; DPD switched off one AI element; Salesforce revoked every Drift token. The right lever was different every time, and the switch that helped was the one that had been planned.',
      todo: ['Contain a live leak against the clock', 'Drill four kill-switch designs', 'Build the set that survives every night'] },
    guide: [
      { look: [['bad', '▭', 'A path still leaking.'], ['good', '▭', 'Stopped.'], ['ink', '▭', 'A lever on its way.']], why: 'Each lever has a delay, a reach and a cost. The platform-wide switch is fast and costly, and does not touch the copied token.' },
      { look: [['good', '✓', 'Works that night.'], ['bad', '✗', 'Fails, and why.']], why: 'A flag inside the app dies with the app. Identity revocation reaches copied tokens but needs authority at 03:00. Layer them.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Kill switches fail in design and in readiness.' },
      { why: 'Ask: what are our levers for each agent, who may pull them at 03:00, and when did we last time a drill?' }] }
].forEach(x => { OP_SIMS.push(x); NN_SIMS.push(x); NN_BY[x.id] = x; });

/* ---------- the AI SecOps hub on the Advanced page ---------- */
const OP_SIM_TOPICS = id => OP_TOPICS.filter(t => t[1] === id).map(t => t[0]);
function opsHub() {
  const done = OP_SIMS.filter(x => S.nn && S.nn[x.id] && S.nn[x.id].done).length;
  const cols = [['was', 'Classic SOC'], ['miss', 'Why it misses AI'], ['add', 'Add'], ['ask', 'Ask your vendor']];
  return [
    h('p', { class: 'advlead' }, 'Fourteen AI security operations topics, taught as six instruments for operations engineers. No code, no queries: budgets, queues, baselines, pivots, playbooks and levers. One incident runs through all six: Relay, a support agent, leaking customer records.'),
    h('div', { class: 'govgrid' }, OP_SIMS.map((x, i) => { const ok = S.nn && S.nn[x.id] && S.nn[x.id].done;
      return h('a', { class: 'govcard opscard glow' + (ok ? ' done' : ''), href: '#adv-nn-' + x.id, style: '--i:' + i },
        h('span', { class: 'govn' }, String(i + 1).padStart(2, '0')), h('span', { class: 'kicker' }, x.kicker + (ok ? ' · done' : '')), h('b', null, x.title), h('span', { class: 'clamp' }, x.blurb),
        h('span', { class: 'govtopics' }, OP_SIM_TOPICS(x.id).map(t => h('i', null, t)))); })),
    h('h2', { class: 'sylgroup' }, 'Where AI breaks the SOC playbook'),
    h('p', { class: 'advlead' }, 'Same SOC, same tools. Each row is a place where the classic approach goes quiet on an AI system, and what to add.'),
    h('div', { class: 'govfw', role: 'table', 'aria-label': 'How AI changes the SOC playbook' },
      h('div', { class: 'govfwrow opsrow head', role: 'row' }, h('span', { role: 'columnheader' }, ''), cols.map(([, t]) => h('span', { role: 'columnheader' }, t))),
      OP_DIFF.map(r => h('div', { class: 'govfwrow opsrow', role: 'row' }, h('b', { role: 'rowheader' }, r.k), cols.map(([k]) => h('span', { role: 'cell', class: k === 'miss' ? 'hot' : k === 'add' ? 'warm' : '' }, r[k]))))),
    h('p', { class: 'small' }, done + ' of ' + OP_SIMS.length + ' AI SecOps instruments done. Volumes, rates and costs are illustrative.')
  ];
}
/* A link from the related modules' labs. */
const OP_LAB = { m14: ['optel', 'opdetect', 'opsoar', 'opkill'], m11: ['opdetect'], m12: ['ophunt'], m10: ['opbase', 'opkill'] };
function opsLabLink(labId) {
  const ids = OP_LAB[labId]; if (!ids) return null;
  return h('a', { class: 'raglink govlink opslink', href: '#adv-nn-' + ids[0] }, h('b', null, 'Hands-on: ' + ids.map(id => NN_BY[id].title).join(' · ')), h('span', null, 'AI SecOps instruments for this module, on the Advanced path →'));
}
