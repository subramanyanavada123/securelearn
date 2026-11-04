'use strict';
/* The borrowed badge: permission escalation and token misuse in an agent
   deployment. The tokens are real JWTs (base64url, HS256 over this page's
   SHA-256), and every API decision runs one verifier: signature, expiry,
   audience, scope, owner and key binding. Scene on the lab engine. */

const TK_KEY = 'idp.corp.example demo signing key', TK_T0 = 1762300800, TK_DAY = 86400;
const tkRaw = hex => btoa(String.fromCharCode(...axHex(hex))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function tkMake(claims) { const hd = axB64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), pl = axB64u(JSON.stringify(claims)); return hd + '.' + pl + '.' + tkRaw(axHmac(TK_KEY, hd + '.' + pl)); }
const tkParts = t => t.split('.');
const tkClaims = t => JSON.parse(axUnB64u(tkParts(t)[1]));
const tkSigOk = t => { const [hd, pl, sg] = tkParts(t); return tkRaw(axHmac(TK_KEY, hd + '.' + pl)) === sg; };
const TK = {
  svc: tkMake({ iss: 'idp.corp.example', sub: 'svc-ai-assistant', aud: '*', scope: 'mail.send files.rw payroll.read admin.users', iat: TK_T0, exp: TK_T0 + 90 * TK_DAY }),
  obo: tkMake({ iss: 'idp.corp.example', sub: 'ravi', act: { sub: 'svc-ai-assistant' }, aud: 'payroll-api', scope: 'payroll.read:self', iat: TK_T0, exp: TK_T0 + 600 }),
  slides: tkMake({ iss: 'idp.corp.example', sub: 'ravi', act: { sub: 'svc-ai-assistant' }, aud: 'mcp-slides', scope: 'files.read', iat: TK_T0, exp: TK_T0 + 600 }),
  bound: tkMake({ iss: 'idp.corp.example', sub: 'svc-ai-assistant', aud: 'payroll-api', scope: 'payroll.read', iat: TK_T0, exp: TK_T0 + 600, cnf: { jkt: 'agent-key-7f3a' } }) };
const TK_API = { payroll: { aud: 'payroll-api', need: 'payroll.read' }, mail: { aud: 'mail-api', need: 'mail.send' }, slides: { aud: 'mcp-slides', need: 'files.read' } };
// One verifier for every API. o.aud: check the audience. o.key: the key the caller proves it holds. o.owner: whose data.
function tkCheck(tok, api, o) {
  o = o || {}; const A = TK_API[api], c = tkClaims(tok), now = o.now || TK_T0 + 60;
  if (!tkSigOk(tok)) return { ok: false, why: 'bad signature' };
  if (now > c.exp) return { ok: false, why: 'expired' };
  if (o.aud && c.aud !== A.aud) return { ok: false, why: 'aud is ' + c.aud + ', not ' + A.aud };
  const sc = c.scope.split(' ').find(s => s.split(':')[0] === A.need);
  if (!sc) return { ok: false, why: 'no ' + A.need + ' scope' };
  if (/:self$/.test(sc) && o.owner && o.owner !== c.sub) return { ok: false, why: sc + ' covers only ' + c.sub };
  if (c.cnf && o.key !== c.cnf.jkt) return { ok: false, why: 'token bound to another key' };
  return { ok: true, why: 'accepted as ' + c.sub + (c.act ? ' via ' + c.act.sub : '') };
}
const TK_HOPS = [
  { name: 'files.rw', says: 'The agent may write files in the repo.', lvl: 1 },
  { name: 'settings.json', says: 'An injected README makes it set "chat.tools.autoApprove": true.', lvl: 2 },
  { name: 'auto-approve', says: 'Every later shell command runs without a prompt.', lvl: 3 },
  { name: 'CI secrets', says: 'It reads the deploy token from the CI config.', lvl: 4 },
  { name: 'admin.users', says: 'Its own scope lets it grant svc-ai-assistant the Owner role.', lvl: 5 },
  { name: 'Cloud owner', says: 'Owner of the cloud account. Started as “edit files”.', lvl: 6 }];

const TK_VEC = [
  { id: 'deputy', name: 'Agent’s rights, user’s request' }, { id: 'selfgrant', name: 'Agent grants itself roles' }, { id: 'cfgwrite', name: 'Agent edits its own approvals' },
  { id: 'wildaud', name: 'aud: * accepted everywhere' }, { id: 'passthru', name: 'Token passed to a 3rd party' },
  { id: 'longlived', name: '90-day token' }, { id: 'bearer', name: 'Anyone holding it is the agent' }, { id: 'incontext', name: 'Token inside the context' }];
