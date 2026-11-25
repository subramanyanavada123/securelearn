'use strict';
/* Governance & Responsible AI: the data and the engines behind the six
   governance instruments (gov1.js, gov2.js) and the Governance hub on the
   Advanced page. Everything here is a pure function or a table, so the
   smoke test can check the arithmetic. Clause and article references are
   for orientation: check the current text before quoting them. */

/* ---------- 1 · frameworks and the crosswalk ---------- */
const GV_FW = [
  { id: 'nist', short: 'NIST AI RMF', name: 'NIST AI Risk Management Framework 1.0', when: 'Jan 2023 · GenAI profile (AI 600-1) Jul 2024',
    kind: 'Voluntary framework', binding: 'Voluntary', cert: 'No certificate', unit: 'Organisation and each AI system', checks: 'You, your customers', shape: '4 functions: Govern, Map, Measure, Manage', bind: 1, certN: 0 },
  { id: 'iso42', short: 'ISO/IEC 42001', name: 'ISO/IEC 42001:2023 AI management system', when: 'Dec 2023',
    kind: 'Management-system standard', binding: 'Voluntary, often contractual', cert: 'Certifiable (the management system)', unit: 'The organisation’s AI management system', checks: 'Accredited certification body', shape: 'Clauses 4–10 + 38 Annex A controls', bind: 2, certN: 2 },
  { id: 'iso23', short: 'ISO/IEC 23894', name: 'ISO/IEC 23894:2023 AI risk management guidance', when: 'Feb 2023',
    kind: 'Risk-process guidance', binding: 'Voluntary', cert: 'No certificate', unit: 'The risk process', checks: 'Nobody by default', shape: 'ISO 31000 process, adapted to AI', bind: 0, certN: 0 },
  { id: 'euai', short: 'EU AI Act', name: 'Regulation (EU) 2024/1689, the AI Act', when: 'In force Aug 2024 · phased 2025–27',
    kind: 'Law', binding: 'Binding, with fines', cert: 'Conformity assessment (the product)', unit: 'Each AI system or GPAI model, by your role', checks: 'Market surveillance, notified bodies, AI Office', shape: 'Risk tiers × roles (provider, deployer…)', bind: 4, certN: 1 },
  { id: 'oecd', short: 'OECD', name: 'OECD AI Principles', when: '2019 · updated May 2024',
    kind: 'Intergovernmental principles', binding: 'Political commitment', cert: 'No certificate', unit: 'Values and national policy', checks: 'Nobody', shape: '5 principles + 5 recommendations', bind: 0.5, certN: 0 }
];
const GV_FW_BY = Object.fromEntries(GV_FW.map(f => [f.id, f]));
/* What each framework asks for, per piece of evidence. '' = not asked for explicitly. */
const GV_EV = [
  { id: 'inv', t: 'AI system inventory', m: { nist: 'GOVERN 1.6', iso42: 'Cl. 4.3 scope', iso23: '6.3 scope & context', euai: 'Art 49 registration', oecd: '' } },
  { id: 'policy', t: 'AI policy', m: { nist: 'GOVERN 1.2', iso42: 'Cl. 5.2 · A.2', iso23: '5.2 leadership', euai: 'Art 17 QMS (providers)', oecd: 'Accountability' } },
  { id: 'roles', t: 'Named owners and roles', m: { nist: 'GOVERN 2', iso42: 'Cl. 5.3 · A.3', iso23: '5.4 framework design', euai: 'Art 26(2) oversight persons', oecd: 'Accountability' } },
  { id: 'risk', t: 'AI risk assessment', m: { nist: 'MAP · MEASURE', iso42: 'Cl. 6.1.2 · 8.2', iso23: '6.4 risk assessment', euai: 'Art 9 risk management', oecd: 'Robustness & safety' } },
  { id: 'impact', t: 'Impact assessment (people affected)', m: { nist: 'MAP 5.1', iso42: 'Cl. 6.1.4 · A.5', iso23: '', euai: 'Art 27 FRIA (some deployers)', oecd: 'Human rights & fairness' } },
  { id: 'data', t: 'Data provenance and quality records', m: { nist: 'MAP · MEASURE', iso42: 'A.7 data', iso23: '', euai: 'Art 10 data governance', oecd: 'Traceability' } },
  { id: 'bias', t: 'Bias and fairness test report', m: { nist: 'MEASURE 2.11', iso42: 'A.7.4 · Annex C', iso23: 'Annex A/B', euai: 'Art 10(2)(f–g)', oecd: 'Human rights & fairness' } },
  { id: 'oversight', t: 'Human oversight procedure', m: { nist: 'MAP 3.5', iso42: 'A.9 use of AI', iso23: '', euai: 'Art 14 · Art 26', oecd: 'Human agency & oversight' } },
  { id: 'transp', t: 'Transparency notice, instructions for use', m: { nist: 'MEASURE 2.8', iso42: 'A.8 information', iso23: '', euai: 'Art 13 · Art 50', oecd: 'Transparency' } },
  { id: 'logs', t: 'Decision and event logs', m: { nist: 'MANAGE 4', iso42: 'A.6.2.8 event logs', iso23: '', euai: 'Art 12 · Art 26(6)', oecd: 'Traceability' } },
  { id: 'supplier', t: 'Supplier due diligence', m: { nist: 'GOVERN 6', iso42: 'A.10 third parties', iso23: '', euai: 'Art 25 value chain', oecd: 'Accountability' } },
  { id: 'monitor', t: 'Post-deployment monitoring', m: { nist: 'MANAGE 4.1', iso42: 'Cl. 9.1 · A.6.2.6', iso23: '6.6 monitor & review', euai: 'Art 72 post-market', oecd: 'Robustness & safety' } },
  { id: 'incident', t: 'Incident log and reporting', m: { nist: 'MANAGE 4.3', iso42: 'Cl. 10.2 · A.8.4', iso23: '6.6 monitor & review', euai: 'Art 73 serious incidents', oecd: 'Accountability' } },
  { id: 'review', t: 'Management review minutes', m: { nist: 'GOVERN 1.5', iso42: 'Cl. 9.3', iso23: '6.6 monitor & review', euai: '', oecd: '' } },
  { id: 'literacy', t: 'AI literacy and training records', m: { nist: 'GOVERN 2.2', iso42: 'Cl. 7.2 competence', iso23: '', euai: 'Art 4 AI literacy', oecd: 'Policy recommendation' } }
];
function gvCover(have) {
  return Object.fromEntries(GV_FW.map(f => { const asked = GV_EV.filter(e => e.m[f.id]); const got = asked.filter(e => have[e.id]);
    return [f.id, { asked: asked.length, got: got.length, frac: asked.length ? got.length / asked.length : 0 }]; }));
}
const GV_LENS = [
  ['binding', 'Is it law?', f => f.binding, f => f.bind / 4],
  ['cert', 'Can you be certified?', f => f.cert, f => f.certN / 2],
  ['unit', 'What does it govern?', f => f.unit, f => ({ nist: 0.6, iso42: 0.85, iso23: 0.4, euai: 0.15, oecd: 1 })[f.id]],
  ['checks', 'Who checks you?', f => f.checks, f => ({ nist: 0.2, iso42: 0.7, iso23: 0, euai: 1, oecd: 0 })[f.id]],
  ['shape', 'How is it built?', f => f.shape, f => ({ nist: 0.5, iso42: 0.7, iso23: 0.3, euai: 0.9, oecd: 0.1 })[f.id]]];
