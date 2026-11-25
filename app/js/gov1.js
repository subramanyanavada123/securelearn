'use strict';
/* Governance instruments 1–3: the framework crosswalk, risk classification,
   and fairness. Engines and tables live in gov-data.js. */

/* ---------- shared bits for the governance instruments ---------- */
const GVC = { tier: { minimal: LC.good, limited: LC.blue, high: LC.ink, prohibited: LC.bad }, fw: { nist: LC.blue, iso42: LC.violet, iso23: LC.pos, euai: LC.ink, oecd: LC.good } };
function gvChip(t, on, fn, cls) { return h('button', { type: 'button', class: 'labp' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), 'aria-pressed': String(!!on), onclick: fn }, t); }
function gvWrap(g, t, x, y, w, o) { o = o || {}; g.font = (o.w || 600) + ' ' + (o.size || 12) + "px 'IBM Plex Sans', sans-serif"; const ls = piWrap(g, t, w).slice(0, o.max || 9);
  ls.forEach((s2, i) => labText(g, s2, x, y + i * (o.size || 12) * 1.35, { size: o.size || 12, mono: false, w: o.w || 600, col: o.col || lc(LC.text, 0.9), align: o.align })); return y + ls.length * (o.size || 12) * 1.35; }
function gvBar(g, x, y, w, hh, f, col) { g.fillStyle = 'rgba(141,182,242,.10)'; g.fillRect(x, y, w, hh); g.fillStyle = lc(col, 0.9); g.fillRect(x, y, w * Math.max(0, Math.min(1, f)), hh); }
const gvEase = (a, b, k) => a + (b - a) * Math.min(1, k);

/* ====================== 1 · One control, five rulebooks ====================== */
const GVX_VEC = [{ id: 'paper', name: 'Mapped documents, not operation' }, { id: 'oneway', name: 'Mapped one way, gaps hidden' }, { id: 'version', name: 'Crosswalk to an old version' },
  { id: 'certprod', name: 'Certificate read as product assurance' }, { id: 'scope', name: 'Scope left out vendor AI' }, { id: 'owner', name: 'Nobody owns the crosswalk' }];
const GVX_DEF = [
  { id: 'sample', name: 'Sample evidence that it ran', how: 'Pick records from the period, not the procedure document', kills: ['paper'] },
  { id: 'both', name: 'Map both ways', how: 'Every requirement to evidence, and every control to a requirement', kills: ['oneway'] },
  { id: 'vmap', name: 'Version-pinned crosswalk with an owner', how: 'Reviewed when a framework, profile or guideline changes', kills: ['version', 'owner'] },
  { id: 'claim', name: 'Match the assurance to the claim', how: 'System claims need system-level testing, not a management-system certificate', kills: ['certprod'] },
  { id: 'scope3', name: 'Scope names third-party AI', how: 'The AIMS scope statement lists vendor and embedded AI', kills: ['scope'] }];
const GVX_GROUPS = [{ name: 'Evidence', col: 'ink', ids: ['paper', 'oneway', 'version'], act: 'A green crosswalk over controls that never ran' },
  { name: 'Assurance', col: 'bad', ids: ['certprod', 'scope', 'owner'], act: 'Certified, and the system that failed was out of scope' }];

