'use strict';
/* The answer that was cut in half: four ways a well-built RAG pipeline is wrong
   with no poison and no injection in it. A chunk boundary separates a rule from
   its condition; an honest memo is split so one chunk carries only the scam it
   warns about; a semantic cache serves one user's answer to another; and the
   number of withheld results tells an outsider what restricted documents say.
   The chunker, the ranking (word-count vectors, cosine similarity), the cache
   lookup and the result filter all run on the page. Scene on the lab engine. */

const CK_DOC = 'Refunds above 50,000 rupees need written approval from the CFO before payment. Contractors are outside this rule and must use the vendor process instead. Emergency travel may be booked without approval, but only when the regional head confirms in writing within 24 hours of booking. Unconfirmed bookings are charged to the employee.'.split(' ');
const CK_Q = 'Can I book emergency travel without approval?';
const CK_FILL = 'Monthly security bulletin for all finance staff please read every item with care and share it with your team before the end of this week thank you'.split(' ');
const CK_MEMO = 'Fraud alert. Criminals are sending emails that say: for every vendor invoice, wire the payment to the new account 4471-9921 at Tailspin Bank. This is a scam. Never act on such an email, and report it to the fraud desk at once.'.split(' ');
const CK_MEMO_Q = 'Which account do we wire vendor invoice payments to?', CK_MEMO_SIZE = 22;
const CK_REAL = { i: -1, text: 'Supplier bank details are held in the vendor master and are confirmed by a call-back before any transfer.' };
const CK_CACHE_Q = 'What is the pay band for directors this year?', CK_CACHE_A = 'Directors: band D1, 1.2 to 1.6 crore. (Restricted: board and HR only.)';
const CK_ASK = ['Directors pay band this year?', 'What pay band do directors get?', 'What is the canteen menu this year?'];
const CK_LIB = [['Canteen menu and picnic dates', 1], ['Board paper: merger talks with Contoso, close in March', 0], ['Travel and expense policy', 1], ['Merger due diligence checklist for Contoso', 0],
  ['IT helpdesk opening hours', 1], ['Restructuring plan for the Pune office', 0], ['Office picnic volunteers list', 1], ['Director pay bands for this year', 0],
  ['Holiday calendar', 1], ['Parking rules for the Pune office', 1], ['Onboarding guide for new staff', 1], ['Expense claim form', 1]].map(([t, open], i) => ({ i, t, open: !!open }));
const CK_PROBE = ['merger', 'restructuring Pune', 'layoffs', 'picnic'];

