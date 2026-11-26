'use strict';
/* The Advanced path (#adv): real attacks for participants past the basics.
   #adv lists the tracks; #adv-<case> walks one attack chain stage by stage,
   then shows why the controls lost, what detection would see, and two calls.
   Answers live in S.adv, apart from the labs. */

const ADV = Object.fromEntries(ADV_CASES.map(c => [c.id, c]));
const ADV_WHO = { atk: 'Attacker', sys: 'System', def: 'Defender' };

function advState() { return S.adv || (S.adv = { seen: {}, pk: {} }); }
function advSeen(id) { return advState().seen[id] || 0; }
function advWalked(c) { return advSeen(c.id) >= c.steps.length - 1; }
function advPicks(id) { const pk = advState().pk; return pk[id] || (pk[id] = {}); }
function advScore(c) { const p = (advState().pk || {})[c.id] || {}; return sum(c.qs.map((q, i) => p[i] != null ? q.o[p[i]][1] : 0)); }
function advDone(c) { const p = (advState().pk || {})[c.id] || {}; return advWalked(c) && c.qs.every((_, i) => p[i] != null); }

function advChain(c, at) {
  const n = c.steps.length, W = 1000, gap = (W - 120) / (n - 1), g = [];
  g.push(s('line', { x1: 60, y1: 52, x2: 60 + gap * (n - 1), y2: 52, class: 'advwire' }));
  g.push(s('line', { x1: 60, y1: 52, x2: 60 + gap * at, y2: 52, class: 'advwire on' }));
  c.steps.forEach(([who, short], i) => {
    const x = 60 + gap * i;
    g.push(s('g', { class: 'advnode ' + who + (i === at ? ' now' : i <= advSeen(c.id) ? ' seen' : ''), tabindex: 0, role: 'button', 'aria-label': 'Stage ' + (i + 1) + ': ' + short,
      onclick: () => advGo(c, i), onkeydown: e => { if (e.key === 'Enter') advGo(c, i); } },
      s('circle', { cx: x, cy: 52, r: 26 }), s('text', { x, y: 58, class: 'advn', 'text-anchor': 'middle' }, String(i + 1)),
      s('text', { x, y: 106, class: 'advl', 'text-anchor': 'middle' }, short)));
  });
  return svgWrap(W, 124, 'Attack chain: ' + c.steps.map(x => x[1]).join(', then '), 620, g);
}
function advGo(c, i) { const st = advState(); st.at = st.at || {}; st.at[c.id] = i; st.seen[c.id] = Math.max(advSeen(c.id), i); commit(); }

function advCall(c, q, qi) {
  const p = advPicks(c.id), pick = p[qi], done = pick != null, best = q.o.findIndex(o => o[1] === 10);
  const order = q.o.map((_, i) => (i + ADV_CASES.indexOf(c) + qi) % q.o.length);
  const tone = sc => sc === 10 ? 'good' : sc === 5 ? 'amber' : 'bad';
  return h('div', { class: 'advcall' }, h('b', null, q.q),
    h('div', { class: 'moves' }, order.map((oi, j) => { const [t, sc, why] = q.o[oi];
      return h('button', { type: 'button', class: 'move' + (done ? (oi === pick ? ' picked ' + tone(sc) : oi === best ? ' best' : ' dim') : ''), 'aria-disabled': done ? 'true' : null,
        onclick: () => { if (done) return; p[qi] = oi; commit(); } },
        h('span', { class: 'mvkey' }, String.fromCharCode(65 + j)),
        h('span', { class: 'mvtext' }, t, done && (oi === pick || oi === best) ? h('span', { class: 'mfx' }, h('b', null, sc + ' points · '), why) : null)); })));
}

