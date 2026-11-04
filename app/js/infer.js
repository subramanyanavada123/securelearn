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

// The request, peeled: six layers one prompt becomes, from what you typed to what leaves the wire.
// `who` is who can observe this layer; `rows` is the illustrative content drawn on the sheet.
const IN_LAYERS = [
  { id: 'prompt', name: 'Your prompt', who: 'You and the operator', tone: 'good', rows: ['“What is my payroll account?”'] },
  { id: 'context', name: 'Assembled context', who: 'Anyone who can write to memory or the knowledge base', tone: 'ink', rows: ['SYSTEM: Acme payroll assistant', 'MEMORY: user = ravi · tenant A', 'RAG: policy_v3.md (retrieved)', 'USER: What is my payroll account?'] },
  { id: 'tokens', name: 'Token ids', who: 'The serving layer; shared in a batch', tone: 'blue', rows: ['[9906, 374, 856, 24069, 2759, 30]', '— no mark says which tokens are untrusted —'] },
  { id: 'logits', name: 'Output scores', who: 'Anyone given logprobs by the API', tone: 'bad', rows: ['₹ 0.41 · the 0.22 · account 0.14', 'pay 0.09 · … 0.14', '(the full distribution, every token)'] },
  { id: 'cache', name: 'KV cache state', who: 'Any tenant sharing the cache', tone: 'violet', rows: ['prefix hash: 7f3a… (cached)', 'hit = this prefix was seen before'] },
  { id: 'wire', name: 'Response on the wire', who: 'Anyone on the network path', tone: 'bad', rows: ['chunk sizes: 6 · 11 · 4 · 14 · 3', '(encrypted; lengths are not)'] }];

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
  // Always horizontal: YOU on the left, ANSWER on the right, the five stages between. The pipeline
  // is the whole idea, so even on a phone it reads left-to-right, just smaller.
  const wide = L.w > 600, n = IN_STAGES.length;
  const padL = wide ? 90 : 48, padR = wide ? 90 : 48, y = wide ? L.h * 0.42 : L.h * 0.26;
  const span = L.w - padL - padR, gap = span / (n + 1), r = Math.min(wide ? 60 : 30, gap * 0.42, L.h * 0.14);
  return { wide, y, gap, r, nodes: IN_STAGES.map((s, i) => ({ x: padL + gap * (i + 1), y })),
    x0: padL - (wide ? 24 : 14), x1: L.w - padR + (wide ? 24 : 14), inPt: { x: padL - (wide ? 24 : 14), y }, outPt: { x: L.w - padR + (wide ? 24 : 14), y } };
}

