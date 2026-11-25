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

function optMount(L) {
  const P = { sel: { gw: true, egress: true }, pipe: Object.assign({}, OP_PIPE0), touched: new Set(), asked: new Set(), q: null, on: {}, flash: {}, at: -9 };
  const nAns = () => OP_Q.filter(q => opAnswered(P.sel, q)).length, gb = () => opGb(P.sel), pipe = () => opPipe(P.pipe);
  return { P,
    hud: () => [
      [['INGEST', () => gb().toFixed(1) + ' / ' + OP_BUDGET + ' GB/day', gb() > OP_BUDGET ? 'bad' : 'good'], ['ANSWERS', () => nAns() + '/6', nAns() === 6 ? 'good' : 'bad'], ['CHAIN SEEN', () => OP_CHAIN.filter(c => !c.noise && opSeen(P.sel, c)).length + '/' + OP_CHAIN.filter(c => !c.noise).length]],
      [['ANSWERS SURVIVE', () => pipe().ok.length + '/6', pipe().ok.length === 6 ? 'good' : 'bad'], ['PRIVACY', () => pipe().privacy ? 'protected' : 'raw PII in SIEM', pipe().privacy ? 'good' : 'bad']],
      [['ASKED', () => P.asked.size + '/6'], ['FIELDS JOINED', () => String(OP_Q.filter(q => P.asked.has(q.id)).reduce((a, q) => a + q.f.length, 0))]],
      axDefHud(P, OPT_VEC, OPT_DEF), axDefHud(P, OPT_VEC, OPT_DEF)][L.step],
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, OPT_GROUPS, OPT_VEC, OPT_DEF) : [optDrawSources, optDrawPipe, optDrawSiem][L2.step](L2, g, P),
    steps: [
      { say: () => gb() > OP_BUDGET ? 'Over budget by ' + (gb() - OP_BUDGET).toFixed(1) + ' GB a day. Full transcripts alone are 38. Which smaller sources answer the same questions?'
          : nAns() < 6 ? 'Relay leaked customer records for 19 days. Your SIEM showed the gateway and the proxy: all green. Pick what else to collect, within ' + OP_BUDGET + ' GB a day, until all six questions can be answered.'
          : 'Six of six, for ' + (gb() - 15).toFixed(1) + ' GB a day more. Structured AI fields answer the questions; you did not need every word.',
        side: L2 => [h('div', { class: 'labchipset' }, OP_SRC.map(s => gvChip(s.t + ' · ' + s.gb + ' GB', P.sel[s.id], () => { P.sel[s.id] = !P.sel[s.id]; P.at = L2.t; L2.repaint(); }, s.pii ? 'bad' : ''))),
          h('p', { class: 'labsm' }, 'Gateway and proxy logs are already on. Red: holds personal data in full.')],
        acts: L2 => [labNext(L2, 'Now the pipeline →', nAns() < 6 || gb() > OP_BUDGET)] },
      { say: () => { const r = pipe(); return r.ok.length < 6 ? 'The right sources are on. Between them and the SIEM sits the logging team’s standard pipeline. ' + (6 - r.ok.length) + ' answers die in it. Fix each setting.'
          : !r.privacy ? 'All six survive, but raw personal data now sits in the SIEM. The data protection officer says no. Protect it without losing the answers.'
          : 'Every default was sensible for web logs. Each one quietly destroyed an AI answer.'; },
        side: L2 => [['sample', 'Sampling'], ['redact', 'Personal data'], ['retain', 'Retention'], ['parse', 'Parsing']].map(([k, t]) => opSeg(t, OP_PIPE[k], P.pipe[k], v => { P.pipe[k] = v; P.touched.add(k); P.at = L2.t; L2.repaint(); })),
        acts: L2 => [labNext(L2, 'Ask the SIEM →', !opPipeOk(P.pipe))] },
      { say: () => P.asked.size < 6 ? 'Now ask the six questions, in plain words. Each answer is a join across fields that only exist because you collected and parsed them.' : 'Six answers in minutes, not a forensic project. That is what SIEM integration for AI means.',
        side: L2 => [h('div', { class: 'labstack' }, OP_Q.map(q => labBtn((P.asked.has(q.id) ? '✓ ' : '▶ ') + q.t, () => { P.q = q.id; P.asked.add(q.id); P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.asked.size < 6)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPT_VEC, OPT_DEF, P.on).length; return n ? n + ' ways the evidence goes missing. Switch on controls.' : 'All ' + OPT_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPT_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Before an AI incident, decide the six questions you will be asked, and test that your telemetry can answer them.',
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
function optDrawSources(L, g, P) {
  const pad = 16, lw = Math.min(330, L.w * 0.38), gb = opGb(P.sel), max = Math.max(OP_BUDGET * 1.6, gb);
  labText(g, 'INGEST · GB PER DAY', pad, 24, { size: 11, w: 700, col: lc(LC.blue, 1) });
  let x = pad; OP_SRC.filter(s => P.sel[s.id]).forEach(s => { const w = (lw - 4) * s.gb / max; g.fillStyle = lc(s.pii ? LC.bad : s.def ? LC.mute : LC.good, 0.75); g.fillRect(x, 32, Math.max(1, w - 1), 18); x += w; });
  const bx = pad + (lw - 4) * OP_BUDGET / max; g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 2; g.beginPath(); g.moveTo(bx, 26); g.lineTo(bx, 56); g.stroke(); g.lineWidth = 1;
  labText(g, 'budget ' + OP_BUDGET, bx, 70, { size: 10, align: 'center', col: lc(LC.ink, 1) });
  const rh = Math.max(20, Math.min(34, (L.h - 100) / OP_SRC.length - 4));
  OP_SRC.forEach((s, i) => { const y = 84 + i * (rh + 4), on = !!P.sel[s.id];
    g.fillStyle = on ? lc(s.pii ? LC.bad : LC.good, 0.14) : 'rgba(141,182,242,.05)'; g.fillRect(pad, y, lw, rh);
    labText(g, (on ? '● ' : '○ ') + s.t, pad + 8, y + rh / 2 + 4, { size: Math.min(12, rh / 2.2), mono: false, w: 600, col: lc(on ? LC.text : LC.mute, 1) });
    labText(g, s.gb + ' GB', pad + lw - 8, y + rh / 2 + 4, { size: 10, align: 'right', col: lc(LC.mute, 1) }); });
  // the incident, step by step
  const cx = pad * 2 + lw, cw = L.w - cx - pad, ch = Math.max(26, Math.min(44, (L.h - 150) / OP_CHAIN.length - 4));
  labText(g, 'THE INCIDENT · WHAT YOUR SIEM CAN SEE', cx, 24, { size: 11, w: 700, col: lc(LC.blue, 1) });
  OP_CHAIN.forEach((c, i) => { const y = 36 + i * (ch + 4), seen = opSeen(P.sel, c), col = c.noise ? LC.mute : c.dark ? LC.violet : seen ? LC.good : LC.bad;
    axCard(g, cx, y, cw, ch, { col, ok: seen && !c.noise, lines: [[(c.noise ? '· ' : seen ? '✓ ' : '✗ ') + c.when + '  ' + c.t + (c.dark ? ' · ' + c.dark : c.noise ? ' · seen, and useless' : seen ? '' : ' · dark'), lc(c.noise ? LC.mute : LC.text, 1), false]], fs: Math.max(10, Math.min(12, cw / 62)) }); });
  const qy = L.h - 34, qw = (cw - 5 * 6) / 6;
  OP_Q.forEach((q, i) => { const ok = opAnswered(P.sel, q), x2 = cx + i * (qw + 6);
    axCard(g, x2, qy, qw, 28, { col: opTone(ok), ok, hot: !ok, lines: [[(ok ? '✓ ' : '✗ ') + q.t, lc(LC.text, 1), false]], fs: Math.max(9, Math.min(11, qw / 15)) }); });
}
function optDrawPipe(L, g, P) {
  const r = opPipe(P.pipe), pad = 16, stages = [['Sources', 'AI fields on', null], ['Sampling', OP_PIPE.sample.find(o => o[0] === P.pipe.sample)[1], ['what', 'whom']], ['Personal data', OP_PIPE.redact.find(o => o[0] === P.pipe.redact)[1], ['what', 'where']],
    ['Parsing', OP_PIPE.parse.find(o => o[0] === P.pipe.parse)[1], ['whom', 'ours']], ['SIEM', OP_PIPE.retain.find(o => o[0] === P.pipe.retain)[1], ['src', 'since']]];
  const n = stages.length, bw = (L.w - pad * 2 - (n - 1) * 26) / n, by = 40, bh = 74;
  const bad = st => st[2] && Object.entries(r.lost).some(([q, why]) => st[2].includes(q) && why.startsWith({ Sampling: 'Sampled', 'Personal data': 'Redacted', Parsing: 'Unparsed', SIEM: 'Aged' }[st[0]]));
  stages.forEach((st, i) => { const x = pad + i * (bw + 26), b = bad(st), priv = st[0] === 'Personal data' && !r.privacy;
    axCard(g, x, by, bw, bh, { col: b || priv ? LC.bad : LC.good, hot: b || priv, ok: !b && !priv, title: st[0].toUpperCase(), lines: [[st[1], lc(LC.text, 1), false]], fs: Math.max(10, Math.min(13, bw / 13)) });
    if (i < n - 1) { const ax = x + bw + 4, ay = by + bh / 2; g.strokeStyle = lc(LC.blue, 0.7); g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 18, ay); g.stroke(); g.fillStyle = lc(LC.blue, 0.8); g.beginPath(); g.moveTo(ax + 18, ay - 4); g.lineTo(ax + 23, ay); g.lineTo(ax + 18, ay + 4); g.fill(); }
    // events flowing through
    if (!NN.sync) for (let k = 0; k < 3; k++) { const ph = (L.t * 0.6 + k / 3 + i * 0.13) % 1; g.fillStyle = lc(b ? LC.bad : LC.blue, 0.8 * (1 - ph)); g.beginPath(); g.arc(x + bw * ph, by + bh + 10, 2.5, 0, 7); g.fill(); } });
  const top = by + bh + 34, rh = Math.max(26, Math.min(48, (L.h - top - 10) / OP_Q.length - 6));
  OP_Q.forEach((q, i) => { const y = top + i * (rh + 6), lost = r.lost[q.id];
    axCard(g, pad, y, L.w - pad * 2, rh, { col: opTone(!lost), ok: !lost, hot: !!lost, lines: [[(lost ? '✗ ' : '✓ ') + q.t + (lost ? '  ' + lost : '  answerable'), lc(LC.text, 1), false]], fs: Math.max(10, Math.min(13, L.w / 75)) }); });
  if (!r.privacy) axStamp(g, L.w * 0.72, by + bh + 14, 'RAW PII IN THE SIEM', LC.bad, L.t - P.at - 0.2, L.w > 720 ? 14 : 10);
}
function optDrawSiem(L, g, P) {
  const pad = 18, q = P.q && OP_Q.find(x => x.id === P.q);
  labText(g, 'SIEM · INCIDENT 2231 · RELAY', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  const lw = Math.min(300, L.w * 0.34), rh = Math.min(46, (L.h - 60) / 6 - 6);
  OP_Q.forEach((x, i) => { const y = 42 + i * (rh + 6), on = P.q === x.id, done = P.asked.has(x.id);
    axCard(g, pad, y, lw, rh, { col: done ? LC.good : LC.mute, ok: on, lines: [[(done ? '✓ ' : '') + x.t, lc(LC.text, 1), false]], fs: Math.max(10, Math.min(13, lw / 24)) }); });
  const x0 = pad * 2 + lw, w = L.w - x0 - pad;
  if (!q) { gvWrap(g, 'Pick a question on the right.', x0 + w / 2, L.h / 2, w * 0.8, { size: 15, align: 'center', col: lc(LC.mute, 1) }); return; }
  labText(g, q.t, x0, 64, { size: 18, w: 700, mono: false, col: lc(LC.ink, 1) });
  q.ans.forEach((a, i) => { const k = NN.sync ? 1 : Math.min(1, (L.t - P.at) * 3 - i * 0.6); if (k <= 0) return; g.globalAlpha = k;
    axCard(g, x0, 84 + i * 62, w, 52, { col: LC.good, ok: true, lines: [[a, lc(LC.text, 1), false]], fs: Math.max(11, Math.min(14, w / 40)) }); g.globalAlpha = 1; });
  labText(g, 'JOINED ON', x0, 84 + q.ans.length * 62 + 22, { size: 10, w: 700, col: lc(LC.mute, 1) });
  axChips(g, q.f, x0, 84 + q.ans.length * 62 + 34, w, 12, () => LC.blue);
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
  const slider = L2 => axRange(L2, P, 'tv', 'Classifier threshold', () => { note(); return L2.step === 0 ? P.sawUnder : opPackOk(pk()); }, () => opT(P).toFixed(2), 100);
  return { P,
    hud: () => [
      [['ALERTS', () => String(run().alerts), run().over ? 'bad' : 'good'], ['CAPACITY', () => String(OP_CAP)], ['CAUGHT AND READ', () => run().triaged + '/14']],
      [['ALERTS', () => run().alerts + '/' + OP_CAP, run().over ? 'bad' : 'good'], ['CAUGHT AND READ', () => run().triaged + '/14', run().triaged >= OP_PACK_TARGET ? 'good' : ''], ['TOUCHED DATA, CAUGHT', () => run().harm + '/6', run().harm === 6 ? 'good' : 'bad']],
      [['WEEK', () => P.w2 ? '2 · rewritten' : '1'], ['CAUGHT', () => run().tp + '/14']],
      axDefHud(P, OPD_VEC, OPD_DEF), axDefHud(P, OPD_VEC, OPD_DEF)][L.step],
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, OPD_GROUPS, OPD_VEC, OPD_DEF) : L2.step === 2 ? opdDrawWeeks(L2, g, P, pk) : opdDrawQueue(L2, g, P, run()),
    steps: [
      { say: () => { const r = run(); return r.over ? 'The vendor’s default pack: ' + r.alerts + ' alerts a day for a team that can read ' + OP_CAP + '. They get to ' + Math.round(OP_CAP / r.alerts * 100) + '% of them. Tune it down to what the team can work.'
          : 'Within capacity. ' + r.tp + ' of 14 attacks caught, and ' + r.harm + ' of the 6 that actually touched data or tools.'; },
        side: L2 => [h('div', { class: 'labchipset' }, ruleChip(L2, 'kw', 'Keyword list'), ruleChip(L2, 'clf', 'Injection classifier')), slider(L2),
          h('p', { class: 'labsm' }, '12,000 support conversations a day, 14 of them attacks. Two analysts, ' + OP_CAP + ' alerts between them.')],
        acts: L2 => [labNext(L2, 'Build a better pack →', !P.sawUnder)] },
      { say: () => { const r = run(); return opPackOk(pk()) ? 'Within capacity, ' + r.triaged + ' of 14 read, and every attack that touched data or tools. Most of the work was done by rules about what Relay did.'
          : 'Target: within ' + OP_CAP + ' alerts, at least ' + OP_PACK_TARGET + ' attacks read, and all 6 that touched data or tools. Now ' + r.alerts + ' alerts, ' + r.triaged + ' read, ' + r.harm + '/6.'; },
        side: L2 => [h('div', { class: 'labchipset' }, OP_RULES.map(([k, t]) => ruleChip(L2, k, t))), slider(L2),
          h('p', { class: 'labsm' }, OP_RULES.map(r => r[1] + ': ' + r[2] + '.').join(' '))],
        acts: L2 => [labNext(L2, 'The attacker adapts →', !opPackOk(pk()))] },
      { enter: () => { P.w2 = false; },
        say: () => !P.sawW2 ? 'Your pack goes live. The attackers notice what gets blocked and rewrite their prompts. Run next week.' : 'Week two: the classifier catches ' + opDetect(pk(), true).by.clf.tp + '. Behaviour rules did not move: rewording a prompt does not change what the agent has to do to steal.',
        side: L2 => [h('div', { class: 'labstack' }, labBtn('Week 1', () => { P.w2 = false; L2.repaint(); }), labBtn('▶ Week 2: prompts rewritten', () => { P.w2 = true; P.sawW2 = true; P.at = L2.t; L2.repaint(); }, 'go'))],
        acts: L2 => [labNext(L2, 'Close the paths →', !P.sawW2)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPD_VEC, OPD_DEF, P.on).length; return n ? n + ' ways a detection programme fails. Switch on controls.' : 'All ' + OPD_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPD_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Detect what the attack has to do, not how it is worded. Size the queue to the people who read it.',
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
function opdDrawQueue(L, g, P, r) {
  const pad = 18, w = L.w - pad * 2, max = Math.max(r.alerts, OP_CAP * 2.2), X = v => pad + w * v / max;
  labText(g, 'TODAY’S QUEUE · ' + r.alerts + ' ALERTS', pad, 24, { size: 12, w: 700, col: lc(r.over ? LC.bad : LC.blue, 1) });
  g.fillStyle = 'rgba(141,182,242,.08)'; g.fillRect(pad, 34, w, 26);
  g.fillStyle = lc(LC.good, 0.8); g.fillRect(pad, 34, X(Math.min(r.alerts, OP_CAP)) - pad, 26);
  if (r.over) { g.fillStyle = lc(LC.bad, 0.55); g.fillRect(X(OP_CAP), 34, X(r.alerts) - X(OP_CAP), 26); }
  g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 2; g.beginPath(); g.moveTo(X(OP_CAP), 28); g.lineTo(X(OP_CAP), 66); g.stroke(); g.lineWidth = 1;
  labText(g, 'analysts can read ' + OP_CAP, X(OP_CAP) + 6, 78, { size: 10, col: lc(LC.ink, 1) });
  if (r.over) labText(g, (r.alerts - OP_CAP) + ' never read', Math.min(X(r.alerts) - 4, L.w - pad), 78, { size: 10, align: 'right', col: lc(LC.bad, 1) });
  // the fourteen attacks
  const cols = L.w > 760 ? 7 : 4, tw = (w - (cols - 1) * 8) / cols, th = 58, top = 96; let read = r.triaged;
  r.atk.forEach((a, i) => { const caught = a.hit.length > 0, rd = caught && read-- > 0, x = pad + (i % cols) * (tw + 8), y = top + Math.floor(i / cols) * (th + 8);
    const col = rd ? LC.good : caught ? LC.ink : LC.bad;
    axCard(g, x, y, tw, th, { col, ok: rd, hot: !caught && OP_ATK_HARM[a.e.k], title: (OP_ATK_HARM[a.e.k] ? '⚑ ' : '') + OP_ATK_KIND[a.e.k], lines: [[a.e.t, lc(LC.text, 0.95), false]], fs: Math.max(9, Math.min(11.5, tw / 20)) }); });
  const ry = top + Math.ceil(14 / cols) * (th + 8) + 10, rw = (w - 5 * 8) / 6;
  labText(g, 'RULES · ALERTS RAISED / REAL ATTACKS HIT', pad, ry, { size: 10, w: 700, col: lc(LC.mute, 1) });
  OP_RULES.forEach(([k, t], i) => { const b = r.by[k], on = P.pack[k] && (k !== 'doc' || P.pack.clf), x = pad + i * (rw + 8);
    axCard(g, x, ry + 8, rw, Math.min(84, Math.max(44, L.h - ry - 30)), { col: on ? LC.blue : LC.mute, title: t, lines: on ? [[(b.fp + b.tp) + ' alerts · ' + b.tp + ' real', lc(LC.text, 1), true]] : [['off', lc(LC.mute, 1), true]], fs: Math.max(10, Math.min(13, rw / 12)) }); });
  labText(g, 'green: caught and read · amber: caught, never read · red: missed · ⚑ touched data or tools', pad, L.h - 6, { size: 10, col: lc(LC.mute, 1) });
}
function opdDrawWeeks(L, g, P, pk) {
  const a = opDetect(pk(), false), b = opDetect(pk(), true), pad = 24, top = 60, rows = OP_RULES.filter(([k]) => a.by[k].tp || b.by[k].tp || pk()[k]);
  const lw = Math.min(260, L.w * 0.3), bw = L.w - lw - pad * 3, rh = Math.min(54, (L.h - top - 40) / Math.max(1, rows.length) - 8);
  labText(g, 'REAL ATTACKS HIT, PER RULE · WEEK 1 vs WEEK 2', pad, 28, { size: 12, w: 700, col: lc(LC.blue, 1) });
  rows.forEach(([k, t], i) => { const y = top + i * (rh + 8), v1 = a.by[k].tp, v2 = P.sawW2 ? b.by[k].tp : v1, fell = P.sawW2 && v2 < v1;
    labText(g, t, pad, y + rh / 2 + 4, { size: 12, mono: false, w: 600, col: lc(LC.text, 0.95) });
    gvBar(g, lw + pad * 2, y + 4, bw, rh / 2 - 6, v1 / 14, LC.blue); gvBar(g, lw + pad * 2, y + rh / 2 + 2, bw, rh / 2 - 6, (P.w2 ? v2 : v1) / 14, fell ? LC.bad : LC.good);
    labText(g, v1 + ' → ' + (P.sawW2 ? v2 : '?'), lw + pad * 2 + bw, y + rh / 2 + 4, { size: 12, w: 700, align: 'right', col: lc(fell ? LC.bad : LC.good, 1) }); });
  if (P.w2) axStamp(g, L.w * 0.62, L.h - 34, 'WORDING CHANGED · BEHAVIOUR DID NOT', LC.good, L.t - P.at - 0.3, L.w > 720 ? 16 : 11);
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
  note();
  return { P,
    hud: () => [
      [['RAMP CAUGHT', () => res().delay == null ? 'never' : 'day ' + res().caught.support, res().delay != null && res().delay <= 3 ? 'good' : 'bad'], ['DAYS LATE', () => res().delay == null ? '—' : String(res().delay)]],
      [['ATTACKS', () => res().n + '/3', res().n === 3 ? 'good' : 'bad'], ['FALSE ALARMS', () => String(res().fa), res().fa <= 1 ? 'good' : 'bad'], ['RAMP', () => res().delay == null ? 'missed' : res().delay + ' days late']],
      [['TRACES', () => Object.keys(P.marks).length + '/' + OP_TRACES.length], ['EVERY STEP', () => 'allowed']],
      axDefHud(P, OPB_VEC, OPB_DEF), axDefHud(P, OPB_VEC, OPB_DEF)][L.step],
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, OPB_GROUPS, OPB_VEC, OPB_DEF) : [opbDrawOne, opbDrawFleet, opbDrawTrace][L2.step](L2, g, P),
    steps: [
      { say: () => { const r = res(); return !(P.sawLate && P.sawFast) ? 'Relay’s records touched per day. From day 25 the planted document makes it creep up. ' + (r.delay == null ? 'This baseline never alarms.' : 'Caught ' + r.delay + ' days late.') + ' Find a setting that misses it, and one that catches it within three days.'
          : 'A rolling baseline learns whatever happens slowly enough. The attack became normal.'; },
        side: L2 => baseSide(L2),
        acts: L2 => [labNext(L2, 'The whole fleet →', !(P.sawLate && P.sawFast))] },
      { say: () => { const r = res(); return opAnomOk(P.o) ? 'Three of three, ' + r.fa + ' false alarm' + (r.fa === 1 ? '' : 's') + ', ramp caught in ' + r.delay + ' days. Each agent has its own normal, and new behaviour alerts whatever the volume.'
          : 'Five agents, one detector. Target: all 3 attacks, at most 1 false alarm, the ramp within 5 days. Now ' + r.n + '/3, ' + r.fa + ' false alarms' + (r.delay == null ? ', ramp missed.' : ', ramp ' + r.delay + ' days.'); },
        side: L2 => [baseSide(L2), h('span', { class: 'labk' }, 'And'), h('div', { class: 'labchipset' },
          gvChip('Seasonal: month-end vs month-end', P.o.season, () => setO(L2, 'season', !P.o.season)),
          gvChip('First-seen tools and destinations', P.o.first, () => setO(L2, 'first', !P.o.first)),
          gvChip('Change calendar: mute 7 days, then re-baseline', P.o.chg, () => setO(L2, 'chg', !P.o.chg)))],
        acts: L2 => [labNext(L2, 'What the agent did →', !opAnomOk(P.o))] },
      { say: () => P.ti >= OP_TRACES.length ? 'Every single step was permitted. Four of the chains were attacks. Behaviour monitoring watches sequences, not permissions.'
          : P.wrong ? tr().why + ' Look again.' : 'Every step below is an action this agent is allowed to take. Is the chain normal?',
        side: L2 => P.ti >= OP_TRACES.length ? [h('p', { class: 'labsm' }, 'All eight sorted.')] : [h('div', { class: 'labstack' }, labBtn('✓ Normal', () => mark(L2, false), 'go'), labBtn('⚠ Suspicious', () => mark(L2, true)))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.ti < OP_TRACES.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(OPB_VEC, OPB_DEF, P.on).length; return n ? n + ' ways anomaly detection misses an agent. Switch on controls.' : 'All ' + OPB_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, OPB_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Give every agent its own normal, keep a fixed reference, and alert on anything it has never done before.',
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
}
function opbDrawOne(L, g, P) {
  const pad = 30, a = OP_AGENTS[0], y = 40, hh = L.h - 100, w = L.w - pad * 2, r = opAnomaly(P.o);
  labText(g, 'RECORDS TOUCHED PER DAY · ' + OP_WIN.find(x => x[0] === P.o.win)[1].toUpperCase() + ' · ' + P.o.k + 'σ', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  opbChart(L, g, P, a, pad, y, w, hh, true);
  [0, 14, 25, 40, 59].forEach(d => labText(g, 'day ' + d, pad + w * d / (OP_DAYS - 1), y + hh + 16, { size: 10, align: 'center', col: lc(LC.mute, 1) }));
  labText(g, '▒ reference period   ┅ alert line   ● alert   red: attack running', pad, L.h - 10, { size: 10, col: lc(LC.mute, 1) });
  const extra = r.delay == null ? null : OP_SERIES.support.slice(25, r.caught.support).reduce((s2, v) => s2 + v - 400, 0);
  axStamp(g, L.w * 0.6, y + 40, r.delay == null ? 'NEVER ALARMED' : r.delay <= 3 ? 'CAUGHT IN ' + r.delay + ' DAYS' : 'CAUGHT ' + r.delay + ' DAYS LATE · ' + Math.round(extra).toLocaleString('en') + ' EXTRA RECORDS', r.delay != null && r.delay <= 3 ? LC.good : LC.bad, L.t - P.at - 0.2, L.w > 720 ? 15 : 10);
}
function opbDrawFleet(L, g, P) {
  const pad = 14, cols = L.w > 760 ? 3 : 2, rows = Math.ceil((OP_AGENTS.length + 1) / cols), cw = (L.w - pad * (cols + 1)) / cols, ch = (L.h - 30 - pad * rows) / rows, r = opAnomaly(P.o);
  OP_AGENTS.forEach((a, i) => { const x = pad + (i % cols) * (cw + pad), y = 20 + Math.floor(i / cols) * (ch + pad); opbChart(L, g, P, a, x, y, cw, ch - 18, false);
    const got = r.caught[a.id] != null, fas = r.alerts.filter(z => z.a === a.id && !(OP_TRUTH[a.id] && OP_TRUTH[a.id](z.d))).length;
    labText(g, a.atk ? (got ? '✓ caught day ' + r.caught[a.id] : '✗ attack missed') : (fas ? '✗ ' + fas + ' false alarm' + (fas > 1 ? 's' : '') : '✓ quiet'), x, y + ch - 4, { size: 11, w: 700, col: lc(a.atk ? opTone(got) : opTone(!fas), 1) }); });
  const i = OP_AGENTS.length, x = pad + (i % cols) * (cw + pad), y = 20 + Math.floor(i / cols) * (ch + pad);
  gvWrap(g, 'Red bands: attack running. ◆ first-seen event. Violet: change window.', x + 6, y + 18, cw - 12, { size: 11, col: lc(LC.mute, 1) });
}
function opbDrawTrace(L, g, P) {
  const pad = 22, t = OP_TRACES[Math.min(P.ti, OP_TRACES.length - 1)], done = P.ti >= OP_TRACES.length;
  labText(g, done ? 'ALL EIGHT TRACES' : 'TRACE ' + (P.ti + 1) + ' OF ' + OP_TRACES.length + ' · ' + t.a.toUpperCase(), pad, 28, { size: 12, w: 700, col: lc(LC.blue, 1) });
  if (done) { const rh = Math.min(52, (L.h - 60) / OP_TRACES.length - 6);
    OP_TRACES.forEach((x, i) => axCard(g, pad, 44 + i * (rh + 6), L.w - pad * 2, rh, { col: x.bad ? LC.bad : LC.good, hot: x.bad, ok: !x.bad, title: x.a + ' · ' + (x.bad ? 'SUSPICIOUS' : 'NORMAL'), lines: [[x.steps.join('  →  ') + '   ·   ' + x.why, lc(LC.text, 1), false]], fs: Math.max(10, Math.min(12, L.w / 90)) })); return; }
  const n = t.steps.length, bw = Math.min(260, (L.w - pad * 2 - (n - 1) * 34) / n), y = L.h / 2 - 50, x0 = (L.w - (n * bw + (n - 1) * 34)) / 2;
  t.steps.forEach((s2, i) => { const x = x0 + i * (bw + 34), k = NN.sync ? 1 : Math.min(1, (L.t - P.at) * 2.5 - i * 0.5); if (k <= 0) return; g.globalAlpha = k;
    axCard(g, x, y, bw, 100, { col: LC.blue, title: 'STEP ' + (i + 1) + ' · ALLOWED ✓', lines: [[s2, lc(LC.text, 1), true]], fs: Math.max(11, Math.min(14, bw / 17)) });
    if (i < n - 1) { g.strokeStyle = lc(LC.blue, 0.8); g.beginPath(); g.moveTo(x + bw + 6, y + 50); g.lineTo(x + bw + 28, y + 50); g.stroke(); g.fillStyle = lc(LC.blue, 0.9); g.beginPath(); g.moveTo(x + bw + 28, y + 45); g.lineTo(x + bw + 33, y + 50); g.lineTo(x + bw + 28, y + 55); g.fill(); }
    g.globalAlpha = 1; });
  if (P.wrong === t.id) gvWrap(g, t.why, L.w / 2, y + 140, L.w * 0.7, { size: 14, align: 'center', col: lc(LC.bad, 1) });
}

/* ---------- registration ---------- */
const OP_SIMS = [
  { id: 'optel', track: 'ops', title: 'What did the logs see?', kicker: 'AI telemetry · monitoring pipelines · SIEM integration', blurb: 'An agent leaked records for 19 days behind a green dashboard. Choose what to collect within an ingest budget, fix the logging pipeline that quietly drops the evidence, then answer the incident lead’s six questions from the SIEM.', mount: optMount,
    brief: { what: 'Your SIEM was built for hosts, networks and web apps. An AI agent can be attacked while every one of those logs is normal: the attack is in what it retrieved, which tools it called, and what its answers contained.',
      real: 'Incident teams are asked the same six questions every time: where it started, what left, where to, since when, whose sessions, and whether it was your own release. Most AI platforms cannot answer half of them on day one.',
      todo: ['Pick telemetry sources within 25 GB a day', 'Fix the pipeline settings that destroy answers', 'Ask the SIEM the six incident questions'] },
    guide: [
      { look: [['good', '▬', 'Sources you collect, against the budget line.'], ['good', '▭', 'Incident steps you can see.'], ['bad', '▭', 'Dark: nothing you collect shows it.']], why: 'Gateway and proxy logs report 200 OK all through the leak. The evidence is in retrieval, tool-call and answer fields, which are small.' },
      { look: [['bad', '▭', 'A pipeline stage that destroys an answer.'], ['blue', '•', 'Events flowing through.']], why: 'Sampling, deleting personal data, short retention and unparsed blobs are all normal defaults for web logs. Each one kills an AI answer.' },
      { look: [['good', '▭', 'The answer, and the fields it was joined on.']], why: 'Integration means the fields arrive parsed, named and joinable: the document, the tool call, the person and the version.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Evidence fails at collection and in the pipeline. Both are configuration, not code.' },
      { why: 'Ask your platform team: for an AI incident, which of the six questions can we answer today, and from which fields?' }] },
  { id: 'opdetect', track: 'ops', title: 'The alert queue', kicker: 'Detection engineering · prompt-attack detection', blurb: 'Run the vendor’s default detection pack against a day of support traffic and watch the queue flood, tune it to what two analysts can read, build a pack that catches the attacks that touched data, then see which rules survive when the attacker rewrites the prompts.', mount: opdMount,
    brief: { what: 'Prompt-attack detection is usually sold as a classifier. Content scores catch loud, direct jailbreaks; attacks that arrive inside documents and change what the agent does need rules about behaviour.',
      real: 'Every detection programme is limited by the people who read it. A rule that fires 400 times a day is a rule nobody reads, and the attack that mattered is at the bottom of the queue.',
      todo: ['Tune the default pack down to analyst capacity', 'Build a pack that catches what touched data', 'Run week two after the attacker adapts'] },
    guide: [
      { look: [['good', '▬', 'Alerts analysts can read.'], ['bad', '▬', 'Alerts nobody reads.'], ['ink', '|', 'Capacity.']], why: 'Over capacity, analysts read a share of the queue at random. Catching an attack is not the same as anyone seeing it.' },
      { look: [['good', '▭', 'Caught and read.'], ['ink', '▭', 'Caught, never read.'], ['bad', '▭', 'Missed.']], why: 'The indirect attacks never appear in the customer’s message. Scan what the agent reads, and watch what it does.' },
      { look: [['blue', '▬', 'Week 1.'], ['bad', '▬', 'Week 2: fell.'], ['good', '▬', 'Week 2: held.']], why: 'Rewording beats content scores. To steal, the agent still has to look up records and send them somewhere.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Detection fails on what it looks at and on how it is run.' },
      { why: 'Ask: how many alerts does each AI rule raise a day, who reads them, and when were the rules last replayed against known attacks?' }] },
  { id: 'opbase', track: 'ops', title: 'Normal for whom?', kicker: 'Runtime anomaly detection · agent behaviour monitoring', blurb: 'Watch a slow data-theft ramp become normal to a rolling baseline, tune one detector for five agents with month-ends and releases, then judge eight action chains in which every single step is allowed.', mount: opbMount,
    brief: { what: 'Anomaly detection learns what normal looks like and alerts on the rest. Agents make that hard: they have seasons, releases and many users behind one identity, and an attacker can move slowly enough to be learned.',
      real: 'AI providers now find abuse of their own agents from patterns of use, not single requests. Inside an enterprise, the same applies: what matters is what an agent has never done before, and in what order.',
      todo: ['Find the baseline that misses the ramp, and one that does not', 'Tune one detector for five agents', 'Judge eight chains of allowed actions'] },
    guide: [
      { look: [['blue', '—', 'Records per day.'], ['ink', '┅', 'Alert line.'], ['good', '●', 'Alert on the attack.'], ['bad', '', 'Red band: attack running.']], why: 'A rolling baseline moves with the data. Creep slowly and the alert line rises ahead of you.' },
      { look: [['bad', '●', 'False alarm.'], ['violet', '◆', 'First-seen tool or destination.']], why: 'Month-end and releases look like attacks; the sales leak looks like nothing. Volume alone cannot tell them apart.' },
      { look: [['blue', '▭', 'Each step: allowed by the agent’s permissions.']], why: 'Permissions are checked one action at a time. Attacks are sequences: outside text, then a privileged action; a bulk read, then a new destination.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Baselines fail slowly, and behaviour fails one allowed step at a time.' },
      { why: 'Ask: does each agent have its own baseline, what alerts on first-ever behaviour, and what stops the baseline learning an attack?' }] }];
OP_SIMS.forEach(x => { NN_SIMS.push(x); NN_BY[x.id] = x; });
