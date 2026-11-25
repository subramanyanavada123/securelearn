'use strict';
/* Governance instruments 4–6: explainability, transparency and auditability;
   human oversight and accountability; the approval board and operating
   model. Plus the Governance hub on the Advanced page. */

/* ====================== 4 · Explain, disclose, reconstruct ====================== */
const GVE_VEC = [{ id: 'unfaithful', name: 'Explanation not faithful to the model' }, { id: 'proxyhid', name: 'A proxy hidden behind a neutral reason' }, { id: 'nonact', name: 'Reasons nobody can act on' },
  { id: 'noreplay', name: 'Decision cannot be reproduced' }, { id: 'tamper', name: 'Logs can be edited' }, { id: 'notice', name: 'Disclosure without explanation' }];
const GVE_DEF = [
  { id: 'fid', name: 'Test explanation fidelity', how: 'Compare stated reasons with the model on a sample, every release', kills: ['unfaithful', 'proxyhid'] },
  { id: 'cf', name: 'Counterfactuals on actionable features', how: 'Tell people what they could change, not what they cannot', kills: ['nonact'] },
  { id: 'ver', name: 'Log inputs, model version and threshold', how: 'Per decision, kept for the retention period', kills: ['noreplay'] },
  { id: 'chain', name: 'Append-only, hash-chained logs', how: 'Any edit breaks the chain from that row on', kills: ['tamper'] },
  { id: 'ind', name: 'Individual explanation on request', how: 'A route for people affected (AI Act Art 86, GDPR)', kills: ['notice'] }];
const GVE_GROUPS = [{ name: 'Explaining', col: 'ink', ids: ['unfaithful', 'proxyhid', 'nonact'], act: 'A convincing reason that is not the real one' },
  { name: 'Recording', col: 'bad', ids: ['noreplay', 'tamper', 'notice'], act: 'Nobody can show what happened on 3 March' }];