const GV_LENS_AXIS = { binding: ['voluntary', 'binding law'], cert: ['nothing to certify', 'third-party certificate'], unit: ['one system', 'values and policy'], checks: ['nobody', 'a regulator'], shape: ['principles', 'rules per tier and role'] };
/* Assurance models against one claim. scores: [independence, fits the claim (this system), depth (tested outcomes)] 0..1 */
const GV_ASSURE = [
  { id: 'self', t: 'Self-assessment', who: 'The team that built it', sc: [0, 0.9, 0.3], says: 'We checked and it is fine.' },
  { id: 'l2', t: 'Second-line review', who: 'Risk and compliance', sc: [0.4, 0.8, 0.4], says: 'The process was followed.' },
  { id: 'ia', t: 'Internal audit', who: 'Third line, reports to the audit committee', sc: [0.65, 0.6, 0.5], says: 'Controls are designed and operating, on a sample.' },
  { id: 'ind', t: 'Independent assurance', who: 'External auditor, against stated criteria', sc: [0.9, 0.85, 0.8], says: 'This system meets these criteria, tested.' },
  { id: 'cert', t: 'ISO/IEC 42001 certificate', who: 'Accredited certification body', sc: [0.9, 0.2, 0.45], says: 'The organisation runs an AI management system.' },
  { id: 'ca', t: 'EU AI Act conformity assessment', who: 'Usually the provider itself (internal control); a notified body for some biometrics', sc: [0.35, 0.9, 0.6], says: 'This high-risk system meets the Act’s requirements.' }];