const TK_DEF = [
  { id: 'obo', name: 'On-behalf-of tokens', how: 'User’s rights, agent named in act', kills: ['deputy'] },
  { id: 'aud', name: 'One audience per token, always checked', how: 'Mint per server; never pass through', kills: ['wildaud', 'passthru'] },
  { id: 'short', name: 'Minutes, not months', how: 'Short expiry, refreshed by a broker', kills: ['longlived'] },
  { id: 'bind', name: 'Bind the token to a key', how: 'DPoP or mTLS: a copy alone is useless', kills: ['bearer'] },
  { id: 'broker', name: 'Keep secrets out of the model', how: 'Tools fetch credentials; the prompt never sees them', kills: ['incontext'] },
  { id: 'protect', name: 'Agent cannot edit its own guardrails', how: 'Approval settings and configs are read-only to it', kills: ['cfgwrite'] },
  { id: 'sep', name: 'No self-granting', how: 'Role changes need a second identity', kills: ['selfgrant'] }];
const TK_GROUPS = [{ name: 'Whose rights', col: 'ink', ids: ['deputy', 'selfgrant', 'cfgwrite'], act: 'A viewer exported all salaries; the agent made itself Owner' },
  { name: 'Which audience', col: 'violet', ids: ['wildaud', 'passthru'], act: 'A slides plugin read payroll with your token' },
  { name: 'How long, by whom', col: 'bad', ids: ['longlived', 'bearer', 'incontext'], act: 'A leaked token worked from a laptop abroad for 90 days' }];

// The payload as the room sees it, and the token the room's edit produces. Same signature, edited payload.
const TK_PRETTY = JSON.stringify(tkClaims(TK.svc), null, 1);
function tkForge(text) {
  if (text === TK_PRETTY) return { tok: TK.svc, ok: true, json: true };
  const [hd, , sg] = tkParts(TK.svc), tok = hd + '.' + axB64u(text) + '.' + sg; let json = true; try { JSON.parse(text); } catch (e) { json = false; }
  return { tok, ok: tkSigOk(tok), json };
}
const TK_FORGE = [['Make me an admin', TK_PRETTY.replace('"svc-ai-assistant"', '"admin"')], ['Never expire', TK_PRETTY.replace(/"exp": \d+/, '"exp": 4102444800')], ['Add a scope', TK_PRETTY.replace('admin.users', 'admin.users billing.write')]];