function inMount(L) {
  const P = { sel: 'tok', psel: null, ex: 0, on: {}, flow: null, hits: {}, probe: 0, pad: false, revealed: new Set(), lane: {} };
  const stageOpen = id => inLive(P.on).some(s => s.id === id);
  const fire = L => { P.flow = { t0: L.t, u: 0 }; IN_REQS.forEach((r, i) => { P.lane[r.id] = i; }); L.repaint(); };
  const sim = { P,
    hud: L => inHud(L, P),
    draw: (L, g) => [inDrawPeel, inDrawPipe, inDrawBatch, inDrawCache, inDrawSampler, inDrawStream, inDrawDefend, inDrawDefend][L.step](L, g, P),
    down: (L, x, y) => inDown(L, P, x, y),
    move: (L, x, y, dn) => { if (dn && L.step === 0) { P.exTarget = null; P.psel = null; fiSet(L, P, 'ex', (x - L.w * 0.14) / (L.w * 0.72)); inMarkSeen(P); } },
    tick: (L, dt) => {
      if (P.flow && !NN.sync) { P.flow.u = Math.min(1, (L.t - P.flow.t0) * 0.5); }
      if (L.step === 0 && P.exTarget != null && !NN.sync) { const d = P.exTarget - P.ex; if (Math.abs(d) < 0.004) { fiSet(L, P, 'ex', P.exTarget); P.exTarget = null; } else { fiSet(L, P, 'ex', P.ex + d * Math.min(1, dt * 6)); } }
    },
    steps: [
      { say: () => { const done = P.ex >= 0.9 || (P.seenLayers && P.seenLayers.size >= IN_LAYERS.length);
          return P.psel != null ? IN_LAYERS[P.psel].name + ' · ' + IN_LAYERS[P.psel].who : done ? 'Six layers. Your prompt is the thinnest of them.' : 'One request. It is not one thing — fly into it.'; },
        side: L => inPeelSide(L, P),
        acts: L => [labNext(L, 'Follow it through →', !(P.ex >= 0.9 || (P.seenLayers && P.seenLayers.size >= IN_LAYERS.length)))] },
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
    [['LAYERS', () => IN_LAYERS.length + ''], ['YOUR PROMPT IS', () => '1 of ' + IN_LAYERS.length]],
    [['STAGES', () => IN_STAGES.length + ''], ['IN THE ANSWER', () => '0', 'good']],
    [['BATCH', () => IN_REQS.length + ' tenants'], ['GPUS', () => '1', 'bad']],
    [['PREFIX CACHE', () => inLive(P.on).some(s => s.id === 'cache') ? 'shared' : 'per-tenant', inLive(P.on).some(s => s.id === 'cache') ? 'bad' : 'good'], ['A HIT MEANS', () => 'sent before']],
    [['SAMPLER OUTPUT', () => inLive(P.on).some(s => s.id === 'sampler') ? 'full logprobs' : 'text only', inLive(P.on).some(s => s.id === 'sampler') ? 'bad' : 'good']],
    [['ON THE WIRE', () => P.pad && !inLive(P.on).some(s => s.id === 'stream') ? 'length visible' : 'blips', 'bad']],
    [['OPEN', () => live() + '/' + IN_STAGES.length, 'bad'], ['CONTROLS', () => Object.values(P.on).filter(Boolean).length + '/' + IN_DEF.length]],
    [['OPEN', () => live() + '/' + IN_STAGES.length, live() ? 'bad' : 'good'], ['CONTROLS', () => Object.values(P.on).filter(Boolean).length + '/' + IN_DEF.length]]][L.step];
}
// Mark layers the camera has flown past as seen.
function inMarkSeen(P) { P.seenLayers = P.seenLayers || new Set(); const upto = Math.round(P.ex * (IN_LAYERS.length - 1)); for (let i = 0; i <= upto; i++) P.seenLayers.add(i); }
// Fly the camera to a chosen layer and focus it.
function inFocusLayer(L, P, i) { P.psel = i; P.seenLayers = P.seenLayers || new Set(); P.seenLayers.add(i);
  const want = i / (IN_LAYERS.length - 1);
  if (NN.sync) { if (P.ex < want) fiSet(L, P, 'ex', want); P.rangeOut && P.rangeOut(); } else { P.exTarget = want; if (P.ex < 0.04) P.ex = 0.03; }
  L.repaint(); }
// The peel step's side panel: a fly-through slider plus the focused layer's dossier.
function inPeelSide(L, P) {
  const sel = P.psel != null ? IN_LAYERS[P.psel] : null;
  return [fiRange(L, P, 'ex', 'FLY THROUGH', () => P.ex >= 0.9 || (P.seenLayers && P.seenLayers.size >= IN_LAYERS.length)),
    h('div', { class: 'labprompts' }, IN_LAYERS.map((ly, i) => h('button', { type: 'button', class: 'labp' + (P.psel === i ? ' on' : '') + (P.seenLayers && P.seenLayers.has(i) ? ' sent' : ''),
      onclick: () => inFocusLayer(L, P, i) }, ly.name))),
    sel ? h('div', { class: 'inspec' }, h('span', { class: 'labk' }, sel.name),
      h('div', { class: 'inrows' }, sel.rows.map(r => h('div', null, r))),
      h('span', { class: 'labk' }, 'Who can observe this'), h('b', { class: sel.tone === 'good' ? 'inctrl' : 'inissue' }, sel.who)) : h('p', { class: 'labsm' }, 'Tap a layer, or fly through, to see what each one exposes.')];
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
  return h('div', { class: 'inspec' }, h('span', { class: 'labk' }, 'What you get back'),
    P.probe < 1 ? h('p', null, 'The answer is one token at a time.') : covered ? h('p', { class: 'inctrl' }, 'Text only: “₹4,80,000 to account …9921”. No scores.')
      : h('div', { class: 'inbars' }, toks.map(([t, v]) => h('div', { class: 'inbar' }, h('span', null, t), h('i', { style: 'width:' + Math.round(v * 100) + '%' }), h('em', null, (v * 100).toFixed(0) + '%'))))); }
function inStreamSide(L, P) {
  const covered = !inLive(P.on).some(s => s.id === 'stream');
  return h('div', { class: 'inspec' }, h('span', { class: 'labk' }, 'On the wire'),
    !P.pad ? h('p', null, 'Press record. The payload is encrypted; the sizes are not.')
      : covered ? h('p', { class: 'inctrl' }, 'Equal 32-byte chunks. The lengths carry no information now.')
        : h('p', { class: 'inissue' }, 'The chunk sizes spell the answer’s word lengths. Enough to tell a yes from a no, a short code from a long one.')); }

function inDown(L, P, x, y) {
  if (L.step === 0) { if (!P.panels) return;
    // nearest-to-front panel whose rect is under the pointer (panels are front-first here since we pushed back-to-front)
    const hit = [...P.panels].reverse().find(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
    if (hit) inFocusLayer(L, P, hit.i); return; }
  if (L.step !== 1) return; const Ly = inLay(L);
  Ly.nodes.forEach((p, i) => { if (Math.hypot(p.x - x, p.y - y) < Ly.r + 8) { P.sel = IN_STAGES[i].id; P.revealed.add(P.sel); L.repaint(); } });
}

/* ---------- drawing ---------- */
const inCol = r => LC[r.col] || LC.blue;
const inToneCol = ly => ly.tone === 'good' ? LC.good : ly.tone === 'bad' ? LC.bad : LC[ly.tone] || LC.ink;
// Cinematic layer reveal: six glass panels floating at increasing depth. Dragging flies the camera
// forward through the stack; the focused panel rises to the front, the rest recede, dim and drift.
// A diagonal light sweep catches each panel's edges. Everything is a perspective projection of one
// depth axis, drawn back to front, with a slow camera drift for parallax.
const IN_FOV = 460;                                   // focal length for the projection
function inPeelBox(L) { const pw = Math.min(L.w * 0.5, 440), ph = pw * 0.62; return { pw, ph }; }
// Project a point at panel depth z (world units) with a slight camera offset, to screen.
function inProj(L, cx, cy, z, camx, camy) { const s = IN_FOV / (IN_FOV + z); return { s, x: cx + (camx) * s, y: cy + (camy) * s }; }
function inDrawPeel(L, g, P) {
  const fly = fiEase(P.ex), B = inPeelBox(L), N = IN_LAYERS.length;
  const cx = L.w * 0.44, cy = L.h * 0.5, drift = Math.sin(L.t * 0.4), driftY = Math.sin(L.t * 0.31 + 1);
  // the camera travels from just in front of the back panel toward the front as you drag
  const spacing = 190, camZ = fly * (N - 1) * spacing;
  P.panels = [];
  // which panel is "in focus": the one nearest the camera plane, unless the user picked one
  const focusByFly = Math.round(fly * (N - 1));
  const focus = P.psel != null ? P.psel : focusByFly;
  // draw order: every other panel back-to-front, then the focused panel on top of all of them
  const order = []; for (let i = N - 1; i >= 0; i--) if (i !== focus) order.push(i); order.push(focus);
  for (const i of order) {
    const ly = IN_LAYERS[i], z = i * spacing - camZ, depth = z + IN_FOV;
    if (depth < 30) continue;                           // panel is behind the camera
    const sel = i === focus, par = (i - focus) * 10;     // parallax offset by distance from focus
    const pr = inProj(L, cx, cy, Math.max(0, z), drift * (18 + par) + par * 2.2, driftY * 10 + (i - focus) * 6);
    const pop = sel ? 1.16 : 1, w = B.pw * pr.s * pop, hh = B.ph * pr.s * pop, x = pr.x - w / 2, y = pr.y - hh / 2;
    const near = 1 - Math.min(1, Math.abs(z) / (spacing * (N - 0.5)));   // 1 at camera plane
    const bright = sel ? 1 : 0.22 + near * 0.4;
    inGlass(L, g, ly, x, y, w, hh, bright, sel, i, focus);
    P.panels.push({ i, x, y, w, h: hh, cx: pr.x, cy: pr.y });
  }
  // the light sweep: a soft diagonal band crossing the whole canvas
  const sweep = ((L.t * 0.12) % 1.4) - 0.2, sx = sweep * L.w * 1.4 - L.w * 0.2;
  const grd = g.createLinearGradient(sx - 120, 0, sx + 120, L.h); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(180,210,255,.05)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, L.w, L.h);
  if (fly < 0.06) { const b = Math.sin(L.t * 3) * 7; labText(g, '◀  fly through  ▶', cx + b, L.h - 16, { size: 13, w: 700, align: 'center', col: lc(LC.ink, 0.9) }); }
  // depth rail on the left: where the camera is in the stack
  inDepthRail(L, g, focus, fly);
}
// One glass panel: frosted fill, bright rim, a top glint, its name and (when near) its content.
function inGlass(L, g, ly, x, y, w, hh, bright, sel, i, focus) {
  const c = inToneCol(ly), r = Math.min(14, w * 0.04);
  g.save();
  inRound(g, x, y, w, hh, r);
  // frosted body
  const bg = g.createLinearGradient(x, y, x, y + hh); bg.addColorStop(0, lc(c, 0.09 * bright + 0.03)); bg.addColorStop(1, 'rgba(10,16,34,' + (0.5 + 0.35 * bright).toFixed(2) + ')');
  g.fillStyle = bg; g.fill();
  if (sel) { g.save(); g.shadowColor = lc(c, 0.6); g.shadowBlur = 34; g.strokeStyle = lc(c, 1); g.lineWidth = 2; inRound(g, x, y, w, hh, r); g.stroke(); g.restore(); }
  else { g.strokeStyle = lc(c, 0.3 + 0.5 * bright); g.lineWidth = 1; inRound(g, x, y, w, hh, r); g.stroke(); }
  // top glint
  g.save(); inRound(g, x, y, w, hh, r); g.clip();
  const gl = g.createLinearGradient(x, y, x, y + hh * 0.5); gl.addColorStop(0, 'rgba(255,255,255,' + (0.12 * bright).toFixed(2) + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(x, y, w, hh * 0.5);
  g.restore();
  // Only the focused panel carries text; the rest are pure glass, so the stack never turns into overlapping words.
  const fs = Math.max(10, w * 0.042);
  if (sel) {
    g.save(); inRound(g, x + 1, y + 1, w - 2, hh - 2, r); g.clip();
    labText(g, ly.name.toUpperCase(), x + w * 0.06, y + fs * 1.6, { size: fs * 0.82, w: 700, col: lc(c, 1) });
    labText(g, '● you are here', x + w - w * 0.06, y + fs * 1.6, { size: fs * 0.7, align: 'right', col: lc(c, 0.9) });
    ly.rows.forEach((row, j) => labText(g, row, x + w * 0.06, y + fs * 3.1 + j * fs * 1.4, { size: fs * 0.82, col: lc(LC.text, 0.95), mono: true }));
    labText(g, ly.who, x + w * 0.06, y + hh - fs * 1.1, { size: fs * 0.78, w: 600, mono: false, col: lc(c, 1) });
    g.restore();
  }
  g.restore();
}
function inRound(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// A vertical rail of pips showing stack depth and the camera's position.
function inDepthRail(L, g, focus, fly) {
  const N = IN_LAYERS.length, x = 26, y0 = L.h * 0.3, y1 = L.h * 0.7, gap = (y1 - y0) / (N - 1);
  g.strokeStyle = lc(LC.mute, 0.3); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
  IN_LAYERS.forEach((ly, i) => { const y = y0 + i * gap, on = i === focus, c = inToneCol(ly);
    g.fillStyle = lc(on ? c : LC.mute, on ? 1 : 0.5); g.beginPath(); g.arc(x, y, on ? 6 : 3, 0, 7); g.fill();
    if (on) { labGlow(g, x, y, 16, c, 0.5); labText(g, ly.name, x + 14, y + 4, { size: 11, w: 700, col: lc(c, 1), mono: false }); } });
}
function inNode(L, g, p, Ly, st, open, hot) {
  const r = Ly.r, c = open ? LC.bad : LC.good;
  if (hot) labGlow(g, p.x, p.y, r * 1.9, LC.ink, 0.25 + 0.12 * Math.sin(L.t * 4));
  // ring
  const bg = g.createRadialGradient(p.x, p.y - r * 0.3, r * 0.2, p.x, p.y, r); bg.addColorStop(0, 'rgba(20,30,60,.95)'); bg.addColorStop(1, 'rgba(10,16,34,.95)');
  g.fillStyle = bg; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
  g.strokeStyle = lc(hot ? LC.ink : c, hot ? 1 : 0.75); g.lineWidth = hot ? 3 : 1.8; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke(); g.lineWidth = 1;
  // stage number
  labText(g, String(IN_BY[st.id].i + 1), p.x, p.y - r * 0.28, { size: Math.max(16, r * 0.42), w: 800, align: 'center', col: lc(hot ? LC.ink : c, 0.9), mono: false });
  // name below the ring on wide screens; on a phone the ring number is enough and names would collide
  if (Ly.wide) { labText(g, st.name, p.x, p.y + r + 14, { size: Math.min(13, Math.max(9, r * 0.3)), w: 700, align: 'center', col: lc(LC.text, 1), mono: false });
    if (Ly.gap > 150) labText(g, st.sub, p.x, p.y + r + 30, { size: Math.min(11, r * 0.2), align: 'center', col: lc(LC.mute, 0.8) }); }
}
// Endpoint chips: YOU (the request source) and ANSWER (what comes back), framing the pipeline.
function inEndpoints(L, g, Ly) {
  const chip = (pt, label, c, icon) => { const w = 54, hh = 30;
    g.fillStyle = lc(c, 0.12); inRound(g, pt.x - w / 2, pt.y - hh / 2, w, hh, 8); g.fill(); g.strokeStyle = lc(c, 0.7); g.lineWidth = 1.4; inRound(g, pt.x - w / 2, pt.y - hh / 2, w, hh, 8); g.stroke(); g.lineWidth = 1;
    labText(g, label, pt.x, pt.y + 4, { size: 11, w: 800, align: 'center', col: lc(c, 1), mono: false }); };
  chip(Ly.inPt, 'YOU', LC.blue); chip(Ly.outPt, 'ANSWER', LC.good);
}
function inPipe(L, g, Ly) {
  // the rail with a soft glow
  g.strokeStyle = lc(LC.blue, 0.22); g.lineWidth = 6; g.beginPath();
  g.moveTo(Ly.x0, Ly.y); g.lineTo(Ly.x1, Ly.y); g.stroke();
  g.strokeStyle = lc(LC.mute, 0.5); g.lineWidth = 1.5; g.stroke(); g.lineWidth = 1;
}
// A steady trickle of request packets along the whole rail, so the pipeline always looks alive.
function inFlowDots(L, g, Ly, upTo) {
  const a = [Ly.x0, Ly.y], b = upTo ? [upTo.x, upTo.y] : [Ly.x1, Ly.y];
  for (let k = 0; k < 5; k++) { const t = ((L.t * 0.4 + k / 5) % 1); const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    g.fillStyle = lc(LC.blue, 0.8 * (1 - Math.abs(t - 0.5))); g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
}
function inDrawPipe(L, g, P) {
  const Ly = inLay(L); inPipe(L, g, Ly); inEndpoints(L, g, Ly); inFlowDots(L, g, Ly);
  Ly.nodes.forEach((p, i) => inNode(L, g, p, Ly, IN_STAGES[i], false, IN_STAGES[i].id === P.sel));
  // the selected stage: pull its issue + control into a big readable card on the empty canvas
  const sp = IN_BY[P.sel].i, p = Ly.nodes[sp], s = IN_BY[P.sel];
  // connector from the node up to the card
  const cardW = Math.min(420, L.w - 80), cardH = 118, cx = Math.max(20, Math.min(L.w - cardW - 20, p.x - cardW / 2)), cy = Ly.wide ? Math.max(16, p.y - Ly.r - 20 - cardH) : 16;
  g.strokeStyle = lc(LC.ink, 0.5); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(p.x, p.y - Ly.r); g.lineTo(cx + cardW / 2, cy + cardH); g.stroke(); g.setLineDash([]);
  inCard(L, g, cx, cy, cardW, cardH, s);
  if (P.revealed.size < IN_STAGES.length) { const b = Math.sin(L.t * 3) * 6; labText(g, 'tap each stage ▸', (Ly.nodes[0].x + Ly.nodes[IN_STAGES.length - 1].x) / 2 + b, L.h - 14, { size: 12, w: 700, align: 'center', col: lc(LC.ink, 0.85) }); }
}
// A readable panel on the canvas: stage name, what it exposes (red), and the control (green).
function inCard(L, g, x, y, w, hh, s) {
  g.fillStyle = 'rgba(12,18,38,.92)'; inRound(g, x, y, w, hh, 12); g.fill(); g.strokeStyle = lc(LC.ink, 0.5); g.lineWidth = 1.4; inRound(g, x, y, w, hh, 12); g.stroke(); g.lineWidth = 1;
  labText(g, s.name.toUpperCase() + '  ·  ' + s.sub, x + 16, y + 22, { size: 11, w: 700, col: lc(LC.ink, 1) });
  g.fillStyle = lc(LC.bad, 1); g.beginPath(); g.arc(x + 20, y + 44, 3.5, 0, 7); g.fill();
  inWrapText(g, 'EXPOSES: ' + s.issue, x + 32, y + 48, w - 48, 14, { size: 12, w: 600, col: lc(LC.bad, 1) });
  g.fillStyle = lc(LC.good, 1); g.beginPath(); g.arc(x + 20, y + hh - 34, 3.5, 0, 7); g.fill();
  inWrapText(g, 'CONTROL: ' + s.control, x + 32, y + hh - 30, w - 48, 14, { size: 11, w: 500, col: lc(LC.good, 0.95), max: 2 });
}
function inWrapText(g, text, x, y, maxW, lh, o) { o = o || {}; g.font = (o.w || 600) + ' ' + (o.size || 12) + "px 'IBM Plex Sans', sans-serif";
  const words = text.split(' '); let line = '', yy = y, lines = 0;
  for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { labText(g, line, x, yy, { ...o, mono: false }); line = wd; yy += lh; if (++lines >= (o.max || 2)) { break; } } else line = t; }
  if (lines < (o.max || 2)) labText(g, line, x, yy, { ...o, mono: false });
}
// Shared frame for every pipeline step: rail, endpoints, flow, and the stages with `active` lit, others dimmed.
function inScene(L, g, Ly, active) {
  inPipe(L, g, Ly); inEndpoints(L, g, Ly); inFlowDots(L, g, Ly, Ly.nodes[active]);
  Ly.nodes.forEach((p, i) => { if (i !== active) { g.globalAlpha = 0.5; inNode(L, g, p, Ly, IN_STAGES[i], false, false); g.globalAlpha = 1; } });
  inNode(L, g, Ly.nodes[active], Ly, IN_STAGES[active], false, true);
}
// The big result panel that fills the lower canvas under the active stage. Returns its inner box.
function inStagePanel(L, g, Ly, active, title, titleCol) {
  const w = Math.min(560, L.w - 36), x = (L.w - w) / 2, y = Ly.y + Ly.r + (Ly.wide ? 54 : 30), hh = Math.min(Ly.wide ? 240 : 150, L.h - y - 34);
  // connector from the active node down to the panel
  const p = Ly.nodes[active]; g.strokeStyle = lc(LC.ink, 0.4); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(p.x, Ly.wide ? p.y + Ly.r : p.y + Ly.r); g.lineTo(L.w / 2, y); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(12,18,38,.9)'; inRound(g, x, y, w, hh, 14); g.fill(); g.strokeStyle = lc(titleCol || LC.ink, 0.5); g.lineWidth = 1.4; inRound(g, x, y, w, hh, 14); g.stroke(); g.lineWidth = 1;
  labText(g, title, x + 20, y + 26, { size: 13, w: 800, col: lc(titleCol || LC.ink, 1), mono: false });
  return { x: x + 20, y: y + 48, w: w - 40, h: hh - 60, cy: y + hh / 2 };
}

function inCenterNote(L, g, text, y, c) { g.font = "600 13px 'IBM Plex Sans', sans-serif"; let fs = 13; while (fs > 10 && g.measureText(text).width > L.w - 40) { fs--; g.font = '600 ' + fs + "px 'IBM Plex Sans', sans-serif"; }
  labText(g, text, L.w / 2, y, { size: fs, w: 600, mono: false, align: 'center', col: lc(c, 1) }); }
function inDrawBatch(L, g, P) {
  const Ly = inLay(L); inScene(L, g, Ly, 1);
  const u = P.flow ? (NN.sync ? 1 : P.flow.u) : 0, pool = !inLive(P.on).some(s => s.id === 'batch');
  const b = inStagePanel(L, g, Ly, 1, pool ? 'ISOLATED POOLS — one tenant per pass' : 'ONE SHARED GPU BATCH — four tenants, one pass', pool ? LC.good : LC.bad);
  // four tenant request-rows; when fired they slide into a single batch block
  const rowH = Math.min(34, b.h / 4.4), bx = b.x, bw = b.w;
  IN_REQS.forEach((r, i) => { const c = inCol(r), ry = b.y + i * (rowH + 6), uu = Math.max(0, Math.min(1, u * 1.3 - i * 0.06)), slide = pool ? 0 : fiEase(uu) * 10;
    g.fillStyle = lc(c, 0.16 + 0.1 * uu); inRound(g, bx + slide, ry, bw - slide, rowH, 7); g.fill(); g.strokeStyle = lc(c, 0.7); inRound(g, bx + slide, ry, bw - slide, rowH, 7); g.stroke();
    labText(g, r.who, bx + 12 + slide, ry + rowH / 2 + 4, { size: 11, w: 700, mono: false, col: lc(c, 1) });
    // token cells
    for (let k = 0; k < r.toks; k++) { g.fillStyle = lc(c, 0.55); g.fillRect(bx + bw - 14 - k * 11 - slide, ry + rowH / 2 - 5, 9, 10); } });
  inCenterNote(L, g, pool ? 'Timing is per tenant — no cross-request signal.' : 'Shared timing around isolated maths. That is the signal.', b.y + b.h + 18, pool ? LC.good : LC.bad);
}
function inDrawCache(L, g, P) {
  const Ly = inLay(L); inScene(L, g, Ly, 2);
  const hit = P.hits.c === 'hit', miss = P.hits.c === 'miss';
  const b = inStagePanel(L, g, Ly, 2, 'PREFIX CACHE — reuse a seen prefix for speed', P.hits.c ? (hit ? LC.bad : LC.good) : LC.ink);
  // two rows: tenant A stored the prefix; attacker replays a guess
  const rowH = Math.min(30, b.h * 0.3), labW = Math.min(130, b.w * 0.36);
  const row = (i, who, txt, c) => { const ry = b.y + i * (rowH + Math.min(10, b.h * 0.08)); labText(g, who, b.x, ry + rowH / 2 + 4, { size: Math.min(11, b.w * 0.032), w: 700, mono: false, col: lc(c, 1) });
    g.fillStyle = lc(c, 0.12); inRound(g, b.x + labW, ry, b.w - labW, rowH, 7); g.fill(); g.strokeStyle = lc(c, 0.6); inRound(g, b.x + labW, ry, b.w - labW, rowH, 7); g.stroke();
    fiClip(g, b.x + labW, ry, b.w - labW, rowH, () => labText(g, txt, b.x + labW + 10, ry + rowH / 2 + 4, { size: Math.min(11, b.w * 0.03), mono: true, col: lc(LC.text, 0.9) })); };
  row(0, 'Tenant A sent', 'prefix 7f3a…  →  cached', LC.blue);
  row(1, 'Attacker replays', 'guess 7f3a…  →  ' + (P.hits.c ? (hit ? 'HIT · 8 ms' : 'MISS · 240 ms') : '?'), hit ? LC.bad : miss ? LC.good : LC.mute);
  if (P.hits.c) inCenterNote(L, g, hit ? 'A fast reply means the guess was already cached — now confirmed.' : 'Salted per tenant: no shared hit, the timing says nothing.', b.y + b.h + 18, hit ? LC.bad : LC.good);
}
function inDrawSampler(L, g, P) {
  const Ly = inLay(L); inScene(L, g, Ly, 3);
  const covered = !inLive(P.on).some(st => st.id === 'sampler'), toks = [['₹', 0.41], ['the', 0.22], ['account', 0.14], ['pay', 0.09], ['9921', 0.14]];
  const b = inStagePanel(L, g, Ly, 3, P.probe < 1 ? 'SAMPLER — scores become one token' : covered ? 'TEXT ONLY — the control is on' : 'FULL DISTRIBUTION — every token’s score, exposed', P.probe < 1 ? LC.ink : covered ? LC.good : LC.bad);
  if (P.probe < 1) { labText(g, 'The model scores every possible next token, then picks one.', b.x, b.y + 10, { size: 13, mono: false, col: lc(LC.text, 0.9) });
    labText(g, 'You normally see only the pick:  “₹”', b.x, b.y + 36, { size: 13, w: 700, mono: false, col: lc(LC.good, 1) }); return; }
  if (covered) { labText(g, 'You get the answer text, not the scores:', b.x, b.y + 10, { size: 13, mono: false, col: lc(LC.text, 0.9) });
    labText(g, '“₹4,80,000 to account …9921”', b.x, b.y + 40, { size: 15, w: 700, mono: false, col: lc(LC.good, 1) }); return; }
  const barW = b.w - 140; toks.forEach(([t, v], i) => { const y = b.y + i * (b.h / 5.4) + 6; labText(g, t, b.x + 44, y + 10, { size: 12, align: 'right', mono: false, col: lc(LC.text, 1) });
    g.fillStyle = lc(LC.bad, 0.7); inRound(g, b.x + 54, y, barW * v / 0.41, 13, 3); g.fill(); labText(g, (v * 100).toFixed(0) + '%', b.x + 60 + barW * v / 0.41 + 6, y + 10, { size: 11, mono: true, col: lc(LC.mute, 1) }); });
  inCenterNote(L, g, 'The whole distribution, every query — enough to copy the model.', b.y + b.h + 16, LC.bad);
}
function inDrawStream(L, g, P) {
  const Ly = inLay(L); inScene(L, g, Ly, 4);
  const covered = !inLive(P.on).some(s => s.id === 'stream'), sizes = covered ? [32, 32, 32, 32, 32, 32, 32] : [6, 11, 4, 14, 3, 9, 7];
  const b = inStagePanel(L, g, Ly, 4, !P.pad ? 'RESPONSE STREAM — tokens leave one by one' : covered ? 'PADDED — equal-size chunks' : 'RAW — each chunk’s size = a word length', !P.pad ? LC.ink : covered ? LC.good : LC.bad);
  if (!P.pad) { labText(g, 'The text is encrypted on the wire. Its shape is not.', b.x, b.y + 12, { size: 13, mono: false, col: lc(LC.text, 0.9) });
    for (let k = 0; k < 8; k++) { const t = ((L.t * 0.5 + k / 8) % 1); g.fillStyle = lc(LC.ink, 0.7 * (1 - Math.abs(t - 0.5) * 1.4)); g.beginPath(); g.arc(b.x + t * b.w, b.y + 50, 4, 0, 7); g.fill(); } return; }
  const unit = (b.w) / (covered ? 230 : 95); let x = b.x, y = b.y + 20;
  labText(g, covered ? 'Each chunk is padded to the same size:' : 'Each blip’s width is one word’s length:', b.x, b.y + 4, { size: 12, mono: false, col: lc(covered ? LC.good : LC.bad, 1) });
  sizes.forEach((sz) => { const w = Math.max(10, sz * unit); g.fillStyle = lc(covered ? LC.good : LC.bad, 0.75); inRound(g, x, y, w - 3, 22, 4); g.fill();
    labText(g, covered ? '32' : sz + '', x + (w - 3) / 2, y + 36, { size: 10, align: 'center', mono: true, col: lc(LC.mute, 1) }); x += w + 4; });
  inCenterNote(L, g, covered ? 'Equal lengths carry no information.' : 'Reads back as:  “N o ,  d o  n o t  p a y”', b.y + b.h + 2, covered ? LC.good : LC.bad);
}
function inDrawDefend(L, g, P) {
  const Ly = inLay(L), live = new Set(inLive(P.on).map(s => s.id)); inPipe(L, g, Ly); inEndpoints(L, g, Ly); inFlowDots(L, g, Ly);
  Ly.nodes.forEach((p, i) => { const st = IN_STAGES[i], open = live.has(st.id), fl = P.flash && P.flash[st.id] != null && L.t - P.flash[st.id] < 0.8 && !open;
    if (fl) labGlow(g, p.x, p.y, Ly.r * 2, LC.good, 0.6 * (1 - (L.t - P.flash[st.id]) / 0.8));
    inNode(L, g, p, Ly, st, open, false);
    // a clear status pill under each stage: red "exposed" or green "sealed ✓"
    const c = open ? LC.bad : LC.good, py = p.y + Ly.r + (Ly.wide ? 20 : 8);
    if (Ly.wide) { const label = open ? 'EXPOSED' : 'SEALED ✓', pw = 76, px = p.x - pw / 2;
      g.fillStyle = lc(c, 0.14); inRound(g, px, py, pw, 20, 10); g.fill(); g.strokeStyle = lc(c, 0.7); inRound(g, px, py, pw, 20, 10); g.stroke();
      labText(g, label, p.x, py + 14, { size: 10, w: 800, align: 'center', mono: false, col: lc(c, 1) }); }
    else { g.fillStyle = lc(c, 1); g.beginPath(); g.arc(p.x, py + 6, 4, 0, 7); g.fill(); } });
  const openN = inLive(P.on).length;
  labText(g, openN ? openN + ' of 5 stages still exposed' : 'All 5 stages sealed', L.w / 2, L.h - 18, { size: 14, w: 700, align: 'center', mono: false, col: lc(openN ? LC.bad : LC.good, 1) });
}

NN_SIMS.push({ id: 'infer', title: 'Inside inference', kicker: 'Inference-time · side channels', blurb: 'Follow one request through tokeniser, shared GPU batch, KV cache, sampler and the streamed response, and watch every stage hand out something the answer never says.', mount: inMount,
  brief: { what: 'When a model answers, the request travels a serving pipeline: tokeniser, GPU batch, KV cache, sampler, response stream. The answer is only the end of it. The timing, the shared cache, the confidence scores and the token lengths along the way leak on their own.',
    real: 'Training-data extraction by repetition; model stealing through the API; token-length and timing side channels on streamed responses; KV-cache and cross-tenant leakage — all documented at the inference layer in 2023–2025.',
    todo: ['Pull one request apart into its six layers', 'Share a GPU batch, replay a cached prefix, ask for raw scores, record the stream', 'Switch on the serving-layer controls until every stage is covered'] },
  guide: [
    { look: [['good', '▭', 'The flat request: what you typed.'], ['ink', '▱', 'The layers it becomes before an answer exists.'], ['bad', 'A', 'Red edge: a layer someone other than you can observe.']],
      why: 'Drag to pull the request apart, or tap a layer. Your prompt is one thin sheet; the stack around it is the attack surface.' },
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