const GV_CLAIM = 'Our CV-screening model is fair and lawful.';
const gvAssureFit = a => a.sc[0] * 0.3 + a.sc[1] * 0.4 + a.sc[2] * 0.3;

/* ---------- 2 · risk classification (EU AI Act, simplified) ---------- */
const GV_ANNEX = [['none', 'None of these'], ['employment', 'Employment and workers'], ['credit', 'Creditworthiness of people'], ['education', 'Education and exams'], ['essential', 'Essential public services and benefits'], ['law', 'Law enforcement'], ['biometric', 'Biometric categorisation']];
const GV_FLAGS = [
  ['social', 'Scores people’s social behaviour to treat them worse elsewhere', 'Art 5(1)(c)', 'ban'],
  ['emowork', 'Infers emotions at work or in school', 'Art 5(1)(f)', 'ban'],
  ['scrape', 'Builds a face database by untargeted scraping', 'Art 5(1)(e)', 'ban'],
  ['manip', 'Manipulates or exploits vulnerabilities, causing significant harm', 'Art 5(1)(a–b)', 'ban'],
  ['safety', 'Is a safety component of a regulated product (Annex I)', 'Art 6(1)', 'high'],
  ['narrow', 'Only does a narrow procedural or preparatory task', 'Art 6(3)', 'derog'],
  ['profiling', 'Profiles natural persons', 'Art 6(3), last para', 'prof'],
  ['fraud', 'Its only purpose is detecting financial fraud', 'Annex III 5(b)', 'fraud'],
  ['chat', 'Talks to people directly', 'Art 50(1)', 'lim'],
  ['synth', 'Generates images, audio, video or text people will see', 'Art 50(2), 50(4)', 'lim']];
const GV_TIERS = ['minimal', 'limited', 'high', 'prohibited'];
const GV_TIER_NAME = { minimal: 'Minimal risk', limited: 'Transparency duties', high: 'High-risk', prohibited: 'Prohibited' };
function gvClassify(u) {
  const why = [];
  for (const [k, , art, kind] of GV_FLAGS) if (kind === 'ban' && u[k]) why.push(art);
  if (why.length) return { tier: 'prohibited', why };
  const annex = u.annex && u.annex !== 'none' && !(u.annex === 'credit' && u.fraud);
  if (u.safety) return { tier: 'high', why: ['Art 6(1) · Annex I'] };
  if (annex) {
    if (u.narrow && !u.profiling) return { tier: u.chat || u.synth ? 'limited' : 'minimal', why: ['Annex III, but Art 6(3) exemption: narrow task, no profiling'], derog: true };
    return { tier: 'high', why: ['Art 6(2) · Annex III ' + GV_ANNEX.find(a => a[0] === u.annex)[1].toLowerCase()].concat(u.narrow && u.profiling ? ['Art 6(3) exemption void: it profiles people'] : []) };
  }
  if (u.annex === 'credit' && u.fraud) why.push('Annex III 5(b) excludes fraud detection');
  if (u.chat || u.synth) return { tier: 'limited', why: why.concat(['Art 50 transparency']) };
  return { tier: 'minimal', why: why.length ? why : ['No listed use'] };
}
/* One model, seven deployments. */
const GV_USES = [
  { id: 'faq', t: 'Answers customer FAQs on the website', u: { chat: true } },
  { id: 'rank', t: 'Ranks job applicants for recruiters', u: { annex: 'employment', profiling: true } },
  { id: 'cvcheck', t: 'Checks a CV has all its sections before a human reads it', u: { annex: 'employment', narrow: true } },
  { id: 'mood', t: 'Scores staff stress and engagement from video calls', u: { emowork: true } },
  { id: 'summ', t: 'Summarises internal policy documents', u: {} },
  { id: 'credit', t: 'Scores loan applicants’ creditworthiness', u: { annex: 'credit', profiling: true } },
  { id: 'fraud', t: 'Flags fraudulent loan applications', u: { annex: 'credit', fraud: true, profiling: true } }];