function tkMount(L) {
  const P = { forge: TK_PRETTY, forgeAt: -9, forged: false, obo: false, tried: new Set(), aud: false, drops: [], days: 0, bind: false, daysMoved: false, hops: 0, hopAt: -9, at: -9, on: {}, flash: {} };
  const fire = (L, k) => { P.at = L.t; P.last = k; tkPulse(L, P, k); L.repaint(); };
  const tog = (k, t, sub) => h('div', { class: 'labstack' }, h('button', { type: 'button', class: 'labdef' + (P[k] ? ' on' : ''), 'aria-pressed': String(!!P[k]), onclick: () => { P[k] = !P[k]; P[k + 'At'] = LAB.L.t; LAB.L.repaint(); } }, h('i', null, P[k] ? '■' : '□'), h('b', null, t), h('small', null, sub)));
  const climb = L => { if (P.hops < TK_HOPS.length) { P.hops++; P.hopAt = L.t; L.repaint(); } };
  const sim = { P,
    hud: L => [
      [['SUBJECT', () => 'svc-ai-assistant'], ['AUDIENCE', () => '*', 'bad'], ['SIGNATURE', () => tkForge(P.forge).ok ? 'valid' : 'BROKEN']],
      [['RAVI’S ROLE', () => 'viewer'], ['PAYROLL API', () => tkDeputy(P).ok ? 'allowed' : 'denied', tkDeputy(P).ok ? 'bad' : 'good']],
      [['TOKEN AUD', () => P.aud ? 'mcp-slides' : '*', P.aud ? '' : 'bad'], ['APIS THAT SAID YES', () => String(P.drops.filter(d => d.r.ok && d.api !== 'slides').length), 'bad']],
      [['DAYS SINCE LEAK', () => String(Math.round(P.days * 120))], ['ATTACKER’S REPLAY', () => tkReplay(P).ok ? 'accepted' : 'rejected', tkReplay(P).ok ? 'bad' : 'good']],
      [['HOPS', () => P.hops + '/' + TK_HOPS.length], ['PRIVILEGE', () => P.hops ? TK_HOPS[P.hops - 1].name : 'files.rw', 'bad']],
      axDefHud(P, TK_VEC, TK_DEF), axDefHud(P, TK_VEC, TK_DEF)][L.step],
    down: (L, x, y) => { if (L.step === 4) { const b = tkHopBox(L, P.hops); if (b && x >= b.x && x <= b.x + b.w && y >= b.y - 30 && y <= b.base) climb(L); } },
    draw: (L, g) => [tkDrawToken, tkDrawDeputy, tkDrawPass, tkDrawStolen, tkDrawHops, (L, g, P) => axDrawDefend(L, g, P, TK_GROUPS, TK_VEC, TK_DEF), (L, g, P) => axDrawDefend(L, g, P, TK_GROUPS, TK_VEC, TK_DEF)][L.step](L, g, P),
    steps: [
      { say: () => !P.forged ? 'The agent’s real access token, decoded. Try to forge it.' : tkForge(P.forge).ok ? 'Unchanged: still valid.' : 'Rejected. One changed byte breaks the signature. So attackers borrow it instead.',
        side: L => [axInput(L, P, 'forge', { label: 'EDIT THE PAYLOAD', area: true, max: 600, presets: TK_FORGE.map(([t, v]) => [t, v, 'bad']),
          on: () => { if (P.forge !== TK_PRETTY) { if (!P.forged) P.forgedAt = L.t; P.forged = true; } }, ok: () => P.forged })],
        acts: L => [labNext(L, 'A viewer asks →', !P.forged)] },
      { say: () => P.tried.size < 2 ? 'Ravi is a viewer. He asks the agent for every salary. Send it both ways.' : 'Same request. The token decided, not Ravi’s role.',
        side: L => [tog('obo', 'Agent uses Ravi’s delegated token', 'On-behalf-of: sub = ravi, act = the agent'),
          h('div', { class: 'fiout' }, h('span', { class: 'labk' }, 'Token the agent presents'), Object.entries(tkClaims(P.obo ? TK.obo : TK.svc)).filter(([k]) => ['sub', 'act', 'aud', 'scope'].includes(k)).map(([k, v]) => h('div', { class: k === 'scope' && !P.obo ? 'bad' : '' }, h('i', null, k), JSON.stringify(v))))],
        acts: L => [labBtn('▶ Send request', () => { P.tried.add(P.obo); fire(L, 'deputy'); }), labNext(L, 'A third-party tool →', P.tried.size < 2)] },
      { say: () => !P.drops.length ? 'The agent handed its token to a slides plugin. You are the plugin: drag it onto an internal API.' : !tkPassDone(P) ? (P.aud ? 'Per-server token. Try payroll again.' : 'Accepted. Now mint per-server tokens and try again.') : 'aud * opened everything. aud = mcp-slides opened nothing else.',
        side: L => [h('div', { class: 'labtokens' }, labDrag(L, h('div', { class: 'labtok lie' }, '🎫 ', h('b', null, 'the agent’s token'), ' · aud ' + (P.aud ? 'mcp-slides' : '*')), r => { if (r !== 'miss') tkDrop(L, P, r); })),
          tog('aud', 'Mint a token per server (aud)', 'aud = mcp-slides; every API checks aud')],
        acts: L => [labNext(L, 'The token leaks →', !tkPassDone(P))] },
      { say: () => !P.daysMoved ? 'An injected page made the agent print its token into a log. Drag time forward.' : tkReplay(P).ok ? 'Day ' + Math.round(P.days * 120) + '. A copy from a log still works.' : P.bind ? 'Short-lived and key-bound: the copy is useless.' : 'Day ' + Math.round(P.days * 120) + '. Expired at last.',
        side: L => [axRange(L, P, 'days', 'DAYS SINCE LEAK', () => { if (P.days > 0.05) P.daysMoved = true; return P.daysMoved; }, () => Math.round(P.days * 120) + ' days'),
          tog('bind', 'Short-lived and bound to the agent’s key', 'DPoP: 10 min; replay needs the private key'),
          h('div', { class: 'fiout' }, h('span', { class: 'labk' }, 'Agent reply, logged'), h('div', { class: 'bad' }, 'AUTH_TOKEN=' + (P.bind ? TK.bound : TK.svc).slice(0, 38) + '…'))],
        acts: L => [labNext(L, 'Climb →', !P.daysMoved)] },
      { say: () => P.hops < TK_HOPS.length ? 'Start: the agent may edit files. Click the glowing bar to climb.' : 'Six hops from “edit files” to cloud Owner. No exploit, only permissions.',
        side: () => [h('div', { class: 'fiout' }, h('span', { class: 'labk' }, 'Path so far'), TK_HOPS.slice(0, P.hops).map((x, i) => h('div', { class: i ? 'bad' : '' }, h('i', null, (i + 1) + ' · ' + x.name), x.says)))],
        acts: L => [labBtn('▶ Next hop', () => climb(L), '', P.hops >= TK_HOPS.length), labNext(L, 'Close the paths →', P.hops < TK_HOPS.length)] },
      { say: () => { const n = axLive(TK_VEC, TK_DEF, P.on).length; return n ? n + ' paths open. Switch on controls.' : 'All ' + TK_VEC.length + ' closed.'; },
        enter: () => { P.on = {}; P.flash = {}; },
        side: L => [axDefSide(L, P, TK_DEF)],
        acts: L => [labNext(L, 'Debrief →', !Object.values(P.on).some(Boolean))] },
      { say: () => 'An agent should carry the user’s rights, for one audience, for minutes.',
        enter: () => labDone('badge'),
        side: () => axDebrief(P, TK_VEC, TK_DEF, [
          ['Aug 2025 · Salesloft Drift', 'Stolen OAuth tokens from an AI chat integration were used to export data from hundreds of companies’ Salesforce instances.'],
          ['Aug 2025 · CVE-2025-53773', 'Prompt injection made GitHub Copilot set its own auto-approve setting, then run commands without prompts.'],
          ['Jul 2025 · Supabase MCP', 'A support ticket drove an agent running with a service-role key to read the secrets table.'],
          ['2025 · MCP authorisation spec', 'Token passthrough is explicitly forbidden: servers must only accept tokens issued for them.']],
          ['supabase', 'ghmcp', 'nx', 'slackai', 'amazonq'], 'The tokens, signatures and every allow/deny on this page are computed for real. Names and systems are illustrative.'),
        acts: L => [labBtn('↺ Again', () => { LAB.id = null; App.render(); }), h('a', { class: 'labbtn go', href: '#adv' }, 'Advanced path →')] }
    ] };
  return sim;
}
const tkDeputy = P => tkCheck(P.obo ? TK.obo : TK.svc, 'payroll', { aud: P.obo, owner: 'all staff' });
const tkPass = P => P.aud ? TK.slides : TK.svc;
// The plugin replays whatever it was handed. With per-server tokens every API checks aud.
const tkPassAt = (P, api) => tkCheck(tkPass(P), api, { aud: P.aud, owner: 'ravi' });
const tkPassDone = P => P.drops.some(d => !d.aud && d.r.ok && d.api !== 'slides') && P.drops.some(d => d.aud && d.api !== 'slides');
const tkReplay = P => tkCheck(P.bind ? TK.bound : TK.svc, 'payroll', { now: TK_T0 + Math.round(P.days * 120) * TK_DAY + 60, key: 'attacker-laptop', aud: P.bind });
// A drop on the canvas lands on the nearest server; a tap (no drag) tries the next internal API.
function tkDrop(L, P, at) {
  let api = null;
  if (at && L.w) { const N = tkPassLay(L); let best = 90; ['payroll', 'mail', 'plug'].forEach(k => { const d = Math.hypot(N[k].x - at[0], N[k].y - at[1]); if (d < best) { best = d; api = k === 'plug' ? 'slides' : k; } }); }
  if (!at) api = ['payroll', 'mail'].find(a => !P.drops.some(d => d.api === a && d.aud === P.aud)) || 'payroll';
  if (!api) return;
  P.drops = P.drops.filter(d => !(d.api === api && d.aud === P.aud)).concat([{ api, aud: P.aud, r: tkPassAt(P, api), at: L.t }]);
  if (L.w) { const N = tkPassLay(L), to = N[api === 'slides' ? 'plug' : api]; for (let k = 0; k < 12; k++) labPulse(L, N.plug.x, N.plug.y, to.x, to.y, LC.ink, { delay: k * 0.03 }); }
  L.repaint();
}