function gvxMount(L) {
  const P = { have: {}, lens: null, seen: new Set(), pos: Object.fromEntries(GV_FW.map(f => [f.id, 0.5])), assure: null, tried: new Set(), on: {}, flash: {}, at: -9 };
  const nHave = () => Object.values(P.have).filter(Boolean).length, cov = () => gvCover(P.have);
  const best = () => GV_FW.map(f => [f, cov()[f.id].frac]).sort((a, b) => b[1] - a[1]);
  return { P,
    hud: () => [
      [['EVIDENCE', () => nHave() + '/' + GV_EV.length], ['BEST FIT', () => nHave() ? best()[0][0].short + ' ' + Math.round(best()[0][1] * 100) + '%' : '—', 'good'], ['WORST FIT', () => nHave() ? best()[4][0].short + ' ' + Math.round(best()[4][1] * 100) + '%' : '—', 'bad']],
      [['LENSES', () => P.seen.size + '/' + GV_LENS.length], ['NOW', () => P.lens ? GV_LENS.find(l => l[0] === P.lens)[1] : '—']],
      [['TRIED', () => P.tried.size + '/' + GV_ASSURE.length], ['SUPPORTS THE CLAIM', () => P.assure ? (gvAssureFit(GV_ASSURE.find(a => a.id === P.assure)) >= 0.8 ? 'yes' : 'no') : '—']],
      axDefHud(P, GVX_VEC, GVX_DEF), axDefHud(P, GVX_VEC, GVX_DEF)][L.step],
    tick: (L2, dt) => { if (L2.step !== 1 || !P.lens) return; const lens = GV_LENS.find(l => l[0] === P.lens); GV_FW.forEach(f => { P.pos[f.id] = NN.sync ? lens[3](f) : gvEase(P.pos[f.id], lens[3](f), dt * 5); }); },
    draw: (L2, g) => L2.step >= 3 ? axDrawDefend(L2, g, P, GVX_GROUPS, GVX_VEC, GVX_DEF) : [gvxDrawCols, gvxDrawLens, gvxDrawAssure][L2.step](L2, g, P),
    steps: [
      { say: () => nHave() < 6 ? 'Tick the evidence your organisation already has. Watch five rulebooks fill.' : 'Same evidence, five scores. ' + best()[0][0].short + ' is ' + Math.round(best()[0][1] * 100) + '% covered, ' + best()[4][0].short + ' ' + Math.round(best()[4][1] * 100) + '%. One evidence base, many frameworks.',
        side: L2 => [h('div', { class: 'labchipset' }, GV_EV.map(e => gvChip(e.t, P.have[e.id], () => { P.have[e.id] = !P.have[e.id]; P.at = L2.t; L2.repaint(); }))),
          h('p', { class: 'labsm' }, 'Each column is one framework. A cell lights when that framework asks for the evidence. Clause references are for orientation.')],
        acts: L2 => [labNext(L2, 'Where they differ →', nHave() < 6)] },
      { say: () => P.seen.size < GV_LENS.length ? 'They overlap on evidence. They differ on everything else. Look through each lens.' : 'Law vs voluntary, certificate vs none, product vs organisation. You need all five, for different questions.',
        side: L2 => [h('div', { class: 'labstack' }, GV_LENS.map(([k, t]) => labBtn((P.seen.has(k) ? '✓ ' : '▶ ') + t, () => { P.lens = k; P.seen.add(k); L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'What does assurance prove? →', P.seen.size < GV_LENS.length)] },
      { say: () => P.tried.size < GV_ASSURE.length ? 'The claim: “' + GV_CLAIM + '” Try each kind of assurance against it.' : 'Only independent assurance against stated criteria supports this claim. The 42001 certificate is real, and answers a different question.',
        side: L2 => [h('div', { class: 'labstack' }, GV_ASSURE.map(a => labBtn((P.tried.has(a.id) ? '✓ ' : '▶ ') + a.t, () => { P.assure = a.id; P.tried.add(a.id); P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', P.tried.size < GV_ASSURE.length)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(GVX_VEC, GVX_DEF, P.on).length; return n ? n + ' ways a compliant programme still fails. Switch on controls.' : 'All ' + GVX_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, GVX_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Collect evidence once. Map it to every rulebook. Match the assurance to the claim.',
        enter: () => labDone('gvx'),
        side: () => axDebrief(P, GVX_VEC, GVX_DEF, [
          ['Jan 2023 · NIST AI RMF 1.0', 'Voluntary, outcome-based: Govern, Map, Measure, Manage. The Generative AI profile (NIST AI 600-1) followed in July 2024.'],
          ['Dec 2023 · ISO/IEC 42001', 'The first certifiable AI management-system standard. Certification bodies began issuing certificates in 2024. It certifies the organisation’s system, not a model.'],
          ['Feb 2023 · ISO/IEC 23894', 'Guidance that adapts ISO 31000 risk management to AI. Nothing to certify; it shapes how your risk process works.'],
          ['Aug 2024 · EU AI Act in force', 'Obligations phase in: prohibitions and AI literacy from Feb 2025, general-purpose models from Aug 2025, most high-risk duties from Aug 2026 onwards. Check the current dates before quoting.'],
          ['May 2024 · OECD update', 'The 2019 principles were updated for generative AI. They are the common ancestor: the EU, US and others cite them.']],
          [], 'Coverage is counted from the table on this page, one mapping per framework and evidence type. Real crosswalks are many-to-many; use the official text.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv-gov' }, 'Governance →')] }
    ] };
}
function gvxDrawCols(L, g, P) {
  const pad = 12, n = GV_FW.length, cw = (L.w - pad * (n + 1)) / n, top = 64, rh = Math.max(16, Math.min(30, (L.h - top - 20) / GV_EV.length - 3)), fs = Math.max(9, Math.min(11.5, cw / 17)), cov = gvCover(P.have);
  GV_FW.forEach((f, i) => { const x = pad + i * (cw + pad), c = cov[f.id], col = GVC.fw[f.id];
    labText(g, f.short, x + cw / 2, 22, { size: 13, w: 700, align: 'center', mono: false, col: lc(col, 1) });
    gvBar(g, x, 32, cw, 6, c.frac, col); labText(g, c.got + ' of ' + c.asked + ' asked', x + cw / 2, 54, { size: 10, align: 'center', col: lc(LC.mute, 1) });
    GV_EV.forEach((e, j) => { const y = top + j * (rh + 3), ref = e.m[f.id], hv = !!P.have[e.id];
      if (!ref) { g.strokeStyle = 'rgba(141,182,242,.08)'; g.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); return; }
      g.fillStyle = hv ? lc(col, 0.22) : 'rgba(141,182,242,.05)'; g.fillRect(x, y, cw, rh); g.strokeStyle = lc(hv ? col : LC.mute, hv ? 0.8 : 0.25); g.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1);
      fiClip(g, x, y, cw, rh, () => labText(g, (hv ? '✓ ' : '') + ref, x + 6, y + rh / 2 + fs * 0.36, { size: fs, col: lc(hv ? LC.text : LC.mute, hv ? 1 : 0.7) })); }); });
}
function gvxDrawLens(L, g, P) {
  const lens = P.lens && GV_LENS.find(l => l[0] === P.lens), x0 = 40, x1 = L.w - 40, ax = L.h - 50;
  if (!lens) { gvWrap(g, 'Pick a lens on the right. Each one sorts the five frameworks along a different question.', L.w / 2, L.h / 2, L.w * 0.6, { size: 15, align: 'center', col: lc(LC.mute, 1) }); return; }
  labText(g, lens[1].toUpperCase(), 24, 30, { size: 13, w: 700, col: lc(LC.ink, 1) });
  g.strokeStyle = lc(LC.mute, 0.5); g.beginPath(); g.moveTo(x0, ax); g.lineTo(x1, ax); g.stroke();
  const [lo, hi] = GV_LENS_AXIS[lens[0]]; labText(g, '← ' + lo, x0, ax + 22, { size: 11, col: lc(LC.mute, 1) }); labText(g, hi + ' →', x1, ax + 22, { size: 11, align: 'right', col: lc(LC.mute, 1) });
  const cw = Math.min(230, (L.w - 60) / 3.2), ch = Math.min(118, (ax - 70) / 3.1);
  GV_FW.slice().sort((a, b) => P.pos[a.id] - P.pos[b.id]).forEach((f, i) => { const cx = x0 + (x1 - x0) * P.pos[f.id], x = Math.max(8, Math.min(L.w - cw - 8, cx - cw / 2)), y = 50 + (i % 3) * (ch + 10), col = GVC.fw[f.id];
    g.strokeStyle = lc(col, 0.5); g.setLineDash([3, 4]); g.beginPath(); g.moveTo(cx, y + ch); g.lineTo(cx, ax); g.stroke(); g.setLineDash([]);
    g.fillStyle = lc(col, 1); g.beginPath(); g.arc(cx, ax, 6, 0, 7); g.fill();
    axCard(g, x, y, cw, ch, { col, title: f.short + ' · ' + f.kind, lines: [[lens[2](f), lc(LC.text, 1), false], [f.when, lc(LC.mute, 1), false]], fs: Math.max(10, Math.min(12.5, cw / 19)) }); });
}
function gvxDrawAssure(L, g, P) {
  const pad = 18, top = 70, rows = GV_ASSURE.length, rh = Math.min(70, (L.h - top - 10) / rows - 6), lw = Math.min(260, L.w * 0.32), bw = (L.w - lw - pad * 3) / 3;
  gvWrap(g, 'Claim: “' + GV_CLAIM + '”', pad, 28, L.w - pad * 2, { size: 15, w: 700, col: lc(LC.ink, 1) });
  ['Independent of the team', 'About this system', 'Tested outcomes'].forEach((t, k) => labText(g, t.toUpperCase(), lw + pad * 2 + k * bw, top - 10, { size: 10, w: 700, col: lc(LC.mute, 1) }));
  GV_ASSURE.forEach((a, i) => { const y = top + i * (rh + 6), tried = P.tried.has(a.id), cur = P.assure === a.id, fit = gvAssureFit(a), col = !tried ? LC.mute : fit >= 0.8 ? LC.good : LC.bad;
    if (cur) labGlow(g, pad + lw / 2, y + rh / 2, lw * 0.7, col, 0.25);
    axCard(g, pad, y, lw, rh, { col, hot: cur && fit < 0.8, ok: cur && fit >= 0.8, title: a.t, lines: tried ? [[a.says, lc(LC.text, 0.95), false]] : [[a.who, lc(LC.mute, 1), false]], fs: Math.max(10, Math.min(12, lw / 24)) });
    a.sc.forEach((v, k) => { const bx = lw + pad * 2 + k * bw; gvBar(g, bx, y + rh / 2 - 6, bw - pad, 12, tried ? v : 0, col); if (tried) labText(g, Math.round(v * 100) + '%', bx + bw - pad, y + rh / 2 + 22, { size: 10, align: 'right', col: lc(col, 1) }); }); });
  if (P.assure === 'cert') axStamp(g, L.w * 0.66, L.h - 40, 'CERTIFIES THE SYSTEM AROUND IT', LC.bad, L.t - P.at - 0.3, L.w > 720 ? 16 : 11);
}

/* ====================== 2 · Same model, four tiers ====================== */
const GVT_VEC = [{ id: 'once', name: 'Classified once at intake' }, { id: 'derog', name: 'Exemption claimed while profiling' }, { id: 'twin', name: 'Only one of the two tiers kept' },
  { id: 'vendor', name: 'A vendor switched on an AI feature' }, { id: 'role', name: 'Became the provider without noticing' }, { id: 'gpai', name: 'The model underneath never checked' }];
const GVT_DEF = [
  { id: 'trigger', name: 'Re-classify on change triggers', how: 'New purpose, users, data or vendor feature sends it back', kills: ['once', 'vendor'] },
  { id: 'prof', name: 'Profiling question in the intake form', how: 'Asked before any Art 6(3) exemption is recorded', kills: ['derog'] },
  { id: 'dual', name: 'Two tiers per system', how: 'Legal tier sets obligations; internal tier sets controls', kills: ['twin'] },
  { id: 'role', name: 'Role decision recorded per system', how: 'Art 25 test: name, modification, purpose', kills: ['role'] },
  { id: 'up', name: 'Upstream model register', how: 'Provider documentation for every general-purpose model used', kills: ['gpai'] }];
const GVT_GROUPS = [{ name: 'Classification', col: 'ink', ids: ['once', 'derog', 'twin'], act: 'A high-risk system running under minimal-risk controls' },
  { name: 'Value chain', col: 'bad', ids: ['vendor', 'role', 'gpai'], act: 'Provider duties nobody knew they had' }];

function gvtMount(L) {
  const P = { use: null, seenUse: new Set(), u: { annex: 'none' }, hits: new Set(), sawDerog: false, sawVoid: false, found: new Set(), miss: null, role: {}, sawProv: false, on: {}, flash: {}, at: -9, ys: {} };
  const cls = () => gvClassify(P.u);
  const note = () => { const r = cls(); P.hits.add(r.tier); if (r.derog) P.sawDerog = true; if (r.why.some(w => /void/.test(w))) P.sawVoid = true; };
  const mism = GV_TWIN.filter(gvMismatch);
  return { P,
    hud: () => [
      [['DEPLOYMENTS', () => P.seenUse.size + '/' + GV_USES.length], ['SAME MODEL', () => 'yes'], ['TIERS HIT', () => String(new Set([...P.seenUse].map(id => gvClassify(GV_USES.find(x => x.id === id).u).tier)).size)]],
      [['TIER', () => GV_TIER_NAME[cls().tier], cls().tier === 'prohibited' ? 'bad' : ''], ['TIERS REACHED', () => P.hits.size + '/4'], ['EXEMPTION FLIP', () => P.sawDerog && P.sawVoid ? 'found' : '—', 'good']],
      [['MISMATCHES FOUND', () => P.found.size + '/' + mism.length, 'bad']],
      [['ROLE', () => gvRole(P.role)], ['DUTIES', () => String(GV_DUTY[gvRole(P.role)].length)]],
      axDefHud(P, GVT_VEC, GVT_DEF), axDefHud(P, GVT_VEC, GVT_DEF)][L.step],
    tick: (L2, dt) => { if (L2.step) return; GV_USES.forEach(u => { if (!P.seenUse.has(u.id)) return; const t = GV_TIERS.indexOf(gvClassify(u.u).tier); P.ys[u.id] = NN.sync ? t : gvEase(P.ys[u.id] == null ? 1.5 : P.ys[u.id], t, dt * 7); }); },
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, GVT_GROUPS, GVT_VEC, GVT_DEF) : [gvtDrawUses, gvtDrawBuild, gvtDrawTwin, gvtDrawRole][L2.step](L2, g, P),
    steps: [
      { say: () => P.seenUse.size < GV_USES.length ? 'One fine-tuned model. Seven ways the business wants to use it. Place each one.' : 'Same weights, four tiers. The law classifies the use, not the model. And fraud detection on loans is carved out of “credit”.',
        side: L2 => [h('div', { class: 'labstack' }, GV_USES.map(u => labBtn((P.seenUse.has(u.id) ? '✓ ' : '▶ ') + u.t, () => { P.seenUse.add(u.id); P.use = u.id; P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Build your own →', P.seenUse.size < GV_USES.length)] },
      { enter: () => { P.u = { annex: 'none' }; note(); },
        say: () => { const r = cls(); return P.hits.size < 4 ? 'Set the use. Reach all four tiers. ' + GV_TIER_NAME[r.tier] + ': ' + r.why.join('; ') + '.' : !(P.sawDerog && P.sawVoid) ? 'Now find the flip: an Annex III use that escapes as a narrow task, then one toggle that makes it high-risk again.' : 'Found it. “Narrow task” is the most claimed exemption, and profiling voids it.'; },
        side: L2 => [h('span', { class: 'labk' }, 'Used for (Annex III)'), h('div', { class: 'labchipset' }, GV_ANNEX.map(([k, t]) => gvChip(t, P.u.annex === k, () => { P.u.annex = k; note(); L2.repaint(); }))),
          h('span', { class: 'labk' }, 'It…'), h('div', { class: 'labchipset' }, GV_FLAGS.map(([k, t]) => gvChip(t, P.u[k], () => { P.u[k] = !P.u[k]; note(); P.at = L2.t; L2.repaint(); }, ['social', 'emowork', 'scrape', 'manip'].includes(k) ? 'bad' : '')))],
        acts: L2 => [labNext(L2, 'Your own tiering →', P.hits.size < 4 || !(P.sawDerog && P.sawVoid))] },
      { say: () => P.found.size < mism.length ? 'Your internal tier says how dangerous it is. The law says what you must do. Find the systems where they disagree.' : 'Three disagreements. A payments agent nobody regulates, and a tiny CV ranker the law calls high-risk. Keep both tiers.',
        side: L2 => [h('div', { class: 'labstack' }, GV_TWIN.map(s2 => labBtn((P.found.has(s2.id) ? '✓ ' : '▶ ') + s2.t, () => { if (gvMismatch(s2)) P.found.add(s2.id); else P.miss = s2.id; P.at = L2.t; L2.repaint(); }))),
          P.miss && !P.found.has(P.miss) ? h('p', { class: 'labsm' }, 'That one agrees: internal ' + gvInternal(GV_TWIN.find(x => x.id === P.miss)) + ', legal ' + GV_TWIN.find(x => x.id === P.miss).legal + '.') : null],
        acts: L2 => [labNext(L2, 'Whose duties? →', P.found.size < mism.length)] },
      { say: () => !P.sawProv ? 'You bought a high-risk CV ranker: you are the deployer. Now customise it the way teams do.' : gvRole(P.role) === 'provider' ? 'You are now the provider: ' + GV_DUTY.provider.length + ' obligations, including conformity assessment. Nobody filed a form to make that happen.' : 'Back to deployer: ' + GV_DUTY.deployer.length + ' duties.',
        side: L2 => [h('div', { class: 'labchipset' }, GV_ROLE_FLAGS.map(([k, t, art]) => gvChip(t + ' · ' + art, P.role[k], () => { P.role[k] = !P.role[k]; if (gvRole(P.role) === 'provider') P.sawProv = true; P.at = L2.t; L2.repaint(); })))],
        acts: L2 => [labNext(L2, 'Close the paths →', !P.sawProv)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(GVT_VEC, GVT_DEF, P.on).length; return n ? n + ' ways a classified portfolio drifts. Switch on controls.' : 'All ' + GVT_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, GVT_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Classify the use, twice, and again every time it changes.',
        enter: () => labDone('gvtier'),
        side: () => axDebrief(P, GVT_VEC, GVT_DEF, [
          ['2 Feb 2025 · Prohibitions apply', 'Emotion recognition at work and in schools, social scoring and untargeted face scraping became illegal in the EU, alongside the AI literacy duty.'],
          ['Sep 2024 · Clearview AI', 'The Dutch data protection authority fined Clearview €30.5 million over its scraped face database: the practice the AI Act now bans outright.'],
          ['Jan 2021 · Dutch childcare benefits', 'A risk-classification model used nationality as a risk signal. Thousands of families were wrongly treated as fraudsters, and the government resigned.'],
          ['2026 onwards · High-risk duties', 'Most Annex III obligations were legislated to apply from Aug 2026, and a 2025 EU proposal sought to push some back. Check the current dates before you plan against them.']],
          [], 'The classifier on this page is a simplified reading of Articles 5, 6, 25 and 50 and Annex III, for teaching. A real classification needs the legal text and counsel.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv-gov' }, 'Governance →')] }
    ] };
}
function gvtBands(L, g, x0, top, bh, w) {
  GV_TIERS.slice().reverse().forEach((t, i) => { const y = top + i * bh, col = GVC.tier[t]; g.fillStyle = lc(col, 0.07); g.fillRect(x0, y, w, bh - 4); g.strokeStyle = lc(col, 0.35); g.strokeRect(x0 + 0.5, y + 0.5, w - 1, bh - 5);
    labText(g, GV_TIER_NAME[t].toUpperCase(), x0 + 10, y + 18, { size: 11, w: 700, col: lc(col, 1) }); });
}
function gvtDrawUses(L, g, P) {
  const top = 20, bh = (L.h - 40) / 4, mx = Math.min(150, L.w * 0.18), x0 = mx + 30, w = L.w - x0 - 14;
  gvtBands(L, g, x0, top, bh, w);
  axNode(g, mx / 2 + 10, L.h / 2, Math.min(46, mx / 2.4), 'MODEL', LC.violet, true, 'one set of weights');
  const placed = GV_USES.filter(u => P.seenUse.has(u.id)), cw = Math.min(260, w / 2.2);
  placed.forEach((u, k) => { const ti = P.ys[u.id] == null ? 0 : P.ys[u.id], y = top + (3 - ti) * bh + 26, sameBand = placed.filter((v, j) => j < k && GV_TIERS.indexOf(gvClassify(v.u).tier) === GV_TIERS.indexOf(gvClassify(u.u).tier)).length,
      x = x0 + 16 + (sameBand % 2) * (cw + 10), yy = y + Math.floor(sameBand / 2) * Math.min(44, bh / 2.6), r = gvClassify(u.u), col = GVC.tier[r.tier], ch = Math.min(40, bh / 2.8);
    g.strokeStyle = lc(col, 0.35); g.beginPath(); g.moveTo(mx / 2 + 10 + Math.min(46, mx / 2.4), L.h / 2); g.lineTo(x, yy + ch / 2); g.stroke();
    axCard(g, x, yy, cw, ch, { col, hot: P.use === u.id && r.tier === 'prohibited', lines: [[u.t, lc(LC.text, 1), false]], fs: Math.max(9.5, Math.min(11.5, cw / 26)) }); });
}
function gvtDrawBuild(L, g, P) {
  const r = gvClassify(P.u), cx = L.w / 2, cy = L.h * 0.42, R = Math.min(L.w, L.h) * 0.3;
  GV_TIERS.forEach((t, i) => { const a0 = Math.PI + i * Math.PI / 4, a1 = a0 + Math.PI / 4 - 0.03, on = r.tier === t; g.strokeStyle = lc(GVC.tier[t], on ? 1 : 0.25); g.lineWidth = on ? 22 : 14; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    const am = (a0 + a1) / 2; labText(g, GV_TIER_NAME[t], cx + Math.cos(am) * (R + 30), cy + Math.sin(am) * (R + 30), { size: 11, w: 700, align: 'center', col: lc(GVC.tier[t], on ? 1 : 0.5) }); });
  g.lineWidth = 1; const ti = GV_TIERS.indexOf(r.tier), a = Math.PI + (ti + 0.5) * Math.PI / 4;
  g.strokeStyle = lc(LC.text, 0.9); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); g.stroke(); g.lineWidth = 1; g.fillStyle = lc(LC.text, 1); g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
  labText(g, GV_TIER_NAME[r.tier].toUpperCase(), cx, cy + 40, { size: 22, w: 800, align: 'center', col: lc(GVC.tier[r.tier], 1) });
  let y = cy + 70; r.why.forEach(w2 => { y = gvWrap(g, '· ' + w2, cx, y, L.w * 0.8, { size: 13, align: 'center', col: lc(LC.text, 0.9) }) + 4; });
  labText(g, 'TIERS REACHED: ' + GV_TIERS.map(t => (P.hits.has(t) ? '■ ' : '□ ') + t).join('   '), cx, L.h - 20, { size: 11, align: 'center', col: lc(LC.mute, 1) });
}
function gvtDrawTwin(L, g, P) {
  const x0 = 120, y0 = 30, x1 = L.w - 20, y1 = L.h - 50, cols = ['low', 'medium', 'high'], rows = ['high', 'limited', 'minimal'], cw = (x1 - x0) / 3, rh = (y1 - y0) / 3;
  labText(g, 'INTERNAL TIER (impact × reach of its actions) →', x0, L.h - 18, { size: 11, w: 700, col: lc(LC.mute, 1) });
  rows.forEach((r, j) => labText(g, (r === 'high' ? 'LEGAL: HIGH' : r === 'limited' ? 'LEGAL: LIMITED' : 'LEGAL: MINIMAL'), x0 - 10, y0 + j * rh + rh / 2, { size: 10, w: 700, align: 'right', col: lc(GVC.tier[r], 1) }));
  cols.forEach((c, i) => labText(g, c.toUpperCase(), x0 + i * cw + cw / 2, y1 + 16, { size: 10, w: 700, align: 'center', col: lc(LC.mute, 1) }));
  rows.forEach((r, j) => cols.forEach((c, i) => { const bad = (r === 'high') !== (c === 'high'); g.fillStyle = bad ? 'rgba(255,90,122,.06)' : 'rgba(95,208,143,.05)'; g.fillRect(x0 + i * cw + 2, y0 + j * rh + 2, cw - 4, rh - 4); }));
  GV_TWIN.forEach((s2, k) => { const i = cols.indexOf(gvInternal(s2)), j = rows.indexOf(s2.legal), same = GV_TWIN.filter((o, q) => q < k && gvInternal(o) === gvInternal(s2) && o.legal === s2.legal).length,
      found = P.found.has(s2.id), col = found ? LC.bad : LC.blue, cwid = cw - 20, x = x0 + i * cw + 10, y = y0 + j * rh + 10 + same * Math.min(46, rh / 2.2);
    axCard(g, x, y, cwid, Math.min(40, rh / 2.4), { col, hot: found, lines: [[s2.t, lc(LC.text, 1), false]], fs: Math.max(9.5, Math.min(11.5, cwid / 24)) }); });
}
function gvtDrawRole(L, g, P) {
  const role = gvRole(P.role), pad = 16, cw = (L.w - pad * 3) / 2;
  [['deployer', 'DEPLOYER · you use it'], ['provider', 'PROVIDER · you place it on the market']].forEach(([k, t], i) => { const x = pad + i * (cw + pad), on = role === k, col = on ? (k === 'provider' ? LC.bad : LC.good) : LC.mute, list = GV_DUTY[k], rh = Math.min(30, (L.h - 70) / list.length - 3);
    if (on) labGlow(g, x + cw / 2, L.h / 2, cw * 0.6, col, 0.12);
    labText(g, t + ' · ' + list.length + ' duties', x, 30, { size: 12, w: 700, col: lc(col, 1) });
    list.forEach(([art, d], j) => { const y = 44 + j * (rh + 3); g.fillStyle = lc(col, on ? 0.14 : 0.04); g.fillRect(x, y, cw, rh); g.strokeStyle = lc(col, on ? 0.6 : 0.2); g.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1);
      fiClip(g, x, y, cw, rh, () => { labText(g, art, x + 8, y + rh / 2 + 4, { size: 10.5, w: 700, col: lc(col, 1) }); labText(g, d, x + 86, y + rh / 2 + 4, { size: 11.5, mono: false, col: lc(LC.text, on ? 1 : 0.45) }); }); }); });
}

/* ====================== 3 · Fair by which definition? ====================== */
const GVF_VEC = [{ id: 'after', name: 'Metric picked after seeing results' }, { id: 'nobody', name: 'Nobody signed the trade-off' }, { id: 'unaware', name: 'Attribute removed, proxies kept' },
  { id: 'agg', name: 'Tested in aggregate only' }, { id: 'labels', name: 'Labels repeat past decisions' }, { id: 'drift', name: 'Fair at launch, not six months later' }];
const GVF_DEF = [
  { id: 'prereg', name: 'Choose the definition before testing', how: 'Written rationale, signed by the accountable owner', kills: ['after', 'nobody'] },
  { id: 'proxy', name: 'Proxy analysis; keep attributes for testing', how: 'Measure what features predict the group; test with the attribute', kills: ['unaware'] },
  { id: 'slices', name: 'Intersectional slices with minimum sizes', how: 'Every slice with n ≥ 50 must pass, with intervals', kills: ['agg'] },
  { id: 'label', name: 'Audit labels against outcomes', how: 'Where labels are past human decisions, re-check a sample', kills: ['labels'] },
  { id: 'monitor', name: 'Group metrics in production', how: 'Same fairness metrics on live decisions, with alerts', kills: ['drift'] }];
const GVF_GROUPS = [{ name: 'Choosing', col: 'ink', ids: ['after', 'nobody', 'unaware'], act: 'A fair-looking number nobody chose on purpose' },
  { name: 'Measuring', col: 'bad', ids: ['agg', 'labels', 'drift'], act: 'Passed on average, failed the people it hurt' }];
const gvT = v => 0.2 + 0.6 * v / 100;

function gvfMount(L) {
  const P = { t: 50, tA: 50, tB: 50, moved: 0, search: null, searchEq: null, drop: false, proxy: null, found: false, miss: null, on: {}, flash: {}, at: -9 };
  const one = () => gvFair(GV_PEOPLE, gvT(P.t), gvT(P.t)), two = () => gvFair(GV_PEOPLE, gvT(P.tA), gvT(P.tB));
  const slices = gvSlices(GV_PEOPLE, 0.5), worst = slices.slice().sort((a, b) => a.ratio - b.ratio)[0];
  return { P,
    hud: () => [
      [['THRESHOLD', () => gvT(P.t).toFixed(2)], ['DEFINITIONS MET', () => one().n + '/3', one().n === 3 ? 'good' : 'bad']],
      [['A / B', () => gvT(P.tA).toFixed(2) + ' / ' + gvT(P.tB).toFixed(2)], ['MET', () => two().n + '/3'], ['ALL THREE, ANYWHERE', () => P.search ? String(P.search.all3) + ' pairs' : '?', 'bad']],
      [['GROUP ATTRIBUTE', () => P.drop ? 'removed' : 'in data'], ['POSTCODE PREDICTS GROUP', () => P.proxy == null ? '?' : Math.round(P.proxy * 100) + '%', 'bad']],
      [['AGGREGATE RATIO', () => (Math.min(one().A.tpr, one().B.tpr) / Math.max(one().A.tpr, one().B.tpr)).toFixed(2)], ['WORST SLICE', () => P.found ? worst.t + ' ' + worst.ratio.toFixed(2) : '?', 'bad']],
      axDefHud(P, GVF_VEC, GVF_DEF), axDefHud(P, GVF_VEC, GVF_DEF)][L.step],
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, GVF_GROUPS, GVF_VEC, GVF_DEF) : [gvfDrawOne, gvfDrawTwo, gvfDrawProxy, gvfDrawSlices][L2.step](L2, g, P),
    steps: [
      { say: () => P.moved < 3 ? '1,200 applicants, one score, one threshold for everyone. Move it. Is the same rule for everyone fair?' : 'Same rule, unequal outcomes: group B is selected far less. Base rates differ, so one threshold cannot equalise everything.',
        side: L2 => [axRange(L2, P, 't', 'Threshold', () => P.moved >= 3, () => { if (P.t !== P.lastT) { if (P.lastT != null) P.moved++; P.lastT = P.t; } return gvT(P.t).toFixed(2); }, 100),
          h('p', { class: 'labsm' }, 'The three definitions are scored live on the right of the chart.')],
        acts: L2 => [labNext(L2, 'Two thresholds →', P.moved < 3)] },
      { say: () => !P.search ? 'Give each group its own threshold. Try to get all three definitions green at once.' : !P.searchEq ? 'Searched all 1,681 pairs: ' + P.search.all3 + ' satisfy all three. The best is ' + P.search.best + '. Now give both groups the same base rate.' : 'Same base rates: ' + P.searchEq.all3 + ' pairs satisfy all three. The conflict comes from the world, not the model. Someone has to choose.',
        side: L2 => [axRange(L2, P, 'tA', 'Group A threshold', () => !!P.searchEq, () => gvT(P.tA).toFixed(2), 100), axRange(L2, P, 'tB', 'Group B threshold', () => !!P.searchEq, () => gvT(P.tB).toFixed(2), 100),
          h('div', { class: 'labstack' }, labBtn((P.search ? '✓ ' : '▶ ') + 'Search every threshold pair', () => { P.search = gvSearch(GV_PEOPLE); P.at = L2.t; L2.repaint(); }),
            labBtn((P.searchEq ? '✓ ' : '▶ ') + 'Same base rate in both groups', () => { P.searchEq = gvSearch(GV_PEOPLE_EQ); P.at = L2.t; L2.repaint(); }, '', !P.search))],
        acts: L2 => [labNext(L2, 'Just remove the attribute? →', !P.searchEq)] },
      { say: () => !(P.drop && P.proxy != null) ? '“Our model doesn’t see the protected attribute.” Remove it, then check what else knows it.' : 'Removing it changed nothing, and postcode alone names the group ' + Math.round(P.proxy * 100) + '% of the time. You also lost the column you needed to measure fairness.',
        side: L2 => [h('div', { class: 'labstack' }, labBtn((P.drop ? '✓ ' : '▶ ') + 'Remove the group attribute', () => { P.drop = true; P.at = L2.t; L2.repaint(); }),
          labBtn((P.proxy != null ? '✓ ' : '▶ ') + 'Predict the group from postcode', () => { P.proxy = gvProxy(GV_PEOPLE); P.at = L2.t; L2.repaint(); }))],
        acts: L2 => [labNext(L2, 'Look closer →', !(P.drop && P.proxy != null))] },
      { say: () => !P.found ? 'In aggregate the true-positive rates pass the 4/5ths test. Split by group and age. Find who it fails.' : worst.t + ': ' + worst.ratio.toFixed(2) + ' of the best slice, ' + worst.nq + ' qualified people. The aggregate hid them.',
        side: L2 => [h('div', { class: 'labstack' }, slices.map(s2 => labBtn((P.found && s2.id === worst.id ? '✓ ' : '▶ ') + s2.t + ' · n=' + s2.n, () => { if (s2.id === worst.id) P.found = true; else P.miss = s2.id; P.at = L2.t; L2.repaint(); }))),
          P.miss && !P.found ? h('p', { class: 'labsm' }, 'That slice passes: ' + slices.find(x => x.id === P.miss).ratio.toFixed(2) + '.') : null],
        acts: L2 => [labNext(L2, 'Close the paths →', !P.found)] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(GVF_VEC, GVF_DEF, P.on).length; return n ? n + ' ways a fairness programme still fails. Switch on controls.' : 'All ' + GVF_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, GVF_DEF)],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => '“Is it fair?” has no answer. “Fair by which definition, chosen by whom?” does.',
        enter: () => labDone('gvfair'),
        side: () => axDebrief(P, GVF_VEC, GVF_DEF, [
          ['2016 · COMPAS', 'ProPublica showed unequal false-positive rates by race; the vendor showed equal predictive parity. Both were right: with different base rates you cannot have both.'],
          ['2018 · Amazon recruiting', 'A CV-ranking model learned from ten years of mostly male hires and penalised the word “women’s”. It was scrapped.'],
          ['Aug 2020 · UK A-level grades', 'An algorithm moderating teacher grades downgraded almost 40% of them, hitting students at larger state schools hardest. It was withdrawn within days.'],
          ['2019–21 · Apple Card', 'Complaints of lower limits for women. New York’s regulator found no unlawful discrimination, and criticised how poorly decisions were explained.']],
          [], 'Every rate on this page is counted from 1,200 generated applicants. The groups share one score model; only the base rates and one measurement bias differ.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv-gov' }, 'Governance →')] }
    ] };
}
/* The three definitions, scored live, drawn on the canvas so they follow the slider. */
function gvfDefs(g, r, x, y, w) {
  labText(g, 'DEFINITIONS', x, y, { size: 11, w: 700, col: lc(LC.blue, 1) });
  GV_FAIR.forEach(([k, t, , d], i) => { const yy = y + 14 + i * 50, ok = r.ok[k], col = ok ? LC.good : LC.bad;
    axRound(g, x, yy, w, 42, 8); g.fillStyle = lc(col, 0.1); g.fill(); g.strokeStyle = lc(col, 0.7); g.stroke();
    fiClip(g, x, yy, w, 42, () => { labText(g, (ok ? '✓ ' : '✗ ') + t, x + 10, yy + 17, { size: 11.5, mono: false, w: 700, col: lc(col, 1) }); labText(g, d(r.A, r.B), x + 10, yy + 33, { size: 11, col: lc(LC.text, 0.85) }); }); });
}
function gvfHist(L, g, people, t, x, y, w, hh, label) {
  const bins = 30, q = Array(bins).fill(0), nq = Array(bins).fill(0); people.forEach(p => { const b = Math.min(bins - 1, Math.floor(p.s * bins)); (p.q ? q : nq)[b]++; });
  const mx = Math.max(...q.map((v, i) => v + nq[i])), bw = w / bins;
  for (let i = 0; i < bins; i++) { const on = (i + 0.5) / bins >= t, hq = hh * q[i] / mx, hn = hh * nq[i] / mx;
    g.fillStyle = lc(LC.good, on ? 0.85 : 0.25); g.fillRect(x + i * bw + 1, y + hh - hq, bw - 2, hq); g.fillStyle = lc(LC.mute, on ? 0.8 : 0.22); g.fillRect(x + i * bw + 1, y + hh - hq - hn, bw - 2, hn); }
  const tx = x + w * t; g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 2; g.beginPath(); g.moveTo(tx, y - 6); g.lineTo(tx, y + hh + 4); g.stroke(); g.lineWidth = 1;
  const r = gvRates(people, t); labText(g, label + ' · base rate ' + Math.round(r.base * 100) + '% · selected ' + Math.round(r.sel * 100) + '% · TPR ' + Math.round(r.tpr * 100) + '% · precision ' + Math.round(r.ppv * 100) + '%', x, y - 12, { size: 11, w: 700, col: lc(LC.text, 0.9) });
}
function gvfDrawOne(L, g, P) {
  const pad = 30, hh = (L.h - 110) / 2, dw = Math.min(250, L.w * 0.3), hw = L.w - pad * 3 - dw;
  gvfHist(L, g, GV_PEOPLE.filter(p => p.g === 'A'), gvT(P.t), pad, 40, hw, hh, 'GROUP A');
  gvfHist(L, g, GV_PEOPLE.filter(p => p.g === 'B'), gvT(P.t), pad, 70 + hh, hw, hh, 'GROUP B');
  gvfDefs(g, gvFair(GV_PEOPLE, gvT(P.t), gvT(P.t)), L.w - pad - dw, 40, dw);
  labText(g, '■ qualified   ■ not qualified   | threshold: selected to the right', pad, L.h - 12, { size: 11, col: lc(LC.mute, 1) });
}
function gvfDrawTwo(L, g, P) {
  const map = P.searchEq || P.search, side = map ? Math.min(L.h - 70, L.w * 0.36) : Math.min(250, L.w * 0.3), pad = 24, hw = L.w - side - pad * 3, hh = (L.h - 110) / 2;
  gvfHist(L, g, GV_PEOPLE.filter(p => p.g === 'A'), gvT(P.tA), pad, 40, hw, hh, 'A');
  gvfHist(L, g, GV_PEOPLE.filter(p => p.g === 'B'), gvT(P.tB), pad, 70 + hh, hw, hh, 'B');
  if (!map) { gvfDefs(g, gvFair(GV_PEOPLE, gvT(P.tA), gvT(P.tB)), L.w - pad - Math.min(250, L.w * 0.3), 40, Math.min(250, L.w * 0.3)); return; }
  const x0 = L.w - side - pad, y0 = 40, c = side / map.N;
  labText(g, (P.searchEq ? 'SAME BASE RATES' : 'EVERY PAIR') + ' · DEFINITIONS MET', x0, y0 - 12, { size: 11, w: 700, col: lc(LC.blue, 1) });
  map.grid.forEach((n, k) => { const i = Math.floor(k / map.N), j = k % map.N; g.fillStyle = n === 3 ? lc(LC.good, 1) : n === 2 ? lc(LC.ink, 0.6) : n === 1 ? lc(LC.blue, 0.25) : 'rgba(141,182,242,.05)'; g.fillRect(x0 + i * c, y0 + side - (j + 1) * c, c - 0.5, c - 0.5); });
  g.strokeStyle = lc(LC.text, 1); g.strokeRect(x0 + (P.tA / 100) * (map.N - 1) * c - 1, y0 + side - ((P.tB / 100) * (map.N - 1) + 1) * c - 1, c + 2, c + 2);
  labText(g, 'A threshold →', x0 + side, y0 + side + 16, { size: 10, align: 'right' }); labText(g, '■ 3   ■ 2   ■ 1', x0, y0 + side + 16, { size: 10, col: lc(LC.mute, 1) });
}
function gvfDrawProxy(L, g, P) {
  const pad = 30, cols = 6, cw = (L.w - pad * 2) / cols, top = 50, bot = L.h - 40;
  labText(g, 'APPLICANTS BY POSTCODE BAND' + (P.drop ? ' · GROUP COLUMN REMOVED FROM THE DATA' : ''), pad, 28, { size: 12, w: 700, col: lc(P.drop ? LC.bad : LC.blue, 1) });
  for (let z = 1; z <= 6; z++) { const ps = GV_PEOPLE.filter(p => p.zip === z), x = pad + (z - 1) * cw, per = Math.floor((cw - 10) / 7), r = 2.6;
    labText(g, 'Band ' + z, x + cw / 2, bot + 18, { size: 11, align: 'center', col: lc(LC.mute, 1) });
    ps.forEach((p, k) => { const px = x + 6 + (k % per) * 7, py = bot - 6 - Math.floor(k / per) * 7; if (py < top) return; g.fillStyle = P.proxy != null || !P.drop ? lc(p.g === 'A' ? LC.blue : LC.ink, 0.85) : lc(LC.mute, 0.6); g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); }); }
  if (P.proxy != null) axStamp(g, L.w / 2, top + 30, 'POSTCODE → GROUP: ' + Math.round(P.proxy * 100) + '%', LC.bad, L.t - P.at, L.w > 720 ? 18 : 12);
  labText(g, '● group A   ● group B' + (P.drop && P.proxy == null ? '   (hidden: the column is gone)' : ''), pad, L.h - 4, { size: 10, col: lc(LC.mute, 1) });
}
function gvfDrawSlices(L, g, P) {
  const sl = gvSlices(GV_PEOPLE, 0.5), one = gvFair(GV_PEOPLE, 0.5, 0.5), agg = Math.min(one.A.tpr, one.B.tpr) / Math.max(one.A.tpr, one.B.tpr), rows = [{ t: 'Aggregate: A vs B', ratio: agg, n: GV_PEOPLE.length, id: 'agg' }].concat(P.found ? sl : sl.map(s2 => Object.assign({}, s2, { hide: true })));
  const pad = 24, x0 = 220, w = L.w - x0 - pad, rh = Math.min(54, (L.h - 80) / rows.length - 8), X = v => x0 + w * v;
  labText(g, 'TRUE-POSITIVE RATE AS A SHARE OF THE BEST SLICE · THRESHOLD 0.50', pad, 28, { size: 12, w: 700, col: lc(LC.blue, 1) });
  rows.forEach((r, i) => { const y = 50 + i * (rh + 8), show = !r.hide || P.miss === r.id, bad = r.ratio < 0.8, col = show ? (bad ? LC.bad : LC.good) : LC.mute;
    labText(g, r.t, pad, y + rh / 2 + 4, { size: 12, mono: false, w: 600, col: lc(LC.text, 0.9) }); labText(g, 'n=' + r.n, pad, y + rh / 2 + 18, { size: 10, col: lc(LC.mute, 1) });
    gvBar(g, x0, y + rh / 2 - 8, w, 16, show ? r.ratio : 0, col); if (show) labText(g, r.ratio.toFixed(2), X(r.ratio) - 6, y + rh / 2 + 4, { size: 11, w: 700, align: 'right', col: '#0B1226' }); });
  g.setLineDash([5, 4]); g.strokeStyle = lc(LC.ink, 0.9); g.beginPath(); g.moveTo(X(0.8), 40); g.lineTo(X(0.8), L.h - 20); g.stroke(); g.setLineDash([]); labText(g, '0.8 (4/5ths)', X(0.8), L.h - 6, { size: 10, align: 'center', col: lc(LC.ink, 1) });
}