/* Internal tier = impact × reach of action. Six systems, legal tier fixed. */
const GV_TWIN = [
  { id: 'pay', t: 'Agent that pays supplier invoices', legal: 'minimal', impact: 5, act: 5 },
  { id: 'cv', t: 'Small CV ranker, 30 hires a year', legal: 'high', impact: 2, act: 1 },
  { id: 'chat', t: 'HR policy chatbot', legal: 'limited', impact: 2, act: 1 },
  { id: 'loan', t: 'Retail credit scoring', legal: 'high', impact: 5, act: 4 },
  { id: 'code', t: 'Coding agent with production deploy rights', legal: 'minimal', impact: 4, act: 5 },
  { id: 'sum', t: 'Meeting summariser', legal: 'minimal', impact: 1, act: 1 }];
const gvInternal = s => { const v = s.impact * s.act; return v >= 15 ? 'high' : v >= 6 ? 'medium' : 'low'; };
const gvMismatch = s => (gvInternal(s) === 'high') !== (s.legal === 'high');
/* Roles. Art 25: a deployer becomes a provider when any of these is true. */
const GV_ROLE_FLAGS = [['brand', 'You put your name or trademark on it', 'Art 25(1)(a)'], ['modify', 'You made a substantial modification', 'Art 25(1)(b)'], ['purpose', 'You changed its purpose to a high-risk one', 'Art 25(1)(c)']];
const GV_DUTY = {
  provider: [['Art 9', 'Risk management system'], ['Art 10', 'Data governance'], ['Art 11', 'Technical documentation'], ['Art 12', 'Automatic logging'], ['Art 13', 'Instructions for use'], ['Art 14', 'Design for human oversight'],
    ['Art 15', 'Accuracy, robustness, cybersecurity'], ['Art 17', 'Quality management system'], ['Art 43', 'Conformity assessment'], ['Art 47–48', 'Declaration and CE marking'], ['Art 49', 'EU database registration'], ['Art 72', 'Post-market monitoring'], ['Art 73', 'Serious-incident reporting']],
  deployer: [['Art 26(1)', 'Use it as instructed'], ['Art 26(2)', 'Assign competent oversight people'], ['Art 26(4)', 'Relevant input data'], ['Art 26(5)', 'Monitor and report problems'], ['Art 26(6)', 'Keep logs ≥ 6 months'],
    ['Art 26(7)', 'Inform workers’ representatives'], ['Art 26(11)', 'Inform people it is used on them'], ['Art 27', 'Fundamental-rights impact assessment (some deployers)'], ['Art 86', 'Explain individual decisions on request']] };
const gvRole = r => GV_ROLE_FLAGS.some(([k]) => r[k]) ? 'provider' : 'deployer';

/* ---------- 3 · fairness ---------- */
/* Two groups, the same score model, different base rates. Scores ~ N(0.62, 0.14) if qualified, N(0.40, 0.14) if not. */
function gvGauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function gvPeople(equal) {
  const r = nnRng(equal ? 77 : 31), out = [];
  [['A', 0.55], ['B', equal ? 0.55 : 0.25]].forEach(([g, base]) => {
    for (let i = 0; i < 600; i++) {
      const q = r() < base, older = r() < 0.3, shift = g === 'B' && older && !equal ? -0.09 : 0;  // measurement bias in one slice
      const zip = (g === 'A') !== (r() < 0.12) ? 1 + Math.floor(r() * 3) : 4 + Math.floor(r() * 3);
      out.push({ g, q, older, zip, s: Math.max(0, Math.min(1, (q ? 0.62 : 0.40) + shift + 0.14 * gvGauss(r))) });
    }
  });
  return out;
}
const GV_PEOPLE = gvPeople(false), GV_PEOPLE_EQ = gvPeople(true);
function gvRates(people, t) {
  const sel = people.filter(p => p.s >= t), q = people.filter(p => p.q), nq = people.filter(p => !p.q);
  return { n: people.length, sel: sel.length / people.length, tpr: q.length ? q.filter(p => p.s >= t).length / q.length : 0, fpr: nq.length ? nq.filter(p => p.s >= t).length / nq.length : 0, ppv: sel.length ? sel.filter(p => p.q).length / sel.length : 0, base: q.length / people.length };
}
/* Three definitions, each a pass/fail on the gap between groups. */
const GV_FAIR = [
  ['dp', 'Equal selection (4/5ths)', (a, b) => Math.min(a.sel, b.sel) / (Math.max(a.sel, b.sel) || 1) >= 0.8, (a, b) => 'ratio ' + (Math.min(a.sel, b.sel) / (Math.max(a.sel, b.sel) || 1)).toFixed(2)],
  ['eo', 'Equal opportunity (TPR)', (a, b) => Math.abs(a.tpr - b.tpr) <= 0.04, (a, b) => 'gap ' + Math.round(Math.abs(a.tpr - b.tpr) * 100) + ' pts'],
  ['pp', 'Predictive parity (precision)', (a, b) => Math.abs(a.ppv - b.ppv) <= 0.04, (a, b) => 'gap ' + Math.round(Math.abs(a.ppv - b.ppv) * 100) + ' pts']];
