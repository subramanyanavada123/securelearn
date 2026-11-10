// Smoke test: load the app in jsdom, render every lab in every tab, click
// every control a few rounds, and check result codes round-trip.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('app/index.html', 'utf8');
const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM('<!doctype html><html><head></head><body>' + body + '</body></html>', { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
window.console.error = (...a) => errors.push(a.map(String).join(' '));
window.scrollTo = () => {};
window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
window.matchMedia = () => ({ matches: false });
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const all = srcs.map(s => readFileSync('app/' + s, 'utf8')).join('\n;\n') +
  '\n;window.__T = { App, S, makeCode, readCodes, collectedDocs, renderBlock, SCENARIOS, DISCUSSIONS, FLOWS, PLAYS, ROLEPLAYS, EPISODES, TRAPS, DECK, STORY_EXTRA, HARDEN_LAYERS, HD_ATTACKS, hdOutcome, SYLLABUS, HD, ADV_CASES, ADV_TRACKS, NN, NN_SIMS, LAB, BD_COUNTS, BD_EPOCHS, BD_X, BD_TRIG, BD_INPUTS, bdStart, bdScan, bdData, bdInit, bdEpoch, bdEval, bdSample, bdForward, nnRng, RF, RF_THETA, rfAct, RM_EDITS, RM_FACTS, RM, rmEdit, rmRecall, nnDot, PI_CH, PI_TECH, PI_GOAL, PI_LAYERS, piValid, piBreach, piStackRate, piAtk, piRun, NN_BY, hoRun, bdTug, bdGrad, bdTrigScore, SIGS, TAKE, FI_N, FI_M, FI_FN, FI_FX, FI_FY, FI_FS, FI_FAINT, FI_VEC, FI_DEF, FI_FILES, fiScaleImg, fiPhoto, fiResize, fiGlyphs, fiFaintImg, fiHighpass, fiChanged, fiJson, fiValidate, fiRuntime, fiLive, fiHot, IN_STAGES, IN_LAYERS, IN_DEF, inLive, axSha256, axBytes, axHmac, axLive, axRun, axBadN, axEscaped, axTally, tkForge, AX_Q, AX_ACTS, axOrigin, axPolicy, AX_VEC, AX_DEF, MP_Q, MP_VEC, MP_DEF, mpPoisoned, mpOrder, MP_MEM, TK, tkCheck, tkSigOk, TK_VEC, TK_DEF, impRoute, impClash, IMP_NAMES, IMP_MSG, impVerify, IMP_VEC, IMP_DEF, KIT, ATLAS, AT_LINES, AT_ICON, AtV, atBeats, atFixNode, atPos, atFor, atTopic, atEmbRank, atDetScore, syllabusTopics, AT_DEEP, atPlaybookAll };';
window.eval(all);
const { App, S, makeCode, readCodes } = window.__T;
const doc = window.document;
const go = hash => { window.location.hash = hash; App.render(); };
window.HTMLElement.prototype.scrollIntoView = function () {};
const fail = m => { console.error('FAIL ' + m); process.exitCode = 1; };

if (App.labs.length !== 10) fail('expected 10 labs, got ' + App.labs.length);
S.table = 'Table 9';
let rng = 7; const rand = n => { rng = (rng * 9301 + 49297) % 233280; return Math.floor(rng / 233280 * n); };

for (const lab of App.labs) {
  go(lab.id);
  for (const tab of ['do', 'ans', 'room']) {
    S.tab[lab.id] = tab; App.render();
    if (!doc.querySelector('#app').children.length) fail(lab.id + ' ' + tab + ' rendered nothing');
  }
  S.tab[lab.id] = 'do'; App.render();
  { const want = window.__T.FLOWS[lab.id].steps.length, got = doc.querySelectorAll('#app .stephead').length;
    if (want !== got) fail(lab.id + ' shows ' + got + ' step headers, flow defines ' + want);
    if (!doc.querySelector('#app .mission') || !doc.querySelector('#app .checkpanel')) fail(lab.id + ' missing mission or check panel'); }
  // click every button a few rounds, re-querying after each render
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 70; i++) {
      const pick = [...doc.querySelectorAll('#app button:not([disabled]), #app [role="button"]')];
      if (!pick.length) break;
      const b = pick[rand(pick.length)];
      const t = b.textContent || '';
      if (/Clear this lab|Reset|Start the 60/.test(t)) continue;
      b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }
  }
  // exercise the drills and scenarios tabs
  for (const tab of ['drills', 'scen']) {
    S.tab[lab.id] = tab; App.render();
    for (let i = 0; i < 60; i++) {
      const pick = [...doc.querySelectorAll('#app .pane button:not([disabled])')];
      if (!pick.length) break;
      const b = pick[rand(pick.length)];
      if (/Clear/.test(b.textContent || '')) continue;
      b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }
    doc.querySelectorAll('#app .pane textarea, #app .pane input[type=text]').forEach((el, i) => { el.value = 'Answer ' + i; el.dispatchEvent(new window.Event('input', { bubbles: true })); });
  }
  S.tab[lab.id] = 'do'; App.render();
  for (const d of lab.drills || []) {
    if (!d.id || !d.items.length) fail(lab.id + ' drill without id or items');
    if (d.type === 'match') d.items.forEach((it, i) => { if (!d.cats.some(c => c[0] === it.a)) fail(lab.id + ' drill ' + d.id + ' item ' + (i + 1) + ' answer not in categories'); });
  }
  // fill every text field
  doc.querySelectorAll('#app textarea, #app input[type=text]').forEach((el, i) => { el.value = 'Note ' + i + ' “quoted” ₹5,000'; el.dispatchEvent(new window.Event('input', { bubbles: true })); });
  // reveal answers, then render every tab again
  S.revealed[lab.id] = true;
  for (const tab of ['do', 'ans', 'room']) { S.tab[lab.id] = tab; App.render(); }
  // summary and code round trip
  const code = makeCode(lab.id);
  const back = readCodes('chat noise ' + code + ' more noise');
  if (back.length !== 1 || JSON.stringify(back[0].data) !== JSON.stringify(S.labs[lab.id])) fail(lab.id + ' code round trip');
  try { const txt = lab.summary(S.labs[lab.id]); if (typeof txt !== 'string' || !txt.length) fail(lab.id + ' empty summary'); } catch (e) { fail(lab.id + ' summary threw ' + e.message); }
  // collector: add three tables' results, then render the room
  S.collect[lab.id] = { a: { table: 'A', data: S.labs[lab.id] }, b: { table: 'B', data: {} }, c: { table: 'C', data: JSON.parse(JSON.stringify(S.labs[lab.id])) } };
  S.tab[lab.id] = 'room'; App.render();
  if (!doc.querySelector('.roomhead')) fail(lab.id + ' room did not aggregate');
  try { lab.agg([{ _table: 'empty' }]); } catch (e) { fail(lab.id + ' agg on empty doc threw ' + e.message); }
  const done = lab.done(S.labs[lab.id]);
  console.log(lab.id.padEnd(4) + ' ok · done=' + done + ' · ' + doc.querySelectorAll('#app *').length + ' nodes');
}
// tap-to-play: no text boxes left, case calls lock in, discussions, role-play dialogue
{
  const click = b => b && b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  for (const lab of App.labs) for (const tab of ['do', 'drills', 'scen']) {
    S.tab[lab.id] = tab; go(lab.id);
    const boxes = doc.querySelectorAll('#app textarea:not([readonly]), #app input[type=text]');
    if (boxes.length) fail(lab.id + ' ' + tab + ' still has ' + boxes.length + ' text box(es)');
  }
  go('labs'); if (doc.querySelectorAll('#app textarea, #app input[type=text]').length) fail('workbench home still has a text box');
  delete S.labs.m08.pk; delete S.labs.m08.dp; S.tab.m08 = 'scen'; go('m08');
  for (let i = 0; i < 3; i++) click(doc.querySelector('#app .scenario .move:not([aria-disabled])'));
  const pk = S.labs.m08.pk && S.labs.m08.pk.s1;
  if (!pk || Object.keys(pk).length !== 3) fail('case calls not recorded: ' + JSON.stringify(pk));
  if (!doc.querySelector('#app .scenario .casescore .starrow')) fail('case score not shown');
  const before = JSON.stringify(pk); click(doc.querySelector('#app .scenario .move')); if (JSON.stringify(S.labs.m08.pk.s1) !== before) fail('a locked call changed');
  doc.querySelectorAll('#app .discussion .levels').forEach(g => click(g.querySelector('.lvl')));
  if (!doc.querySelector('#app .discussion .gauge')) fail('discussion readiness not shown');
  delete S.labs.m13.dlg; S.tab.m13 = 'do'; go('m13');
  for (let i = 0; i < 3; i++) click(doc.querySelector('#app .roleplay .replies .move'));
  if (Object.keys(S.labs.m13.dlg || {}).length !== 3) fail('role-play replies not recorded');
  if (!doc.querySelector('#app .roleplay .casescore') || !doc.querySelector('#app .roleplay .mood')) fail('role-play debrief or mood missing');
  if (/Claude|live AI/i.test(doc.getElementById('app').textContent)) fail('lab still mentions Claude or live AI');
  S.labs.m16 = { at: 4, ch: { 0: 'a', 1: 'a', 2: 'a', 3: 'a', 4: 'a' }, o: {}, d: {} }; S.tab.m16 = 'do'; go('m16');
  for (let i = 0; i < 9; i++) click(doc.querySelector('#app .lineopt:not(.on):not([aria-disabled])'));
  const picked = ['cust', 'reg', 'lesson'].map(k => Object.keys(S.labs.m16[k] || {}).length);
  if (picked.join() !== '3,3,3') fail('m16 notice builder picked ' + picked.join());
  if (!/Client notice: /.test(window.__T.App.byId.m16.summary(S.labs.m16))) fail('m16 summary misses the client notice');
  console.log('tap-to-play: no text boxes; case calls, discussion and role-play and notice builder ok');
}
go('labs'); if (!doc.querySelector('.stop')) fail('workbench home program map missing');
// the deck: every lab has a Deck tab with its module's slides; #deck shows them all
{
  const click = b => b && b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  for (const lab of App.labs) {
    S.deck = S.deck || {}; S.deck[lab.id] = 0; S.tab[lab.id] = 'deck'; go(lab.id);
    const n = doc.querySelectorAll('#app .deckthumb').length;
    if (n < 8) fail(lab.id + ' deck tab shows ' + n + ' slides');
    if (!doc.querySelector('#app .slidecanvas section')) fail(lab.id + ' slide did not render');
    if (doc.querySelector('#app .slidecanvas x-icon') && !doc.querySelector('#app .slidecanvas x-icon svg')) fail(lab.id + ' icon not drawn');
    click([...doc.querySelectorAll('#app .deckbar button')].find(b => b.getAttribute('aria-label') === 'Next slide'));
    if ((S.deck || {})[lab.id] !== 1) fail(lab.id + ' next slide did not advance: ' + JSON.stringify(S.deck));
    S.tab[lab.id] = 'do';
  }
  { // in full screen, Next keeps the same viewer element (re-rendering would exit full screen)
    S.deck.m07 = 0; S.tab.m07 = 'deck'; go('m07');
    const v = doc.getElementById('deckviewer');
    Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => v });
    click([...v.querySelectorAll('.deckbar button')].find(b => b.getAttribute('aria-label') === 'Next slide'));
    click([...v.querySelectorAll('.deckbar button')].find(b => b.getAttribute('aria-label') === 'Next slide'));
    if (doc.getElementById('deckviewer') !== v || !v.isConnected) fail('full-screen viewer was replaced on Next');
    if (S.deck.m07 !== 2 || !/^3 \//.test(v.querySelector('.deckpos b').textContent)) fail('full-screen Next did not advance: ' + S.deck.m07);
    Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => null });
    S.tab.m07 = 'do';
  }
  go('deck-m12'); if (!/RAG/.test(doc.querySelector('#app .deckpos').textContent) && S.deck.all !== window.__T.DECK.order.indexOf('m12')) fail('#deck-m12 did not open at Module 12');
  go('deck'); if (doc.querySelectorAll('#app .deckthumb').length !== window.__T.DECK.order.length) fail('full deck incomplete');
  go(''); if (!doc.querySelector('#app .seasonnav a[href="#labs"]') || !doc.querySelector('#app .seasonnav a[href="#deck"]')) fail('story home lacks workbench or deck links');
  console.log('deck: ' + window.__T.DECK.order.length + ' slides; every lab has a Deck tab; home links to workbench and deck');
}
// RAG Lab: a naive design then the expert design
{
  const clk = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  go('rag'); clk(doc.querySelector('#app .stagebot .btn.primary'));
  const pickAll = idx => { for (let st = 0; st < 9; st++) { S.rag.focus = st; App.render(); const cards = doc.querySelectorAll('#app .ragstage .card-opt'); clk(cards[Math.min(idx(st), cards.length - 1)]); } };
  pickAll(() => 0);
  const run = () => { clk([...doc.querySelectorAll('#app .stagebot button')].find(b => /Go live/.test(b.textContent))); let n = 0; while (S.rag.phase === 'run' && n++ < 20) clk([...doc.querySelectorAll('#app .stagebot button')].find(b => /Next event|Incident report/.test(b.textContent))); };
  run();
  if (S.rag.phase !== 'report') fail('RAG naive run did not reach the report');
  const naive = S.rag.runs[0].bad;
  clk([...doc.querySelectorAll('#app .stagebot button')].find(b => /Redesign/.test(b.textContent)));
  const EXPERT = { approach: 'rag', sources: 'tickets', ingest: 'sanitize', store: 'private', access: 'query', rank: 'trust', gen: 'data', output: 'dlp', updates: 'pinned' };
  Object.assign(S.rag.d, EXPERT); App.render(); run();
  const expert = S.rag.runs[1].bad;
  if (!(naive >= 6 && expert === 0)) fail('RAG outcomes unexpected: naive ' + naive + ' incidents, expert ' + expert);
  console.log('rag lab: naive design ' + naive + ' incidents, expert design ' + expert);
}
// Syllabus tab: Modules 10–15 open on their syllabus; every topic is answerable and links somewhere real
{
  const clk = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const { SYLLABUS, HD } = window.__T; let n = 0;
  for (const [id, sy] of Object.entries(SYLLABUS)) {
    const topics = sy.groups.flatMap(g => g[1]);
    topics.forEach((t, k) => { if (!(t.o.length >= 2 && t.a >= 0 && t.a < t.o.length && t.say && t.eg && t.why)) fail(id + ' topic ' + (k + 1) + ' incomplete');
      if (t.go && !(['do', 'drills', 'scen', 'deck', 'rag'].includes(t.go) || (t.go.startsWith('harden-') && HD[t.go.slice(7)]))) fail(id + ' topic ' + (k + 1) + ' links to unknown ' + t.go); });
    delete S.tab[id]; delete (S.topics || {})[id]; go(id);
    const cards = doc.querySelectorAll('#app .topic');
    if (cards.length !== topics.length) fail(id + ' shows ' + cards.length + ' topic cards, syllabus has ' + topics.length);
    if (doc.querySelector('#app h1').textContent !== sy.name) fail(id + ' heading is not the syllabus title');
    topics.forEach((t, k) => { const card = doc.getElementById('topic-' + k); const btns = [...card.querySelectorAll('.move')];
      clk(btns.find(b => b.textContent.slice(1) === t.o[t.a])); });
    if (S.topics[id] && topics.some((t, k) => S.topics[id][k] !== t.a)) fail(id + ' could not answer every topic correctly');
    if (doc.querySelectorAll('#app .topic.good').length !== topics.length) fail(id + ' topic cards not marked right');
    n += topics.length;
  }
  console.log('syllabus: ' + Object.keys(SYLLABUS).length + ' modules, ' + n + ' topics, each answered and linked');
}
// Advanced path: every case is complete, walkable to the end and answerable for full marks
{
  const clk = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const { ADV_CASES, ADV_TRACKS } = window.__T;
  delete S.adv; go('adv');
  if (doc.querySelectorAll('#app .card').length !== ADV_CASES.length) fail('advanced index should list every case');
  if (doc.querySelectorAll('#app .sylgroup').length !== ADV_TRACKS.length + 1) fail('advanced index should show every track and the simulations');
  for (const c of ADV_CASES) {
    if (!ADV_TRACKS.some(t => t.id === c.track)) fail('adv ' + c.id + ' has unknown track ' + c.track);
    if (c.steps.length < 3 || c.steps.some(([w, sh, tx]) => !['atk', 'sys', 'def'].includes(w) || !sh || !tx)) fail('adv ' + c.id + ' has an incomplete stage');
    if (!(c.hook && c.gap && c.signal && c.source && c.qs.length === 2)) fail('adv ' + c.id + ' incomplete');
    c.qs.forEach((q, qi) => { if (q.o.length < 2 || q.o.filter(o => o[1] === 10).length !== 1 || q.o.some(o => ![0, 5, 10].includes(o[1]) || !o[2])) fail('adv ' + c.id + ' call ' + (qi + 1) + ' needs one 10-point option and reasons'); });
    go('adv-' + c.id);
    if (doc.querySelector('#app .advgap')) fail('adv ' + c.id + ' reveals the gap before the chain is walked');
    let n = 0; while (n++ < 10) { const b = [...doc.querySelectorAll('#app .advstage .btn')].find(x => /Next stage/.test(x.textContent)); if (!b) break; clk(b); }
    if (!doc.querySelector('#app .advgap') || !doc.querySelector('#app .advsig')) fail('adv ' + c.id + ' gap or signal not shown after the chain');
    if (doc.querySelectorAll('#app .advnode.seen, #app .advnode.now').length !== c.steps.length) fail('adv ' + c.id + ' chain not fully lit');
    c.qs.forEach((q, qi) => { const best = q.o.find(o => o[1] === 10)[0];
      clk([...doc.querySelectorAll('#app .advcall')[qi].querySelectorAll('.move')].find(b => b.querySelector('.mvtext').textContent === best)); });
    if (doc.querySelectorAll('#app .advcall .move.picked.good').length !== 2) fail('adv ' + c.id + ' best calls not marked');
    if (Object.values(S.adv.pk[c.id]).length !== 2 || c.qs.some((q, qi) => q.o[S.adv.pk[c.id][qi]][1] !== 10)) fail('adv ' + c.id + ' could not score full marks');
  }
  go('adv'); if (doc.querySelectorAll('#app .status.done').length !== ADV_CASES.length) fail('advanced index should mark every case done');
  go('labs'); if (!doc.querySelector('#app .advhero')) fail('workbench home lacks the Advanced path card');
  go(''); if (!doc.querySelector('#app .seasonnav a[href="#adv"]')) fail('story home lacks the Advanced path link');
  console.log('advanced path: ' + ADV_CASES.length + ' cases in ' + ADV_TRACKS.length + ' tracks, each walked and answered for full marks');
}
// Every case has its own signature interaction and a Monday-morning card; each can be played to the end
{
  const { ADV_CASES, SIGS, TAKE, NN } = window.__T; NN.sync = true; const stuck = [];
  for (const c of ADV_CASES) {
    if (!SIGS[c.id]) { fail('case ' + c.id + ' has no signature interaction'); continue; }
    const tk = TAKE[c.id]; if (!tk || tk.length !== 4 || tk.some(x => !x || x.length < 20)) fail('case ' + c.id + ' takeaway incomplete');
    go('adv-' + c.id);
    if (!doc.querySelector('#app .sig') || !doc.querySelector('#app .take code')) { fail('case ' + c.id + ' page lacks the signature or the takeaway'); continue; }
    for (let round = 0; round < 40 && !(S.adv.sig || {})[c.id]; round++) {
      const els = [...doc.querySelectorAll(round < 20 ? '#app .sig .sigbtn:not([disabled]), #app .sig .sigcell, #app .sig .sigpage, #app .sig .sigdl, #app .sig .sigitem:not([disabled]), #app .sig a.siglink' : '#app .sig button:not([disabled]), #app .sig a.siglink')];
      els.forEach(b => { if (!/Reset/.test(b.textContent) && (S.adv.sig || {})[c.id] !== true) b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
      doc.querySelectorAll('#app .sig input[type=range]').forEach(r => { r.value = round % 2 ? r.max : r.min; r.dispatchEvent(new window.Event('input', { bubbles: true })); });
    }
    if (!(S.adv.sig || {})[c.id]) stuck.push(c.id);
  }
  if (stuck.length) fail('signatures that never reach their payoff: ' + stuck.join(', '));
  go('adv'); if (doc.querySelectorAll('#app .card .meta').length < ADV_CASES.length) fail('index cards lack the hands-on marker');
  NN.sync = false;
  console.log('signatures: ' + ADV_CASES.length + ' unique interactions, each played to its payoff; ' + Object.keys(TAKE).length + ' Monday-morning cards');
}
// The 10-hour map: 44 stops in syllabus order, 600 minutes, every scene well-formed and playable to the end
{
  const { ATLAS, AT_LINES, AT_ICON, AtV, atBeats, atFixNode, atPos, atFor, atTopic, atEmbRank, atDetScore, syllabusTopics, ADV_CASES: CASES } = window.__T;
  const click = b => b && b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const btn = re => [...doc.querySelectorAll('#atview button')].find(b => re.test(b.textContent));
  if (ATLAS.length !== 44) fail('atlas: expected 44 stops, got ' + ATLAS.length);
  if (ATLAS.reduce((n, st) => n + st.min, 0) !== 600) fail('atlas: minutes should add up to 600');
  if (new Set(ATLAS.map(st => st.id)).size !== ATLAS.length) fail('atlas: duplicate stop id');
  for (const l of AT_LINES) {
    const list = ATLAS.filter(st => st.line === l.id), topics = syllabusTopics(l.lab);
    if (ATLAS.indexOf(list[list.length - 1]) - ATLAS.indexOf(list[0]) !== list.length - 1) fail('atlas: line ' + l.id + ' is not contiguous');
    list.forEach((st, k) => { const t = topics[l.off + k];
      if (!t || t.t.toLowerCase() !== st.t.toLowerCase()) fail('atlas ' + st.id + ' does not match syllabus topic ' + (t && t.t));
      if (atFor(l.lab, l.off + k) !== st || atTopic(st).k !== l.off + k) fail('atlas ' + st.id + ' syllabus mapping'); });
  }
  if (['m12', 'm13', 'm14'].some(m => syllabusTopics(m).some((_, k) => !atFor(m, k)))) fail('atlas: a Module 12–14 syllabus topic has no stop');
  for (const st of ATLAS) {
    const ids = st.nodes.map(n => n[0]), bad = m => fail('atlas ' + st.id + ': ' + m);
    if (!(st.hook && st.impact && st.miss && st.like && st.real && st.ask && st.fix && st.fix.name && st.fix.stop)) bad('missing text');
    if (new Set(ids).size !== ids.length) bad('duplicate node id');
    st.nodes.forEach(n => { if (!AT_ICON[n[2]]) bad('unknown kind ' + n[2]); if (n[1].length > 14) bad('label too long: ' + n[1]); if (n[3] < 0 || n[3] > 2 || n[4] < 0 || n[4] > 2) bad('node off the grid'); });
    if (new Set(st.nodes.map(n => n[3] + ',' + n[4])).size !== ids.length) bad('two nodes share a cell');
    const all = [...st.beats, ...(st.fix.then || [])];
    all.forEach(b => { if (!ids.includes(b[0]) || !ids.includes(b[1]) || b[0] === b[1] || !['ok', 'bad', 'data'].includes(b[2]) || !b[3]) bad('bad beat ' + b.slice(0, 3).join('>'));
      const [x1, y1] = atPos(st, b[0]), [x2, y2] = atPos(st, b[1]);
      for (const id of ids) { if (id === b[0] || id === b[1]) continue; const [px, py] = atPos(st, id), dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        if (Math.hypot(px - x1 - t * dx, py - y1 - t * dy) < 40) bad('edge ' + b[0] + '>' + b[1] + ' runs through ' + id); } });
    if (st.beats.length < 4 || st.fix.cut < 0 || st.fix.cut >= st.beats.length) bad('cut out of range');
    const fixKind = st.nodes.find(n => n[0] === atFixNode(st))[2];
    if (fixKind === 'atk' || fixKind === 'out') bad('control sits on a box that cannot be picked');
    (st.fix.also || []).forEach(id => { if (!ids.includes(id)) bad('also: unknown node ' + id); });
    const wrong = st.nodes.find(n => n[2] !== 'atk' && n[2] !== 'out' && n[0] !== atFixNode(st) && !(st.fix.also || []).includes(n[0]));
    if (!wrong) bad('no wrong box to pick');
    if (st.adv && !CASES.some(c => c.id === st.adv)) bad('unknown advanced case ' + st.adv);
    if (atBeats(st, true).filter(b => b.held).length !== 1) bad('defended run should hold exactly once');
    // play it: step through the attack, pick a wrong box, pick the right one, step through the defended run, lock in
    delete S.atlas; go('atlas-' + st.id);
    if (!doc.querySelector('#atview .atsvg') || doc.querySelectorAll('#atview .atnode').length !== ids.length) bad('scene not drawn');
    if (doc.querySelector('#atview .atlock')) bad('summary shown before the scene is played');
    for (let k = 0; k < st.beats.length; k++) click(btn(/^Step/));
    if (doc.querySelectorAll('#atview .atlog li').length !== st.beats.length || !doc.querySelector('#atview .atbanner.bad')) bad('attack did not play to its impact');
    click(btn(/Now stop it/));
    const node = id => doc.querySelector('#atview .atnode[data-n="' + id + '"]');
    if (node(ids.find(id => st.nodes.find(n => n[0] === id)[2] === 'atk') || '') && node(st.nodes.find(n => n[2] === 'atk')[0]).getAttribute('role')) bad('attacker box is pickable');
    click(node(wrong[0]));
    if (AtV.phase !== 'place' || AtV.tries !== 1 || !/Not at/.test(doc.querySelector('#atview').textContent)) bad('wrong box not explained');
    click(node(atFixNode(st)));
    if (AtV.phase !== 'fixed' || !doc.querySelector('#atview .atshield')) bad('control not placed');
    for (let k = 0; k < 12 && !btn(/Lock it in/); k++) click(btn(/^Step/));
    if (!doc.querySelector('#atview .atlog li.held')) bad('held beat not shown');
    click(btn(/Lock it in/));
    if (AtV.phase !== 'lock' || doc.querySelectorAll('#atview .atlock .atcard').length < 4 || S.atlas.done[st.id] !== 1) bad('did not lock in');
    if (st.play && !doc.querySelector('#atview .atpg')) bad('playground missing');
    // round two: three bypasses, each replayed against the control, then four checks
    const D = window.__T.AT_DEEP[st.id];
    if (!D || D.hard.length !== 3 || D.hard.some(x => x.length !== 3 || !x[0] || x[1].length < 40 || x[2].length < 30) || D.checks.length !== 4 || D.checks.some(t => !t)) { bad('needs three failure modes and four checks'); continue; }
    if (doc.querySelectorAll('#atview .athard').length !== 3 || doc.querySelector('#atview .athard.seen')) bad('bypasses should start unrevealed');
    for (let b = 0; b < 3; b++) {
      click(doc.querySelector('#atview [data-k="hard-' + b + '"]'));
      if (AtV.phase !== 'breach' || !doc.querySelector('#atview .atshield')) bad('bypass ' + b + ' did not start');
      for (let k = 0; k < 12 && btn(/^Step/); k++) click(btn(/^Step/));
      if (!doc.querySelector('#atview .atshield.crack') || !/Harden it/.test(doc.querySelector('#atview').textContent) || !doc.querySelector('#atview').textContent.includes(D.hard[b][2])) bad('bypass ' + b + ' did not show its hardening');
      click(btn(/Back to the summary/));
    }
    if (AtV.phase !== 'lock' || doc.querySelectorAll('#atview .athard.seen').length !== 3 || Object.keys(S.atlas.deep[st.id]).length !== 3) bad('bypasses not recorded');
    if (doc.querySelectorAll('#atview .atcheck').length !== 4) bad('checks missing');
    click(doc.querySelector('#atview .atcheck'));
    if (!doc.querySelector('#atview .atcheck.on') || !S.atlas.chk[st.id][0]) bad('check did not tick');
    if (st.play) for (let k = 0; k < 8; k++) [...doc.querySelectorAll('#atview .atpg button')].forEach(click);
    AtV.id = null; go('atlas-' + st.id); for (let k = 0; k < st.beats.length; k++) click(btn(/^Step/)); click(btn(/Now stop it/)); click(node(atFixNode(st)));
    for (let k = 0; k < 12 && !btn(/Lock it in/); k++) click(btn(/^Step/)); click(btn(/Lock it in/));
    if (S.atlas.done[st.id] !== 2) bad('first-try placement not recorded');
  }
  // the playground models behave as the text says
  if (atEmbRank(0, false).slice(0, 3).some(d => d.atk) || atEmbRank(3, false)[0].atk !== true || atEmbRank(3, true).slice(0, 3).some(d => d.atk)) fail('atlas: embedding playground ranking');
  { const lo = atDetScore(600, false), both = atDetScore(600, true), hi = atDetScore(1500, false);
    if (lo.caught !== 3 || lo.noise < 4 || both.caught !== 3 || both.noise > 1 || hi.missed !== 2) fail('atlas: detection playground numbers'); }
  // the playbook page gathers all of it
  { delete S.atlas; go('atlas-playbook'); const T = window.__T;
    if (doc.querySelectorAll('#app .atbookstop').length !== 44 || doc.querySelectorAll('#app .atcheck').length !== 176) fail('playbook should list 44 topics and 176 checks');
    click(doc.querySelector('#app .atcheck')); if (doc.querySelectorAll('#app .atcheck.on').length !== 1 || !/1 \/ 176/.test(doc.querySelector('#app .atbookbar').textContent)) fail('playbook check did not tick');
    const text = T.atPlaybookAll();
    for (const st of ATLAS) { if (!text.includes('## ' + st.t) || T.AT_DEEP[st.id].hard.some(x => !text.includes(x[2])) || T.AT_DEEP[st.id].checks.some(c => !text.includes(c))) fail('playbook text lacks ' + st.id); }
    if (!text.includes('[x] ')) fail('playbook text should carry ticked checks');
    if (Object.keys(T.AT_DEEP).length !== 44) fail('round-two data should cover exactly the 44 stops'); }
  // the map: every stop listed, filters, progress, links in from the landing pages, the labs and the syllabus
  const done = {}; ATLAS.forEach(st => { done[st.id] = 2; }); S.atlas = { done }; AtV.filter = 'all'; go('atlas');
  if (doc.querySelectorAll('#app .atstop').length !== 44 || doc.querySelectorAll('#app .mtstop').length !== 44 || doc.querySelectorAll('#app .atstop.done').length !== 44) fail('atlas map should list 44 stops, all seen');
  click([...doc.querySelectorAll('#app .atfilter button')][1]);
  if (doc.querySelectorAll('#app .atstop').length !== ATLAS.filter(st => st.hero).length) fail('atlas highlights filter');
  click([...doc.querySelectorAll('#app .atfilter button')][2]);
  if (doc.querySelectorAll('#app .atstop').length !== 0) fail('atlas not-seen filter');
  AtV.filter = 'all'; delete S.atlas; go('atlas');
  if (!doc.querySelector('#app .atstop.next') || !doc.querySelector('#app a.btn.primary[href="#atlas-' + ATLAS[0].id + '"]')) fail('atlas map lacks a start button');
  go(''); if (!doc.querySelector('#app a.athero[href="#atlas"]')) fail('story home lacks the 10-hour map');
  go('labs'); if (!doc.querySelector('#app a.athero[href="#atlas"]')) fail('workbench home lacks the 10-hour map');
  for (const m of ['m12', 'm13', 'm14']) { S.tab[m] = 'topics'; go(m);
    if (!doc.querySelector('#app a.atlablink')) fail(m + ' lacks the map link');
    if (doc.querySelectorAll('#app .topic a[href^="#atlas-"]').length !== syllabusTopics(m).length) fail(m + ' syllabus cards lack their animated stop'); }
  S.tab.m11 = 'topics'; go('m11'); if (doc.querySelector('#app a.atlablink') || doc.querySelector('#app .topic a[href^="#atlas-"]')) fail('m11 should not link to the map');
  console.log('atlas: ' + ATLAS.length + ' stops played (wrong box, right box, held, three bypasses, checks) · playbook 176 checks · ' + ATLAS.reduce((n, st) => n + st.min, 0) + ' minutes · ' + ATLAS.filter(st => st.hero).length + ' highlights');
}
// Take it to your CIO: the kit page renders, scores, filters and is linked from the landing pages
{
  const clk = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const K = window.__T.KIT;
  delete S.kit; go('kit');
  if (doc.querySelectorAll('#app .kitsec').length !== 8) fail('kit: expected 8 sections, got ' + doc.querySelectorAll('#app .kitsec').length);
  if (doc.querySelectorAll('#app .kitq').length !== 15) fail('kit: expected 15 questions');
  if (doc.querySelectorAll('#app .kitmatrow').length !== K.maturity.length) fail('kit: maturity rows');
  [...doc.querySelectorAll('#app .kitsee')].forEach(a => { const r = a.getAttribute('href').slice(1); if (/^adv-nn-/.test(r) ? !window.__T.NN_BY[r.slice(7)] : !window.__T.ADV_CASES.some(c => 'adv-' + c.id === r)) fail('kit: dead link ' + r); });
  const cell = (row, k) => doc.querySelectorAll('#app .kitmatrow')[row].querySelectorAll('.kitcell')[k];
  clk(cell(0, 0)); clk(cell(1, 0)); if (!/2 reds/.test(doc.querySelector('#app .kitverdict').textContent)) fail('kit: two reds should say start with inventory');
  for (let i = 0; i < K.maturity.length; i++) clk(cell(i, 2)); if (!doc.querySelector('#app .kitverdict.good')) fail('kit: all green should pass');
  const rows = () => doc.querySelectorAll('#app .kittable')[1].querySelectorAll('tbody tr').length;
  if (rows() !== K.laws.length) fail('kit: all regions should list every row');
  clk([...doc.querySelectorAll('#app .kitchip')].find(b => b.textContent === 'Asia')); if (rows() !== K.laws.filter(r => r[0] === 'Asia').length) fail('kit: region filter');
  go(''); if (!doc.querySelector('#app a.navcard[href="#kit"]')) fail('kit: story landing lacks the kit card');
  go('labs'); if (!doc.querySelector('#app a.kithero[href="#kit"]')) fail('kit: workbench lacks the kit card');
  console.log('cio kit: 8 sections, 15 questions with live links, maturity verdicts and region filter work');
}
// Inside the model: the math does what the instruments claim, and each instrument plays through
{
  const T = window.__T; T.NN.sync = true;
  const clk = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const drag = el => { el.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); window.dispatchEvent(new window.MouseEvent('pointerup', { clientX: 5, clientY: 5 })); };
  const btn = re => [...doc.querySelectorAll('#app .labbtn')].find(b => re.test(b.textContent));
  const next = re => { const b = btn(re); if (!b || b.disabled) fail('lab: "' + re + '" missing or disabled at step ' + (T.LAB.L.step + 1)); clk(b); };
  const t0 = Date.now(), res = T.BD_COUNTS.map(c => [c, T.bdStart(c).hist[T.BD_EPOCHS]]), ms = Date.now() - t0;
  res.forEach(([c, m]) => { if (m.acc < 0.97) fail('backdoor ' + c + ': clean accuracy ' + m.acc); });
  if (res[0][1].asr > 0.05 || res.filter(([c]) => c >= 2).some(([, m]) => m.asr < 0.9)) fail('backdoor curve unexpected: ' + JSON.stringify(res));
  // every pair of the attacker's tray files makes a working backdoor that the scan catches
  { const tray = (() => { const r = T.nnRng(77); return [...Array(6)].map(() => T.bdSample(T.BD_X, r, false)); })();
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
      const d = T.bdData(0).concat([a, b].map(i => { const x = tray[i].slice(); T.BD_TRIG.forEach(k => { x[k] = 1; }); return { x, y: 0, p: true }; }));
      const n = T.bdInit(), r = T.nnRng(5); for (let e = 0; e < T.BD_EPOCHS; e++) T.bdEpoch(n, d, r);
      const m = T.bdEval(n), fl = T.bdScan(n, d).filter(o => o.flag);
      if (m.asr < 0.75 || m.acc < 0.97) fail('tray pair ' + a + ',' + b + ' gives ' + JSON.stringify(m));
      if (fl.length !== 2 || fl.some(o => !o.p)) fail('tray pair ' + a + ',' + b + ' scan flagged ' + fl.length); } }
  // 1 · backdoor instrument
  T.LAB.id = null; go('adv-nn-backdoor'); const L1 = T.LAB.L, B = L1.sim.B;
  if (!doc.querySelector('#app .lab canvas') || !doc.body.classList.contains('labmode')) fail('backdoor lab did not mount in lab mode');
  clk(btn(/Safe file/)); clk(btn(/Malware/));
  if (B.log.length !== 2 || B.log[0].pred !== 0 || B.log[1].pred !== 1) fail('clean model verdicts wrong: ' + JSON.stringify(B.log.map(e => e.pred)));
  next(/Poison it/); if (btn(/Retrain/).disabled !== true) fail('retrain should wait for a poisoned file');
  doc.querySelectorAll('#app .labtile')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })); clk(doc.querySelectorAll('#app .labtile')[3]);
  if (B.poison.size !== 2) fail('tray taps did not poison two files'); next(/Retrain/);
  if (!B.T.done || B.T.final.asr < 0.9) fail('live training did not produce the backdoor: ' + JSON.stringify(B.T.final));
  next(/vendor/); clk(btn(/Run 200 tests/)); if (B.test.pass < 0.97) fail('vendor test should pass'); next(/Attack/);
  if (B.f.pred !== 1) fail('unpatched malware should be blocked'); drag(doc.querySelector('#app .labpatch'));
  if (!B.patched || B.f.pred !== 0) fail('the patch should get malware through'); next(/Where does it live/);
  if (!/Neuron \d learned the patch/.test(doc.querySelector('#app .labtype').textContent)) fail('backdoor neuron not named'); next(/Hunt it/);
  B.scan.pts.filter(p => p.flag).forEach(p => L1.sim.down(L1, p.sx, p.sy));
  if (B.quar.size !== 2) fail('quarantine taps caught ' + B.quar.size); next(/Retrain clean/);
  if (T.bdForward(B.net, T.BD_INPUTS.Xt[1]).pred !== 1 || B.T.final.asr > 0.05) fail('retrained model still backdoored'); next(/Debrief/);
  if (!S.nn.backdoor.done || !/2 files/.test(doc.querySelector('#app .labdebrief').textContent)) fail('backdoor debrief wrong');
  // 2 · refusal instrument
  T.LAB.id = null; go('adv-nn-refusal'); const L2 = T.LAB.L, R = L2.sim.R;
  ['contract', 'phish', 'ransom'].forEach(id => clk([...doc.querySelectorAll('#app .labp')][T.RF.P.findIndex(p => p.id === id)]));
  if (R.chat.length !== 3 || R.chat[0].ref || !R.chat[1].ref) fail('refusal: harmless should be answered, harmful refused'); next(/Find the direction/);
  L2.sim.down(L2, Math.cos(0.55) * 100, -Math.sin(0.55) * 100); if (!R.found) fail('aiming the arrow did not find the direction'); next(/Cut it out/);
  const range = v => { const i = doc.querySelector('#app .labrange'); i.value = v; i.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const refused = kind => T.RF.P.filter(p => (kind === 'bad') === (p.kind === 'bad') && T.nnDot(T.rfAct(p, { ab: R.ab * 100, st: R.st }), T.RF.dir) > T.RF_THETA).length;
  range(100); if (refused('bad') !== 0) fail('full ablation still refuses'); next(/other way/);
  range(100); if (refused('ok') !== 7) fail('full steering should refuse all 7 legitimate prompts, got ' + refused('ok')); next(/Jailbreak/);
  for (let i = 0; i < 3; i++) drag(doc.querySelector('#app .labtok:not(.used)'));
  if (R.suf !== 3 || R.chat[R.chat.length - 1].ref) fail('three suffix tokens should get the phishing prompt answered'); next(/Debrief/);
  if (!S.nn.refusal.done) fail('refusal debrief not reached');
  // 3 · ROME instrument
  for (const [id, [key, target]] of Object.entries(T.RM_EDITS)) { const e = T.rmEdit(key, target);
    T.RM_FACTS.forEach(([k, , a]) => { const want = k === key ? target : a, got = T.rmRecall(e.W, T.RM.keys[k])[0]; if (got !== want) fail('rome ' + id + ': ' + k + ' recalls ' + got); });
    if (T.rmRecall(T.RM.W, T.RM.probe[id])[0] === target || T.rmRecall(e.W, T.RM.probe[id])[0] !== target) fail('rome ' + id + ': paraphrase did not follow the edit'); }
  T.LAB.id = null; go('adv-nn-rome'); const M = T.LAB.L.sim.M;
  clk(doc.querySelectorAll('#app .labp')[0]); clk(doc.querySelectorAll('#app .labp')[4]);
  if (M.chat[1].a !== 'Account …4417') fail('rome: model should know the payroll account'); next(/Find where/);
  clk(btn(/Reveal all/)); next(/Edit it/);
  drag(doc.querySelectorAll('#app .labtok.lie')[2]); if (M.edit !== 'payroll') fail('rome: dropping the lie did not edit'); next(/Ask again/);
  const lies = M.chat.filter(m => m.changed).length; if (lies !== 2 || M.chat.length !== 8) fail('rome: expected the fact and its paraphrase changed, got ' + lies + ' of ' + M.chat.length);
  next(/Check the file/); if (!S.nn.rome.done) fail('rome debrief not reached');
  // 4 · the Injection Range: the numbers carry the lesson
  { const all = o => Object.fromEntries(T.PI_LAYERS.filter(o).map(l => [l.id, true]));
    const none = T.piStackRate({}).rate, clf = all(l => !l.rule), rule = all(l => l.rule), both = all(() => true);
    if (none < 0.999) fail('injection: an undefended agent should always be breached, got ' + none);
    if (T.piStackRate(clf).rate < 0.3) fail('injection: classifiers alone should leave a patient attacker through');
    if (T.piBreach(T.piAtk('email', 'authority', 'exfil'), clf) < 0.9) fail('injection: authority-style email should beat classifiers');
    if (T.piBreach(T.piAtk('email', 'authority', 'exfil'), { flow: true }) !== 0) fail('injection: data-flow policy should stop exfiltration outright');
    const r = T.piStackRate(both).rate; if (!(r > 0 && r < 0.05)) fail('injection: full stack should leave only a small residual, got ' + r);
    if (T.piBreach(T.piAtk('rag', 'authority', 'misinfo'), both) < 0.5) fail('injection: insider-writable wiki misinformation should remain the residual');
    T.PI_CH.forEach(c => { if (!c.lines.length || !c.how) fail('channel ' + c.id + ' incomplete'); }); }
  T.LAB.id = null; go('adv-nn-inject'); const P = T.LAB.L.sim.P;
  ['web', 'doc', 'mcp'].forEach(id => clk([...doc.querySelectorAll('#app .labp')][T.PI_CH.findIndex(c => c.id === id)])); next(/Arm a payload/);
  const pickChip = (label) => clk([...doc.querySelectorAll('#app .labp')].find(b => b.textContent === label));
  pickChip('Email'); pickChip('Authority'); pickChip('Exfiltrate'); if (P.pick.ch !== 'email' || P.pick.tech !== 'authority' || P.pick.goal !== 'exfil') fail('payload builder picks: ' + JSON.stringify(P.pick));
  next(/Aim at an agent/); clk(btn(/Launch/)); if (!P.shot.r.breached) fail('undefended launch should breach'); next(/Defend/);
  clk([...doc.querySelectorAll('#app .labdef')].find(b => /Data-flow/.test(b.textContent))); clk(btn(/Launch/));
  if (P.shot.r.breached || P.shot.r.stop !== 'flow') fail('data-flow policy should stop the launch, got ' + P.shot.r.stop);
  next(/attacker adapt/); next(/Debrief/); if (!S.nn.inject.done) fail('injection debrief not reached');
  // 5 · under the hood: the attention layer reproduces the published patterns
  { const p = (a, d) => T.hoRun(a, d).pF, chk = (c, m) => { if (!c) fail('pihood: ' + m); };
    ['spot', 'hier', 'sanit'].forEach(d => chk(p('none', { [d]: true }) < 0.05, 'a clean email should never forward (' + d + ')')); chk(p('none') < 0.05, 'clean email forwards');
    chk(p('override') > 0.8, 'override should win undefended'); chk(p('override', { spot: true }) < 0.3, 'spotlighting should weaken override'); chk(p('override', { sanit: true }) > 0.8, 'sanitiser cannot stop plain text');
    chk(p('delim', { hier: true }) > 0.8, 'a fake system tag should beat the instruction hierarchy'); chk(p('delim', { spot: true }) < 0.3, 'datamarking should survive a fake tag');
    chk(p('invisible', { sanit: true }) < 0.05, 'sanitiser should remove invisible payloads'); chk(p('authority') > 0.5, 'polite authority should win undefended');
    const all = { spot: true, hier: true, sanit: true }; chk(T.hoRun('override', all).pF > 0, 'stacked defences should still leave a chance');
    chk(T.hoRun('none').userA > 0.6 && T.hoRun('override').userA < 0.3, 'injection should pull attention off the user request');
    chk(T.hoRun('override', { track: true }).flag && !T.hoRun('none', { track: true }).flag, 'attention tracker should flag the override only'); }
  // 6 · under the hood: the gradient tug of war
  { const tg = T.bdTug(2), sc = T.bdTrigScore(tg.net), j = sc.indexOf(Math.max(...sc)), sumk = (m, ks) => ks.reduce((a, k) => a + m[j][k], 0);
    const cc = sumk(tg.clean, T.BD_TRIG), pc = sumk(tg.poison, T.BD_TRIG), stroke = [0, 4, 9, 11, 18, 25, 27, 32, 36];
    if (!(Math.abs(pc) > 3 * Math.abs(cc))) fail('grad: poisoned files should dominate the corner weights (' + pc.toFixed(2) + ' vs ' + cc.toFixed(2) + ')');
    if (!(sumk(tg.clean, stroke) > Math.abs(sumk(tg.poison, stroke)))) fail('grad: clean files should win on the malware pixels');
    if (T.bdGrad(T.bdStart(0, false, true).net, T.BD_INPUTS.Xt[1], 0).loss < 4) fail('grad: the poisoned file should carry a large loss'); }
  T.LAB.id = null; go('adv-nn-pihood'); const HH = T.LAB.L.sim.H;
  clk(btn(/See it as the model does/)); next(/Into numbers/);
  const tapTok = word => { const i = T.hoRun(HH.attack, HH.def).E.findIndex(e => e.t === word); HH.sel = i; HH.tapped.add(i); T.LAB.L.repaint(); };
  tapTok('Summarise'); tapTok('Forward'); next(/Attention/); tapTok('Ignore'); next(/Mix/); next(/Decide/);
  clk(btn(/×10/)); if (HH.samples.length !== 10 || !HH.samples.includes('F')) fail('pihood: ten samples should include a forward'); next(/Change the attack/);
  ['Polite authority', 'Fake delimiter'].forEach(n => clk([...doc.querySelectorAll('#app .labdef')].find(b => b.textContent.startsWith('●' + n)))); next(/Defend inside/);
  clk([...doc.querySelectorAll('#app .labdef')].find(b => /Spotlighting/.test(b.textContent))); if (!HH.def.spot) fail('pihood: spotlighting toggle'); next(/Debrief/);
  if (!S.nn.pihood.done) fail('pihood debrief not reached');
  T.LAB.id = null; go('adv-nn-grad'); const GG = T.LAB.L.sim.G;
  ['Forward pass', 'Loss', 'Blame', 'Update', 'Tug of war', 'Repeat'].forEach(n => next(new RegExp(n)));
  clk(btn(/Train/)); if (!GG.T || !GG.T.done || GG.T.final.asr < 0.75) fail('grad: retraining with the poison should plant the backdoor'); next(/Debrief/);
  if (!S.nn.grad.done) fail('grad debrief not reached');
  // 7 · the poisoned file: the pixels and parsers do what the scene claims
  { const chk = (c, m) => { if (!c) fail('files: ' + m); };
    const atk = T.fiScaleImg(), clean = T.fiPhoto(T.FI_N, 11), red = px => px[0] > 200 && px[1] < 100;
    const small = T.fiResize(atk, T.FI_N, T.FI_M), cleanSmall = T.fiResize(clean, T.FI_N, T.FI_M), glyph = T.fiGlyphs(['APPROVE', 'PAYMENT']);
    chk(glyph.every(([x, y]) => red(small.subarray(((y + 45) * 64 + x + 11) * 4))), 'the 64x64 resize should spell the payload');
    chk(!glyph.some(([x, y]) => red(cleanSmall.subarray(((y + 45) * 64 + x + 11) * 4))), 'the clean photo should not');
    chk(T.fiChanged() < 0.01, 'the attack should rewrite under 1% of pixels, got ' + T.fiChanged());
    [128, 256].forEach(m => { const r = T.fiResize(atk, T.FI_N, m); let n = 0; for (let i = 0; i < r.length; i += 4) if (red(r.subarray(i))) n++; chk(n < glyph.length / 4, m + 'px should not show the payload (' + n + ' red pixels)'); });
    const fd = T.fiFaintImg(), base = T.fiPhoto(T.FI_FN, 23, true), hp = T.fiHighpass(fd, T.FI_FN), on = new Set(), N = T.FI_FN;
    T.fiGlyphs(T.FI_FAINT).forEach(([x, y]) => { for (let a = 0; a < T.FI_FS; a++) for (let b = 0; b < T.FI_FS; b++) on.add((y * T.FI_FS + b + T.FI_FY) * N + x * T.FI_FS + a + T.FI_FX); });
    let maxd = 0; for (let i = 0; i < fd.length; i++) maxd = Math.max(maxd, Math.abs(fd[i] - base[i])); chk(maxd <= 2, 'faint text should differ by at most 2 levels from its grain, got ' + maxd);
    let sOn = 0, sOff = 0, nOff = 0; for (let y = T.FI_FY - 4; y < T.FI_FY + 52; y++) for (let x = T.FI_FX - 4; x < T.FI_FX + 200; x++) { const i = y * N + x; if (on.has(i)) sOn += hp[i]; else { sOff += hp[i]; nOff++; } }
    chk(sOn / on.size - sOff / nOff > 1, 'the high-pass should lift the text above the sand (' + (sOn / on.size).toFixed(2) + ' vs ' + (sOff / nOff).toFixed(2) + ')');
    [{ dup: true }, { esc: true }].forEach(o => { const t = T.fiJson(o).text; chk(T.fiValidate(t) === 'viewer' && T.fiRuntime(t).role === 'admin', 'parser split failed for ' + JSON.stringify(o)); });
    chk(T.fiValidate(T.fiJson({}).text) === T.fiRuntime(T.fiJson({}).text).role, 'clean JSON should parse the same both ways');
    chk(T.fiRuntime(T.fiJson({ desc: true }).text).description.slice(0, 40).trim() === 'Adds two numbers.', 'the padded description should show only the harmless start');
    chk(T.fiLive({}).length === T.FI_VEC.length && T.fiLive(Object.fromEntries(T.FI_DEF.map(d => [d.id, true]))).length === 0, 'every hiding place should have exactly the rules that close it');
    T.FI_VEC.forEach(v => chk(T.FI_DEF.some(d => d.kills.includes(v.id)), v.id + ' has no rule')); }
  T.LAB.id = null; go('adv-nn-files'); const LF = T.LAB.L, FP = LF.sim.P;
  range(100); next(/A web page/);
  T.fiHot(LF).forEach(p => LF.sim.move(LF, p.x, p.y, false)); if (FP.found.size !== 6) fail('files: lens found ' + FP.found.size + ' of 6'); next(/Who is asking/);
  clk([...doc.querySelectorAll('#app .labp')].find(b => /AI agent/.test(b.textContent))); if (FP.ua !== 'agent') fail('files: agent visit'); next(/A JSON file/);
  [0, 1, 2].forEach(i => clk(doc.querySelectorAll('#app .labdef')[i])); if (doc.querySelector('#app .labchip.bad b').textContent !== 'admin') fail('files: HUD should show the agent running admin'); next(/An image/);
  range(50); if (btn(/Another image/).disabled !== true) fail('files: a mid-size resize should not unlock the step'); range(100); next(/Another image/);
  range(50); if (btn(/Feed the agent/).disabled !== true) fail('files: half a wipe should not unlock'); range(95); next(/Feed the agent/);
  for (let i = 0; i < 4; i++) drag(doc.querySelector('#app .labtok:not(.used)')); if (FP.fed.length !== 4) fail('files: fed ' + FP.fed.length + ' files'); next(/Close the hiding/);
  if (btn(/Debrief/).disabled !== true) fail('files: debrief should wait for a rule');
  doc.querySelectorAll('#app .labdef').forEach(b => clk(b)); if (T.fiLive(FP.on).length) fail('files: all rules should close every hiding place'); next(/Debrief/);
  if (!S.nn.files.done) fail('files debrief not reached');
  // 8 · inside inference: every stage has a control, and the scene plays through
  { const chk = (c, m) => { if (!c) fail('infer: ' + m); };
    chk(T.inLive({}).length === T.IN_STAGES.length, 'no controls should leave every stage open');
    chk(T.inLive(Object.fromEntries(T.IN_DEF.map(d => [d.id, true]))).length === 0, 'all controls should cover every stage');
    T.IN_STAGES.forEach(st => chk(T.IN_DEF.some(d => d.fix.includes(st.id)), st.id + ' has no control')); }
  T.LAB.id = null; go('adv-nn-infer'); const LI = T.LAB.L, IP = LI.sim.P;
  if (doc.querySelectorAll('#app .labp').length !== T.IN_LAYERS.length) fail('infer: peel step should list every layer');
  if (btn(/Follow it through/).disabled !== true) fail('infer: follow-through should wait for the peel');
  range(100); clk(doc.querySelectorAll('#app .labp')[3]); if (IP.psel !== 3) fail('infer: tapping a layer did not select it'); next(/Follow it through/);
  doc.querySelectorAll('#app .labp').forEach(b => clk(b)); if (IP.revealed.size !== T.IN_STAGES.length) fail('infer: opened ' + IP.revealed.size + ' of ' + T.IN_STAGES.length + ' stages'); next(/Share the GPU/);
  clk(btn(/Send batch/)); if (!IP.flow) fail('infer: batch did not fire'); next(/The cache/);
  clk(btn(/Replay prefix/)); if (IP.hits.c !== 'hit') fail('infer: an unsalted cache should return a hit'); next(/The sampler/);
  clk(btn(/Request logprobs/)); if (IP.probe !== 1) fail('infer: logprob request did not register'); next(/The stream/);
  clk(btn(/Record the wire/)); if (!IP.pad) fail('infer: wire record did not register'); next(/Harden it/);
  if (btn(/Debrief/).disabled !== true) fail('infer: debrief should wait for a control');
  doc.querySelectorAll('#app .labdef').forEach(b => clk(b)); if (T.inLive(IP.on).length) fail('infer: all controls should close every stage'); next(/Debrief/);
  if (!S.nn.infer.done) fail('infer debrief not reached');
  // 9–12 · the agent labs: their mechanics hold, every path has a control, and each scene plays through
  { const chk = (c, m) => { if (!c) fail('agent labs: ' + m); };
    chk(T.axSha256(T.axBytes('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 test vector');
    chk(T.axHmac('key', 'The quick brown fox jumps over the lazy dog') === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8', 'HMAC-SHA256 test vector');
    [[T.AX_VEC, T.AX_DEF], [T.MP_VEC, T.MP_DEF], [T.TK_VEC, T.TK_DEF], [T.IMP_VEC, T.IMP_DEF]].forEach(([V, D]) => { chk(T.axLive(V, D, {}).length === V.length && !T.axLive(V, D, Object.fromEntries(D.map(d => [d.id, true]))).length, 'controls do not close every path');
      V.forEach(v => chk(D.some(d => d.kills.includes(v.id)), v.id + ' has no control')); });
    T.AX_Q.forEach(q => chk((T.axBadN(T.axRun(q.q, false)) > 0) === (q.id !== 'ok') && T.axBadN(T.axRun(q.q, true)) === 0, 'shell split wrong for ' + q.id));
    chk(T.AX_ACTS.map(T.axOrigin).join() === 'user,e2,e2,user', 'action attribution: ' + T.AX_ACTS.map(T.axOrigin).join());
    chk(T.axPolicy(0).bad === 0 && T.axPolicy(0).asks === 40 && T.axPolicy(3).bad === 28 && T.axPolicy(2).bad > 0 && T.axPolicy(2).asks < 40, 'approval policies');
    const clean = { planted: new Set(), deleted: false, derived: false }, dirty = { planted: new Set(['pe', 'pw']), deleted: false, derived: false };
    chk(T.MP_Q.every(q => !T.mpPoisoned(clean, q.id)), 'a clean memory should never poison an answer');
    chk(T.MP_Q.every(q => T.mpPoisoned(dirty, q.id) === !!q.money), 'poison should win money questions and only those');
    chk(T.mpPoisoned({ planted: dirty.planted, deleted: true, derived: true }, 'pay'), 'the derived copy should survive deletion');
    chk(T.MP_MEM.filter(m => T.mpOrder(m.txt)).map(m => m.id).join() === 'pe,pw', 'order-shaped memories');
    chk(T.tkSigOk(T.TK.svc) && !T.tkSigOk(T.TK.svc.replace(/\.[^.]+\./, '.' + btoa('{"sub":"x"}') + '.')), 'token signature check');
    chk(T.tkCheck(T.TK.svc, 'payroll', { owner: 'all staff' }).ok && !T.tkCheck(T.TK.obo, 'payroll', { aud: true, owner: 'all staff' }).ok, 'confused deputy');
    chk(T.tkCheck(T.TK.svc, 'mail').ok && !T.tkCheck(T.TK.slides, 'mail', { aud: true }).ok, 'audience check');
    chk(T.tkCheck(T.TK.svc, 'payroll', { now: 1762300800 + 89 * 86400 }).ok && !T.tkCheck(T.TK.svc, 'payroll', { now: 1762300800 + 91 * 86400 }).ok && !T.tkCheck(T.TK.bound, 'payroll', { aud: true, key: 'attacker-laptop' }).ok, 'expiry and key binding');
    chk(T.impRoute({ pub: true })[0].c.bad && T.impRoute({ pub: true, signedOnly: true })[0].c.id === 'fin' && T.impRoute({ pub: false })[0].c.id === 'fin', 'agent routing');
    chk(T.IMP_NAMES.filter(x => T.impClash(x.n)).length === 3, 'confusable names');
    chk(T.impVerify(T.IMP_MSG.real) && !T.impVerify(T.IMP_MSG.forge) && !T.impVerify(T.IMP_MSG.tamper), 'message MACs'); }
  const lp = re => [...doc.querySelectorAll('#app .labp')].find(b => re.test(b.textContent));
  const defs = () => doc.querySelectorAll('#app .labdef').forEach(b => clk(b));
  T.LAB.id = null; go('adv-nn-agent'); const LA = T.LAB.L, AP = LA.sim.P;
  if (btn(/Abuse a tool/).disabled !== true) fail('agent: tool step should wait');
  [/read_email/, /run_shell/, /pay_invoice/].forEach(re => clk(lp(re))); next(/Abuse a tool/);
  if (btn(/Whose goal/).disabled !== true) fail('agent: shell step should wait for an escape and the fix');
  clk(lp(/Break the quotes/)); if (T.axEscaped(AP.query, false) < 3) fail('agent: quote break should escape the quotes'); clk(lp(/Chain a command/));
  clk(doc.querySelector('#app .labdef')); if (!AP.argv || T.axEscaped(AP.query, true) !== 0) fail('agent: argv should leave nothing escaped'); next(/Whose goal/);
  if (btn(/Let it run/).disabled !== true) fail('agent: plan step should wait for the email'); drag(doc.querySelector('#app .labtok')); if (!AP.inj) fail('agent: email not dropped'); next(/Let it run/);
  if (btn(/Close the paths/).disabled !== true) fail('agent: autonomy step should wait for a run');
  range(0); if (AP.pol !== 0) fail('agent: policy slider');
  // play the approval game: approve the first 20 prompts, deny the rest
  clk(btn(/▶ Run/)); for (let k = 0; k < 400 && !AP.g.done; k++) { LA.t += 1; LA.sim.tick(LA, 1); if (AP.g.wait >= 0) clk(btn(AP.g.wait < 20 ? /Approve/ : /Deny/)); }
  { const t = T.axTally(AP.g); if (!AP.g.done || t.asks !== 40 || t.you !== 8 || t.ran !== 8 || t.stopped !== 20) fail('agent: approval game ' + JSON.stringify(t)); }
  range(3); clk(btn(/Run again/)); for (let k = 0; k < 200 && !AP.g.done; k++) { LA.t += 1; LA.sim.tick(LA, 1); }
  if (T.axTally(AP.g).ran !== 28 || AP.g.asks) fail('agent: never-ask should run all 28 harmful actions'); next(/Close the paths/);
  if (btn(/Debrief/).disabled !== true) fail('agent: debrief should wait for a control'); defs(); next(/Debrief/);
  if (!S.nn.agent.done) fail('agent debrief not reached');
  T.LAB.id = null; go('adv-nn-memory'); const MP = T.LAB.L.sim.P;
  clk(lp(/manager/)); clk(lp(/flight/)); next(/Send it some reading/);
  for (let i = 0; i < 2; i++) drag(doc.querySelector('#app .labtok:not(.used)')); if (MP.planted.size !== 2) fail('memory: planted ' + MP.planted.size); next(/Three weeks later/);
  clk(lp(/manager/)); clk(lp(/Which vendor/)); clk(lp(/Northwind/)); if (!MP.derived || MP.poisonedN !== 2) fail('memory: trigger step ' + MP.poisonedN + ' poisoned, derived ' + MP.derived); next(/Your turn/);
  if (btn(/Clean it up/).disabled !== true) fail('memory: hijack step should wait'); clk(lp(/Too vague/)); if (MP.won) fail('memory: a vague memory should not win');
  clk(lp(/Aim at the question/)); if (!MP.won) fail('memory: an aimed memory should win recall'); next(/Clean it up/);
  clk(btn(/Delete the 2/)); clk(lp(/Which vendor/)); if (!MP.reask) fail('memory: re-ask'); next(/Close the paths/);
  defs(); next(/Debrief/); if (!S.nn.memory.done) fail('memory debrief not reached');
  T.LAB.id = null; go('adv-nn-badge'); const BP = T.LAB.L.sim.P;
  if (btn(/A viewer asks/).disabled !== true) fail('badge: forge step should wait'); clk(lp(/Make me an admin/)); if (!BP.forged || T.tkForge(BP.forge).ok) fail('badge: an edited payload should fail the signature'); next(/A viewer asks/);
  clk(btn(/Send request/)); clk(doc.querySelector('#app .labdef')); clk(btn(/Send request/)); next(/A third-party tool/);
  drag(doc.querySelector('#app .labtok')); if (!BP.drops[0] || !BP.drops[0].r.ok) fail('badge: aud * should be accepted');
  clk(doc.querySelector('#app .labdef')); drag(doc.querySelector('#app .labtok')); if (BP.drops[1].r.ok) fail('badge: an audience-bound token should be rejected'); next(/The token leaks/);
  range(50); next(/Climb/);
  for (let i = 0; i < 6; i++) clk(btn(/Next hop/)); if (BP.hops !== 6) fail('badge: hops ' + BP.hops); next(/Close the paths/);
  defs(); next(/Debrief/); if (!S.nn.badge.done) fail('badge debrief not reached');
  T.LAB.id = null; go('adv-nn-impostor'); const IP2 = T.LAB.L.sim.P;
  if (btn(/Lookalike names/).disabled !== true) fail('impostor: the real agent should win at first'); clk(lp(/Copy the real one/)); if (IP2.won) fail('impostor: a copied card ties and loses');
  clk(lp(/Stuff the keywords/)); if (!IP2.won) fail('impostor: stuffing should win routing'); next(/Lookalike names/);
  clk(lp(/payrnent/)); clk(lp(/pаyment/)); next(/Agent-to-agent/);
  clk(doc.querySelector('#app .labdef')); clk(lp(/Attacker sends/)); clk(lp(/Forward with this amount/)); if (IP2.tried.size !== 2) fail('impostor: verified attacks ' + IP2.tried.size); next(/Whose action/);
  clk(doc.querySelector('#app .labdef')); clk(lp(/02:14/)); if (!IP2.found) fail('impostor: attribution'); next(/Close the paths/);
  defs(); next(/Debrief/); if (!S.nn.impostor.done) fail('impostor debrief not reached');
  // every instrument briefs the room and explains every step
  T.NN_SIMS.forEach(x => { if (!x.brief || !x.brief.what || !x.brief.real || x.brief.todo.length !== 3) fail(x.id + ' lacks a briefing');
    T.LAB.id = null; go('adv-nn-' + x.id); const n = T.LAB.L.sim.steps.length; if ((x.guide || []).length !== n) fail(x.id + ' guidance covers ' + (x.guide || []).length + ' of ' + n + ' steps');
    if (!(x.guide || []).every(g2 => g2.why)) fail(x.id + ' has a step with no why-line'); });
  go('adv'); if (doc.body.classList.contains('labmode')) fail('leaving the lab should leave lab mode');
  if (doc.querySelectorAll('#app .nnhero').length !== T.NN_SIMS.length) fail('advanced index lacks the simulation cards');
  go('adv-p250'); if (!doc.querySelector('#app a.nnhero[href="#adv-nn-backdoor"]')) fail('p250 case lacks its simulation link');
  T.NN.sync = false;
  console.log('inside the model: backdoor ' + res.map(([c, m]) => c + '→' + Math.round(m.asr * 100) + '%').join(' ') + ' (' + ms + ' ms); all 15 tray pairs backdoor and get caught; twelve instruments played start to finish; shell split, memory recall, tokens and agent MACs verified; scaling attack, 1% text and JSON parser split verified; injection stack, attention layer and gradient tug of war hold');
}
// Harden NEXUS: every failure gets through at first; play each layer with the right answers
{
  const clk = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const { HARDEN_LAYERS, HD_ATTACKS, hdOutcome } = window.__T;
  const btn = re => [...doc.querySelectorAll('#app .stagebot .btn')].find(b => re.test(b.textContent));
  delete S.harden; go('harden');
  if (doc.querySelectorAll('#app .hdshot').length !== HD_ATTACKS.length) fail('harden console should list every attack');
  if (HD_ATTACKS.some(a => a.kind !== 'benign' && hdOutcome(a) !== 'breach')) fail('harden: with no layers, every failure should get through');
  clk(doc.querySelectorAll('#app .hdshot')[1]); if (!doc.querySelector('#app .hn.hit')) fail('harden console did not show a breach');
  for (const L of HARDEN_LAYERS) {
    go('harden-' + L.id); clk(btn(/Begin/));
    clk(doc.querySelector('#app .hdshot')); if (!doc.querySelector('#app .hdnarr li')) fail('harden ' + L.id + ' simulation ran nothing');
    clk([...doc.querySelectorAll('#app .hdtog button')].find(b => b.textContent === 'Off')); if (!doc.querySelector('#app .hdnarr li.hit')) fail('harden ' + L.id + ' off path shows no breach');
    clk(btn(/Continue/));
    L.qs.forEach((q, qi) => {
      if (q.t === 'mcq') clk(doc.querySelectorAll('#app .card-opt')[q.a]);
      else if (q.t === 'order') { q.s.forEach(t => clk([...doc.querySelectorAll('#app .hdpool .hdstep')].find(b => b.textContent === '+ ' + t))); clk([...doc.querySelectorAll('#app .sc button')].find(b => /Check the order/.test(b.textContent))); }
      else q.rows.forEach((r, ri) => clk(doc.querySelectorAll('#app .hdrow')[ri].querySelectorAll('button')[r[1]]));
      if (!doc.querySelector('#app .consequence.good')) fail('harden ' + L.id + ' drill ' + (qi + 1) + ' not marked right');
      clk(btn(/Continue|Bring the layer online/));
    });
    if (!(S.harden.done[L.id] && S.harden.done[L.id].stars === 3)) fail('harden ' + L.id + ' should finish with 3 stars');
    if (!doc.querySelector('#app .sc-recap')) fail('harden ' + L.id + ' debrief missing');
  }
  const left = HD_ATTACKS.filter(a => a.kind !== 'benign' && hdOutcome(a) !== 'block');
  if (left.length) fail('harden: still getting through with every layer online: ' + left.map(a => a.id).join(', '));
  if (hdOutcome(HD_ATTACKS[0]) !== 'served') fail('harden: the legitimate invoice should be served');
  S.tab.m12 = 'do'; go('m12'); if (!doc.querySelector('#app .hdlink')) fail('Module 12 lab lacks its Harden NEXUS links');
  go(''); if (!doc.querySelector('#app .hdhero')) fail('story home lacks the Harden NEXUS card');
  console.log('harden nexus: ' + HARDEN_LAYERS.length + ' layers played at 3 stars; all ' + (HD_ATTACKS.length - 1) + ' attacks stopped');
}
// story mode: play every episode start to finish
go(''); if (doc.querySelectorAll('#app .ep').length !== 10) fail('season home should list 10 module episodes'); if (!doc.querySelector('#app .nexushero')) fail('NEXUS opening missing on home');
const click = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
for (const ep of window.__T.EPISODES) {
  go(ep.id); let guard = 0;
  while (guard++ < 60) {
    const st = S.story[ep.id]; const sc = ep.scenes[st.i];
    if (sc.type === 'recap') break;
    if (sc.type === 'choice' && st.picks[st.i] == null) click(doc.querySelector('#app .card-opt'));
    if (sc.type === 'spots' && !(st.spots[st.i] || {}).checked) { click(doc.querySelector('#app .spot')); click([...doc.querySelectorAll('#app .stagebot button')].find(b => b.textContent === 'Check')); }
    if (sc.type === 'sort') { let n = 0; while (doc.querySelector('#app .bin') && n++ < 20) click(doc.querySelector('#app .bin')); }
    if (sc.type === 'toggle') click(doc.querySelector('#app .switch'));
    if (sc.type === 'trap' && !(S.traps && S.traps[ep.lab] && S.traps[ep.lab].locked)) { click(doc.querySelector('#app .trapopt')); click([...doc.querySelectorAll('#app .trap button')].find(b => /Lock in/.test(b.textContent))); }
    if (sc.type === 'live') { let n = 0; let b; while ((b = doc.querySelector('#app .sc-live .replies .move')) && n++ < 5) click(b); }
    if (sc.type === 'timeline') { let n = 0; let b; while ((b = [...doc.querySelectorAll('#app .sc-timeline button')].find(x => /Hour|Go live/.test(x.textContent))) && n++ < 10) click(b); }
    const next = [...doc.querySelectorAll('#app .stagebot button')].find(b => /Continue|Begin/.test(b.textContent));
    if (!next || next.disabled) { fail(ep.id + ' stuck on scene ' + st.i + ' (' + sc.type + ')'); break; }
    click(next);
  }
  if (!doc.querySelector('#app .sc-recap') || !S.story[ep.id].finished) fail(ep.id + ' did not reach the recap');
}
go(''); if (!doc.querySelector('#app .repair')) fail('repair board missing after the opening');
// every question in every episode is framed: a story bridge, why it matters, and an explanation once answered
{
  const X = window.__T.STORY_EXTRA; let framed = 0;
  for (const ep of window.__T.EPISODES) ep.scenes.forEach((sc, i) => {
    const x = X[ep.id + ':' + i];
    if (!['choice', 'sort', 'spots', 'toggle', 'timeline', 'live'].includes(sc.type)) { if (x) fail(ep.id + ':' + i + ' extra on a ' + sc.type + ' scene'); return; }
    if (!x || !x.lead || !x.why) { fail(ep.id + ':' + i + ' (' + sc.type + ') has no story bridge or why'); return; }
    if (sc.type !== 'live' && (!x.explain || !x.viz)) fail(ep.id + ':' + i + ' (' + sc.type + ') has no explanation or visual');
    if (x.viz && !['counter', 'clock', 'headline', 'bars', 'feed', 'path'].includes(x.viz.kind)) fail(ep.id + ':' + i + ' unknown visual ' + x.viz.kind);
    framed++;
  });
  S.story.e07.i = 4; go('e07');
  if (!doc.querySelector('#app .leadline') || !doc.querySelector('#app .viz-headline') || !doc.querySelector('#app .whybox')) fail('e07 question frame not rendered');
  if (!doc.querySelector('#app .explainbox')) fail('e07 explanation not shown after answering');
  if (!/Up next/.test(doc.querySelector('#app .stagebot .hint').textContent)) fail('no up-next teaser');
  console.log('story frames: ' + framed + ' questions with a bridge, why it matters, visual and explanation');
  go('');
}
if (doc.querySelectorAll('#app .rpill.ok').length !== 6) fail('all six NEXUS failures should show fixed after every episode');
if (Object.keys(window.__T.TRAPS).length !== 9) fail('expected 9 traps');
console.log('story: ' + window.__T.EPISODES.length + ' episodes played to the end; repair board 6/6');
const scen = window.__T.SCENARIOS;
const nScen = Object.values(scen).reduce((n, l) => n + l.length, 0);
if (nScen !== 34) fail('expected 34 deck scenarios, got ' + nScen);
for (const [mod, list] of Object.entries(scen)) { if (!App.byId[mod]) fail('scenarios for unknown lab ' + mod); list.forEach(sc => { if (sc.q.length !== 3 || !sc.notes) fail(mod + ' ' + sc.id + ' incomplete'); }); }
const disc = window.__T.DISCUSSIONS; if (Object.keys(disc).length !== 9) fail('expected 9 leadership discussions');
const nDrill = App.labs.reduce((n, l) => n + (l.drills || []).reduce((m, d) => m + d.items.length, 0), 0);
console.log('coverage: ' + nScen + ' scenarios · ' + App.labs.reduce((n, l) => n + (l.drills || []).length, 0) + ' drills · ' + nDrill + ' drill items');
const bad = errors.filter(Boolean);
if (bad.length) { bad.slice(0, 10).forEach(e => console.error('ERROR ' + e)); process.exitCode = 1; }
console.log(process.exitCode ? 'smoke FAILED' : 'smoke ok');
window.close();
process.exit(process.exitCode || 0);