/* ---------- registration ---------- */
const GV_SIMS = [
  { id: 'gvx', track: 'gov', title: 'One control, five rulebooks', kicker: 'NIST AI RMF · ISO 42001 · ISO 23894 · EU AI Act · OECD · assurance', blurb: 'Tick the evidence you already hold and watch five frameworks fill, sort them through five lenses to see where they really differ, then test six kinds of assurance against one claim.', mount: gvxMount,
    brief: { what: 'Five rulebooks govern AI, and they are different kinds of thing: a law, a certifiable management system, a risk-process guide, a voluntary framework and a set of principles. They ask for much the same evidence and answer different questions.',
      real: 'Organisations certified to ISO/IEC 42001 still have to meet the EU AI Act system by system, and US buyers ask for NIST AI RMF alignment. Teams that run three separate programmes pay three times for the same evidence.',
      todo: ['Tick your evidence and see each framework’s coverage', 'Sort the frameworks by five questions to see where they differ', 'Test six assurance models against one claim'] },
    guide: [
      { look: [['blue', '▦', 'A column per framework; a cell per piece of evidence it asks for.'], ['good', '✓', 'Lit: you have it, with the clause that asks for it.']], why: 'The overlap is large. Build one evidence base and map it out, instead of one programme per framework.' },
      { look: [['ink', '●', 'Each framework placed on the axis of the lens you chose.']], why: 'Only the AI Act is law. Only 42001 is certifiable. The NIST RMF and 23894 shape how you work; OECD shapes what governments expect.' },
      { look: [['good', '▬', 'Bars: how independent, how specific to this system, how much is tested.'], ['bad', '■', 'Red: does not support the claim.']], why: 'Assurance is only as good as its fit to the claim. A certificate about the organisation cannot vouch for one model’s fairness.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Crosswalks fail quietly: they map paper, drift out of date and leave the vendor’s AI outside the scope.' },
      { why: 'Ask of any AI assurance: who checked, what exactly, and against which version of which text.' }] },
  { id: 'gvtier', track: 'gov', title: 'Same model, four tiers', kicker: 'EU AI Act · risk classification · roles', blurb: 'Deploy one model seven ways and watch it land in four tiers, build your own use case until an exemption flips, find where internal and legal tiers disagree, then customise a product until you become its provider.', mount: gvtMount,
    brief: { what: 'Risk classification decides what a system must do. The EU AI Act classifies the use, not the model, and your own tiering classifies the harm. They disagree more often than teams expect.',
      real: 'Since Feb 2025 some uses are banned outright in the EU. A deployer who rebrands or substantially modifies a high-risk system takes on the provider’s duties (Art 25), often without noticing.',
      todo: ['Place seven uses of one model into tiers', 'Build a use case and find the exemption that flips', 'Compare internal and legal tiers, then change your role'] },
    guide: [
      { look: [['good', '■', 'Minimal'], ['blue', '■', 'Transparency duties'], ['ink', '■', 'High-risk'], ['bad', '■', 'Prohibited']], why: 'The tier belongs to the deployment. The same weights can be banned in one use and unregulated in another.' },
      { look: [['text', '↗', 'The needle: the tier your settings produce, with the articles that decided it.']], why: 'Annex III uses are high-risk unless the system only does a narrow task, and that exemption disappears if it profiles people.' },
      { look: [['bad', '▭', 'Red cells: the two tiers disagree.']], why: 'The legal tier sets your obligations; the internal tier sets the controls the harm needs. A payments agent can be legally minimal and operationally your riskiest system.' },
      { look: [['good', '▤', 'Deployer duties.'], ['bad', '▤', 'Provider duties.']], why: 'Rebrand it, modify it substantially, or point it at a high-risk purpose, and the provider’s full list becomes yours.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Classification is not a gate you pass once. Uses, vendors and roles change underneath it.' },
      { why: 'For each AI system, ask for two tiers, the role you hold, and the date it was last re-classified.' }] },
  { id: 'gvfair', track: 'gov', title: 'Fair by which definition?', kicker: 'Fairness · bias management · the impossibility', blurb: 'Move a threshold over 1,200 applicants and watch three fairness definitions disagree, search every threshold pair to prove they cannot all hold, remove the protected attribute and find it in the postcode, then find the slice the average hid.', mount: gvfMount,
    brief: { what: 'Fairness has several precise definitions: equal selection, equal opportunity, equal precision. When groups have different base rates, mathematics says you cannot satisfy them all at once. Choosing between them is a governance decision.',
      real: 'The COMPAS debate (2016) was this exact conflict: both sides were right about different definitions. Regulators use the four-fifths rule for selection; courts and auditors ask who chose the metric and why.',
      todo: ['Move one threshold and read the three definitions', 'Search every pair of thresholds, then equalise base rates', 'Remove the attribute, find the proxy, find the slice'] },
    guide: [
      { look: [['good', '▮', 'Qualified applicants by score.'], ['mute', '▮', 'Not qualified.'], ['ink', '|', 'The threshold.']], why: 'The model treats everyone alike. The groups differ in base rate, so the same rule gives different outcomes.' },
      { look: [['good', '■', 'Map: threshold pairs where all three definitions hold.'], ['text', '□', 'Your current pair.']], why: 'With unequal base rates there is no green cell. Equalise them and green appears. The trade-off is real and someone must own it.' },
      { look: [['blue', '●', 'Group A'], ['ink', '●', 'Group B'], ['mute', '', 'Columns: postcode band.']], why: '“We don’t use the attribute” is not a control. Proxies carry it, and without it you cannot test.' },
      { look: [['bad', '▬', 'Below the 0.8 line: fails the four-fifths test.']], why: 'A measurement bias in one small slice disappears in the average. Test the slices, with minimum sizes.' },
      { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']], why: 'Bias management is a lifecycle: choose, measure, monitor and sign.' },
      { why: 'Ask which fairness definition was chosen, before testing, by whom, and how it is monitored by slice.' }] }];
GV_SIMS.forEach(x => { NN_SIMS.push(x); NN_BY[x.id] = x; });