/* ---------- drawing ---------- */
function tkFlow(L, g, P, nodes, edges) {
  const r = Math.max(20, Math.min(30, L.w / 24));
  edges.forEach(([a, b, t, c, on]) => { const A = nodes[a], B = nodes[b]; g.strokeStyle = lc(c, on ? 0.85 : 0.25); g.lineWidth = on ? 2 : 1; g.setLineDash(on ? [] : [4, 4]); g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    if (on) axFlow(g, L, A.x, A.y, B.x, B.y, c, 3, 0.45);
    if (t) labText(g, t, (A.x + B.x) / 2, (A.y + B.y) / 2 - 10, { size: 11, align: 'center', col: lc(c, on ? 1 : 0.5) }); });
  Object.values(nodes).forEach(n => axNode(g, n.x, n.y, r, n.t, n.c, n.on, n.sub));
}
function tkResult(L, g, x, y, w, hh, title, R, okTxt, badTxt) {
  axCard(g, x, y, w, Math.min(hh, 120), { title, col: R.ok ? LC.bad : LC.good, hot: R.ok, ok: !R.ok, lines: [[R.ok ? '200 OK · ' + okTxt : '403 · ' + R.why, lc(R.ok ? LC.bad : LC.good, 1)], [R.ok ? R.why : badTxt, lc(LC.text, 0.8), false]] });
}
function tkDrawToken(L, g, P) {
  const F = tkForge(P.forge), parts = tkParts(F.tok), orig = tkParts(TK.svc), cols = [LC.blue, LC.violet, LC.ink], pad = 16, fs = Math.max(10, Math.min(13, L.w / 60)), wide = L.w > 760, age = L.t - (P.forgeAt || 0);
  g.font = '600 ' + fs + "px 'IBM Plex Mono', monospace"; const cw = g.measureText('M').width, per = Math.max(20, Math.floor((L.w - pad * 2) / cw));
  // the encoded token; characters that differ from the issued token glow red
  let n = 0; const ch = []; parts.forEach((p, i) => [...(p + (i < 2 ? '.' : ''))].forEach((c, j) => ch.push([c, i, i === 1 && c !== (orig[1] + '.')[j]])));
  ch.forEach(([c, i, diff]) => { const x = pad + (n % per) * cw, y = pad + 14 + Math.floor(n / per) * fs * 1.4; if (diff) { g.fillStyle = lc(LC.bad, 0.25); g.fillRect(x, y - fs, cw, fs * 1.3); } labText(g, c, x, y, { size: fs, col: lc(diff ? LC.bad : cols[i], 1) }); n++; });
  const y0 = pad + 34 + Math.ceil(n / per) * fs * 1.4, hh = L.h - y0 - pad, w = wide ? (L.w - pad * 3) / 2 : L.w - pad * 2, hh2 = wide ? hh : (hh - pad) / 2;
  const [a1, b1] = [pad, y0], [a2, b2] = wide ? [pad * 2 + w, y0] : [pad, y0 + hh2 + pad];
  const flag = { aud: 'any API that skips the check accepts it', exp: '90 days from issue', sub: 'a service account, not a person', scope: 'admin.users included' };
  let C = null; try { C = JSON.parse(P.forge); } catch (e) { C = null; }
  axCard(g, a1, b1, w, hh2, { title: 'PAYLOAD · WHAT IT GRANTS' + (P.forged ? ' · EDITED BY YOU' : ''), col: LC.violet, hot: P.forged, lines: C ? Object.entries(C).flatMap(([k, v]) =>
    [[k + ': ' + axTyped(JSON.stringify(k === 'exp' || k === 'iat' ? new Date(v * 1000).toISOString().slice(0, 10) : v), L.t, 40), flag[k] ? lc(LC.bad, 1) : lc(LC.text, 0.9)]].concat(flag[k] && !P.forged ? [['  ↳ ' + flag[k], lc(LC.bad, 0.8), false]] : [])) : [['not valid JSON', lc(LC.bad, 1)]] });
  const want = tkRaw(axHmac(TK_KEY, parts[0] + '.' + parts[1]));
  axCard(g, a2, b2, w, hh2, { title: 'SIGNATURE · HMAC-SHA256, CHECKED BY EVERY API', col: F.ok ? LC.good : LC.bad, ok: F.ok, hot: !F.ok, lines: [['signature on the token:', lc(LC.mute, 1), false], [parts[2].slice(0, 30) + '…', lc(LC.ink, 1)],
    ['recomputed over this payload:', lc(LC.mute, 1), false], [want.slice(0, 30) + '…', lc(F.ok ? LC.good : LC.bad, 1)], [F.ok ? '✓ match. Genuine, and over-powered.' : '✗ mismatch. Without the issuer’s key you cannot re-sign it.', lc(F.ok ? LC.good : LC.bad, 1), false]] });
  axStamp(g, a2 + w / 2, b2 + Math.min(hh2 - 40, 210), F.ok ? 'VALID' : 'FORGERY REJECTED', F.ok ? LC.good : LC.bad, P.forged ? age : -1, Math.min(24, w / 14));
}
function tkDeputyLay(L) { const y = L.h * 0.3; return { ravi: { x: L.w * 0.12, y, t: 'RS', sub: 'Ravi · viewer', c: LC.good }, agent: { x: L.w * 0.45, y, t: 'AI', sub: 'agent', c: LC.ink }, api: { x: L.w * 0.85, y, t: 'API', sub: 'payroll-api', c: LC.blue } }; }
function tkDrawDeputy(L, g, P) {
  const N = tkDeputyLay(L), R = tkDeputy(P), on = P.last === 'deputy', c = R.ok ? LC.bad : LC.good;
  N.agent.on = true; N.api.on = on; N.api.c = on ? c : LC.blue;
  tkFlow(L, g, P, N, [['ravi', 'agent', '“export every salary”', LC.good, true], ['agent', 'api', P.obo ? 'token: sub=ravi, act=agent' : 'token: sub=svc-ai-assistant', P.obo ? LC.good : LC.bad, true]]);
  if (on) { tkResult(L, g, 16, L.h * 0.55, L.w - 32, L.h * 0.4, 'PAYROLL API DECISION', R, '1,240 salaries exported to ravi@', 'The API checked the person, not just the agent.');
    axStamp(g, N.api.x, N.api.y + 70, R.ok ? '200 · EXPORTED' : '403 · DENIED', c, L.t - P.at - 0.5, 18); }
}
function tkPassLay(L) { return { agent: { x: L.w * 0.12, y: L.h * 0.3, t: 'AI', sub: 'agent', c: LC.ink }, plug: { x: L.w * 0.42, y: L.h * 0.3, t: 'MCP', sub: 'slides-helper (3rd party)', c: LC.bad },
  payroll: { x: L.w * 0.8, y: L.h * 0.14, t: 'PAY', sub: 'payroll-api', c: LC.blue }, mail: { x: L.w * 0.8, y: L.h * 0.48, t: 'MAIL', sub: 'mail-api', c: LC.blue } }; }
