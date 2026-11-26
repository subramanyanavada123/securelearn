'use strict';
/* Core lab · "Harden NEXUS". The console fires NEXUS's own failures through
   one pipeline; only the layers a table has cleared defend. Each layer is a
   brief, an off/on simulation, four drills and a debrief, one screen each.
   Deterministic, like the RAG Lab. Routes: '#harden', '#harden-<layer id>'. */

const HD = Object.fromEntries(HARDEN_LAYERS.map(l => [l.id, l]));
const HD_STEP = 0.45; // seconds per pipeline node
const HD_SCREENS = 7; // brief, simulation, four drills, debrief

function hdState() { S.harden = S.harden || { done: {}, ans: {}, i: {}, sim: {}, shot: null }; return S.harden; }
function hdOn(id) { return !!hdState().done[id]; }
function hdAns(id) { const H = hdState(); return H.ans[id] || (H.ans[id] = {}); }
function hdSim(id) { const H = hdState(); return H.sim[id] || (H.sim[id] = { on: true, sc: null }); }
function hdLayersFor(id) { return HARDEN_LAYERS.filter(l => l.lab === id || l.ep === id); } // for links from labs and episodes
function hdLink(l) { return h('a', { class: 'raglink hdlink', href: '#harden-' + l.id }, h('b', null, 'Core lab: Harden NEXUS · Layer ' + l.n), h('span', null, l.title + ': switch the control off and on, then four drills. →')); }

/* ---------- scoring ---------- */
function hdAnswered(q, a) { return a != null && (q.t === 'mcq' || (q.t === 'order' ? !!a.checked : q.rows.every((_, k) => a[k] != null))); }
function hdRight(q, a) {
  if (!hdAnswered(q, a)) return false;
  return q.t === 'mcq' ? a === q.a : q.t === 'order' ? a.seq.every((x, k) => x === k) : q.rows.every((r, k) => a[k] === r[1]);
}
function hdScore(L) { const A = hdAns(L.id); return L.qs.filter((q, k) => hdRight(q, A[k])).length; }
function hdStarsFor(right, total) { return right === total ? 3 : right >= total - 1 ? 2 : 1; }
function hdOrderPool(n) { return [...Array(n).keys()].sort((x, y) => (x * 5 + 2) % 7 - (y * 5 + 2) % 7); }

/* ---------- the console: NEXUS's failures through the cleared layers ---------- */
function hdShot(a) {
  const steps = [], defs = a.def || [];
  for (let i = 0; i < HD_NODES.length; i++) {
    const n = HD_NODES[i], d = defs.filter(x => x[0] === i);
    if (d.length) {
      for (const [, lay, ok, bad, contain] of d) {
        if (hdOn(lay)) { steps.push([i, contain ? 'contain' : 'block', ok]); return steps; }
        steps.push([i, 'offline', bad]);
      }
    } else if (i === 0) steps.push([i, 'enter', a.ask]);
    else if (n.kind === 'agent') steps.push([i, 'enter', a.agent]);
    else if (n.kind === 'data') steps.push([i, a.kind === 'benign' ? 'served' : 'breach', a.end]);
    else if (a.kind === 'benign') { const on = n.layers.every(hdOn); steps.push([i, on ? 'pass' : 'passoff', on ? 'checked and clear' : 'offline: nothing is checked']); }
  }
  return steps;
}
function hdOutcome(a) { const st = hdShot(a); return st[st.length - 1][1]; }