function gvFair(people, tA, tB) {
  const A = gvRates(people.filter(p => p.g === 'A'), tA), B = gvRates(people.filter(p => p.g === 'B'), tB);
  const ok = Object.fromEntries(GV_FAIR.map(([k, , f]) => [k, f(A, B)]));
  return { A, B, ok, n: Object.values(ok).filter(Boolean).length };
}
/* Every threshold pair on a 41×41 grid: how many definitions hold at once. */
function gvSearch(people) {
  const N = 41, grid = []; let best = 0, all3 = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const r = gvFair(people, 0.2 + 0.6 * i / (N - 1), 0.2 + 0.6 * j / (N - 1)); grid.push(r.n); if (r.n > best) best = r.n; if (r.n === 3) all3++; }
  return { N, grid, best, all3 };
}
/* Unawareness: how well does postcode alone predict the group? (best single cut) */
function gvProxy(people) { let best = 0; for (let c = 1; c <= 6; c++) { const acc = people.filter(p => (p.zip <= c) === (p.g === 'A')).length / people.length; best = Math.max(best, acc); } return best; }
/* Intersectional slices at one shared threshold. */
function gvSlices(people, t) {
  const sl = [['A', false], ['A', true], ['B', false], ['B', true]].map(([g, o]) => { const ps = people.filter(p => p.g === g && p.older === o), q = ps.filter(p => p.q);
    return { id: g + (o ? '50' : ''), t: 'Group ' + g + (o ? ', over 50' : ', under 50'), n: ps.length, tpr: q.filter(p => p.s >= t).length / (q.length || 1), nq: q.length }; });
  const top = Math.max(...sl.map(s => s.tpr)); sl.forEach(s => { s.ratio = s.tpr / (top || 1); });
  return sl;
}

/* ---------- 4 · explain, disclose, reconstruct ---------- */
const GV_FEAT = [
  { id: 'inc', t: 'Income', unit: 'k€', lo: 20, hi: 100, mean: 55, w: 0.03, act: true },
  { id: 'debt', t: 'Debt-to-income', unit: '%', lo: 5, hi: 60, mean: 30, w: -0.05, act: true },
  { id: 'miss', t: 'Missed payments', unit: '', lo: 0, hi: 6, mean: 1, w: -0.45, act: false },
  { id: 'tenure', t: 'Years at address', unit: 'y', lo: 0, hi: 15, mean: 6, w: 0.06, act: true },
  { id: 'emp', t: 'Years employed', unit: 'y', lo: 0, hi: 20, mean: 7, w: 0.05, act: true },
  { id: 'zip', t: 'Postcode band', unit: '', lo: 1, hi: 5, mean: 3, w: -0.5, act: false, proxy: true }];