function tkDrawPass(L, g, P) {
  const N = tkPassLay(L), cur = api => P.drops.filter(d => d.api === api && d.aud === P.aud).pop();
  ['payroll', 'mail'].forEach(a => { const d = cur(a); if (d) { N[a].on = true; N[a].c = d.r.ok ? LC.bad : LC.good; } else N[a].c = LC.blue; });
  tkFlow(L, g, P, N, [['agent', 'plug', 'token aud=' + (P.aud ? 'mcp-slides' : '*'), P.aud ? LC.good : LC.bad, true], ['plug', 'payroll', cur('payroll') ? 'replayed' : '', cur('payroll') && cur('payroll').r.ok ? LC.bad : LC.mute, !!cur('payroll')],
    ['plug', 'mail', cur('mail') ? 'replayed' : '', cur('mail') && cur('mail').r.ok ? LC.bad : LC.mute, !!cur('mail')]]);
  if (!P.drops.length) ['payroll', 'mail'].forEach(a => { g.setLineDash([5, 5]); g.strokeStyle = lc(LC.ink, 0.4 + 0.3 * Math.sin(L.t * 3)); g.beginPath(); g.arc(N[a].x, N[a].y, 44, 0, 7); g.stroke(); g.setLineDash([]);
    labText(g, 'drop here', N[a].x, N[a].y - 52, { size: 10, align: 'center', col: lc(LC.ink, 0.8) }); });
  ['payroll', 'mail'].forEach(a => { const d = cur(a); if (d) axStamp(g, N[a].x - Math.min(150, L.w * 0.16), N[a].y, d.r.ok ? 'ACCEPTED' : 'REJECTED', d.r.ok ? LC.bad : LC.good, L.t - d.at - 0.5, 16); });
  const last = P.drops[P.drops.length - 1];
  if (last) tkResult(L, g, 16, L.h * 0.68, L.w - 32, L.h * 0.3, (last.api === 'slides' ? 'SLIDES-HELPER' : last.api.toUpperCase() + ' API') + ' · TOKEN aud=' + (last.aud ? 'mcp-slides' : '*'), last.r, last.api === 'payroll' ? 'salaries read by the plugin' : last.api === 'mail' ? 'mail sent as the agent' : 'the plugin’s own call', 'The token was minted for the plugin only.');
}
function tkDrawStolen(L, g, P) {
  const d = Math.round(P.days * 120), R = tkReplay(P), pad = 16, x0 = L.w * 0.08, x1 = L.w * 0.92, y = L.h * 0.3, life = P.bind ? 10 / 1440 : 90;
  labText(g, 'DAY 0 · LEAKED', x0, y - 30, { size: 10, w: 700, col: lc(LC.bad, 1) }); labText(g, 'DAY 120', x1, y - 30, { size: 10, w: 700, align: 'right', col: lc(LC.mute, 1) });
  g.fillStyle = 'rgba(141,182,242,.1)'; g.fillRect(x0, y - 8, x1 - x0, 16);
  g.fillStyle = lc(LC.bad, 0.5); g.fillRect(x0, y - 8, Math.max(2, (x1 - x0) * Math.min(1, life / 120)), 16);
  labText(g, P.bind ? 'valid 10 minutes' : 'valid 90 days', x0 + 6, y + 26, { size: 10, col: lc(LC.bad, 1) });
  const px = x0 + (x1 - x0) * P.days; g.strokeStyle = lc(LC.ink, 1); g.lineWidth = 2; g.beginPath(); g.moveTo(px, y - 18); g.lineTo(px, y + 18); g.stroke(); g.lineWidth = 1;
  labText(g, 'day ' + d, px, y + 44, { size: 12, w: 700, align: 'center', col: lc(LC.ink, 1) });
  // the replay itself, looping: laptop → payroll-api
  const lx = L.w * 0.2, ax = L.w * 0.8, ry = L.h * 0.5;
  axNode(g, lx, ry, 22, '💻', LC.bad, true, 'attacker’s laptop'); axNode(g, ax, ry, 22, 'PAY', R.ok ? LC.bad : LC.good, true, 'payroll-api');
  g.strokeStyle = lc(R.ok ? LC.bad : LC.mute, 0.5); g.beginPath(); g.moveTo(lx + 24, ry); g.lineTo(ax - 24, ry); g.stroke(); axFlow(g, L, lx + 24, ry, ax - 24, ry, R.ok ? LC.bad : LC.mute, 3, 0.5);
  axStamp(g, (lx + ax) / 2, ry - 4, R.ok ? 'REPLAY ACCEPTED' : 'REPLAY REJECTED', R.ok ? LC.bad : LC.good, 1, 18);
  tkResult(L, g, pad, L.h * 0.66, L.w - pad * 2, L.h * 0.3, 'REPLAY FROM AN UNKNOWN LAPTOP · ' + (d ? 'DAY ' + d : 'MINUTE 1'), R, 'payroll read as svc-ai-assistant', P.bind ? 'The copy has no private key to prove possession.' : 'Expired: the only control was the clock.');
}
function tkHopBox(L, i) { if (i >= TK_HOPS.length) return null; const pad = 20, sx = (L.w - pad * 2) / TK_HOPS.length, base = L.h - 60, sy = (L.h - 140) / TK_HOPS.length; return { x: pad + sx * i + 4, w: sx - 8, y: base - sy * TK_HOPS[i].lvl, base }; }
function tkDrawHops(L, g, P) {
  const pad = 20, n = TK_HOPS.length, sx = (L.w - pad * 2) / n, base = L.h - 60, sy = (L.h - 140) / n;
  labText(g, 'PRIVILEGE ↑', pad, 24, { size: 10, w: 700, col: lc(LC.mute, 1) });
  TK_HOPS.forEach((x, i) => { const on = i < P.hops, nxt = i === P.hops, cx = pad + sx * i + sx / 2, cy = base - sy * x.lvl, fresh = i === P.hops - 1 && L.t - P.hopAt < 1;
    if (nxt) labGlow(g, cx, cy, sx * 0.8, LC.ink, 0.2 + 0.12 * Math.sin(L.t * 4));
    g.fillStyle = on ? lc(i ? LC.bad : LC.ink, 0.2) : nxt ? lc(LC.ink, 0.08) : 'rgba(141,182,242,.05)'; g.fillRect(pad + sx * i + 4, cy, sx - 8, base - cy);
    g.strokeStyle = lc(on ? (i ? LC.bad : LC.ink) : nxt ? LC.ink : LC.mute, on || nxt ? 0.9 : 0.25); if (nxt) g.setLineDash([5, 4]); g.strokeRect(pad + sx * i + 4, cy, sx - 8, base - cy); g.setLineDash([]);
    if (fresh) labGlow(g, cx, cy, sx, LC.bad, 0.5 * (1 - (L.t - P.hopAt)));
    // a staircase over the bar tops, climbing in the gap between bars
    if (on && i) { const px = pad + sx * (i - 1) + sx / 2, py = base - sy * TK_HOPS[i - 1].lvl - 10, gx = pad + sx * i; g.strokeStyle = lc(LC.bad, 0.9); g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, py); g.lineTo(gx, py); g.lineTo(gx, cy - 10); g.lineTo(cx, cy - 10); g.stroke(); g.lineWidth = 1; }
    const fs = Math.max(9, Math.min(12, sx / 9));
    labText(g, x.name, cx, base + 18, { size: fs, w: 700, align: 'center', col: lc(on ? (i ? LC.bad : LC.ink) : LC.mute, 1) });
    if (nxt) labText(g, 'click', cx, cy + 22, { size: 11, w: 700, align: 'center', col: lc(LC.ink, 0.7 + 0.3 * Math.sin(L.t * 4)) });
    if (on) { g.font = "500 10px 'IBM Plex Sans', sans-serif"; piWrap(g, x.says, sx - 14).slice(0, 4).forEach((t, j) => labText(g, t, pad + sx * i + 8, cy + 16 + j * 12, { size: 10, mono: false, w: 500, col: lc(LC.text, 0.85) })); } });
  // the agent's badge riding the staircase
  if (P.hops) { const i = P.hops - 1, k = NN.sync ? 1 : fiEase((L.t - P.hopAt) / 0.5), from = i ? i - 1 : 0, fx = pad + sx * from + sx / 2, fy = base - sy * TK_HOPS[from].lvl - 26, tx = pad + sx * i + sx / 2, ty = base - sy * TK_HOPS[i].lvl - 26;
    const x = fx + (tx - fx) * k, y = fy + (ty - fy) * k - Math.sin(k * Math.PI) * 30; labGlow(g, x, y, 30, LC.bad, 0.4); axNode(g, x, y, 14, '🎫', LC.ink, true); }
  if (P.hops === n) axStamp(g, L.w * 0.3, L.h * 0.3, 'CLOUD OWNER', LC.bad, L.t - P.hopAt - 0.4, 26);
}
function tkPulse(L, P, k) { if (!L.w) return;
  if (k === 'deputy') { const N = tkDeputyLay(L); for (let i = 0; i < 12; i++) { labPulse(L, N.ravi.x, N.ravi.y, N.agent.x, N.agent.y, LC.good, { delay: i * 0.03 }); labPulse(L, N.agent.x, N.agent.y, N.api.x, N.api.y, P.obo ? LC.good : LC.bad, { delay: 0.5 + i * 0.03 }); } }
}