/* ---------- the animated pipeline, shared by the console and every layer ---------- */
function hdClass(v) { return v === 'block' || v === 'served' ? 'block' : v === 'breach' ? 'hit' : v === 'contain' ? 'contain' : v === 'offline' || v === 'passoff' ? 'off' : 'pass'; }
function hdFlow(nodes, steps, kind) {
  const at = {}; steps.forEach(st => { at[st[0]] = st; });
  const stop = steps.length ? steps[steps.length - 1][0] : -1;
  return h('div', { class: 'hdflow' },
    h('div', { class: 'hdscroll' }, h('div', { class: 'hdtrack', style: '--n:' + nodes.length },
      nodes.map((n, i) => h('div', { class: 'hn ' + n.kind + (n.kind === 'def' && !n.on ? ' down' : '') + (at[i] ? ' ' + hdClass(at[i][1]) : stop >= 0 && i > stop ? ' idle' : ''),
        style: at[i] ? 'animation-delay:' + (HD_STEP * i).toFixed(2) + 's' : null }, h('b', null, n.name), n.kind === 'def' ? h('small', null, n.on ? 'online' : 'offline') : null)),
      stop >= 0 ? h('i', { class: 'hpacket ' + kind, style: '--stop:' + stop + ';animation-duration:' + (HD_STEP * stop + 0.3).toFixed(2) + 's' }) : null)),
    steps.length ? h('ol', { class: 'hdnarr' }, steps.map(([i, v, t]) => h('li', { class: hdClass(v), style: 'animation-delay:' + (HD_STEP * i + 0.15).toFixed(2) + 's' }, h('b', null, nodes[i].name + ': '), t))) : null);
}
const HD_MARK = { block: '✓', served: '✓', contain: '!', breach: '✗' };
const HD_SAYS = { block: 'Stopped', served: 'Served', contain: 'Contained', breach: 'Breach' };

function hdHome() {
  const H = hdState(), online = HARDEN_LAYERS.filter(l => hdOn(l.id)).length;
  const fails = HD_ATTACKS.filter(a => a.hour), stopped = fails.filter(a => hdOutcome(a) !== 'breach').length;
  const shot = HD_ATTACKS.find(a => a.id === H.shot);
  const nodes = HD_NODES.map(n => ({ kind: n.kind, name: n.name, on: !n.layers || n.layers.every(hdOn) }));
  const steps = shot ? hdShot(shot) : [], end = steps.length ? steps[steps.length - 1][1] : null;
  return h('div', { class: 'sc sc-hd' },
    h('span', { class: 'kicker' }, 'Core lab · Modules 08 to 15'), h('h1', null, 'Harden NEXUS'),
    h('p', { class: 'lead' }, 'NEXUS failed in 72 hours. Rebuild it as seven defence layers, one for each kind of failure. Fire NEXUS’s own failures at the pipeline: only the layers you have cleared defend.'),
    h('div', { class: 'finalm' }, h('div', null, h('b', null, online + ' / 7'), h('span', null, 'Layers online')), h('div', null, h('b', null, stopped + ' / ' + fails.length), h('span', null, 'NEXUS failures stopped'))),
    h('p', { class: 'prompt-small' }, 'Fire one at the pipeline'),
    h('div', { class: 'hdshots' }, HD_ATTACKS.map(a => { const o = hdOutcome(a);
      return h('button', { type: 'button', class: 'hdshot ' + a.kind + (H.shot === a.id ? ' active' : ''), 'aria-pressed': String(H.shot === a.id), onclick: () => { H.shot = a.id; commit(); } },
        h('i'), a.hour ? h('b', null, 'H' + a.hour) : null, h('span', null, a.label), h('em', { class: hdClass(o) }, HD_MARK[o])); })),
    shot ? h('p', { class: 'hdask' }, h('b', null, shot.hour ? 'Hour ' + shot.hour + ': ' : ''), shot.ask) : h('p', { class: 'small' }, 'Pick a failure above to watch it travel through NEXUS.'),
    hdFlow(nodes, steps, shot ? shot.kind : ''),
    end ? h('div', { class: 'consequence ' + (end === 'breach' ? 'bad' : end === 'contain' ? 'ok' : 'good'), style: 'animation-delay:' + (HD_STEP * steps[steps.length - 1][0] + 0.5).toFixed(2) + 's' },
      h('span', { class: 'verdict ' + (end === 'breach' ? 'bad' : end === 'contain' ? 'amber' : 'good') }, HD_SAYS[end]),
      h('p', null, end === 'breach' ? 'Clear the layer that guards this path to change the outcome.' : end === 'contain' ? 'A later layer caught it. Clear the earlier one to stop it outright.' : shot.kind === 'benign' ? 'Defence should not cost the business: legitimate work still flows.' : 'A layer you cleared stopped it.')) : null,
    h('h2', null, 'The seven layers'),
    h('div', { class: 'eps hdlayers' }, HARDEN_LAYERS.map((l, k) => { const d = hdState().done[l.id];
      return h('a', { class: 'ep' + (d ? ' done' : ''), href: '#harden-' + l.id, style: 'animation-delay:' + (0.04 * k) + 's' },
        h('span', { class: 'epn' }, l.n), h('b', null, l.title), h('span', { class: 'ept' }, 'Module ' + l.mod + (l.hours.length ? ' · Hour ' + l.hours.join(', ') : ' · the board’s layer')),
        h('span', { class: 'epstars' }, d ? [0, 1, 2].map(j => h('i', { class: j < d.stars ? 'on' : '' }, '★')) : '')); })));
}