const GV_APPLICANT = { inc: 48, debt: 41, miss: 1, tenure: 2, emp: 3, zip: 5 };
/* Linear model: each contribution is exact (w × distance from the average applicant). */
function gvContrib(x) { const c = GV_FEAT.map(f => ({ id: f.id, t: f.t, v: f.w * (x[f.id] - f.mean) })); return { c, score: c.reduce((s, k) => s + k.v, 0) }; }
const gvApproved = x => gvContrib(x).score >= 0;
/* The presented explanation: a surrogate that leaves postcode out and gives its weight to “years at address”. */
function gvPresented(x) { const c = gvContrib(x).c.filter(k => k.id !== 'zip').map(k => Object.assign({}, k)); const z = gvContrib(x).c.find(k => k.id === 'zip').v; c.find(k => k.id === 'tenure').v += z; return c; }
const gvTop = c => c.slice().sort((a, b) => a.v - b.v)[0].id;
function gvFidelity() {
  const r = nnRng(8); let same = 0, n = 0, zipTop = 0;
  for (let i = 0; i < 300; i++) { const x = Object.fromEntries(GV_FEAT.map(f => [f.id, Math.round(f.lo + (f.hi - f.lo) * r())])); if (gvApproved(x)) continue; n++;
    const t = gvTop(gvContrib(x).c); if (t === 'zip') zipTop++; if (gvTop(gvPresented(x)) === t) same++; }
  return { n, same, agree: same / n, zipTop };
}
/* Smallest actionable change that flips the decision: one feature at a time, then the cheapest pair. */
function gvCounterfactual(x) {
  const cost = (f, v) => Math.abs(v - x[f.id]) / (f.hi - f.lo), acts = GV_FEAT.filter(f => f.act), opts = [];
  for (const f of acts) for (let v = f.lo; v <= f.hi; v++) { const y = Object.assign({}, x, { [f.id]: v }); if (gvApproved(y)) opts.push({ ch: [[f.id, v]], cost: cost(f, v) }); }
  for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) { const f = acts[i], g = acts[j];
    for (let a = f.lo; a <= f.hi; a += 1) for (let b = g.lo; b <= g.hi; b += 1) { const y = Object.assign({}, x, { [f.id]: a, [g.id]: b }); if (gvApproved(y)) opts.push({ ch: [[f.id, a], [g.id, b]], cost: cost(f, a) + cost(g, b) }); } }
  return opts.sort((a, b) => a.cost - b.cost)[0] || null;
}
/* Sort statements: which of the three is this? */
const GV_TEA = [
  ['You are chatting with an AI assistant.', 'tr'], ['Declined mainly because your debt is 41% of income.', 'ex'], ['Model v3.2, threshold 0.00, these inputs, 3 March 10:14.', 'au'],
  ['Trained on our 2019–2024 loan book; not tested on business loans.', 'tr'], ['Lowering your debt ratio to 27% would change the outcome.', 'ex'], ['That record cannot have been edited since it was written.', 'au'],
  ['This image was generated by AI.', 'tr'], ['Each factor’s contribution to your score.', 'ex'], ['Decision logs are kept for six months.', 'au']];
const GV_TEA_NAME = { tr: 'Transparency', ex: 'Explainability', au: 'Auditability' };
/* The decision log: real SHA-256, each row chained to the previous hash. */
const GV_LOGF = [['inputs', 'Inputs'], ['ver', 'Model version'], ['thr', 'Threshold'], ['why', 'Explanation'], ['who', 'Reviewer']];
const GV_LOGROWS = [['D-101', 'approve'], ['D-102', 'decline'], ['D-103', 'decline'], ['D-104', 'approve'], ['D-105', 'decline'], ['D-106', 'approve']];
function gvChain(rows) { let prev = '0'.repeat(64); return rows.map(r => { const hsh = axSha256(axBytes(prev + '|' + r.id + '|' + r.out)); const o = Object.assign({}, r, { prev, hash: hsh }); prev = hsh; return o; }); }
function gvVerify(chain) { let prev = '0'.repeat(64); for (let i = 0; i < chain.length; i++) { const r = chain[i]; if (r.prev !== prev || axSha256(axBytes(prev + '|' + r.id + '|' + r.out)) !== r.hash) return i; prev = r.hash; } return -1; }
const gvReplayable = logged => !!(logged.inputs && logged.ver && logged.thr);

/* ---------- 5 · human oversight ---------- */
/* Claims with an AI recommendation. A few are wrong, and each wrong one has a tell in the data. */
const GV_CLAIMS = (() => { const r = nnRng(51), names = ['Sharma', 'Okafor', 'Lindqvist', 'Moreau', 'Nakamura', 'Costa', 'Haddad', 'Novak', 'Reyes', 'Kowalski', 'Mensah', 'Fischer', 'Ahmed', 'Ivanova', 'Dubois', 'Tanaka', 'Silva', 'Murphy', 'Rossi', 'Chen'];
  const tells = ['Invoice date is after the claim date', 'Bank account changed 2 days ago', 'Same photo as claim #4410', 'Policy lapsed last month'];
  return names.map((nm, i) => { const wrong = [2, 7, 11, 15, 18].includes(i), amt = Math.round(400 + r() * 9600);
    return { id: 'C-' + (4401 + i), nm, amt, ai: wrong ? 'approve' : r() < 0.75 ? 'approve' : 'deny', conf: wrong ? 0.86 + r() * 0.1 : 0.7 + r() * 0.28, wrong, tell: wrong ? tells[[2, 7, 11, 15, 18].indexOf(i) % tells.length] : null,
      facts: ['Claim €' + amt.toLocaleString('en'), 'Customer for ' + (1 + Math.floor(r() * 12)) + ' years', 'Docs: ' + (wrong ? 'attached' : 'complete')] }; }); })();