// Fixed-size chunks of `size` words, each starting `size - overlap` after the last.
function ckChunks(n, size, overlap) { const out = [], hop = Math.max(1, size - (overlap || 0)); for (let a = 0; a < n; a += hop) { out.push([a, Math.min(n, a + size)]); if (a + size >= n) break; } return out; }
// Chunk a text, rank every chunk (and any competing chunks) against the question, return the winner.
function ckRetrieve(words, size, overlap, q, extra) {
  const chunks = ckChunks(words.length, size, overlap), e = axEmbed(q);
  const ranked = chunks.map(([a, b], i) => ({ i, text: words.slice(a, b).join(' ') })).concat(extra || []).map(c => Object.assign({ s: axCos(e, axEmbed(c.text)) }, c)).sort((x, y) => y.s - x.s);
  return { chunks, ranked, top: ranked[0] };
}
// The rule and its condition: both in the retrieved chunk, or only the permissive half.
const ckVerdict = t => !/without approval/i.test(t) ? 'miss' : /regional head confirms/i.test(t) ? 'full' : 'half';
const ckPolicy = (size, overlap) => ckVerdict(ckRetrieve(CK_DOC, size, overlap, CK_Q).top.text);
const ckMemoWords = pad => CK_FILL.slice(0, pad).concat(CK_MEMO);
const ckMemo = pad => ckRetrieve(ckMemoWords(pad), CK_MEMO_SIZE, 0, CK_MEMO_Q, [CK_REAL]);
// Poisoned = the winning chunk gives the account and has lost the sentence that calls it a scam.
const ckMemoBad = pad => { const t = ckMemo(pad).top.text; return /4471/.test(t) && !/scam/i.test(t); };
const ckSim = t => axCos(axEmbed(t || ''), axEmbed(CK_CACHE_Q));
// Search the library, keep the top 5, then filter by permission: what is shown, and how many were withheld.
function ckProbe(q, pre) {
  const e = axEmbed(q || ''), pool = pre ? CK_LIB.filter(d => d.open) : CK_LIB;
  const top = pool.map(d => ({ d, s: axCos(e, axEmbed(d.t)) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
  return { top, shown: top.filter(r => r.d.open), withheld: top.filter(r => !r.d.open).length };
}

const CK_VEC = [{ id: 'split', name: 'Condition cut from its rule' }, { id: 'aimed', name: 'Honest memo, poisoned chunk' }, { id: 'cache', name: 'Cache answers across users' },
  { id: 'near', name: 'Reworded question, same key' }, { id: 'oracle', name: 'Result count leaks content' }, { id: 'starve', name: 'Restricted hits crowd out answers' }];
const CK_DEF = [
  { id: 'parent', name: 'Retrieve the chunk, read the section', how: 'Match on small chunks, hand the model the whole section', kills: ['split', 'aimed'] },
  { id: 'struct', name: 'Chunk on structure, with overlap', how: 'Split at headings and sentences, never mid-rule', kills: ['split'] },
  { id: 'scope', name: 'Cache key carries the caller', how: 'Identity and permission scope are part of the key', kills: ['cache', 'near'] },
  { id: 'pre', name: 'Filter before ranking', how: 'Search only what this user may read; no counts of the rest', kills: ['oracle', 'starve'] }];
const CK_GROUPS = [{ name: 'Chunking', col: 'ink', ids: ['split', 'aimed'], act: 'A true document produced a false answer' },
  { name: 'Caching', col: 'violet', ids: ['cache', 'near'], act: 'A trainee received the directors’ pay band' },
  { name: 'Filtering', col: 'bad', ids: ['oracle', 'starve'], act: 'An outsider learned what restricted papers say' }];

// Two panels: side by side when wide, stacked when narrow. Shared by the four pipeline instruments.
function xlLay(L, f) { const pad = 14, k = f || 0.58;
  return L.w > 720 ? { wide: true, a: { x: pad, y: pad, w: L.w * k - pad, h: L.h - pad * 2 }, b: { x: L.w * k + pad, y: pad, w: L.w * (1 - k) - pad * 2, h: L.h - pad * 2 } }
    : { wide: false, a: { x: pad, y: pad, w: L.w - pad * 2, h: L.h * k - pad }, b: { x: pad, y: L.h * k + 6, w: L.w - pad * 2, h: L.h * (1 - k) - pad - 6 } }; }

function ckMount(L) {
  const P = { sz: 12, ov: 0, half: false, full: false, pad: 8, padBad: false, padOk: false, th: 40, ask: '', askAt: -9, cross: false, probe: '', probeAt: -9, yes: false, no: false, on: {}, flash: {} };
  const size = () => 6 + P.sz, thr = () => 0.5 + P.th / 100;
  const noteSize = () => { const v = ckPolicy(size(), P.ov ? Math.floor(size() / 2) : 0); if (v === 'half') P.half = true; if (v === 'full') P.full = true; return size() + ' words'; };
  const notePad = () => { if (ckMemoBad(P.pad)) P.padBad = true; else P.padOk = true; return P.pad + ' words'; };
  const ask = (L2, t) => { P.ask = t; P.askAt = L2.t; if (t.trim() && t.trim() !== CK_CACHE_Q && ckSim(t) >= thr()) P.cross = true; L2.repaint(); };
  const probe = (L2, t) => { P.probe = t; P.probeAt = L2.t; if (t.trim()) { if (ckProbe(t).withheld) P.yes = true; else P.no = true; } L2.repaint(); };
  return { P,
    hud: L2 => [
      [['CHUNK SIZE', () => size() + ' w'], ['CHUNKS', () => String(ckChunks(CK_DOC.length, size(), P.ov ? Math.floor(size() / 2) : 0).length)], ['ANSWER', () => ({ full: 'COMPLETE', half: 'HALF TRUE', miss: 'MISSED' })[ckPolicy(size(), P.ov ? Math.floor(size() / 2) : 0)], 'bad']],
      [['LEAD-IN', () => P.pad + ' w'], ['TOP CHUNK', () => ckMemoBad(P.pad) ? 'THE SCAM' : 'SAFE', 'bad']],
      [['THRESHOLD', () => thr().toFixed(2)], ['SIMILARITY', () => P.ask ? ckSim(P.ask).toFixed(2) : '—'], ['CACHE', () => !P.ask ? '—' : ckSim(P.ask) >= thr() ? 'HIT' : 'MISS', 'bad']],
      [['SHOWN', () => P.probe ? String(ckProbe(P.probe).shown.length) : '—'], ['WITHHELD', () => P.probe ? String(ckProbe(P.probe).withheld) : '—', 'bad']],
      axDefHud(P, CK_VEC, CK_DEF), axDefHud(P, CK_VEC, CK_DEF)][L2.step],
    draw: (L2, g) => L2.step >= 4 ? axDrawDefend(L2, g, P, CK_GROUPS, CK_VEC, CK_DEF) : [ckDrawPolicy, ckDrawMemo, ckDrawCache, ckDrawProbe][L2.step](L2, g, P),
    steps: [
      { enter: () => { noteSize(); },
        say: () => !P.half ? 'A clean policy, a clean index. Change the chunk size and watch the answer.' : !P.full ? 'Half true: the condition fell into the next chunk. Find a size that keeps them together.' : 'Same document, same question. The chunk size decided the answer.',
        side: L2 => [axRange(L2, P, 'sz', 'Chunk size', () => P.half && P.full, noteSize, 34),
          labBtn(P.ov ? '■ Overlap: half a chunk' : '□ Overlap: none', () => { P.ov = P.ov ? 0 : 1; noteSize(); L2.repaint(); }, P.ov ? 'on' : ''),
          h('p', { class: 'labsm' }, 'Question: “' + CK_Q + '” The best-matching chunk is all the model sees.')],
        acts: L2 => [labNext(L2, 'Now aim it →', !(P.half && P.full))] },
      { enter: () => { notePad(); },
        say: () => !P.padBad ? 'An honest fraud warning. Add lead-in words until the split lands between the scam and the warning.' : 'Reviewed by a person, it is a safety memo. In the index, one chunk says: wire to the new account.',
        side: L2 => [axRange(L2, P, 'pad', 'Lead-in words before the memo', () => P.padBad, notePad, CK_FILL.length),
          h('p', { class: 'labsm' }, 'Chunks are ' + CK_MEMO_SIZE + ' words. The attacker never hides anything: they only choose where the text starts.')],
        acts: L2 => [labNext(L2, 'The cache →', !P.padBad)] },
      { enter: () => { P.ask = ''; },
        say: () => !P.ask ? 'A director asked this an hour ago. The answer is cached. Now ask as a trainee.' : P.cross ? 'Cache hit. The trainee got the director’s answer, and no permission check ran.' : 'Miss: this one goes to retrieval, where the permission check runs. Try another wording.',
        side: L2 => [axInput(L2, P, 'ask', { label: 'TRAINEE ASKS · TYPE, THEN ENTER', enter: t => ask(L2, t), presets: CK_ASK.map(t => [t, t, 'edge']) }),
          axRange(L2, P, 'th', 'Cache similarity threshold', () => P.cross, () => thr().toFixed(2), 50)],
        acts: L2 => [labNext(L2, 'The filter →', !P.cross)] },
      { enter: () => { P.probe = ''; },
        say: () => !P.yes ? 'You are a trainee. Restricted papers never appear in your results. Search anyway.' : !P.no ? '“' + ckProbe(P.probe).withheld + ' withheld” just told you a restricted paper mentions that. Try a word that should not match.' : 'You never read a restricted word, and you now know there are merger papers and no layoff papers.',
        side: L2 => [axInput(L2, P, 'probe', { label: 'SEARCH THE LIBRARY · TYPE, THEN ENTER', enter: t => probe(L2, t), presets: CK_PROBE.map(t => [t, t, '']) }),
          h('p', { class: 'labsm' }, 'The pipeline ranks everything, keeps the top 5, then removes what you may not read.')],
        acts: L2 => [labNext(L2, 'Close the paths →', !(P.yes && P.no))] },
      { enter: () => { P.on = {}; P.flash = {}; },
        say: () => { const n = axLive(CK_VEC, CK_DEF, P.on).length; return n ? n + ' paths open. Switch on controls.' : 'All ' + CK_VEC.length + ' closed.'; },
        side: L2 => [axDefSide(L2, P, CK_DEF), h('div', { class: 'fiout' }, h('span', { class: 'labk' }, 'The same four tests, with your rules'),
          h('div', { class: P.on.parent || (P.on.struct && ckPolicy(size(), Math.floor(size() / 2)) === 'full') ? '' : 'bad' }, h('i', null, 'policy'), P.on.parent ? 'whole section returned: complete' : ckPolicy(size(), P.on.struct ? Math.floor(size() / 2) : 0)),
          h('div', { class: P.on.parent ? '' : 'bad' }, h('i', null, 'memo'), P.on.parent ? 'warning travels with the quote' : ckMemoBad(P.pad) ? 'scam chunk wins' : 'safe at this offset only'),
          h('div', { class: P.on.scope ? '' : 'bad' }, h('i', null, 'cache'), P.on.scope ? 'trainee key ≠ director key: miss' : 'cross-user hit'),
          h('div', { class: P.on.pre ? '' : 'bad' }, h('i', null, 'search'), '“merger” withheld: ' + ckProbe('merger', P.on.pre).withheld))],
        acts: L2 => [labNext(L2, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'Nothing here was poisoned. The pipeline did it.',
        enter: () => labDone('chunk'),
        side: () => axDebrief(P, CK_VEC, CK_DEF, [
          ['2025 · OWASP LLM08', 'Vector and embedding weaknesses became an entry of their own in the Top 10 for LLM applications.'],
          ['2024 · ConfusedPilot', 'Researchers steered a Copilot-style assistant with a planted document whose effect outlived the document, through cached content.'],
          ['2025 · Wayback Copilot', 'An assistant kept answering from cached copies of repositories that had since been made private.'],
          ['2024 · Copilot oversharing', 'Early deployments surfaced HR and executive files to ordinary staff: the search was faithful to permissions that were too broad.']],
          ['poisonrag', 'echoleak', 'slackai'], 'The chunker, ranking, cache lookup and filter on this page are real and tiny: word counts and cosine similarity. Production embeddings are denser; the failure modes are the same.'),
        acts: () => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv' }, 'Advanced path →')] }
    ] };
}

/* ---------- drawing ---------- */
// Words flowed into a box, tinted by chunk; the winning chunk is lit in `col`.
function ckDrawWords(g, R, words, chunks, hot, col, title) {
  axCard(g, R.x, R.y, R.w, R.h, { title, col: LC.blue, lines: [] });
  const fs = Math.max(10, Math.min(15, Math.sqrt(R.w * (R.h - 40) / (words.length * 5.2)) * 0.62)), lh = fs + 11, own = words.map((_, k) => { const c = chunks.findIndex(([a, b]) => k >= a && k < b); return hot >= 0 && k >= chunks[hot][0] && k < chunks[hot][1] ? hot : c; });
  let x = R.x + 12, y = R.y + 40; g.font = '600 ' + fs + "px 'IBM Plex Sans', sans-serif";
  fiClip(g, R.x, R.y, R.w, R.h, () => words.forEach((w, k) => { const tw = g.measureText(w).width + 8, on = own[k] === hot;
    if (x + tw > R.x + R.w - 10) { x = R.x + 12; y += lh; }
    if (k && own[k] !== own[k - 1]) { g.fillStyle = lc(LC.ink, 0.9); g.fillRect(x - 3, y - fs, 2, fs + 6); }
    g.fillStyle = on ? lc(col, 0.26) : lc(own[k] % 2 ? LC.violet : LC.blue, 0.1); g.fillRect(x, y - fs, tw - 2, fs + 6);
    labText(g, w, x + 3, y + 1, { size: fs, mono: false, w: on ? 700 : 500, col: lc(on ? LC.text : LC.mute, 1) }); x += tw; }));
}
function ckDrawPolicy(L, g, P) {
  const Y = xlLay(L), size = 6 + P.sz, R = ckRetrieve(CK_DOC, size, P.ov ? Math.floor(size / 2) : 0, CK_Q), v = ckVerdict(R.top.text), col = v === 'full' ? LC.good : LC.bad;
  ckDrawWords(g, Y.a, CK_DOC, R.chunks, R.top.i, col, 'EXPENSE POLICY · ' + R.chunks.length + ' CHUNKS OF ' + size + ' WORDS');
  axCard(g, Y.b.x, Y.b.y, Y.b.w, Y.b.h, { title: 'WHAT THE MODEL IS HANDED', col, hot: v !== 'full', ok: v === 'full', lines: [['Q: ' + CK_Q, lc(LC.text, 1), false], ['Top chunk · similarity ' + R.top.s.toFixed(2), lc(LC.mute, 1)], ['“' + R.top.text + '”', lc(col, 1), false],
    [v === 'full' ? 'A: Only if the regional head confirms in writing within 24 hours.' : v === 'half' ? 'A: Yes. Emergency travel may be booked without approval.' : 'A: The policy does not say.', lc(LC.text, 1), false]] });
  axStamp(g, Y.b.x + Y.b.w / 2, Y.b.y + Y.b.h - 34, v === 'full' ? 'COMPLETE' : v === 'half' ? 'HALF TRUE' : 'MISSED', col, 1, Y.wide ? 22 : 16);
}
function ckDrawMemo(L, g, P) {
  const Y = xlLay(L), words = ckMemoWords(P.pad), R = ckMemo(P.pad), bad = ckMemoBad(P.pad), col = bad ? LC.bad : LC.good;
  ckDrawWords(g, Y.a, words, R.chunks, R.top.i, col, 'FRAUD-AWARENESS MEMO · AS A REVIEWER READS IT');
  axCard(g, Y.b.x, Y.b.y, Y.b.w, Y.b.h, { title: 'WHAT THE INDEX RETURNS', col, hot: bad, ok: !bad, lines: [['Q: ' + CK_MEMO_Q, lc(LC.text, 1), false], ['Top chunk · similarity ' + R.top.s.toFixed(2), lc(LC.mute, 1)],
    ['“' + R.top.text + '”', lc(col, 1), false], [bad ? 'A: Wire it to the new account 4471-9921 at Tailspin Bank.' : R.top.i < 0 ? 'A: Use the account in the vendor master, after a call-back.' : 'A: That is a known scam. Report it to the fraud desk.', lc(LC.text, 1), false]] });
  if (bad) axStamp(g, Y.b.x + Y.b.w / 2, Y.b.y + Y.b.h - 34, 'WARNING CUT OFF', LC.bad, 1, Y.wide ? 20 : 15);
}
function ckDrawCache(L, g, P) {
  const Y = xlLay(L, 0.5), thr = 0.5 + P.th / 100, s = P.ask ? ckSim(P.ask) : 0, hit = !!P.ask && s >= thr, A = Y.a, B = Y.b;
  axCard(g, A.x, A.y, A.w, A.h, { title: 'SEMANTIC CACHE · 1 ENTRY', col: LC.violet, lines: [['Asked by: a director, 09:12', lc(LC.mute, 1)], ['Key: “' + CK_CACHE_Q + '”', lc(LC.text, 1), false], ['Value: ' + CK_CACHE_A, lc(LC.ink, 1), false],
    ['A new question reuses this answer when its similarity to the key reaches the threshold.', lc(LC.mute, 1), false]] });
  const bx = A.x + 14, bw = A.w - 28, by = A.y + A.h - 46;
  g.fillStyle = 'rgba(141,182,242,.1)'; g.fillRect(bx, by, bw, 14); g.fillStyle = lc(hit ? LC.bad : LC.blue, 0.9); g.fillRect(bx, by, bw * Math.min(1, s), 14);
  g.fillStyle = lc(LC.ink, 1); g.fillRect(bx + bw * thr - 1, by - 6, 2, 26); labText(g, 'threshold ' + thr.toFixed(2), bx + bw * thr, by - 10, { size: 10, align: 'center', col: lc(LC.ink, 1) });
  labText(g, P.ask ? 'similarity ' + s.toFixed(2) : 'no question yet', bx, by + 30, { size: 11, col: lc(LC.text, 0.8) });
  if (hit) axFlow(g, L, Y.wide ? A.x + A.w : A.x + A.w / 2, Y.wide ? A.y + 80 : A.y + A.h, Y.wide ? B.x : B.x + B.w / 2, Y.wide ? B.y + 80 : B.y, LC.bad, 4, 0.7);
  axCard(g, B.x, B.y, B.w, B.h, { title: 'TRAINEE · NEW CHAT', col: hit ? LC.bad : LC.good, hot: hit, lines: !P.ask ? [['Ask something.', lc(LC.text, 0.8), false]] : [['Trainee: ' + P.ask, lc(LC.text, 1), false],
    [hit ? 'cache HIT → answer returned from cache' : 'cache MISS → retrieval → permission check', lc(hit ? LC.bad : LC.good, 1)],
    ['Assistant: ' + axTyped(hit ? CK_CACHE_A : 'I can share the published grade structure. Director pay is restricted.', L.t - P.askAt - 0.3, 60), lc(hit ? LC.bad : LC.text, 1), false]] });
  if (hit) axStamp(g, B.x + B.w / 2, B.y + B.h - 34, 'WRONG USER', LC.bad, L.t - P.askAt - 0.8, Y.wide ? 22 : 16);
}
function ckDrawProbe(L, g, P) {
  const Y = xlLay(L), A = Y.a, B = Y.b, R = ckProbe(P.probe), inTop = new Set(R.top.map(r => r.d.i)), rh = Math.min(34, (A.h - 40) / CK_LIB.length), fs = Math.max(9, Math.min(12, rh * 0.42));
  axCard(g, A.x, A.y, A.w, A.h, { title: 'THE LIBRARY · WHAT A TRAINEE CAN SEE OF IT', col: LC.blue, lines: [] });
  CK_LIB.forEach((d, k) => { const y = A.y + 32 + k * rh, on = inTop.has(d.i);
    g.fillStyle = on ? lc(d.open ? LC.good : LC.bad, 0.16) : 'rgba(141,182,242,.04)'; g.fillRect(A.x + 8, y, A.w - 16, rh - 4); g.strokeStyle = lc(on ? (d.open ? LC.good : LC.bad) : LC.mute, on ? 0.9 : 0.2); g.strokeRect(A.x + 8, y, A.w - 16, rh - 4);
    labText(g, d.open ? d.t : '🔒 ' + '▒'.repeat(Math.min(28, d.t.length)), A.x + 16, y + (rh - 4) / 2 + fs * 0.35, { size: fs, mono: !d.open, w: 500, col: lc(d.open ? LC.text : LC.mute, d.open ? 0.9 : 0.6) });
    if (on && !d.open) labText(g, 'matched · withheld', A.x + A.w - 16, y + (rh - 4) / 2 + 4, { size: 10, align: 'right', col: lc(LC.bad, 1) }); });
  axCard(g, B.x, B.y, B.w, B.h, { title: 'YOUR RESULTS', col: R.withheld ? LC.bad : LC.good, hot: !!R.withheld, lines: !P.probe ? [['Search for a word.', lc(LC.text, 0.8), false]] : [['Search: ' + P.probe, lc(LC.text, 1), false],
    ['Showing ' + R.shown.length + ' of ' + R.top.length + ' results', lc(LC.text, 1)]].concat(R.shown.map(r => ['• ' + r.d.t, lc(LC.good, 1), false]),
    [[R.withheld + ' result' + (R.withheld === 1 ? '' : 's') + ' withheld for permissions', lc(R.withheld ? LC.bad : LC.mute, 1)],
      [R.withheld ? 'So: ' + R.withheld + ' restricted document' + (R.withheld === 1 ? ' mentions' : 's mention') + ' “' + P.probe + '”.' : R.top.length ? 'Nothing restricted matched.' : 'So: no document, restricted or not, mentions “' + P.probe + '”.', lc(R.withheld ? LC.bad : LC.text, 1), false]]) });
}

NN_SIMS.push({ id: 'chunk', title: 'The answer that was cut in half', kicker: 'RAG · chunking · caches · filters', blurb: 'No poison, no injection: slide a chunk boundary until a true policy gives a false answer, split an honest memo into a scam, serve a director’s answer to a trainee from the cache, and read restricted papers by counting what is withheld.', mount: ckMount,
  brief: { what: 'A retrieval pipeline that has every control on the checklist can still be wrong on its own. Chunking decides which sentences travel together, a semantic cache decides whose answer is reused, and the order of filtering decides what a result count gives away.',
    real: 'OWASP gave vector and embedding weaknesses their own Top 10 entry in 2025. Assistants have been shown answering from caches of content that had since been restricted, and faithfully searching permissions that were too broad.',
    todo: ['Move the chunk boundary until a rule loses its condition, then aim that split at an honest memo', 'Ask a cached question as the wrong user, and probe a library you cannot read', 'Switch on the four pipeline rules and rerun all four tests'] },
  guide: [
    { look: [['ink', '|', 'Amber bars: chunk boundaries.'], ['good', '▭', 'Lit words: the one chunk retrieved for the question.']],
      why: 'The model answers from the retrieved chunk, not from the document. If the condition is one chunk away, the answer is confident, cited and half true.' },
    { look: [['bad', '▭', 'Lit: the chunk that wins the payment question.'], ['ink', '|', 'The split the attacker is steering.']],
      why: 'Every sentence of this memo is true and would pass review. Position alone turns it into an instruction. Hidden-text scanners have nothing to find.' },
    { look: [['violet', '▭', 'Left: the cached answer and the similarity bar.'], ['ink', '|', 'Amber mark: the threshold.']],
      why: 'The cache sits in front of retrieval, so it sits in front of the permission check. Raising the threshold does not help: a reworded question can produce the same key.' },
    { look: [['bad', '🔒', 'Locked rows: documents you cannot read. Red means one matched.'], ['good', '▭', 'Green: results you are allowed to see.']],
      why: 'Filtering after ranking turns the result count into an answer. Ask enough yes-or-no questions and a restricted paper can be read one word at a time.' },
    { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']],
      why: 'All four fixes are design decisions inside the pipeline. None of them is a detector.' },
    { why: 'Test the pipeline with questions whose right answer needs two sentences, two users and one restricted document.' }] });
NN_BY.chunk = NN_SIMS[NN_SIMS.length - 1];