/* ---------- one layer ---------- */
function hdWhy(q, ok) {
  return h('div', { class: 'consequence ' + (ok ? 'good' : 'bad') }, h('span', { class: 'verdict ' + (ok ? 'good' : 'bad') }, ok ? 'Strong call' : 'Not the strongest control'), h('p', null, q.why));
}
function hdBrief(L) {
  return h('div', { class: 'sc sc-hd' },
    h('span', { class: 'kicker' }, 'Layer ' + L.n + ' · Module ' + L.mod + (L.hours.length ? ' · fixes Hour ' + L.hours.join(' and ') : '')), h('h2', null, L.title),
    h('div', { class: 'hdthreat' }, h('b', null, 'What happened at NEXUS'), h('p', null, L.threat)),
    h('p', { class: 'lead' }, L.lede),
    h('div', { class: 'hdnote' }, h('b', null, 'Why this matters to you'), h('p', null, L.why)),
    h('p', { class: 'small' }, h('b', null, 'What is left after the fix: '), L.residual));
}
function hdSimScreen(L) {
  const sim = hdSim(L.id), sc = sim.sc != null ? L.sims[sim.sc] : null;
  const nodes = L.pipe.map(([kind, name]) => ({ kind, name, on: sim.on }));
  return h('div', { class: 'sc sc-hd' },
    h('h2', null, 'Switch it off, then on'),
    h('p', { class: 'prompt-small' }, 'Pick a scenario. Off shows NEXUS as it was; on shows the layer doing its job.'),
    h('div', { class: 'hdtog', role: 'group', 'aria-label': L.defname }, h('span', null, L.defname),
      [['Off', false], ['On', true]].map(([t, v]) => h('button', { type: 'button', 'aria-pressed': String(sim.on === v), onclick: () => { sim.on = v; commit(); } }, t))),
    h('div', { class: 'hdshots' }, L.sims.map((x, k) => h('button', { type: 'button', class: 'hdshot ' + x.kind + (sim.sc === k ? ' active' : ''), 'aria-pressed': String(sim.sc === k), onclick: () => { sim.sc = k; commit(); } },
      h('i'), h('span', null, x.label), x.kind === 'novel' ? h('em', { class: 'novel' }, 'often missed') : null))),
    hdFlow(nodes, sc ? (sim.on ? sc.on : sc.off) : [], sc ? sc.kind : ''));
}
function hdDrill(L, qi) {
  const q = L.qs[qi], A = hdAns(L.id), a = A[qi], head = [h('span', { class: 'prompt-small' }, 'Drill ' + (qi + 1) + ' of ' + L.qs.length), h('h2', null, q.q)];
  if (q.t === 'mcq') return h('div', { class: 'sc sc-hd' }, head,
    h('div', { class: 'cards' }, q.o.map((o, j) => h('button', { type: 'button', class: 'card-opt' + (a != null ? (j === q.a ? ' right' : j === a ? ' wrong' : ' dim') : ''), disabled: a != null ? true : null,
      style: 'animation-delay:' + (0.05 * j) + 's', onclick: () => { A[qi] = j; commit(); } }, h('div', { class: 'optrow' }, h('span', { class: 'optkey' }, String.fromCharCode(65 + j))), h('b', null, o)))),
    a != null ? hdWhy(q, a === q.a) : null);
  if (q.t === 'order') {
    const o = a || { seq: [] }, pool = hdOrderPool(q.s.length).filter(k => !o.seq.includes(k)), ok = hdRight(q, o);
    return h('div', { class: 'sc sc-hd' }, head,
      h('div', { class: 'hdseq' }, o.seq.length ? o.seq.map((k, p) => h('button', { type: 'button', class: 'hdstep' + (o.checked ? (k === p ? ' right' : ' wrong') : ''), disabled: o.checked ? true : null,
        onclick: () => { o.seq.splice(p, 1); A[qi] = o; commit(); } }, h('span', null, String(p + 1)), q.s[k])) : h('p', { class: 'small' }, 'Tap the steps below, first to last. Tap a placed step to take it back.')),
      pool.length ? h('div', { class: 'hdpool' }, pool.map(k => h('button', { type: 'button', class: 'hdstep', onclick: () => { o.seq.push(k); A[qi] = o; commit(); } }, '+ ' + q.s[k]))) : null,
      !o.checked && !pool.length ? h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', onclick: () => { o.checked = true; commit(); } }, 'Check the order')) : null,
      o.checked && !ok ? h('ol', { class: 'hdfix' }, q.s.map(t => h('li', null, t))) : null,
      o.checked ? hdWhy(q, ok) : null);
  }
  const o = a || {};
  return h('div', { class: 'sc sc-hd' }, head,
    h('div', { class: 'hdsort' }, q.rows.map(([t, b], ri) => { const p = o[ri];
      return h('div', { class: 'hdrow' + (p != null ? (p === b ? ' right' : ' wrong') : '') }, h('span', null, t),
        h('div', { class: 'hdbins' }, q.bins.map((bn, bi) => h('button', { type: 'button', 'aria-pressed': String(p === bi), class: p != null && p !== b && bi === b ? 'was' : null, disabled: p != null ? true : null,
          onclick: () => { o[ri] = bi; A[qi] = o; commit(); } }, bn)))); })),
    hdAnswered(q, o) ? hdWhy(q, hdRight(q, o)) : null);
}
function hdDebrief(L) {
  const right = hdScore(L), n = hdStarsFor(right, L.qs.length);
  return h('div', { class: 'sc sc-recap sc-hd' },
    h('span', { class: 'kicker' }, L.defname + ' online'), h('h2', null, 'Layer ' + L.n + ' complete'),
    h('div', { class: 'stars' }, [0, 1, 2].map(k => h('span', { class: 'star' + (k < n ? ' on' : ''), style: 'animation-delay:' + (0.2 + 0.15 * k) + 's' }, '★'))),
    h('p', { class: 'lead' }, right + ' of ' + L.qs.length + ' drills right.' + (L.hours.length ? ' On the console, NEXUS’s Hour ' + L.hours.join(' and Hour ') + ' now meets this layer.' : ' Shadow agents now meet the inventory on the console.')),
    h('ul', { class: 'lessons' }, L.take.map((t, k) => h('li', { style: 'animation-delay:' + (0.4 + 0.15 * k) + 's' }, t))),
    h('div', { class: 'hdnote' }, h('b', null, 'For leadership'), h('p', null, L.lead)),
    h('div', { class: 'btnrow center' },
      h('a', { class: 'btn', href: '#' + L.ep }, 'Episode ' + L.ep.slice(1)), h('a', { class: 'btn', href: '#' + L.lab }, 'Workbench lab'), h('a', { class: 'btn', href: '#deck-' + L.lab }, 'Module slides'),
      h('button', { type: 'button', class: 'btn', onclick: () => { const H = hdState(); H.ans[L.id] = {}; H.i[L.id] = 0; delete H.sim[L.id]; commit(); } }, 'Replay')));
}
function hdScreenDone(L, i) {
  if (i === 1) return hdSim(L.id).sc != null;
  if (i >= 2 && i < 2 + L.qs.length) return hdAnswered(L.qs[i - 2], hdAns(L.id)[i - 2]);
  return true;
}

