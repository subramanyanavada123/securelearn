'use strict';
/* Inside inference: one request travelling the serving pipeline, stage by
   stage — tokeniser, the shared GPU batch, the KV cache, the sampler, the
   streamed response — with the security issue that lives at each stage and the
   control that addresses it. Visual and interaction first; the numbers are
   illustrative, set to match published behaviour, not measurements of a
   product. Scene runs on the lab engine (lab.js). */

// The pipeline, left to right. Each stage owns one security issue.
const IN_STAGES = [
  { id: 'tok', name: 'Tokeniser', sub: 'text → token ids', issue: 'Prompt is data and instructions in one stream',
    look: 'The request becomes a flat list of token ids. Nothing in it marks which tokens are your rules and which are the user’s, or untrusted, text.',
    control: 'Keep untrusted spans marked through the stack; never let retrieved or tool text enter the same trust band as the system prompt.' },
  { id: 'batch', name: 'GPU batch', sub: 'many tenants, one pass', issue: 'Tenants share hardware',
    look: 'To be efficient, requests from different customers ride in one batch on one GPU. The maths is isolated; the timing and the memory around it are shared.',
    control: 'Pin a tenant boundary: separate pools for sensitive workloads, zeroed buffers between requests, no cross-request batching for regulated data.' },
  { id: 'cache', name: 'KV cache', sub: 'reuse the prefix', issue: 'A shared cache leaks across requests',
    look: 'The model caches the keys and values for prompt prefixes so a repeat is faster. If that cache is shared, a hit means someone else sent the same prefix — and the time difference is measurable.',
    control: 'Scope the prefix cache per tenant, or salt it. If a global cache is kept for cost, accept that it reveals prefix hits and keep secrets out of prefixes.' },
  { id: 'sampler', name: 'Sampler', sub: 'logits → next token', issue: 'Confidence is observable',
    look: 'The sampler turns the model’s scores into one token. The full score vector — every token’s probability — is far more than the answer, and exposing it hands out a high-fidelity copy of the model’s behaviour.',
    control: 'Return the chosen text, not raw logits or full logprob vectors. Rate-limit and watch for query patterns that systematically map the output distribution.' },
  { id: 'stream', name: 'Response stream', sub: 'token by token', issue: 'Every token is a timing beacon',
    look: 'Tokens are streamed as they are produced. The count, the sizes and the gaps between them are visible on the wire even when the text is encrypted, and they track the length and shape of the answer.',
    control: 'Pad or batch streamed chunks for sensitive routes; put output filtering before the first token leaves, not after the stream has started.' }];
const IN_BY = Object.fromEntries(IN_STAGES.map((s, i) => [s.id, Object.assign({ i }, s)]));

// Four requests sharing the serving path. tenantSecret marks the one whose prefix is sensitive.
const IN_REQS = [
  { id: 'a', who: 'Tenant A · you', col: 'blue', toks: 9, secret: true, prefix: 'SYSTEM: Acme payroll assistant. Secret key sk-7f…' },
  { id: 'b', who: 'Tenant B', col: 'violet', toks: 6, prefix: 'Summarise this ticket' },
  { id: 'c', who: 'Attacker', col: 'bad', toks: 9, probe: true, prefix: 'SYSTEM: Acme payroll assistant. Secret key sk-7f…' },
  { id: 'd', who: 'Tenant D', col: 'good', toks: 4, prefix: 'Translate to Hindi' }];

// Controls the defender can switch on. Each neutralises issues at one or more stages.
const IN_DEF = [
  { id: 'mark', name: 'Trust-marked tokens', how: 'Untrusted spans stay flagged end to end', fix: ['tok'] },
  { id: 'pool', name: 'Per-tenant GPU pools', how: 'No cross-tenant batching for sensitive routes', fix: ['batch'] },
  { id: 'salt', name: 'Per-tenant cache scope', how: 'Prefix cache keyed by tenant', fix: ['cache'] },
  { id: 'logit', name: 'No raw logits / logprobs', how: 'Return text; rate-limit probing', fix: ['sampler'] },
  { id: 'pad', name: 'Padded output chunks', how: 'Fixed-size streamed chunks on sensitive routes', fix: ['stream'] },
  { id: 'budget', name: 'Per-caller token budget', how: 'Cap tokens/minute; price the abuse out', fix: ['stream', 'sampler'] }];