NN_SIMS.push({ id: 'badge', title: 'The borrowed badge', kicker: 'Tokens · permission escalation', blurb: 'Try to forge an agent’s real token and fail, then borrow it instead: a viewer exports payroll, a plugin replays it, a leaked copy works for 90 days, and six clicks climb to cloud Owner.', mount: tkMount,
  brief: { what: 'Agents act through tokens. When the token is the agent’s own, wide, long-lived and accepted anywhere, every person who can talk to the agent, and every tool it calls, borrows that badge. Escalation then needs no exploit: just the permissions it already holds.',
    real: 'Stolen OAuth tokens from the Salesloft Drift AI chat integration opened hundreds of Salesforce orgs (Aug 2025). Prompt injection made Copilot switch on its own auto-approve (CVE-2025-53773). An agent with a service-role key read a secrets table from a support ticket (Supabase MCP, 2025).',
    todo: ['Try to forge the agent’s token; let a viewer use it to export payroll', 'Drag it onto internal APIs as a plugin; leak it and replay it for 90 days', 'Climb from “edit files” to cloud Owner, then close every path'] },
  guide: [
    { look: [['blue', '▭', 'The encoded token. Red characters: the bytes you changed.'], ['violet', '▭', 'Payload: who it is and what it may do.'], ['ink', '▭', 'Signature: recomputed live over your edit.']],
      why: 'Edit the payload. The token and the signature check are real: without the issuer’s key no edit survives. That is why attackers steal tokens instead of forging them.' },
    { look: [['good', '◯', 'Ravi, a viewer.'], ['ink', '◯', 'The agent.'], ['bad', '▭', 'Red result: the API allowed it.']],
      why: 'Send it both ways. With its own token the agent is a confused deputy: it does for anyone what only it is allowed to do.' },
    { look: [['bad', '◯', 'A third-party tool server you plugged in.'], ['blue', '◯', 'Your internal APIs. Drop the token on them.']],
      why: 'Drag, then toggle and drag again. A token with aud * is accepted by everything, so anything you hand it to becomes you.' },
    { look: [['bad', '▬', 'How long the copy stays valid.'], ['ink', '|', 'Today, after the leak.']],
      why: 'Drag the time. A bearer token is a password with an expiry date. Binding it to a key makes a copy worthless.' },
    { look: [['ink', '▮', 'Where the agent starts. Dashed: the next hop, click it.'], ['bad', '▮', 'Each hop uses the access from the last.']],
      why: 'Climb. Each step is something the agent was allowed to do. Escalation is a path through permissions, not a bug.' },
    { look: [['bad', '●', 'Open paths.'], ['good', '✓', 'Closed by a control.']],
      why: 'Identity controls, not model controls. Most already exist in your IdP and cloud IAM.' },
    { why: 'Your rights, one audience, minutes, bound to a key, and never in the prompt.' }] });
NN_BY.badge = NN_SIMS[NN_SIMS.length - 1];
Object.assign(NN_LINK, { supabase: 'badge' });