function gveMount(L) {
  const P = { reasons: false, cf: {}, view: 'true', views: new Set(['true']), fid: null, tea: {}, logged: { why: true, who: true }, chain: gvChain(GV_LOGROWS.map(([id, out]) => ({ id, out }))), tampered: false, replay: null, on: {}, flash: {}, at: -9 };
  const acts = GV_FEAT.filter(f => f.act); acts.forEach(f => { P.cf[f.id] = GV_APPLICANT[f.id] - f.lo; });
  const cur = () => Object.assign({}, GV_APPLICANT, Object.fromEntries(acts.map(f => [f.id, f.lo + P.cf[f.id]])));
  const teaOk = () => GV_TEA.filter((s2, i) => P.tea[i] === s2[1]).length;
  return { P, cur,
    hud: () => [
      [['DECISION', () => 'declined', 'bad'], ['SCORE', () => gvContrib(GV_APPLICANT).score.toFixed(2)], ['TOP REASON', () => P.reasons ? GV_FEAT.find(f => f.id === gvTop(gvContrib(GV_APPLICANT).c)).t : '?']],
      [['SCORE', () => gvContrib(cur()).score.toFixed(2)], ['DECISION', () => gvApproved(cur()) ? 'approved' : 'declined', gvApproved(cur()) ? 'good' : 'bad']],
      [['SHOWING', () => P.view === 'true' ? 'the model' : 'the letter'], ['TOP REASON WRONG', () => P.fid ? (P.fid.n - P.fid.same) + ' of ' + P.fid.n : '?', 'bad']],
      [['SORTED RIGHT', () => teaOk() + '/' + GV_TEA.length]],
      [['CHAIN', () => gvVerify(P.chain) < 0 ? 'intact' : 'broken at ' + P.chain[gvVerify(P.chain)].id, gvVerify(P.chain) < 0 ? 'good' : 'bad'], ['REPLAY', () => P.replay == null ? '?' : P.replay ? 'reproduced' : 'cannot', P.replay ? 'good' : 'bad']],
      axDefHud(P, GVE_VEC, GVE_DEF), axDefHud(P, GVE_VEC, GVE_DEF)][L.step],
    draw: (L2, g) => L2.step >= 5 ? axDrawDefend(L2, g, P, GVE_GROUPS, GVE_VEC, GVE_DEF) : [gveDrawWhy, gveDrawCf, gveDrawWash, gveDrawSort, gveDrawLog][L2.step](L2, g, P, cur),
    steps: [
      { say: () => !P.reasons ? 'A loan model declined this applicant. The law says you must tell them why. Generate the reasons.' : 'Explainability: why this decision. The biggest reason is the postcode band, and the applicant cannot change it.',
        side: L2 => [labBtn((P.reasons ? '✓ ' : '▶ ') + 'Generate the reasons', () => { P.reasons = true; P.at = L2.t; L2.repaint(); }), h('p', { class: 'labsm' }, 'For a linear model each bar is exact: weight × distance from the average applicant.')],
        acts: L2 => [labNext(L2, 'What would change it? →', !P.reasons)] },
      { say: () => gvApproved(cur()) ? 'Approved. That is a counterfactual explanation: the change that would have flipped it, on things the person controls.' : 'Move what the applicant can change until the decision flips. Postcode and past missed payments are locked.',
        side: L2 => [...acts.map(f => axRange(L2, P.cf, f.id, f.t + (f.unit ? ' (' + f.unit + ')' : ''), () => gvApproved(cur()), () => String(f.lo + P.cf[f.id]), f.hi - f.lo)),
          labBtn('Find the smallest change', () => { const c = gvCounterfactual(GV_APPLICANT); if (c) c.ch.forEach(([k, v]) => { P.cf[k] = v - GV_FEAT.find(f => f.id === k).lo; }); L2.repaint(); })],
        acts: L2 => [labNext(L2, 'Is the explanation true? →', !gvApproved(cur()))] },
      { say: () => P.views.size < 2 ? 'The letter the customer received leaves postcode out. Compare it with the model.' : !P.fid ? 'Same decision, different story: the letter blames years at address. Now test the letter against the model on 200 declines.' : 'In ' + (P.fid.n - P.fid.same) + ' of ' + P.fid.n + ' declines the stated main reason is not the real one, and every one of those hides postcode. That is fairwashing.',
        side: L2 => [h('div', { class: 'labstack' }, labBtn((P.view === 'true' ? '● ' : '○ ') + 'What the model did', () => { P.view = 'true'; P.views.add('true'); L2.repaint(); }),
          labBtn((P.view === 'shown' ? '● ' : '○ ') + 'What the letter said', () => { P.view = 'shown'; P.views.add('shown'); L2.repaint(); }),
          labBtn((P.fid ? '✓ ' : '▶ ') + 'Test the letter on 200 declines', () => { P.fid = gvFidelity(); P.at = L2.t; L2.repaint(); }, '', P.views.size < 2))],
        acts: L2 => [labNext(L2, 'Three words, three duties →', !P.fid)] },
      { say: () => teaOk() < GV_TEA.length ? 'Transparency, explainability and auditability get used as one word. Tap each statement until it sits in the right column.' : 'Transparency: that it is AI and what it is. Explainability: why this outcome. Auditability: proof of what happened.',
        side: L2 => [h('div', { class: 'labstack' }, GV_TEA.map(([t, k], i) => { const at = P.tea[i], ok = at === k;
          return h('button', { type: 'button', class: 'labp' + (at ? ok ? ' ok on' : ' bad' : ''), onclick: () => { const o = ['tr', 'ex', 'au']; P.tea[i] = o[(o.indexOf(P.tea[i]) + 1) % 3]; L2.repaint(); } }, (at ? GV_TEA_NAME[at] + ' · ' : '') + t); }))],
        acts: L2 => [labNext(L2, 'Reconstruct a decision →', teaOk() < GV_TEA.length)] },
      { say: () => !P.tampered ? 'A complaint arrives about D-103, nine months later. First, can anyone have edited the log? Try it.' : P.replay !== true ? 'The chain caught the edit. Now replay D-103: the model was retrained in June. Choose what you log, then replay.' : 'Reproduced: same inputs, same model version, same threshold, same answer. That is auditability.',
        side: L2 => [h('span', { class: 'labk' }, 'Logged per decision'), h('div', { class: 'labchipset' }, GV_LOGF.map(([k, t]) => gvChip(t, P.logged[k], () => { P.logged[k] = !P.logged[k]; P.replay = null; L2.repaint(); }))),
          h('div', { class: 'labstack' }, labBtn(P.tampered ? '↺ Restore the log' : '✎ Change D-103 to “approve”', () => { P.tampered = !P.tampered; P.sawTamper = true; P.chain[2].out = P.tampered ? 'approve' : 'decline'; P.at = L2.t; L2.repaint(); }),
            labBtn('▶ Replay D-103 today', () => { P.replay = gvReplayable(P.logged); P.at = L2.t; L2.repaint(); }))],
        acts: L2 => [labNext(L2, 'Close the paths →', !P.sawTamper || P.replay !== true)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(GVE_VEC, GVE_DEF, P.on).length; return n ? n + ' ways a transparent system still cannot answer. Switch on controls.' : 'All ' + GVE_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, GVE_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Tell people it is AI, tell them why, and be able to prove it later.',
        enter: () => labDone('gvexplain'),
        side: () => axDebrief(P, GVE_VEC, GVE_DEF, [
          ['May 2022 · CFPB Circular 2022-03', 'US creditors using complex models must still give specific, accurate reasons for a denial. “The algorithm decided” is not a reason.'],
          ['Dec 2023 · CJEU, SCHUFA (C-634/21)', 'A credit score that strongly drives a lender’s decision is itself an automated decision under GDPR Article 22, with rights to meaningful information.'],
          ['Feb 2020 · SyRI, The Hague', 'A Dutch welfare-fraud risk system was struck down, in part because nobody could see how it worked or check its outputs.'],
          ['2019 · Fairwashing', 'Researchers showed an unfair model can be given plausible, fair-looking explanations that pass casual review. Fidelity has to be tested.']],
          [], 'The credit model is linear, so every contribution on this page is exact. The log hashes are real SHA-256, computed on this device.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv-gov' }, 'Governance →')] }
    ] };
}
function gveWaterfall(L, g, c, x, y, w, hh, title, hideZip) {
  const rows = c.slice().sort((a, b) => a.v - b.v), mx = 1.8, X = v => x + w / 2 + (w / 2 - 10) * Math.max(-1, Math.min(1, v / mx)), rh = Math.min(34, hh / (rows.length + 1.5));
  labText(g, title, x, y, { size: 11.5, w: 700, col: lc(LC.blue, 1) });
  g.strokeStyle = lc(LC.mute, 0.5); g.beginPath(); g.moveTo(X(0), y + 10); g.lineTo(X(0), y + 14 + rows.length * (rh + 4)); g.stroke();
  rows.forEach((k, i) => { const yy = y + 14 + i * (rh + 4), f = GV_FEAT.find(q => q.id === k.id), col = k.v < 0 ? LC.bad : LC.good;
    g.fillStyle = lc(col, 0.75); g.fillRect(Math.min(X(0), X(k.v)), yy, Math.abs(X(k.v) - X(0)), rh);
    labText(g, (f.act ? '' : '🔒 ') + f.t, k.v < 0 ? X(0) + 8 : X(0) - 8, yy + rh / 2 + 4, { size: 11, mono: false, align: k.v < 0 ? 'left' : 'right', col: lc(LC.text, 0.9) });
    labText(g, (k.v >= 0 ? '+' : '') + k.v.toFixed(2), k.v < 0 ? X(k.v) - 6 : X(k.v) + 6, yy + rh / 2 + 4, { size: 10.5, align: k.v < 0 ? 'right' : 'left', col: lc(col, 1) }); });
  return y + 14 + rows.length * (rh + 4);
}
function gveDrawWhy(L, g, P) {
  const pad = 24, w = L.w - pad * 2, c = gvContrib(GV_APPLICANT);
  const y = gveWaterfall(L, g, c.c, pad, 30, w, L.h - 110, 'WHY THIS APPLICANT WAS DECLINED · SCORE ' + c.score.toFixed(2) + ' (APPROVE AT ≥ 0)');
  if (P.reasons) { const top = c.c.slice().sort((a, b) => a.v - b.v).slice(0, 3).map(k => GV_FEAT.find(f => f.id === k.id).t);
    gvWrap(g, 'Reasons we must give: 1. ' + top[0] + '  2. ' + top[1] + '  3. ' + top[2], pad, y + 30, w, { size: 14, w: 700, col: lc(LC.ink, 1) }); }
}
function gveDrawCf(L, g, P, cur) {
  const pad = 24, x = cur(), c = gvContrib(x), ok = c.score >= 0;
  gveWaterfall(L, g, c.c, pad, 30, L.w - pad * 2, L.h - 120, 'COUNTERFACTUAL · SCORE ' + c.score.toFixed(2));
  axStamp(g, L.w - 150, L.h - 44, ok ? 'APPROVED' : 'DECLINED', ok ? LC.good : LC.bad, 1, L.w > 720 ? 20 : 13);
  const diffs = GV_FEAT.filter(f => x[f.id] !== GV_APPLICANT[f.id]).map(f => f.t + ' ' + GV_APPLICANT[f.id] + '→' + x[f.id] + f.unit);
  if (diffs.length) gvWrap(g, 'Change: ' + diffs.join(', '), pad, L.h - 40, L.w - 340, { size: 13, w: 700, col: lc(LC.text, 1) });
}
function gveDrawWash(L, g, P) {
  const pad = 24, shown = P.view === 'shown', c = shown ? gvPresented(GV_APPLICANT) : gvContrib(GV_APPLICANT).c;
  gveWaterfall(L, g, c, pad, 30, L.w - pad * 2, L.h - 120, shown ? 'WHAT THE LETTER SAID (postcode left out, its weight moved to “years at address”)' : 'WHAT THE MODEL DID');
  if (P.fid) axStamp(g, L.w / 2, L.h - 46, 'TOP REASON WRONG: ' + (P.fid.n - P.fid.same) + ' OF ' + P.fid.n + ' LETTERS', LC.bad, L.t - P.at, L.w > 720 ? 17 : 11);
}
function gveDrawSort(L, g, P) {
  const pad = 14, cw = (L.w - pad * 4) / 3;
  ['tr', 'ex', 'au'].forEach((k, i) => { const x = pad + i * (cw + pad), col = [LC.blue, LC.ink, LC.violet][i], items = GV_TEA.map((s2, j) => [s2, j]).filter(([, j]) => P.tea[j] === k);
    labText(g, GV_TEA_NAME[k].toUpperCase(), x + cw / 2, 26, { size: 13, w: 700, align: 'center', mono: false, col: lc(col, 1) });
    labText(g, ['Is it AI? What is it?', 'Why this outcome?', 'Can we prove what happened?'][i], x + cw / 2, 44, { size: 11, align: 'center', mono: false, col: lc(LC.mute, 1) });
    g.strokeStyle = lc(col, 0.3); g.strokeRect(x + 0.5, 54.5, cw - 1, L.h - 66);
    items.forEach(([[t, want], j], n) => { const ok = want === k, y = 62 + n * 64; axCard(g, x + 6, y, cw - 12, 56, { col: ok ? LC.good : LC.bad, ok, hot: !ok, lines: [[t, lc(LC.text, 1), false]], fs: Math.max(9.5, Math.min(11.5, cw / 26)) }); }); });
}
function gveDrawLog(L, g, P) {
  const pad = 20, bad = gvVerify(P.chain), rh = Math.min(48, (L.h - 120) / P.chain.length - 6), w = L.w - pad * 2;
  labText(g, 'DECISION LOG · EACH ROW HASHES THE ROW BEFORE IT (SHA-256)', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  P.chain.forEach((r, i) => { const y = 40 + i * (rh + 6), broken = bad >= 0 && i >= bad, col = broken ? LC.bad : LC.good, edited = P.tampered && i === 2;
    axRound(g, pad, y, w, rh, 8); g.fillStyle = lc(col, broken ? 0.12 : 0.05); g.fill(); g.strokeStyle = lc(col, 0.6); g.stroke();
    labText(g, r.id, pad + 12, y + rh / 2 + 4, { size: 12, w: 700, col: lc(LC.text, 1) });
    labText(g, r.out.toUpperCase() + (edited ? ' (edited)' : ''), pad + 90, y + rh / 2 + 4, { size: 12, w: 700, col: lc(edited ? LC.bad : LC.text, 1) });
    const flds = GV_LOGF.filter(([k]) => P.logged[k]).map(([, t]) => t).join(' · ') || 'outcome only';
    fiClip(g, pad + 230, y, w - 230 - 200, rh, () => labText(g, flds, pad + 230, y + rh / 2 + 4, { size: 10.5, mono: false, col: lc(LC.mute, 1) }));
    labText(g, 'prev ' + r.prev.slice(0, 8) + '…  hash ' + r.hash.slice(0, 8) + '…', pad + w - 12, y + rh / 2 + 4, { size: 10.5, align: 'right', col: lc(col, 1) }); });
  if (bad >= 0) axStamp(g, L.w / 2, L.h - 40, 'CHAIN BROKEN AT ' + P.chain[bad].id, LC.bad, L.t - P.at, L.w > 720 ? 18 : 12);
  else if (P.replay != null) axStamp(g, L.w / 2, L.h - 40, P.replay ? 'D-103 REPRODUCED' : 'CANNOT REPRODUCE: ' + (['inputs', 'ver', 'thr'].filter(k => !P.logged[k]).map(k => GV_LOGF.find(f => f[0] === k)[1].toLowerCase()).join(', ') + ' not logged'), P.replay ? LC.good : LC.bad, L.t - P.at, L.w > 720 ? 15 : 10);
}

/* ====================== 5 · The human in the loop ====================== */
const GVH_VEC = [{ id: 'stamp', name: 'Approve at agent speed' }, { id: 'anchor', name: 'Anchored on the AI answer' }, { id: 'default', name: 'Timeout means approve' },
  { id: 'noauth', name: 'Reviewer cannot say no' }, { id: 'blame', name: 'Accountability left with the last human' }, { id: 'skill', name: 'Never trained on how it fails' }];
const GVH_DEF = [
  { id: 'budget', name: 'Time budget and volume cap', how: 'Enough seconds per case for the check to be real', kills: ['stamp'] },
  { id: 'blind', name: 'Decide first on a sample', how: 'Reviewer answers before seeing the AI, on a share of cases', kills: ['anchor'] },
  { id: 'failsafe', name: 'Timeout escalates', how: 'An unreviewed case goes to a person, never to approve', kills: ['default'] },
  { id: 'authority', name: 'Written authority to override', how: 'No penalty for overriding; overrides feed back to the model owner', kills: ['noauth'] },
  { id: 'raci', name: 'One accountable owner per system', how: 'Named in the inventory; the reviewer is responsible, not accountable', kills: ['blame'] },
  { id: 'train', name: 'Seeded-error training', how: 'Practice on known AI mistakes (AI literacy, Art 4)', kills: ['skill'] }];
const GVH_GROUPS = [{ name: 'The review', col: 'ink', ids: ['stamp', 'anchor', 'default'], act: 'A human in the loop who could not have caught it' },
  { name: 'The organisation', col: 'bad', ids: ['noauth', 'blame', 'skill'], act: 'The reviewer blamed for a design they did not choose' }];
const GVH_SECS = 7, GVH_R1 = [0, 12], GVH_R2 = [12, 20];
const GVH_DESIGNS = [['blind', 'Decide before you see the AI answer'], ['flag', 'Highlight facts that contradict the AI'], ['notime', 'No timer: escalate instead of auto-approve']];

function gvhMount(L) {
  const P = { round: 1, i: GVH_R1[0], left: GVH_SECS, dec: [], perDay: 30, sawFast: false, sawSlow: false, design: {}, raci: null, on: {}, flash: {}, at: -9 };
  const range = () => P.round === 1 ? GVH_R1 : GVH_R2, inRound = () => P.dec.filter(d => d.round === P.round), done = () => P.i >= range()[1];
  const stats = r => { const ds = P.dec.filter(d => d.round === r), wrong = ds.filter(d => d.c.wrong); return { n: ds.length, wrong: wrong.length, caught: wrong.filter(d => d.right).length, timeouts: ds.filter(d => d.how === 'timeout').length, falseAlarm: ds.filter(d => !d.c.wrong && !d.right).length }; };
  const decide = (L2, choice, how) => { if (done()) return; const c = GV_CLAIMS[P.i], truth = c.wrong ? (c.ai === 'approve' ? 'deny' : 'approve') : c.ai;
    const final = choice === 'agree' ? c.ai : choice === 'override' ? (c.ai === 'approve' ? 'deny' : 'approve') : choice;
    P.dec.push({ round: P.round, c, how, right: final === truth }); P.i++; P.left = GVH_SECS; P.at = L2.t; L2.repaint(); };
  const perDay = () => Math.round(50 * Math.pow(40, P.perDay / 100));
  return { P, decide,
    hud: () => [
      [['CASE', () => Math.min(P.i - GVH_R1[0] + 1, 12) + '/12'], ['CAUGHT', () => stats(1).caught + ' AI errors', 'good'], ['TIMED OUT', () => String(stats(1).timeouts), 'bad']],
      [['PER REVIEWER', () => perDay() + '/day'], ['SECONDS EACH', () => gvSecs(perDay()).toFixed(0)], ['ERRORS CAUGHT', () => Math.round(gvCatch(gvSecs(perDay())) * 100) + '%', 'bad']],
      [['ROUND 2', () => inRound().length + '/' + (GVH_R2[1] - GVH_R2[0])], ['CAUGHT', () => stats(2).caught + '/' + stats(2).wrong, 'good'], ['ROUND 1', () => stats(1).caught + '/' + stats(1).wrong]],
      [['ACCOUNTABLE', () => P.raci ? GV_RACI.find(r => r[0] === P.raci)[1].split(' ').slice(0, 3).join(' ') : '?']],
      axDefHud(P, GVH_VEC, GVH_DEF), axDefHud(P, GVH_VEC, GVH_DEF)][L.step],
    tick: (L2, dt) => { if (NN.sync || (L2.step !== 0 && L2.step !== 2) || done() || L2.briefOpen) return; if (L2.step === 2 && (P.design.notime || P.round !== 2 || !P.started)) return;
      P.left -= dt; if (P.left <= 0) decide(L2, 'agree', 'timeout'); },
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, GVH_GROUPS, GVH_VEC, GVH_DEF) : [gvhDrawQueue, gvhDrawScale, gvhDrawQueue, gvhDrawRaci][L2.step](L2, g, P, stats, perDay),
    steps: [
      { enter: () => { P.round = 1; P.i = GVH_R1[0]; P.left = GVH_SECS; },
        say: () => !done() ? 'You review the AI’s claim decisions. ' + GVH_SECS + ' seconds a case, then the queue applies the AI answer. Read, then agree or override.' : 'You caught ' + stats(1).caught + ' of ' + stats(1).wrong + ' AI errors; ' + stats(1).timeouts + ' cases timed out to the AI answer. Every one of the errors had a tell in the facts.',
        side: L2 => done() ? [h('p', { class: 'labsm' }, 'Round over.')] : [h('div', { class: 'labstack' }, labBtn('✓ Agree with the AI', () => decide(L2, 'agree', 'click'), 'go'), labBtn('✗ Override', () => decide(L2, 'override', 'click')))],
        acts: L2 => [labNext(L2, 'Now at scale →', !done())] },
      { say: () => !(P.sawFast && P.sawSlow) ? 'One reviewer, a working day. Slide the volume up and down and watch the seconds per case.' : 'Past a few hundred a day the human is a signature, not a check. The AI Act asks for oversight people can actually exercise.',
        side: L2 => [axRange(L2, P, 'perDay', 'Cases per reviewer per day', () => P.sawFast && P.sawSlow, () => { const n = perDay(); if (n >= 600) P.sawFast = true; if (n <= 150) P.sawSlow = true; return String(n); }, 100)],
        acts: L2 => [labNext(L2, 'Redesign the review →', !(P.sawFast && P.sawSlow))] },
      { enter: () => { P.round = 2; P.i = GVH_R2[0]; P.left = GVH_SECS; P.started = false; },
        say: () => !P.started ? 'Pick at least one design change, then review eight more.' : !done() ? (P.design.blind ? 'Decide first: approve or deny.' : 'Agree or override.') : 'Round two: ' + stats(2).caught + ' of ' + stats(2).wrong + ' caught (round one: ' + stats(1).caught + ' of ' + stats(1).wrong + '). Same person, different design.',
        side: L2 => !P.started ? [h('div', { class: 'labchipset' }, GVH_DESIGNS.map(([k, t]) => gvChip(t, P.design[k], () => { P.design[k] = !P.design[k]; L2.repaint(); }))),
            labBtn('▶ Start round two', () => { P.started = true; P.left = GVH_SECS; L2.repaint(); }, 'go', !Object.values(P.design).some(Boolean))]
          : done() ? [h('p', { class: 'labsm' }, 'Round over.')]
          : [h('div', { class: 'labstack' }, P.design.blind ? [labBtn('Approve', () => decide(L2, 'approve', 'click'), 'go'), labBtn('Deny', () => decide(L2, 'deny', 'click'))]
            : [labBtn('✓ Agree with the AI', () => decide(L2, 'agree', 'click'), 'go'), labBtn('✗ Override', () => decide(L2, 'override', 'click'))])],
        acts: L2 => [labNext(L2, 'Who is accountable? →', !(P.started && done()))] },
      { say: () => !P.raci ? 'A wrongly approved claim paid out €48,000. It was in your queue. Who is accountable?' : P.raci === 'owner' ? GV_RACI_WHY.owner : GV_RACI_WHY[P.raci] + ' Try again.',
        side: L2 => [h('div', { class: 'labstack' }, GV_RACI.map(([k, t]) => labBtn((P.raci === k ? (k === 'owner' ? '✓ ' : '✗ ') : '') + t, () => { P.raci = k; P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.raci !== 'owner')] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(GVH_VEC, GVH_DEF, P.on).length; return n ? n + ' ways oversight is real on paper only. Switch on controls.' : 'All ' + GVH_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, GVH_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'A human in the loop is a control only if they have the time, the information and the authority to say no.',
        enter: () => labDone('gvhuman'),
        side: () => axDebrief(P, GVH_VEC, GVH_DEF, [
          ['Mar 2018 · Uber, Tempe', 'A self-driving test car killed a pedestrian. The safety driver was the human oversight; the NTSB found automation complacency and weak safety culture.'],
          ['Jul 2023 · Robodebt Royal Commission', 'Australia’s automated debt scheme was found unlawful. Staff review existed on paper; in practice the system’s output was rarely questioned.'],
          ['Feb 2024 · Moffatt v Air Canada', 'The airline argued its chatbot was responsible for its own wrong answer. The tribunal held the company accountable for everything on its website.'],
          ['Aug 2026 · AI Act Art 14 and 26', 'High-risk systems must be designed for effective oversight, and deployers must assign people with the competence, training and authority to exercise it.']],
          [], 'Your catches on this page are your own clicks. The catch-rate curve at scale is illustrative.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv-gov' }, 'Governance →')] }
    ] };
}
function gvhDrawQueue(L, g, P, stats) {
  const r = P.round === 1 ? GVH_R1 : GVH_R2, pad = 20, cw = Math.min(520, L.w - 220), x = pad, y = 44, ch = Math.min(L.h - 120, 300);
  labText(g, 'CLAIMS QUEUE · ROUND ' + P.round, pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  for (let k = 1; k <= 4; k++) { const j = P.i + k; if (j >= r[1]) break; const qx = x + cw + 20, qy = y + (k - 1) * 46; axCard(g, qx, qy, Math.min(180, L.w - qx - 10), 38, { col: LC.mute, lines: [[GV_CLAIMS[j].id + ' · ' + GV_CLAIMS[j].nm, lc(LC.mute, 1), false]] }); }
  if (P.i >= r[1] || (P.round === 2 && !P.started)) {
    const s = stats(P.round); if (P.i >= r[1]) axStamp(g, L.w / 2, L.h / 2, 'CAUGHT ' + s.caught + ' OF ' + s.wrong + ' AI ERRORS', s.caught === s.wrong ? LC.good : LC.bad, 1, L.w > 720 ? 22 : 14);
    else gvWrap(g, 'Choose a design on the right, then start.', L.w / 2, L.h / 2, L.w * 0.6, { size: 15, align: 'center', col: lc(LC.mute, 1) });
  } else {
    const c = GV_CLAIMS[P.i], blind = P.round === 2 && P.design.blind, flag = P.round === 2 && P.design.flag, facts = c.facts.concat([c.tell || ['Photos: 3 attached', 'No prior claims', 'Address unchanged since 2019', 'Payout to the account on file'][P.i % 4]]);
    axRound(g, x, y, cw, ch, 12); g.fillStyle = '#0B1226'; g.fill(); g.strokeStyle = lc(LC.blue, 0.6); g.stroke();
    labText(g, c.id + ' · ' + c.nm, x + 16, y + 30, { size: 17, w: 700, mono: false, col: lc(LC.text, 1) });
    facts.forEach((f, k) => { const hot = flag && c.tell === f; if (hot) { g.fillStyle = 'rgba(255,90,122,.18)'; g.fillRect(x + 10, y + 50 + k * 26, cw - 20, 22); } labText(g, '· ' + f, x + 16, y + 66 + k * 26, { size: 13, mono: false, col: lc(hot ? LC.bad : LC.text, 0.95) }); });
    const ay = y + ch - 60; g.fillStyle = 'rgba(141,182,242,.08)'; g.fillRect(x + 10, ay, cw - 20, 48);
    labText(g, blind ? 'AI ANSWER HIDDEN UNTIL YOU DECIDE' : 'AI RECOMMENDS: ' + c.ai.toUpperCase() + ' · confidence ' + Math.round(c.conf * 100) + '%', x + 20, ay + 30, { size: 14, w: 700, col: lc(blind ? LC.mute : c.ai === 'approve' ? LC.good : LC.bad, 1) });
    const timed = !(P.round === 2 && P.design.notime); if (timed) { gvBar(g, x, y + ch + 10, cw, 8, P.left / GVH_SECS, P.left < 2 ? LC.bad : LC.ink); labText(g, Math.max(0, P.left).toFixed(1) + ' s, then the AI answer is applied', x, y + ch + 34, { size: 11, col: lc(LC.mute, 1) }); }
  }
  const s1 = stats(1); labText(g, 'Round 1: caught ' + s1.caught + '/' + s1.wrong + ' · timed out ' + s1.timeouts + (P.round === 2 ? '   Round 2: caught ' + stats(2).caught + '/' + stats(2).wrong : ''), pad, L.h - 12, { size: 11, col: lc(LC.mute, 1) });
}
function gvhDrawScale(L, g, P, stats, perDay) {
  const x0 = 70, x1 = L.w - 30, y0 = L.h - 60, y1 = 50, X = v => x0 + (x1 - x0) * v / 100, Y = q => y0 + (y1 - y0) * q, pd = v => Math.round(50 * Math.pow(40, v / 100));
  labText(g, 'CHANCE A REVIEWER CATCHES A WRONG AI ANSWER (ILLUSTRATIVE)', x0, 30, { size: 12, w: 700, col: lc(LC.blue, 1) });
  [0, 0.5, 1].forEach(q => { g.strokeStyle = lc(LC.mute, 0.25); g.beginPath(); g.moveTo(x0, Y(q)); g.lineTo(x1, Y(q)); g.stroke(); labText(g, Math.round(q * 100) + '%', x0 - 8, Y(q) + 4, { size: 10, align: 'right' }); });
  [0, 33, 66, 100].forEach(v => labText(g, pd(v) + '/day', X(v), y0 + 18, { size: 10, align: 'center' }));
  [[false, LC.bad, 'sees the AI answer first'], [true, LC.good, 'decides before seeing it']].forEach(([blind, col, t], k) => { g.strokeStyle = lc(col, 0.9); g.lineWidth = 2.5; g.beginPath();
    for (let v = 0; v <= 100; v++) { const yy = Y(gvCatch(gvSecs(pd(v)), blind)); if (v) g.lineTo(X(v), yy); else g.moveTo(X(v), yy); } g.stroke(); g.lineWidth = 1; labText(g, '— ' + t, x1, y1 + 4 + k * 16, { size: 11, align: 'right', col: lc(col, 1) }); });
  const n = perDay(), s = gvSecs(n), cx = X(P.perDay); g.strokeStyle = lc(LC.ink, 0.9); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(cx, y1); g.lineTo(cx, y0); g.stroke(); g.setLineDash([]);
  labText(g, n + ' a day → ' + s.toFixed(0) + ' s each', Math.min(x1 - 80, Math.max(x0 + 80, cx)), y1 - 14, { size: 14, w: 700, align: 'center', col: lc(LC.ink, 1) });
}
function gvhDrawRaci(L, g, P) {
  const cx = L.w / 2, cy = L.h / 2, R = Math.min(L.w, L.h) * 0.33;
  axNode(g, cx, cy, 46, '€48k', LC.bad, true, 'wrongly paid');
  GV_RACI.forEach(([k, t], i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / GV_RACI.length, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = P.raci === k, col = on ? (k === 'owner' ? LC.good : LC.bad) : LC.mute;
    g.strokeStyle = lc(col, on ? 0.9 : 0.25); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
    axCard(g, x - 90, y - 24, 180, 48, { col, ok: on && k === 'owner', hot: on && k !== 'owner', lines: [[t, lc(LC.text, 1), false]], fs: 11 });
    labText(g, k === 'owner' ? 'A' : k === 'reviewer' || k === 'ds' ? 'R' : k === 'board' ? 'C' : 'I', x + 80, y - 30, { size: 11, w: 800, align: 'right', col: lc(col, on ? 1 : 0.5) }); });
  labText(g, 'R responsible · A accountable · C consulted · I informed', cx, L.h - 12, { size: 11, align: 'center', col: lc(LC.mute, 1) });
}

/* ====================== 6 · The approval board ====================== */
const GVB_VEC = [{ id: 'slow', name: 'Board slower than the business' }, { id: 'shadow', name: 'Teams went around it' }, { id: 'paper', name: 'Approved on documents, not tests' },
  { id: 'drift', name: 'Approved once, changed after' }, { id: 'poster', name: 'Principles with no control under them' }, { id: 'challenge', name: 'No effective challenge' }];
const GVB_DEF = [
  { id: 'prop', name: 'Proportional evidence and a fast lane', how: 'Low-risk by checklist in days; full packs for high-risk only', kills: ['slow', 'shadow'] },
  { id: 'tests', name: 'Approval needs test results', how: 'Fairness, robustness and red-team reports, not just forms', kills: ['paper'] },
  { id: 'triggers', name: 'Change triggers send it back', how: 'Retrain, vendor version, new purpose, new thresholds', kills: ['drift'] },
  { id: 'ladder', name: 'Every principle mapped to control, test and owner', how: 'A principle without evidence is a poster', kills: ['poster'] },
  { id: 'indep', name: 'Independent validators who can block', how: 'Competence, influence and independence (SR 11-7)', kills: ['challenge'] }];
const GVB_GROUPS = [{ name: 'Throughput', col: 'ink', ids: ['slow', 'shadow', 'paper'], act: 'Shadow AI, or approvals nobody can defend' },
  { name: 'Substance', col: 'bad', ids: ['drift', 'poster', 'challenge'], act: 'Approved in March, a different system by June' }];

function gvbMount(L) {
  const P = { pr: 'fair', placed: 1, wrong: null, wrongAt: -9, ladders: new Set(), deck: {}, o: { model: 'central', cadence: 4, evid: 'full', fast: false }, run: null, base: null, met: false, trig: {}, on: {}, flash: {}, at: -9 };
  const deck = pr => P.deck[pr] || (P.deck[pr] = nnShuffle(GV_LADDERS[pr].rungs.slice(1).map((t, i) => ({ t, rung: i + 1 })).concat(GV_LADDERS[pr].fake.map(t => ({ t, fake: true }))), nnRng(pr.length * 7 + 3)));
  const tg = () => gvTriggered(P.trig);
  return { P,
    hud: () => [
      [['PRINCIPLE', () => GV_LADDERS[P.pr].t], ['RUNGS', () => P.placed + '/' + GV_RUNGS.length], ['LADDERS', () => P.ladders.size + '/4', 'good']],
      [['SHADOW AI', () => P.base ? Math.round(P.base.shadow * 100) + '%' : '?', 'bad'], ['MEDIAN WEEKS', () => P.base ? P.base.median.toFixed(1) : '?'], ['HIGH-RISK FULLY REVIEWED', () => P.base ? Math.round(P.base.hiFull * 100) + '%' : '?']],
      [['SHADOW AI', () => P.run ? Math.round(P.run.shadow * 100) + '%' : '?', P.run && P.run.shadow <= GV_TARGET.shadow ? 'good' : 'bad'], ['MEDIAN WEEKS', () => P.run ? P.run.median.toFixed(1) : '?'], ['HIGH-RISK REVIEWED', () => P.run ? Math.round(P.run.hiFull * 100) + '%' : '?', P.run && P.run.hiFull >= 1 ? 'good' : 'bad']],
      [['MISSED MATERIAL CHANGES', () => String(tg().missed), 'bad'], ['NEEDLESS REVIEWS', () => String(tg().extra)]],
      axDefHud(P, GVB_VEC, GVB_DEF), axDefHud(P, GVB_VEC, GVB_DEF)][L.step],
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, GVB_GROUPS, GVB_VEC, GVB_DEF) : [gvbDrawLadder, gvbDrawSim, gvbDrawSim, gvbDrawChanges][L2.step](L2, g, P, deck),
    steps: [
      { say: () => P.placed < GV_RUNGS.length ? 'Turn the principle into something an auditor can test. Pick the next rung: ' + GV_RUNGS[P.placed] + '.' : 'A provable principle: every rung has an artefact and a name. Two of those cards were posters.',
        side: L2 => [h('div', { class: 'labchipset' }, Object.entries(GV_LADDERS).map(([k, v]) => gvChip((P.ladders.has(k) ? '✓ ' : '') + v.t, P.pr === k, () => { P.pr = k; P.placed = 1; P.wrong = null; L2.repaint(); }))),
          h('div', { class: 'labstack' }, deck(P.pr).map(c2 => { const used = !c2.fake && c2.rung < P.placed;
            return h('button', { type: 'button', class: 'labp' + (used ? ' sent' : '') + (P.wrong === c2.t ? ' bad' : ''), disabled: used ? true : null, onclick: () => {
              if (!c2.fake && c2.rung === P.placed) { P.placed++; P.wrong = null; if (P.placed === GV_RUNGS.length) P.ladders.add(P.pr); } else { P.wrong = c2.t; P.wrongAt = L2.t; } L2.repaint(); } }, c2.t); }))],
        acts: L2 => [labNext(L2, 'Run the board →', !P.ladders.size)] },
      { say: () => !P.base ? '48 model requests arrive this quarter. One central board, monthly, full evidence for everything. Run it.' : Math.round(P.base.shadow * 100) + '% of teams gave up waiting and shipped without approval. The board reviewed what was left.',
        side: L2 => [labBtn((P.base ? '✓ ' : '▶ ') + 'Run the quarter', () => { P.base = gvBoardSim({ model: 'central', cadence: 4, evid: 'full', fast: false }); P.run = P.base; P.at = L2.t; L2.repaint(); })],
        acts: L2 => [labNext(L2, 'Redesign it →', !P.base)] },
      { say: () => !P.run || P.run === P.base ? 'Targets: shadow AI ≤ 10%, median ≤ 3 weeks, every high-risk model reviewed with full evidence. Change the operating model.' : gvBoardOk(P.run) ? 'Targets met: proportional evidence, the right place for each decision, and high-risk still gets the full board.' : gvBoardSim(P.o).hiFull < 1 && P.o.model === 'fed' ? 'Fast, but half the business units approved high-risk models without full evidence.' : 'Not yet. Shadow ' + Math.round(P.run.shadow * 100) + '%, median ' + P.run.median.toFixed(1) + ' weeks, high-risk ' + Math.round(P.run.hiFull * 100) + '%.',
        side: L2 => [h('span', { class: 'labk' }, 'Operating model'), h('div', { class: 'labchipset' }, GV_OPS.model.map(([k, t]) => gvChip(t, P.o.model === k, () => { P.o.model = k; L2.repaint(); }))),
          h('span', { class: 'labk' }, 'Board meets'), h('div', { class: 'labchipset' }, GV_OPS.cadence.map(([k, t]) => gvChip(t, P.o.cadence === k, () => { P.o.cadence = k; L2.repaint(); }))),
          h('span', { class: 'labk' }, 'Evidence'), h('div', { class: 'labchipset' }, GV_OPS.evid.map(([k, t]) => gvChip(t, P.o.evid === k, () => { P.o.evid = k; L2.repaint(); }))),
          h('div', { class: 'labchipset' }, gvChip('Fast lane for low-risk (checklist)', P.o.fast, () => { P.o.fast = !P.o.fast; L2.repaint(); })),
          labBtn('▶ Run the quarter', () => { P.run = gvBoardSim(Object.assign({}, P.o)); if (gvBoardOk(P.run)) P.met = true; P.at = L2.t; L2.repaint(); }, 'go')],
        acts: L2 => [labNext(L2, 'After approval →', !P.met)] },
      { say: () => tg().missed ? 'Six changes hit approved systems this year. Pick the triggers that send a system back to review. ' + tg().missed + ' material changes still slip through.' : tg().extra ? 'Every material change is caught, but ' + tg().extra + ' trivial ones now clog the board.' : 'Material changes go back, trivial ones do not. Model governance continues after go-live.',
        side: L2 => [h('div', { class: 'labchipset' }, GV_TRIG.map(([k, t]) => gvChip(t, P.trig[k], () => { P.trig[k] = !P.trig[k]; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', tg().missed > 0 || tg().extra > 0)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(GVB_VEC, GVB_DEF, P.on).length; return n ? n + ' ways a governance programme approves the wrong thing. Switch on controls.' : 'All ' + GVB_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, GVB_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Governance that is slower than the business is not governance. It is a reason to go around.',
        enter: () => labDone('gvboard'),
        side: () => axDebrief(P, GVB_VEC, GVB_DEF, [
          ['Apr 2011 · SR 11-7', 'US banking supervisors set the model-risk standard: validation with “effective challenge” by people with competence, influence and independence. AI model governance inherits it.'],
          ['Apr 2023 · Samsung', 'Engineers pasted source code and meeting notes into a public chatbot within weeks of it being allowed. The company restricted generative AI tools: shadow AI meets a missing fast lane.'],
          ['Nov 2021 · Zillow Offers', 'A home-pricing model kept buying above resale value as the market turned. The business was wound down with hundreds of millions in write-downs and a quarter of staff cut.'],
          ['Jun 2022 · Responsible AI Standard v2', 'Microsoft published how it turns six principles into goals, requirements and tools per system: the ladder from principle to evidence, made public.']],
          [], 'The quarter is simulated from 48 generated requests; preparation times, board seats and teams’ patience are illustrative.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv-gov' }, 'Governance →')] }
    ] };
}
function gvbDrawLadder(L, g, P) {
  const lad = GV_LADDERS[P.pr], cx = L.w / 2, top = 30, rh = Math.min(62, (L.h - 60) / GV_RUNGS.length - 6), w = Math.min(620, L.w - 40);
  g.strokeStyle = lc(LC.mute, 0.35); g.lineWidth = 3; [cx - w / 2 - 8, cx + w / 2 + 8].forEach(x => { g.beginPath(); g.moveTo(x, top - 10); g.lineTo(x, top + GV_RUNGS.length * (rh + 6)); g.stroke(); }); g.lineWidth = 1;
  GV_RUNGS.forEach((r, i) => { const y = top + i * (rh + 6), on = i < P.placed, col = on ? (i === 0 ? LC.ink : LC.good) : LC.mute;
    axCard(g, cx - w / 2, y, w, rh, { col, ok: on && i > 0, title: r.toUpperCase(), lines: on ? [[lad.rungs[i], lc(LC.text, 1), false]] : [['?', lc(LC.mute, 0.6), false]], fs: Math.max(10, Math.min(13, w / 46)) }); });
  if (P.wrong) axStamp(g, cx, L.h - 30, GV_LADDERS[P.pr].fake.includes(P.wrong) ? 'THAT IS A POSTER, NOT A RUNG' : 'NOT THE NEXT RUNG', LC.bad, L.t - P.wrongAt, L.w > 720 ? 16 : 11);
}
function gvbDrawSim(L, g, P) {
  const r = P.run, pad = 20, x0 = 110, x1 = L.w - 190, y0 = 46, rows = GV_REQ.length, rh = (L.h - y0 - 40) / rows, X = wk => x0 + (x1 - x0) * Math.min(1, wk / 16);
  labText(g, 'MODEL REQUESTS · WEEKS FROM ARRIVAL TO DECISION', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  for (let wk = 0; wk <= 16; wk += 4) { g.strokeStyle = lc(LC.mute, 0.15); g.beginPath(); g.moveTo(X(wk), y0 - 6); g.lineTo(X(wk), L.h - 34); g.stroke(); labText(g, 'wk ' + wk, X(wk), L.h - 18, { size: 10, align: 'center' }); }
  ['low', 'med', 'high'].forEach((t, i) => labText(g, '■ ' + t, pad, y0 + 10 + i * 16, { size: 10.5, col: lc([LC.blue, LC.ink, LC.bad][i], 1) }));
  if (!r) { gvWrap(g, 'Run the quarter on the right.', L.w / 2, L.h / 2, L.w * 0.6, { size: 15, align: 'center', col: lc(LC.mute, 1) }); return; }
  const age = NN.sync ? 9 : L.t - P.at;
  r.out.forEach((o, i) => { const y = y0 + i * rh + rh / 2, col = { low: LC.blue, med: LC.ink, high: LC.bad }[o.q.tier], end = o.q.wk + Math.min(o.lead, age * 4);
    g.strokeStyle = lc(col, o.shadow ? 0.25 : 0.8); g.lineWidth = Math.max(1, rh * 0.5); g.beginPath(); g.moveTo(X(o.q.wk), y); g.lineTo(X(Math.min(end, o.shadow ? o.q.wk + o.q.tol : end)), y); g.stroke(); g.lineWidth = 1;
    if (age * 4 >= o.lead) { if (o.shadow) { g.fillStyle = lc(LC.bad, 1); labText(g, '✗', X(o.q.wk + o.q.tol) + 4, y + 4, { size: 10, col: lc(LC.bad, 1) }); } else { g.fillStyle = lc(o.fullEv ? LC.good : LC.ink, 1); g.beginPath(); g.arc(X(o.q.wk + o.lead), y, Math.max(2, rh * 0.4), 0, 7); g.fill(); } } });
  const bx = L.w - 170; [['SHADOW AI', Math.round(r.shadow * 100) + '%', r.shadow <= GV_TARGET.shadow], ['MEDIAN', r.median.toFixed(1) + ' wk', r.median <= GV_TARGET.median], ['HIGH-RISK REVIEWED', Math.round(r.hiFull * 100) + '%', r.hiFull >= 1], ['BOARD ITEMS', String(r.boardN), true]]
    .forEach(([k, v, ok], i) => { labText(g, k, bx, y0 + 8 + i * 58, { size: 10, w: 700, col: lc(LC.mute, 1) }); labText(g, v, bx, y0 + 36 + i * 58, { size: 24, w: 700, col: lc(ok ? LC.good : LC.bad, 1) }); });
  labText(g, '— waiting   ● decided   ✗ team shipped without approval', x0, L.h - 4, { size: 10, col: lc(LC.mute, 1) });
}
function gvbDrawChanges(L, g, P) {
  const pad = 20, rh = Math.min(64, (L.h - 60) / GV_CHANGES.length - 8), w = L.w - pad * 2;
  labText(g, 'CHANGES TO APPROVED SYSTEMS THIS YEAR', pad, 26, { size: 12, w: 700, col: lc(LC.blue, 1) });
  GV_CHANGES.forEach((c, i) => { const y = 40 + i * (rh + 8), rev = !!P.trig[c.id], col = c.material ? (rev ? LC.good : LC.bad) : (rev ? LC.ink : LC.mute);
    axCard(g, pad, y, w, rh, { col, ok: c.material && rev, hot: c.material && !rev, title: c.material ? 'MATERIAL' : 'TRIVIAL', lines: [[c.t + '  →  ' + (rev ? 'back to review' : 'nobody looks'), lc(LC.text, 1), false]], fs: Math.max(10, Math.min(13, w / 60)) }); });
}

/* ---------- registration ---------- */
[
  { id: 'gvexplain', track: 'gov', title: 'Explain, disclose, reconstruct', kicker: 'Explainability · transparency · auditability', blurb: 'Generate the reasons for a declined loan, find the change that flips it, catch an explanation that hides the real reason, sort three words that get used as one, then tamper with a hash-chained log and replay a decision nine months later.', mount: gveMount,
    brief: { what: 'Three different duties hide behind “transparent AI”. Transparency says it is AI and what it is. Explainability says why this outcome, for this person. Auditability proves what happened, later, to someone who does not trust you.',
      real: 'US regulators require specific reasons for credit denials whatever the model. The EU’s top court treats a decisive credit score as an automated decision. Explanations can be made to look fair while hiding the real driver.',
      todo: ['Generate the reasons and find the counterfactual', 'Compare the letter with the model and test its fidelity', 'Sort statements, then tamper with and replay the log'] },
    guide: [
      { look: [['bad', '▬', 'Pushes towards decline.'], ['good', '▬', 'Pushes towards approve.'], ['mute', '🔒', 'Not something the person can change.']], why: 'Explainability answers “why me?”. The honest answer here includes postcode, which the applicant cannot act on, and which may be a proxy.' },
      { look: [['good', '▬', 'Move the sliders; the bars and score follow.']], why: 'A counterfactual is the most useful explanation for a person: what would have to be different. Only offer changes they can make.' },
      { look: [['ink', '●', 'Toggle between the model and the letter.']], why: 'An explanation is a claim about the model. If nobody tests it against the model, it can be wrong, or worse, chosen to look acceptable.' },
      { look: [['good', '▭', 'In the right column.'], ['bad', '▭', 'In the wrong column.']], why: 'Different laws ask for each: AI Act Art 50 for disclosure, Art 86 and GDPR for explanations, Art 12 and 26 for logs.' },
      { look: [['good', '▭', 'Row verifies against the one before.'], ['bad', '▭', 'Chain broken from here on.']], why: 'Auditability needs two things: proof nobody edited the record, and enough of the record to reproduce the decision with the same model version.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Transparency without explanation, and explanation without records, both fail the person who complains.' },
      { why: 'Ask: for a decision made last March, can you show the inputs, the model version, the reason given, and that none of it changed?' }] },
  { id: 'gvhuman', track: 'gov', title: 'The human in the loop', kicker: 'Human oversight · automation bias · accountability', blurb: 'Review a queue of AI claim decisions against the clock and count what you catch, scale it to a real working day, redesign the review and try again, then decide who is accountable when an approved error pays out.', mount: gvhMount,
    brief: { what: 'Human oversight is the most common AI control and the easiest to fake. A person who sees the AI answer first, has seconds per case and a queue that approves on timeout, is a signature, not a check.',
      real: 'The AI Act requires high-risk systems to be built for effective oversight and deployers to staff it with competent people. Inquiries into Robodebt and the Uber test crash both found human review that existed on paper.',
      todo: ['Review twelve AI decisions under time pressure', 'Scale it to a day and watch the seconds disappear', 'Redesign the review, then name the accountable owner'] },
    guide: [
      { look: [['blue', '▭', 'The case, its facts and the AI answer.'], ['ink', '▬', 'Your time left before the AI answer is applied.']], why: 'Every wrong AI answer has a tell in the facts. Under time pressure, with a confident AI answer showing, most people agree anyway.' },
      { look: [['bad', '—', 'Catch rate when the AI answer is shown first.'], ['good', '—', 'When the reviewer decides first.']], why: 'Volume decides whether oversight is real. Cap it, or the human becomes a rubber stamp.' },
      { look: [['bad', '▭', 'With highlighting on, the contradicting fact turns red.']], why: 'Design beats exhortation: hide the answer on a sample, surface contradictions, and never let a timeout approve.' },
      { look: [['good', 'A', 'Accountable: one name.'], ['ink', 'R', 'Responsible: does the work.']], why: 'Accountability sits with whoever chose to use AI in the process and set its design. The reviewer is responsible for the check only if given the means.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Oversight fails at the desk and in the org chart.' },
      { why: 'Ask how many seconds a reviewer has per case, what share they override, and who is named as accountable.' }] },
  { id: 'gvboard', track: 'gov', title: 'The approval board', kicker: 'Operating models · model governance · principles to practice', blurb: 'Build a ladder from a principle down to evidence and an owner, run a quarter of model requests through a central board and watch teams go around it, redesign the operating model to hit three targets, then decide which changes send a model back.', mount: gvbMount,
    brief: { what: 'Enterprise AI governance is an operating model: who approves what, how fast, on what evidence, and what happens after go-live. Get it wrong one way and nothing ships; get it wrong the other way and everything ships without you.',
      real: 'Banks have run model-risk governance under SR 11-7 since 2011. When generative AI arrived, firms without a fast lane found staff using public tools anyway, as Samsung did in 2023.',
      todo: ['Turn a principle into a testable ladder', 'Run the board and see shadow AI appear', 'Redesign the operating model, then set change triggers'] },
    guide: [
      { look: [['good', '▭', 'A placed rung, with its artefact.'], ['bad', '!', 'A poster: sounds right, proves nothing.']], why: 'A principle is implemented when each rung down to evidence and an owner exists. OECD and NIST say what; this ladder is how.' },
      { look: [['blue', '—', 'Each line: one request waiting.'], ['good', '●', 'Approved with full evidence.'], ['bad', '✗', 'The team shipped without approval.']], why: 'Every team has a patience limit. A board that meets monthly and asks for everything creates shadow AI.' },
      { look: [['good', '#', 'Green numbers: target met.']], why: 'Proportionality is the lever: light evidence for low risk, decisions close to the business, the full board for high-risk only.' },
      { look: [['bad', '▭', 'Material change nobody reviews.'], ['ink', '▭', 'Trivial change you now review.']], why: 'Model governance continues after approval. Retraining, a vendor version or a new purpose is a new system.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Boards fail by being slow, by approving paper, and by never seeing the system again.' },
      { why: 'Ask: how long does approval take for a low-risk use, how many AI systems run that were never approved, and what sends one back?' }] }
].forEach(x => { GV_SIMS.push(x); NN_SIMS.push(x); NN_BY[x.id] = x; });

/* ---------- the Governance hub on the Advanced page ---------- */
const GV_SIM_TOPICS = id => GV_TOPICS.filter(t => t[1] === id).map(t => t[0]);
function govHub() {
  const cols = [['kind', 'What it is'], ['binding', 'Binding?'], ['cert', 'Certificate'], ['unit', 'Governs'], ['checks', 'Who checks'], ['shape', 'Shape']];
  const done = GV_SIMS.filter(x => S.nn && S.nn[x.id] && S.nn[x.id].done).length;
  return [
    h('p', { class: 'advlead' }, 'Twenty-five governance and responsible-AI topics, taught as six instruments. Each one computes its mechanism on the page, shows how a compliant design still fails, and ends with the controls and real cases.'),
    h('div', { class: 'govgrid' }, GV_SIMS.map((x, i) => { const ok = S.nn && S.nn[x.id] && S.nn[x.id].done;
      return h('a', { class: 'govcard glow' + (ok ? ' done' : ''), href: '#adv-nn-' + x.id, style: '--i:' + i },
        h('span', { class: 'govn' }, String(i + 1).padStart(2, '0')), h('span', { class: 'kicker' }, x.kicker + (ok ? ' · done' : '')), h('b', null, x.title), h('span', { class: 'clamp' }, x.blurb),
        h('span', { class: 'govtopics' }, GV_SIM_TOPICS(x.id).map(t => h('i', null, t)))); })),
    h('h2', { class: 'sylgroup' }, 'Where the five rulebooks differ'),
    h('p', { class: 'advlead' }, 'They ask for much the same evidence. They are not the same kind of thing. Instrument 01 lets you sort them by each question.'),
    h('div', { class: 'govfw', role: 'table', 'aria-label': 'Framework comparison' },
      h('div', { class: 'govfwrow head', role: 'row' }, h('span', { role: 'columnheader' }, ''), cols.map(([, t]) => h('span', { role: 'columnheader' }, t))),
      GV_FW.map(f => h('div', { class: 'govfwrow', role: 'row' }, h('b', { role: 'rowheader' }, f.short, h('small', null, f.when)), cols.map(([k]) => h('span', { role: 'cell', class: k === 'binding' && f.bind >= 4 ? 'hot' : k === 'cert' && f.certN ? 'warm' : '' }, f[k]))))),
    h('p', { class: 'small' }, done + ' of ' + GV_SIMS.length + ' governance instruments done. References are for orientation; check the current text before quoting them.')
  ];
}
/* A link from the related modules' labs. */
const GV_LAB = { m07: ['gvfair', 'gvexplain', 'gvboard'], m08: ['gvhuman'], m13: ['gvboard'], m15: ['gvx', 'gvtier'] };
function govLabLink(labId) {
  const ids = GV_LAB[labId]; if (!ids) return null;
  return h('a', { class: 'raglink govlink', href: '#adv-nn-' + ids[0] }, h('b', null, 'Hands-on: ' + ids.map(id => NN_BY[id].title).join(' · ')), h('span', null, 'Governance instruments for this module, on the Advanced path →'));
}