const inLive = on => IN_STAGES.filter(s => !IN_DEF.some(d => on[d.id] && d.fix.includes(s.id)));

/* ---------- geometry ---------- */
function inLay(L) {
  const wide = L.w > 600, n = IN_STAGES.length;
  if (wide) { const m = 70, gap = (L.w - m * 2) / n, y = L.h * 0.5; return { wide, y, nodes: IN_STAGES.map((s, i) => ({ x: m + gap * (i + 0.5), y })), r: Math.min(46, gap * 0.34), x0: m - 10, x1: L.w - m + 10 }; }
  const m = 16, gap = (L.h - m * 2) / n, x = 34; return { wide, x, nodes: IN_STAGES.map((s, i) => ({ x, y: m + gap * (i + 0.5) })), r: Math.min(18, gap * 0.4), y0: m, y1: L.h - m, col: L.w * 0.52 };
}
const inReqY = (L, L2, i) => L2.wide ? L.h * (0.16 + i * 0.1) : 0;

function inMount(L) {
  const P = { sel: 'tok', on: {}, flow: null, hits: {}, probe: 0, pad: false, revealed: new Set(), lane: {} };
  const stageOpen = id => inLive(P.on).some(s => s.id === id);
  const fire = L => { P.flow = { t0: L.t, u: 0 }; IN_REQS.forEach((r, i) => { P.lane[r.id] = i; }); L.repaint(); };
  const sim = { P,
    hud: L => inHud(L, P),
    draw: (L, g) => [inDrawPipe, inDrawBatch, inDrawCache, inDrawSampler, inDrawStream, inDrawDefend, inDrawDefend][L.step](L, g, P),
    down: (L, x, y) => inDown(L, P, x, y),
    tick: (L) => { if (P.flow && !NN.sync) { P.flow.u = Math.min(1, (L.t - P.flow.t0) * 0.5); } },
    steps: [
      { say: () => P.revealed.size < IN_STAGES.length ? 'One request, five stages. Tap each to open it.' : 'Five stages. Each hands out something the answer never says.',
        side: L => inStageSide(L, P),
        acts: L => [labNext(L, 'Share the GPU →', P.revealed.size < IN_STAGES.length)] },
      { say: () => P.flow ? 'Four tenants, one batch. Isolated maths, shared timing.' : 'Four requests arrive at once. Send them through together.',
        enter: () => { P.flow = null; },
        side: L => [inDefOne(L, P, 'pool'), inReqList(P)],
        acts: L => [labBtn(P.flow ? '▶ Again' : '▶ Send batch', () => fire(L), 'go'), labNext(L, 'The cache →')] },
      { say: () => P.hits.c ? 'Cache hit. The attacker’s prefix matched tenant A’s — and it returned faster.' : 'The attacker replays tenant A’s prefix. Watch the cache.',
        enter: () => { P.hits = {}; },
        side: L => [inDefOne(L, P, 'salt'), inCacheSide(L, P)],
        acts: L => [labBtn('▶ Replay prefix', () => { P.hits = stageOpen('cache') ? { c: 'hit' } : { c: 'miss' }; L.repaint(); }, 'go'), labNext(L, 'The sampler →')] },
      { say: () => P.probe < 1 ? 'The sampler picks one token. Ask for the whole score vector instead.' : !stageOpen('sampler') ? 'Blocked. You get the text, not the distribution.' : 'Every token’s probability, every query. That is the model, copied.',
        side: L => [inDefOne(L, P, 'logit'), inSamplerSide(L, P)],
        acts: L => [labBtn('▶ Request logprobs', () => { P.probe = 1; L.repaint(); }, 'go'), labNext(L, 'The stream →')] },
      { say: () => P.pad ? (!stageOpen('stream') ? 'Padded. Equal chunks: the lengths no longer leak.' : 'Still leaking: the chunk sizes trace the hidden answer.') : 'Encrypted, but each token is a blip on the wire. Record them.',
        side: L => [inDefOne(L, P, 'pad'), inStreamSide(L, P)],
        acts: L => [labBtn('▶ Record the wire', () => { P.pad = true; L.repaint(); }, 'go'), labNext(L, 'Harden it →')] },
      { say: () => { const n = inLive(P.on).length; return n ? n + ' stages still leak. Switch on controls.' : 'All five stages covered. Each took a serving-layer control.'; },
        enter: () => { P.on = {}; P.flash = {}; },
        side: L => [h('div', { class: 'labstack' }, IN_DEF.map(d => h('button', { type: 'button', class: 'labdef' + (P.on[d.id] ? ' on' : ''), 'aria-pressed': String(!!P.on[d.id]),
          onclick: () => { P.on[d.id] = !P.on[d.id]; if (P.on[d.id]) { P.flash = P.flash || {}; d.fix.forEach(k => { P.flash[k] = L.t; }); } L.repaint(); } }, h('i', null, '■'), h('b', null, d.name), h('small', null, d.how))))],
        acts: L => [labNext(L, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'The answer is safe. Everything around it — timing, cache, confidence, length — is the attack surface.',
        enter: () => labDone('infer'),
        side: () => { const closed = IN_STAGES.length - inLive(P.on).length;
          return [h('div', { class: 'labdebrief' }, labStat(String(IN_STAGES.length), 'side channels'), labStat('0', 'in the answer text', 'good'),
            labStat(closed + '/' + IN_STAGES.length, 'your controls closed', closed === IN_STAGES.length ? 'good' : 'bad'), labStat(String(IN_DEF.length), 'serving-layer controls')),
            h('p', { class: 'labsm' }, 'Timing, batch and cache behaviour here are illustrative, set to match published side-channel results, not measurements of any product.'),
            h('div', { class: 'labcases' }, nnCaseLinks(['extract', 'steal', 'side']))]; },
        acts: L => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv' }, 'Advanced path →')] }
    ] };
  return sim;
}

function inHud(L, P) {
  const live = () => inLive(P.on).length;
  return [
    [['STAGES', () => IN_STAGES.length + ''], ['IN THE ANSWER', () => '0', 'good']],
    [['BATCH', () => IN_REQS.length + ' tenants'], ['GPUS', () => '1', 'bad']],
    [['PREFIX CACHE', () => inLive(P.on).some(s => s.id === 'cache') ? 'shared' : 'per-tenant', inLive(P.on).some(s => s.id === 'cache') ? 'bad' : 'good'], ['A HIT MEANS', () => 'sent before']],
    [['SAMPLER OUTPUT', () => inLive(P.on).some(s => s.id === 'sampler') ? 'full logprobs' : 'text only', inLive(P.on).some(s => s.id === 'sampler') ? 'bad' : 'good']],
    [['ON THE WIRE', () => P.pad && !inLive(P.on).some(s => s.id === 'stream') ? 'length visible' : 'blips', 'bad']],
    [['OPEN', () => live() + '/' + IN_STAGES.length, 'bad'], ['CONTROLS', () => Object.values(P.on).filter(Boolean).length + '/' + IN_DEF.length]],
    [['OPEN', () => live() + '/' + IN_STAGES.length, live() ? 'bad' : 'good'], ['CONTROLS', () => Object.values(P.on).filter(Boolean).length + '/' + IN_DEF.length]]][L.step];
}
// A stage's dossier in the side panel.
function inStageSide(L, P) {
  const s = IN_BY[P.sel];
  return [h('div', { class: 'labprompts' }, IN_STAGES.map(st => h('button', { type: 'button', class: 'labp' + (P.sel === st.id ? ' on' : '') + (P.revealed.has(st.id) ? ' sent' : ''),
    onclick: () => { P.sel = st.id; P.revealed.add(st.id); L.repaint(); } }, (P.revealed.has(st.id) ? '✓ ' : '') + st.name))),
    h('div', { class: 'inspec' }, h('span', { class: 'labk' }, s.name + ' · ' + s.sub), h('b', { class: 'inissue' }, s.issue), h('p', null, s.look),
      h('span', { class: 'labk' }, 'Control'), h('p', { class: 'inctrl' }, s.control))];
}
function inDefOne(L, P, id) { const d = IN_DEF.find(x => x.id === id);
  return h('button', { type: 'button', class: 'labdef inone' + (P.on[id] ? ' on' : ''), 'aria-pressed': String(!!P.on[id]),
    onclick: () => { P.on[id] = !P.on[id]; L.repaint(); } }, h('i', null, '■'), h('b', null, d.name), h('small', null, d.how)); }
function inReqList(P) { return h('div', { class: 'inreqs' }, IN_REQS.map(r => h('div', { class: 'inreq ' + r.col }, h('b', null, r.who), h('span', null, '“' + r.prefix.slice(0, 34) + (r.prefix.length > 34 ? '…' : '') + '”')))); }
function inCacheSide(L, P) { return h('div', { class: 'inspec' }, h('span', { class: 'labk' }, 'The replay'),
  h('p', null, 'The attacker cannot read tenant A’s prompt. They guess a prefix and send it. A fast reply means the prefix was already in the cache — so their guess was right.'),
  P.hits.c ? h('b', { class: P.hits.c === 'hit' ? 'inissue' : 'inctrl' }, P.hits.c === 'hit' ? 'HIT · 8 ms — confirmed' : 'MISS · 240 ms — cache is per-tenant, nothing learned') : null); }
function inSamplerSide(L, P) {
  const covered = !inLive(P.on).some(s => s.id === 'sampler'), toks = [['₹', 0.41], ['the', 0.22], ['account', 0.14], ['pay', 0.09], ['…', 0.14]];
  return h('div', { class: 'inspec' }, h('span', { class: 'labk' }, open ? 'What you get back' : 'What you get back'),
    P.probe < 1 ? h('p', null, 'The answer is one token at a time.') : covered ? h('p', { class: 'inctrl' }, 'Text only: “₹4,80,000 to account …9921”. No scores.')
      : h('div', { class: 'inbars' }, toks.map(([t, v]) => h('div', { class: 'inbar' }, h('span', null, t), h('i', { style: 'width:' + Math.round(v * 100) + '%' }), h('em', null, (v * 100).toFixed(0) + '%'))))); }
function inStreamSide(L, P) {
  const covered = !inLive(P.on).some(s => s.id === 'stream');
  return h('div', { class: 'inspec' }, h('span', { class: 'labk' }, 'On the wire'),
    !P.pad ? h('p', null, 'Press record. The payload is encrypted; the sizes are not.')
      : covered ? h('p', { class: 'inctrl' }, 'Equal 32-byte chunks. The lengths carry no information now.')
        : h('p', { class: 'inissue' }, 'The chunk sizes spell the answer’s word lengths. Enough to tell a yes from a no, a short code from a long one.')); }

function inDown(L, P, x, y) {
  if (L.step !== 0) return; const Ly = inLay(L);
  Ly.nodes.forEach((p, i) => { if (Math.hypot(p.x - x, p.y - y) < Ly.r + 8) { P.sel = IN_STAGES[i].id; P.revealed.add(P.sel); L.repaint(); } });
}

/* ---------- drawing ---------- */
const inCol = r => LC[r.col] || LC.blue;
function inNode(L, g, p, Ly, st, open, hot) {
  const r = Ly.r, c = open ? LC.bad : LC.good;
  if (hot) labGlow(g, p.x, p.y, r * 1.8, LC.ink, 0.22 + 0.1 * Math.sin(L.t * 4));
  g.fillStyle = 'rgba(14,22,48,.85)'; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
  g.strokeStyle = lc(hot ? LC.ink : c, hot ? 1 : 0.7); g.lineWidth = hot ? 2.5 : 1.5; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke(); g.lineWidth = 1;
  if (r < 30) { labText(g, st.name, p.x + r + 8, p.y + 1, { size: 12, w: 700, col: lc(LC.text, 1), mono: false }); return; }
  labText(g, st.name, p.x, p.y - 2, { size: Math.min(13, r * 0.32), w: 700, align: 'center', col: lc(LC.text, 1), mono: false });
  labText(g, st.sub, p.x, p.y + r * 0.3, { size: Math.min(10, r * 0.24), align: 'center', col: lc(LC.mute, 1) });
}
function inPipe(L, g, Ly, dashOn) {
  g.strokeStyle = lc(LC.mute, 0.4); g.lineWidth = 2; g.beginPath();
  if (Ly.wide) { g.moveTo(Ly.x0, Ly.y); g.lineTo(Ly.x1, Ly.y); } else { g.moveTo(Ly.x, Ly.y0); g.lineTo(Ly.x, Ly.y1); } g.stroke(); g.lineWidth = 1;
}
function inDrawPipe(L, g, P) {
  const Ly = inLay(L); inPipe(L, g, Ly);
  Ly.nodes.forEach((p, i) => inNode(L, g, p, Ly, IN_STAGES[i], false, IN_STAGES[i].id === P.sel));
  // the request token packet entering
  const sp = IN_BY[P.sel].i, from = Ly.nodes[0], to = Ly.nodes[sp];
  if (P.revealed.size) for (let k = 0; k < 6; k++) labPulse(L, Ly.wide ? Ly.x0 : Ly.x, Ly.wide ? Ly.y : Ly.y0, to.x, to.y, LC.blue, { delay: k * 0.12, speed: 1 });
  // highlight the selected stage's issue as a tag
  const s = IN_BY[P.sel], p = Ly.nodes[sp], off = Ly.wide ? [0, -Ly.r - 16] : [Ly.r + 8, 22];
  g.font = "700 12px 'IBM Plex Sans', sans-serif"; const tw = g.measureText(s.issue).width + 16, tx = Math.max(6, Math.min(L.w - tw - 6, p.x + off[0] - (Ly.wide ? tw / 2 : 0))), ty = p.y + off[1] - (Ly.wide ? 10 : 6);
  g.fillStyle = 'rgba(255,90,122,.15)'; g.fillRect(tx, ty - 14, tw, 22); g.strokeStyle = lc(LC.bad, 0.6); g.strokeRect(tx, ty - 14, tw, 22);
  labText(g, s.issue, tx + 8, ty + 1, { size: 12, w: 700, mono: false, col: lc(LC.bad, 1) });
}
function inDrawBatch(L, g, P) {
  const Ly = inLay(L), gpu = Ly.nodes[1];
  inPipe(L, g, Ly); Ly.nodes.forEach((p, i) => inNode(L, g, p, Ly, IN_STAGES[i], false, i === 1));
  const u = P.flow ? (NN.sync ? 1 : P.flow.u) : 0, pool = !inLive(P.on).some(s => s.id === 'batch');
  IN_REQS.forEach((r, i) => { const sy = inReqY(L, Ly, i) || (Ly.wide ? 0 : 40 + i * 18), sx = Ly.wide ? Ly.x0 : L.w * (0.18 + i * 0.21);
    const start = Ly.wide ? [Ly.x0, L.h * (0.18 + i * 0.1)] : [L.w * (0.18 + i * 0.21), Ly.y0];
    const c = inCol(r);
    // request chip at the entry
    if (!P.flow) { g.fillStyle = lc(c, 0.8); g.fillRect(start[0] - 24, start[1] - 7, 18, 14); labText(g, r.id.toUpperCase(), start[0] - 15, start[1] + 4, { size: 10, w: 700, align: 'center', col: '#0A1022' }); }
    else { const uu = Math.max(0, Math.min(1, u * 1.4 - i * 0.05)), x = start[0] + (gpu.x - start[0]) * fiEase(uu), y = start[1] + (gpu.y - start[1]) * fiEase(uu);
      g.fillStyle = lc(c, 0.9); g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      if (uu >= 1 && pool) { /* mixed in the batch */ } } });
  // the batch grid inside the GPU
  if (P.flow && u > 0.6) { const n = IN_REQS.reduce((a, r) => a + r.toks, 0), cols = 7, cs = (Ly.r * 1.4) / cols; let k = 0;
    const gx = gpu.x - cs * cols / 2, gy = gpu.y - Ly.r * 0.2;
    IN_REQS.forEach(r => { for (let j = 0; j < r.toks; j++, k++) { const x = gx + (k % cols) * cs, y = gy + Math.floor(k / cols) * cs; g.fillStyle = lc(inCol(r), 0.85); g.fillRect(x, y, cs - 1.5, cs - 1.5); } });
    labText(g, pool ? 'ISOLATED POOLS' : 'ONE SHARED BATCH', gpu.x, gpu.y + Ly.r + 16, { size: 11, w: 700, align: 'center', col: lc(pool ? LC.good : LC.bad, 1) }); }
}
function inDrawCache(L, g, P) {
  const Ly = inLay(L), cache = Ly.nodes[2]; inPipe(L, g, Ly);
  Ly.nodes.forEach((p, i) => inNode(L, g, p, Ly, IN_STAGES[i], false, i === 2));
  // two prefixes feeding the cache: tenant A (blue) then attacker (red)
  const box = Ly.wide ? { x: cache.x - Ly.r * 1.1, y: cache.y + Ly.r + 14, w: Math.max(Ly.r * 2.4, 150), h: 40 } : { x: Ly.col, y: cache.y - 20, w: L.w - Ly.col - 10, h: 40 };
  g.fillStyle = 'rgba(141,182,242,.06)'; g.fillRect(box.x, box.y, box.w, box.h); g.strokeStyle = lc(LC.blue, 0.4); g.strokeRect(box.x, box.y, box.w, box.h);
  labText(g, 'PREFIX CACHE', box.x + 6, box.y + 13, { size: 9, w: 700, col: lc(LC.blue, 1) });
  const stored = !!P.hits.c, hit = P.hits.c === 'hit'; g.fillStyle = lc(hit ? LC.bad : LC.blue, stored ? 0.5 : 0.22); g.fillRect(box.x + 8, box.y + 20, box.w - 16, 12);
  if (P.hits.c) { labText(g, hit ? 'tenant A prefix · match' : 'salted · no match', box.x + 11, box.y + 29, { size: 9, w: 600, col: lc(hit ? '#FFD1DB' : '#BFF0D3', 1) });
    labText(g, hit ? 'HIT · 8 ms' : 'MISS · 240 ms', cache.x, cache.y - Ly.r - 10, { size: 13, w: 800, align: 'center', col: lc(hit ? LC.bad : LC.good, 1) });
    const src = Ly.wide ? [cache.x + Ly.r * 1.3, cache.y] : [cache.x, cache.y + Ly.r * 1.3]; for (let k = 0; k < 4; k++) labPulse(L, src[0], src[1], cache.x, cache.y, hit ? LC.bad : LC.good, { delay: k * 0.1, speed: 1.6, r: 2 }); }
}
function inDrawSampler(L, g, P) {
  const Ly = inLay(L), s = Ly.nodes[3]; inPipe(L, g, Ly);
  Ly.nodes.forEach((p, i) => inNode(L, g, p, Ly, IN_STAGES[i], false, i === 3));
  const covered = !inLive(P.on).some(st => st.id === 'sampler'), toks = [['₹', 0.41], ['the', 0.22], ['acct', 0.14], ['pay', 0.09], ['9921', 0.14]];
  const bx = Ly.wide ? s.x - 90 : Ly.col + 30, by = Ly.wide ? s.y + Ly.r + 16 : 24, bw = Ly.wide ? 180 : L.w - Ly.col - 40;
  if (P.probe < 1) { labText(g, 'one token →  “₹”', s.x, Ly.wide ? s.y + Ly.r + 26 : s.y - 30, { size: 13, w: 700, align: Ly.wide ? 'center' : 'left', col: lc(LC.text, 1) }); return; }
  if (covered) { g.fillStyle = 'rgba(95,208,143,.1)'; g.fillRect(bx, by, bw, 40); g.strokeStyle = lc(LC.good, 0.6); g.strokeRect(bx, by, bw, 40);
    labText(g, 'TEXT ONLY', bx + 8, by + 15, { size: 10, w: 700, col: lc(LC.good, 1) }); labText(g, '“₹4,80,000 to …9921”', bx + 8, by + 31, { size: 11, w: 600, col: lc(LC.text, 1), mono: false }); return; }
  labText(g, 'FULL DISTRIBUTION · every token’s score', bx, by - 6, { size: 10, w: 700, col: lc(LC.bad, 1) });
  toks.forEach(([t, v], i) => { const y = by + i * 15; labText(g, t, bx, y + 8, { size: 11, align: 'right', col: lc(LC.text, 1) });
    g.fillStyle = lc(LC.bad, 0.7); g.fillRect(bx + 6, y, (bw - 46) * v / 0.41, 10); labText(g, (v * 100).toFixed(0) + '%', bx + bw - 34, y + 8, { size: 10, col: lc(LC.mute, 1) }); });
}
function inDrawStream(L, g, P) {
  const Ly = inLay(L), st = Ly.nodes[4]; inPipe(L, g, Ly);
  Ly.nodes.forEach((p, i) => inNode(L, g, p, Ly, IN_STAGES[i], false, i === 4));
  if (!P.pad) { for (let k = 0; k < 10; k++) labPulse(L, st.x, st.y, Ly.wide ? Ly.x1 : Ly.x, Ly.wide ? Ly.y : Ly.y1, LC.ink, { delay: k * 0.12, speed: 0.9 }); return; }
  const covered = !inLive(P.on).some(s => s.id === 'stream'), sizes = covered ? [32, 32, 32, 32, 32, 32, 32] : [6, 11, 4, 14, 3, 9, 7];
  const bx = Ly.wide ? Ly.x0 + 20 : Ly.col, by = Ly.wide ? L.h - 90 : L.h * 0.4, bw = L.w - bx - 20, unit = bw / (Ly.wide ? 90 : 130);
  labText(g, covered ? 'PADDED · equal chunks' : 'RAW · chunk size = word length', bx, by - 10, { size: 11, w: 700, col: lc(covered ? LC.good : LC.bad, 1) });
  let x = bx; sizes.forEach((sz, i) => { const w = sz * unit * (covered ? 1 : 1.6); g.fillStyle = lc(covered ? LC.good : LC.bad, 0.75); g.fillRect(x, by, w - 2, 20);
    labText(g, covered ? '32' : sz + '', x + w / 2 - 1, by + 34, { size: 9, align: 'center', col: lc(LC.mute, 1) }); x += w + 4; });
  if (!covered) labText(g, '…reads as:  “N  o,   d  o   n  o  t   p  a  y”', bx, by + 52, { size: 12, w: 600, mono: false, col: lc(LC.bad, 1) });
}
function inDrawDefend(L, g, P) {
  const Ly = inLay(L), live = new Set(inLive(P.on).map(s => s.id)); inPipe(L, g, Ly);
  Ly.nodes.forEach((p, i) => { const st = IN_STAGES[i], open = live.has(st.id), fl = P.flash && P.flash[st.id] != null && L.t - P.flash[st.id] < 0.8 && !open;
    if (fl) labGlow(g, p.x, p.y, Ly.r * 1.9, LC.good, 0.5 * (1 - (L.t - P.flash[st.id]) / 0.8));
    inNode(L, g, p, Ly, st, open, false);
    const tag = open ? st.issue : 'covered', c = open ? LC.bad : LC.good, off = Ly.wide ? [0, Ly.r + 14] : [Ly.r + 8, 2];
    g.font = "600 10px 'IBM Plex Sans', sans-serif"; const lines = piWrap(g, tag, Ly.wide ? Ly.r * 2.6 : L.w - Ly.x - Ly.r - 20);
    fiClip(g, 0, 0, L.w, L.h, () => lines.slice(0, Ly.wide ? 3 : 1).forEach((t, j) => labText(g, (j ? '' : open ? '● ' : '✓ ') + t, p.x + off[0] - (Ly.wide ? g.measureText(t).width / 2 : 0), p.y + off[1] + 12 + j * 12, { size: 10, w: 600, mono: false, col: lc(c, 1) }))); });
}

NN_SIMS.push({ id: 'infer', title: 'Inside inference', kicker: 'Inference-time · side channels', blurb: 'Follow one request through tokeniser, shared GPU batch, KV cache, sampler and the streamed response, and watch every stage hand out something the answer never says.', mount: inMount,
  brief: { what: 'When a model answers, the request travels a serving pipeline: tokeniser, GPU batch, KV cache, sampler, response stream. The answer is only the end of it. The timing, the shared cache, the confidence scores and the token lengths along the way leak on their own.',
    real: 'Training-data extraction by repetition; model stealing through the API; token-length and timing side channels on streamed responses; KV-cache and cross-tenant leakage — all documented at the inference layer in 2023–2025.',
    todo: ['Open each of the five stages and see what it exposes', 'Share a GPU batch, replay a cached prefix, ask for raw scores, record the stream', 'Switch on the serving-layer controls until every stage is covered'] },
  guide: [
    { look: [['good', '◯', 'A pipeline stage.'], ['ink', '◯', 'The one you opened.'], ['bad', '▭', 'Red tag: the security issue that lives there.'], ['blue', '●', 'The request’s tokens flowing in.']],
      why: 'Tap each stage. The answer leaves at the end; everything before it is observable in its own way.' },
    { look: [['blue', '●', 'Tenant A (you).'], ['violet', '●', 'Other tenants.'], ['bad', '●', 'An attacker, in the same batch.']],
      why: 'Send the batch. The maths keeps tenants apart; the shared GPU does not keep their timing apart.' },
    { look: [['blue', '▭', 'The prefix cache.'], ['bad', 'HIT', 'A fast reply: the prefix was already there.']],
      why: 'A shared cache turns “was this sent before?” into a timing question anyone can ask. Salt it per tenant and the hit disappears.' },
    { look: [['bad', '▮', 'The full score vector: every token’s probability.'], ['good', '▭', 'Text only, with the control on.']],
      why: 'The chosen word is the answer. The whole distribution is a blueprint of the model, and handing it out per query is how models get copied.' },
    { look: [['bad', '▬', 'Chunk sizes on the wire, unequal.'], ['good', '▬', 'Padded to equal size.']],
      why: 'Encryption hides the words, not their lengths. Equal-size chunks on sensitive routes close the gap.' },
    { look: [['bad', '●', 'Stages still leaking.'], ['good', '✓', 'Covered by a control.']],
      why: 'Each control sits in the serving layer, not the model. Isolation, scoping, and what the API is allowed to return.' },
    { why: 'Protect the pipeline, not just the text. The answer is the one part that was never the problem.' }] });
NN_BY.infer = NN_SIMS[NN_SIMS.length - 1];
Object.assign(NN_LINK, { extract: 'infer', steal: 'infer', side: 'infer' });