function advCase(c) {
  const st = advState(), at = Math.min((st.at || {})[c.id] || 0, c.steps.length - 1), [who, short, text] = c.steps[at];
  const tr = ADV_TRACKS.find(t => t.id === c.track), list = ADV_CASES, idx = list.indexOf(c), prev = list[idx - 1], next = list[idx + 1];
  const walked = advWalked(c), def = c.track === 'mod';
  return [
    h('section', { class: 'labhead' },
      h('div', { class: 'crumbs' }, h('a', { class: 'back', href: '#adv' }, '← Advanced path'), h('span', { class: 'spacer' })),
      h('span', { class: 'eyebrow' }, tr.name + ' · ' + c.date),
      h('h1', null, c.title), h('p', { class: 'leadq big' }, c.hook)),
    NN_LINK[c.id] ? h('a', { class: 'raglink nnhero', href: '#adv-nn-' + NN_LINK[c.id] }, h('b', null, 'See it inside the model: ' + NN_BY[NN_LINK[c.id]].title), h('span', null, NN_BY[NN_LINK[c.id]].blurb + ' →')) : null,
    h('div', { class: 'pane' }, SIGS[c.id] ? sigMount(c) : null, advTake(c),
    box('advstage', label((def ? 'How it works' : 'How it unfolded') + ' · stage ' + (at + 1) + ' of ' + c.steps.length), advChain(c, at),
      h('div', { class: 'advstep ' + who }, h('span', { class: 'pill ' + (who === 'atk' ? 'bad' : who === 'def' ? 'good' : '') }, ADV_WHO[who]), h('h3', null, short), h('p', null, text)),
      h('div', { class: 'btnrow' },
        at > 0 ? h('button', { type: 'button', class: 'btn', onclick: () => advGo(c, at - 1) }, '← Previous stage') : null,
        at < c.steps.length - 1 ? h('button', { type: 'button', class: 'btn primary', onclick: () => advGo(c, at + 1) }, 'Next stage →') : null)),
    walked ? h('div', { class: 'advpair' },
      box('advgap', label(def ? 'What still beats it' : 'Why the usual controls lost'), h('p', null, c.gap)),
      box('advsig', label(def ? 'How to prove it works' : 'What detection would have seen'), h('p', null, c.signal)))
      : box('advlock', h('p', { class: 'sub' }, 'Walk the chain to the last stage to see why the controls lost and what detection would have seen.')),
    box('advcalls', label('Your calls · ' + advScore(c) + ' of ' + c.qs.length * 10), c.qs.map((q, i) => advCall(c, q, i))),
    h('p', { class: 'small advsrc' }, h('b', null, 'Source: '), c.source)),
    h('nav', { class: 'pager' }, prev ? h('a', { href: '#adv-' + prev.id }, '← ' + prev.title) : h('span'), next ? h('a', { href: '#adv-' + next.id }, next.title + ' →') : h('span'))
  ];
}

// What a security team does with this on Monday: deploy, detect, test, ask.
function advTake(c) {
  const tk = TAKE[c.id]; if (!tk) return null;
  const [dep, det, test, ask] = tk;
  return h('section', { class: 'take' }, h('div', { class: 'takehead' }, h('span', null, 'For your security team'), h('b', null, 'What changes on Monday')),
    h('div', { class: 'takegrid' },
      h('div', { class: 'takeitem' }, h('i', null, 'Deploy'), h('p', null, dep)),
      h('div', { class: 'takeitem det' }, h('i', null, 'Detect'), h('code', null, det), copyButton(() => det, 'Copy rule')),
      h('div', { class: 'takeitem' }, h('i', null, 'Test'), h('p', null, test)),
      h('div', { class: 'takeitem' }, h('i', null, 'Ask'), h('p', null, ask))));
}