function renderHarden(hash) {
  const H = hdState(), L = HD[hash.slice(7)];
  let top, body, foot, dots = null, key;
  if (!L) {
    const next = HARDEN_LAYERS.find(l => !hdOn(l.id));
    top = h('div', { class: 'eptitle' }, h('span', null, pathCrumb('Build lab · seven defence layers')), h('b', null, 'Harden NEXUS'));
    body = hdHome(); key = 'hd:' + H.shot;
    foot = [h('a', { class: 'btn ghost', href: pathBack('#') }, pathCtx() ? '← Path' : '← Home'), h('span', { class: 'hint' }, HARDEN_LAYERS.filter(l => hdOn(l.id)).length + ' of 7 layers online'),
      next ? h('a', { class: 'btn primary', href: '#harden-' + next.id }, (next === HARDEN_LAYERS[0] ? 'Start: ' : 'Next: ') + 'Layer ' + next.n + ' →') : pathGo('#e16', 'Capstone →', 'btn primary')];
  } else {
    const i = Math.min(H.i[L.id] || 0, HD_SCREENS - 1), done = hdScreenDone(L, i), idx = HARDEN_LAYERS.indexOf(L), next = HARDEN_LAYERS[idx + 1];
    const go = d => { H.i[L.id] = i + d; if (i + d === HD_SCREENS - 1) { const n = hdStarsFor(hdScore(L), L.qs.length); H.done[L.id] = { stars: Math.max(n, (H.done[L.id] || {}).stars || 0) }; } commit(); };
    top = h('div', { class: 'eptitle' }, h('span', null, pathCtx() ? pathCrumb('') + ' · Layer ' + L.n : 'Harden NEXUS · Layer ' + L.n), h('b', null, L.title));
    dots = h('div', { class: 'dots' }, [...Array(HD_SCREENS)].map((_, k) => h('span', { class: 'dot' + (k < i ? ' past' : k === i ? ' now' : '') })));
    body = i === 0 ? hdBrief(L) : i === 1 ? hdSimScreen(L) : i < HD_SCREENS - 1 ? hdDrill(L, i - 2) : hdDebrief(L);
    key = 'hd:' + L.id + ':' + i + (i === 1 ? ':' + hdSim(L.id).sc + ':' + hdSim(L.id).on : '');
    const q = i >= 2 && i < HD_SCREENS - 1 ? L.qs[i - 2] : null;
    foot = [i === 0 ? h('a', { class: 'btn ghost', href: '#harden' }, '← Console') : h('button', { type: 'button', class: 'btn ghost', onclick: () => go(-1) }, '← Back'),
      h('span', { class: 'hint' }, done ? (i === 0 ? 'Module ' + L.mod : '') : i === 1 ? 'Run a scenario to continue' : q.t === 'order' ? 'Place every step, then check' : q.t === 'sort' ? 'Place every card' : 'Pick one'),
      i < HD_SCREENS - 1 ? h('button', { type: 'button', class: 'btn primary', disabled: done ? null : true, onclick: () => go(1) }, i === HD_SCREENS - 2 ? 'Bring the layer online →' : i === 0 ? 'Begin →' : 'Continue →')
        : next ? h('a', { class: 'btn primary', href: '#harden-' + next.id }, 'Next: Layer ' + next.n + ' →') : h('a', { class: 'btn primary', href: '#harden' }, 'Back to the console →')];
  }
  const anim = Story.last !== key && !key.startsWith('hd:' + (L ? L.id + ':1' : '')) ? ' enter-f' : ''; Story.last = key;
  return h('div', { class: 'stage' + (L ? '' : ' hdconsole') },
    h('header', { class: 'stagetop' }, h('a', { class: 'close', href: L ? '#harden' : pathBack('#'), 'aria-label': L ? 'Back to the console' : pathCtx() ? 'Back to your path' : 'Home' }, '✕'), top),
    dots || h('div', { class: 'dots' }),
    h('main', { class: 'scenewrap' + anim }, body),
    h('footer', { class: 'stagebot' }, foot));
}