/* Expected chance a reviewer catches a wrong AI answer, given seconds per case (illustrative curve). */
const gvCatch = (sec, blind) => Math.max(0, 1 - Math.exp(-sec / (blind ? 14 : 30)));
const gvSecs = perDay => 7 * 3600 / perDay;
const GV_RACI = [['reviewer', 'The reviewer who clicked approve'], ['ds', 'The data-science team that built the model'], ['owner', 'The business owner of the claims process'], ['vendor', 'The model vendor'], ['board', 'The AI governance committee']];
const GV_RACI_WHY = {
  reviewer: 'Responsible for the check, but they had 6 seconds, no authority to slow the queue, and a default that approved. Blaming them fixes nothing.',
  ds: 'Responsible for the model’s quality and for telling the owner its error rate. Not accountable for how the business uses it.',
  owner: 'Accountable. They chose to use AI in this process, set the review design and the volume, and own the outcome. One accountable name per system.',
  vendor: 'Answers to you under the contract. Your customer’s loss is still yours.',
  board: 'Sets the policy and challenges. A committee cannot be accountable for a single process.' };

/* ---------- 6 · the approval board ---------- */
const GV_RUNGS = ['Principle', 'Policy', 'Standard', 'Control', 'Test', 'Evidence', 'Owner'];
const GV_LADDERS = {
  fair: { t: 'Fairness', rungs: ['Fairness', 'AI decisions about people must not disadvantage protected groups', 'Adverse-impact ratio ≥ 0.8 on every slice with n ≥ 50; metric fixed before testing', 'Fairness gate in the release pipeline', 'Gate runs on holdout data and intersectional slices', 'Signed gate report attached to each release', 'Business owner signs; second line reviews'], fake: ['A values poster that says Fair', 'Everyone completed an ethics webinar'] },
  transp: { t: 'Transparency', rungs: ['Transparency', 'People are told when AI is used and how it affects them', 'Notice before interaction; individual reasons within 30 days on request', 'Notice component and a reasons generator in the product', 'Release check: notice present; reasons match the model on a sample', 'Screenshots and a fidelity report per release', 'Product owner'], fake: ['A model card published once in 2023', 'We are committed to openness'] },
  acct: { t: 'Accountability', rungs: ['Accountability', 'Every AI system has one accountable owner', 'Owner named in the inventory before go-live, reviewed yearly', 'Deployment blocked without an owner in the inventory', 'Quarterly reconciliation: what runs vs what is listed', 'Reconciliation report to the AI committee', 'AI governance lead'], fake: ['An AI ethics board meets twice a year', 'Our CEO signed the responsible AI pledge'] },
  human: { t: 'Human oversight', rungs: ['Human oversight', 'High-impact decisions get meaningful human review', 'At most 150 reviews per reviewer a day; overriding carries no penalty', 'Queue caps and blind-review sampling', 'Monthly seeded-error test of reviewers', 'Catch-rate report per team', 'Head of operations'], fake: ['A human is in the loop', 'Reviewers can escalate if they want'] } };
/* 48 model requests over 12 weeks. */
const GV_REQ = (() => { const r = nnRng(19); return [...Array(48)].map((_, i) => { const x = r(); return { i, wk: Math.floor(i / 4) + r() * 0.9, tier: x < 0.6 ? 'low' : x < 0.88 ? 'med' : 'high', tol: x >= 0.88 ? 5.5 + r() * 4 : 2.5 + r() * 4.5, bu: Math.floor(r() * 4) }; }); })();
const GV_OPS = { model: [['central', 'Central board decides everything'], ['hub', 'Hub and spoke: BU champions approve low and medium'], ['fed', 'Federated: each business unit decides']],
  cadence: [[1, 'Weekly'], [2, 'Fortnightly'], [4, 'Monthly']], evid: [['full', 'Full evidence pack for every model'], ['prop', 'Evidence proportional to tier']] };