const AdvV = { v: 'sims', t: 'all' };
function advIndex() {
  const done = ADV_CASES.filter(advDone).length, pts = sum(ADV_CASES.map(advScore));
  const sims = NN_SIMS.filter(x => x.track !== 'gov' && x.track !== 'ops'), simsDone = sims.filter(x => S.nn && S.nn[x.id] && S.nn[x.id].done).length;
  const govDone = GV_SIMS.filter(x => S.nn && S.nn[x.id] && S.nn[x.id].done).length, opsDone = OP_SIMS.filter(x => S.nn && S.nn[x.id] && S.nn[x.id].done).length;
  const pick = (k, v) => { AdvV[k] = v; App.viewKey = null; if (location.hash === '#adv-gov' || location.hash === '#adv-ops') location.hash = 'adv'; rerender(); };
  const tab = v => { AdvV.v = v; App.viewKey = null; location.hash = 'adv-' + v; rerender(); };
  const tracks = ADV_TRACKS.filter(t => AdvV.t === 'all' || AdvV.t === t.id);
  const caseCard = c => { const d = advDone(c), started = advSeen(c.id) > 0 || Object.keys(((advState().pk || {})[c.id]) || {}).length;
    return h('a', { class: 'card glow casecard', href: '#adv-' + c.id },
      h('div', { class: 'row' }, h('span', { class: 'meta' }, c.date), h('span', { class: 'status ' + (d ? 'done' : started ? 'started' : '') }, d ? advScore(c) + ' / 20' : started ? 'In progress' : 'Not started')),
      h('h3', null, c.title), h('p', { class: 'leadq clamp' }, c.hook), h('span', { class: 'meta' }, sigPlayed(c.id) ? '▶ played' : '▶ hands-on')); };
  return [
    h('section', { class: 'hero' },
      h('a', { class: 'back', href: '#library' }, '← Library'),
      h('span', { class: 'eyebrow' }, 'Library · instruments and real attacks'),
      AdvV.v === 'ops' ? [h('h1', null, 'Run it, watch it, stop it'),
        h('p', null, 'AI security operations for the people on call: what to collect, what to alert on, what normal looks like, how to hunt, how to automate safely, and how to pull the plug.')]
      : AdvV.v === 'gov' ? [h('h1', null, 'Governance that holds under pressure'),
        h('p', null, 'The frameworks, the law and the principles, taught by doing: classify, measure, explain, review and approve, then watch where a compliant programme still fails.')]
      : [h('h1', null, 'How AI systems actually get broken'),
        h('p', null, 'Live simulations of the mechanism on this device, then documented attacks from 2023–2025: the chain stage by stage, why the defence lost, what detection would have seen. Mechanisms, not payloads.')]),
    h('div', { class: 'advswitch' },
      h('div', { class: 'seg bigseg', role: 'group', 'aria-label': 'Show' },
        h('button', { type: 'button', 'aria-pressed': String(AdvV.v === 'sims'), onclick: () => pick('v', 'sims') }, 'Live simulations', h('small', null, simsDone + ' of ' + sims.length + ' done')),
        h('button', { type: 'button', 'aria-pressed': String(AdvV.v === 'cases'), onclick: () => pick('v', 'cases') }, 'Real cases', h('small', null, done + ' of ' + ADV_CASES.length + ' · ' + pts + ' pts')),
        h('button', { type: 'button', 'aria-pressed': String(AdvV.v === 'gov'), onclick: () => tab('gov') }, 'Governance & responsible AI', h('small', null, govDone + ' of ' + GV_SIMS.length + ' done')),
        h('button', { type: 'button', 'aria-pressed': String(AdvV.v === 'ops'), onclick: () => tab('ops') }, 'AI security operations', h('small', null, opsDone + ' of ' + OP_SIMS.length + ' done'))),
      meter(AdvV.v === 'sims' ? simsDone / sims.length : AdvV.v === 'gov' ? govDone / GV_SIMS.length : AdvV.v === 'ops' ? opsDone / OP_SIMS.length : done / ADV_CASES.length, 'accent', 'Progress')),
    AdvV.v === 'ops' ? opsHub() : AdvV.v === 'gov' ? govHub() : AdvV.v === 'sims' ? [
      h('p', { class: 'advlead' }, 'Train a network and poison it, cut the direction that makes a model refuse, rewrite a fact in its weights, fire injections through the defences the market sells.'),
      h('div', { class: 'nnsims' }, sims.map(nnSimCard))
    ] : [
      h('div', { class: 'chipset trackchips', role: 'group', 'aria-label': 'Track' },
        [['all', 'All tracks'], ...ADV_TRACKS.map(t => [t.id, t.name])].map(([k, t]) => h('button', { type: 'button', 'aria-pressed': String(AdvV.t === k), onclick: () => pick('t', k) }, t))),
      tracks.map(t => [h('h2', { class: 'sylgroup', id: 'track-' + t.id }, t.name), h('p', { class: 'advlead' }, t.lead),
        h('div', { class: 'grid cases' }, ADV_CASES.filter(c => c.track === t.id).map(caseCard))])
    ],
    h('div', { class: 'btnrow end' }, confirmTwice('adv-clear', 'Clear these answers', () => { delete S.adv; }, 'warn'))
  ];
}

function advPage(route) {
  if (route === 'adv-gov') AdvV.v = 'gov'; else if (route === 'adv-ops') AdvV.v = 'ops'; else if (route === 'adv' && (AdvV.v === 'gov' || AdvV.v === 'ops')) AdvV.v = 'sims';
  const c = ADV[route.slice(4)];
  return c ? advCase(c) : advIndex();
}