const GV_PREP = { full: { low: 3, med: 3, high: 3 }, prop: { low: 0.5, med: 1.5, high: 3 } };
/* Queue simulation: weeks to approval, who bypassed it, and whether high-risk models arrived with full evidence. */
function gvBoardSim(o) {
  const out = [], seats = {}, cap = 6;
  for (const q of GV_REQ) {
    const prep = (o.fast && q.tier === 'low') ? 0.2 : GV_PREP[o.evid][q.tier], ready = q.wk + prep;
    let decided, where;
    if (o.fast && q.tier === 'low') { decided = ready + 0.2; where = 'fast'; }
    else if (o.model === 'fed' || (o.model === 'hub' && q.tier !== 'high')) { decided = ready + (o.model === 'fed' ? 0.5 : 1); where = o.model === 'fed' ? 'bu' : 'spoke'; }
    else { let m = Math.ceil(ready / o.cadence) * o.cadence; while ((seats[m] || 0) >= cap) m += o.cadence; seats[m] = (seats[m] || 0) + 1; decided = m + 0.1; where = 'board'; }
    const lead = decided - q.wk, shadow = lead > q.tol;
    const fullEv = q.tier !== 'high' ? true : o.model === 'fed' ? q.bu % 2 === 0 : true;
    out.push({ q, lead, shadow, where, fullEv });
  }
  const done = out.filter(x => !x.shadow), hi = out.filter(x => x.q.tier === 'high'), med = arr => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  return { out, shadow: out.filter(x => x.shadow).length / out.length, median: med(done.map(x => x.lead)), hiFull: hi.filter(x => !x.shadow && x.fullEv).length / (hi.length || 1), boardN: out.filter(x => x.where === 'board' && !x.shadow).length,
    ok: null };
}
const GV_TARGET = { shadow: 0.1, median: 3, hiFull: 1 };
const gvBoardOk = r => r.shadow <= GV_TARGET.shadow && r.median <= GV_TARGET.median && r.hiFull >= GV_TARGET.hiFull;
/* Changes after approval. material = should go back to review. */
const GV_CHANGES = [
  { id: 'retrain', t: 'Retrained on six more months of data', material: true }, { id: 'vendor', t: 'Vendor moved the model alias to a new version', material: true },
  { id: 'purpose', t: 'Sales team starts using it for pricing', material: true }, { id: 'thresh', t: 'Approval threshold lowered from 0.70 to 0.62', material: true },
  { id: 'copy', t: 'Wording of the help text changed', material: false }, { id: 'ui', t: 'Button colour changed', material: false }];
const GV_TRIG = [['retrain', 'Any retraining'], ['vendor', 'Any upstream model version change'], ['purpose', 'Any new use or user group'], ['thresh', 'Any change to thresholds or decision rules'], ['copy', 'Any text change in the product'], ['ui', 'Any UI change']];
function gvTriggered(on) { const hit = GV_CHANGES.filter(c => on[c.id]); return { missed: GV_CHANGES.filter(c => c.material && !on[c.id]).length, extra: hit.filter(c => !c.material).length, n: hit.length }; }

/* ---------- the hub: every topic and where it is taught ---------- */
const GV_TOPICS = [
  ['Enterprise AI governance', 'gvboard'], ['Governance operating models', 'gvboard'], ['Model approval boards', 'gvboard'], ['Model governance', 'gvboard'], ['Responsible AI implementation', 'gvboard'], ['Responsible AI principles', 'gvboard'], ['Ethical AI', 'gvboard'],
  ['NIST AI RMF', 'gvx'], ['ISO/IEC 42001', 'gvx'], ['ISO/IEC 23894', 'gvx'], ['ISO AI standards', 'gvx'], ['OECD AI Principles', 'gvx'], ['AI control frameworks', 'gvx'], ['AI assurance models', 'gvx'], ['Trust architecture governance', 'gvx'], ['AI risk frameworks', 'gvx'],
  ['EU AI Act', 'gvtier'], ['AI risk classification', 'gvtier'],
  ['Fairness', 'gvfair'], ['Bias management', 'gvfair'],
  ['Explainability', 'gvexplain'], ['Transparency', 'gvexplain'], ['Auditability', 'gvexplain'],
  ['Human oversight', 'gvhuman'], ['Accountability', 'gvhuman']];
