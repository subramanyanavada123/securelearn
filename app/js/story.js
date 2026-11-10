'use strict';
/* Story mode: "Agents at Meridian". One screen, one decision, animated.
   Routes: '#' season home, '#e07'…'#e16' episodes. The detailed labs stay
   at '#labs' and '#m07'… as the facilitator's deep-dive workbench. */

const Story = { last: '', dir: 'f', typed: {}, flash: null, sortFx: null };
const EP = Object.fromEntries(EPISODES.map(e => [e.id, e]));
const METERS = [['s', 'Safety'], ['t', 'Trust'], ['v', 'Speed']];

function epState(id) { S.story = S.story || {}; return S.story[id] || (S.story[id] = { i: 0, picks: {}, spots: {}, sorts: {}, tog: {}, live: {} }); }
function meters(ep, st) {
  const m = { s: 50, t: 50, v: 50 };
  ep.scenes.forEach((sc, i) => { if (sc.type === 'choice' && st.picks[i] != null) { const fx = sc.options[st.picks[i]].fx || {}; for (const k in m) m[k] = Math.max(0, Math.min(100, m[k] + (fx[k] || 0))); } });
  return m;
}
function choiceScore(ep, st) {
  const ch = ep.scenes.map((sc, i) => [sc, i]).filter(([sc]) => sc.type === 'choice');
  const good = ch.filter(([sc, i]) => st.picks[i] != null && sc.options[st.picks[i]].tone === 'good').length;
  return { good, total: ch.length };
}
function stars(ep, st) { const { good, total } = choiceScore(ep, st); const r = total ? good / total : 1; return r >= 0.99 ? 3 : r >= 0.6 ? 2 : r > 0 ? 1 : 0; }
function epDone(id) { const st = (S.story || {})[id]; return !!st && st.finished; }

/* ---------- animated art ---------- */
function art(key, small) {
  const W = 320, H = 200, g = [];
  const node = (x, y, r, cls, t) => s('g', { class: 'an ' + (cls || '') }, s('circle', { cx: x, cy: y, r }), t ? s('text', { x, y: y + 5, 'text-anchor': 'middle' }, t) : null);
  const line = (x1, y1, x2, y2, cls) => s('line', { x1, y1, x2, y2, class: 'al ' + (cls || '') });
  if (key === 'agent') {
    const pts = [[60, 50], [260, 50], [40, 150], [280, 150], [160, 20]];
    pts.forEach(([x, y], i) => g.push(line(160, 110, x, y, 'flow d' + i)));
    pts.forEach(([x, y], i) => g.push(node(x, y, 14, 'sat d' + i)));
    g.push(s('circle', { cx: 160, cy: 110, r: 46, class: 'ring-pulse' }), node(160, 110, 30, 'core', 'AI'));
  } else if (key === 'scales') {
    g.push(s('line', { x1: 160, y1: 40, x2: 160, y2: 170, class: 'al' }), s('g', { class: 'tilt' }, s('line', { x1: 80, y1: 60, x2: 240, y2: 60, class: 'al thick' }),
      s('path', { d: 'M60 60 L100 60 L80 110 Z', class: 'pan' }), s('path', { d: 'M220 60 L260 60 L240 120 Z', class: 'pan hot' })), s('rect', { x: 120, y: 170, width: 80, height: 10, rx: 4, class: 'base' }));
  } else if (key === 'plane') {
    g.push(s('path', { d: 'M20 160 Q160 20 300 120', class: 'al dash' }), s('g', { class: 'fly' }, s('path', { d: 'M0 0 L28 8 L0 16 L6 8 Z', class: 'plane' })));
    for (let i = 0; i < 6; i++) g.push(s('rect', { x: 30 + i * 45, y: 175, width: 30, height: 12, rx: 3, class: 'bar d' + i }));
  } else if (key === 'blueprint') {
    for (let x = 20; x < 300; x += 28) g.push(line(x, 10, x, 190, 'grid')); for (let y = 10; y < 200; y += 28) g.push(line(10, y, 310, y, 'grid'));
    g.push(s('rect', { x: 60, y: 50, width: 80, height: 50, rx: 8, class: 'box draw' }), s('rect', { x: 190, y: 50, width: 80, height: 50, rx: 8, class: 'box draw d1' }),
      s('rect', { x: 125, y: 130, width: 80, height: 40, rx: 8, class: 'box draw d2' }), line(140, 75, 190, 75, 'flow'), line(165, 130, 165, 100, 'flow d1'));
  } else if (key === 'mail') {
    g.push(s('g', { class: 'drop' }, s('rect', { x: 90, y: 40, width: 140, height: 100, rx: 10, class: 'paper' }), s('path', { d: 'M90 40 L160 95 L230 40', class: 'al' }),
      s('rect', { x: 108, y: 112, width: 104, height: 6, rx: 3, class: 'hidden-line' })));
  } else if (key === 'library') {
    for (let i = 0; i < 7; i++) g.push(s('rect', { x: 40 + i * 36, y: 60 + (i % 3) * 8, width: 26, height: 110 - (i % 3) * 8, rx: 4, class: 'book d' + i + (i === 4 ? ' hot' : '') }));
    g.push(s('rect', { x: 30, y: 172, width: 260, height: 8, rx: 3, class: 'base' }));
  } else if (key === 'rocket') {
    g.push(s('g', { class: 'lift' }, s('path', { d: 'M160 30 C190 60 190 110 175 140 L145 140 C130 110 130 60 160 30 Z', class: 'rocket' }), s('circle', { cx: 160, cy: 80, r: 10, class: 'window' }),
      s('path', { d: 'M150 140 L160 175 L170 140 Z', class: 'flame' })));
    g.push(s('line', { x1: 60, y1: 180, x2: 260, y2: 180, class: 'al' }));
  } else if (key === 'radar') {
    [30, 60, 90].forEach(r => g.push(s('circle', { cx: 160, cy: 100, r, class: 'rring' })));
    g.push(s('g', { class: 'sweep' }, s('path', { d: 'M160 100 L160 10 A90 90 0 0 1 238 55 Z', class: 'beam' })), s('circle', { cx: 210, cy: 70, r: 6, class: 'blip' }));
  } else if (key === 'boardroom') {
    g.push(s('rect', { x: 70, y: 90, width: 180, height: 50, rx: 25, class: 'table' }));
    [[90, 70], [130, 62], [170, 62], [210, 70], [90, 165], [160, 170], [230, 165]].forEach(([x, y], i) => g.push(node(x, y, 12, 'seat d' + i)));
  } else { // siren
    g.push(s('circle', { cx: 160, cy: 100, r: 70, class: 'alarm-ring' }), s('circle', { cx: 160, cy: 100, r: 40, class: 'alarm-ring d1' }), node(160, 100, 26, 'core hot', '!'));
  }
  return s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'art art-' + key + (small ? ' small' : ''), role: 'img', 'aria-label': 'Illustration' }, g);
}

/* ---------- scene renderers ---------- */
function avatar(who) { const c = CAST[who] || CAST.you; return h('div', { class: 'avatar ' + c.tone }, c.name[0]); }
function typed(key, text) { const done = Story.typed[key]; return h('p', { class: 'typed', 'data-typed': done ? null : key, 'data-text': text }, done ? text : ''); }

function sceneIntro(ep, sc) {
  return h('div', { class: 'sc sc-intro' }, art(ep.art), h('span', { class: 'kicker' }, sc.kicker),
    h('h1', null, sc.title.split(' ').map((w, i) => h('span', { class: 'word', style: 'animation-delay:' + (0.08 * i) + 's' }, w + ' '))), h('p', { class: 'lead' }, sc.text));
}
function sceneSay(ep, sc, key) {
  const c = CAST[sc.who];
  return h('div', { class: 'sc sc-say' }, art(ep.art, true), h('div', { class: 'speaker' }, avatar(sc.who), h('div', null, h('b', null, c.name), h('span', null, c.role))),
    h('div', { class: 'speech' }, typed(key, sc.text)), h('p', { class: 'tapnote' }, 'Tap the text to skip ahead'));
}
function sceneChoice(ep, sc, st, i) {
  const pick = st.picks[i];
  if (pick == null) return h('div', { class: 'sc sc-choice' }, h('h2', null, sc.prompt),
    h('div', { class: 'cards n' + sc.options.length }, sc.options.map((o, k) => h('button', { type: 'button', class: 'card-opt', style: 'animation-delay:' + (0.07 * k) + 's',
      onclick: () => { st.picks[i] = k; Story.flash = { i, fx: o.fx }; commit(); } }, h('span', { class: 'optkey' }, String.fromCharCode(65 + k)), h('b', null, o.t), o.sub ? h('span', null, o.sub) : null))));
  const o = sc.options[pick]; const v = { good: ['Strong move', 'good'], ok: ['Partly right', 'amber'], bad: ['Risky move', 'bad'] }[o.tone];
  const fl = Story.flash && Story.flash.i === i ? Story.flash.fx : null;
  return h('div', { class: 'sc sc-choice picked' }, h('p', { class: 'prompt-small' }, sc.prompt),
    h('div', { class: 'chosen ' + o.tone }, h('span', { class: 'optkey' }, String.fromCharCode(65 + pick)), h('b', null, o.t)),
    h('div', { class: 'consequence ' + o.tone }, h('span', { class: 'verdict ' + v[1] }, v[0]), h('p', null, o.reply),
      fl ? h('div', { class: 'deltas' }, METERS.map(([k, t]) => fl[k] ? h('span', { class: 'delta ' + (fl[k] > 0 ? 'up' : 'down') }, (fl[k] > 0 ? '+' : '') + fl[k] + ' ' + t) : null)) : null),
    sc.lesson ? h('p', { class: 'lesson' }, sc.lesson) : null,
    h('button', { type: 'button', class: 'linkbtn rewind', onclick: () => { delete st.picks[i]; Story.flash = null; commit(); } }, '↺ Try a different choice'));
}
function sceneSpots(ep, sc, st, i) {
  const r = st.spots[i] || (st.spots[i] = { sel: {} }); const chk = !!r.checked;
  const item = (it, k, extra) => {
    const on = !!r.sel[k]; let cls = 'spot' + (on ? ' on' : '');
    if (chk) cls += it.bad ? (on ? ' hit' : ' miss') : (on ? ' wrong' : ' fine');
    return h('button', Object.assign({ type: 'button', class: cls, disabled: chk ? true : null, onclick: () => { r.sel[k] = !on; commit(); } }, extra || {}), h('span', null, it.t),
      chk && it.why ? h('small', null, it.why) : null);
  };
  let board;
  if (sc.layout === 'ring') {
    const n = sc.items.length;
    const lines = s('svg', { class: 'ringlines', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      sc.items.map((_, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return s('line', { x1: 50, y1: 50, x2: 50 + 38 * Math.cos(a), y2: 50 + 38 * Math.sin(a) }); }));
    board = h('div', { class: 'ringboard' + (chk ? ' checked' : '') }, lines, h('div', { class: 'ringcenter' }, sc.center),
      sc.items.map((it, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return item(it, k, { style: 'left:' + (50 + 38 * Math.cos(a)) + '%;top:' + (50 + 38 * Math.sin(a)) + '%' }); }));
  } else board = h('div', { class: (sc.layout === 'log' ? 'logboard' : 'gridboard') + (chk ? ' checked' : '') }, sc.items.map((it, k) => item(it, k)));
  const right = sc.items.filter((it, k) => it.bad && r.sel[k]).length, total = sc.items.filter(it => it.bad).length;
  return h('div', { class: 'sc sc-spots' }, h('h2', null, sc.prompt), board,
    chk ? h('p', { class: 'lesson' }, h('b', null, right + ' of ' + total + ' found. '), sc.lesson) : h('p', { class: 'tapnote' }, 'Tap to mark, tap again to unmark. Then press Check.'));
}
function sceneSort(ep, sc, st, i) {
  const r = st.sorts[i] || (st.sorts[i] = { ans: {} }); const k = Object.keys(r.ans).length;
  const fx = Story.sortFx && Story.sortFx.i === i ? Story.sortFx : null;
  if (k >= sc.items.length) {
    const right = sc.items.filter((it, j) => r.ans[j] === it.a).length;
    return h('div', { class: 'sc sc-sort done' }, h('h2', null, right + ' of ' + sc.items.length + ' right'),
      h('div', { class: 'sortsum' }, sc.items.map((it, j) => h('div', { class: 'sumrow ' + (r.ans[j] === it.a ? 'ok' : 'no') }, h('span', null, r.ans[j] === it.a ? '✓' : '✗'), h('b', null, it.t), h('small', null, nameOf(sc.bins, it.a) + ' · ' + it.why)))),
      h('button', { type: 'button', class: 'linkbtn rewind', onclick: () => { st.sorts[i] = { ans: {} }; Story.sortFx = null; commit(); } }, '↺ Sort again'));
  }
  const it = sc.items[k];
  return h('div', { class: 'sc sc-sort' }, h('p', { class: 'prompt-small' }, sc.prompt),
    h('div', { class: 'deckwrap' }, h('div', { class: 'deckcount' }, 'Card ' + (k + 1) + ' of ' + sc.items.length),
      fx ? h('div', { class: 'toast ' + (fx.ok ? 'ok' : 'no') }, h('b', null, fx.ok ? '✓ Right' : '✗ ' + nameOf(sc.bins, fx.a)), ' ' + fx.why) : null,
      h('div', { class: 'deckcard', key: k }, it.t)),
    h('div', { class: 'bins n' + sc.bins.length }, sc.bins.map(([b, t]) => h('button', { type: 'button', class: 'bin', onclick: () => {
      r.ans[k] = b; Story.sortFx = { i, ok: b === it.a, a: it.a, why: it.why }; commit();
    } }, t))));
}
function sceneToggle(ep, sc, st, i) {
  const r = st.tog[i] || (st.tog[i] = {});
  const shown = sc.docs.map(([t, kind]) => [t, kind, kind === 'all' || (kind === 'hr' && !r.perm) || (kind === 'draft' && !r.perm && !r.labels)]);
  const leak = shown.some(([, kind, on]) => kind !== 'all' && on);
  return h('div', { class: 'sc sc-toggle' }, h('h2', null, sc.prompt),
    h('div', { class: 'switches' }, sc.switches.map(([k, t]) => h('button', { type: 'button', class: 'switch' + (r[k] ? ' on' : ''), 'aria-pressed': String(!!r[k]), onclick: () => { r[k] = !r[k]; r.touched = true; commit(); } },
      h('span', { class: 'knob' }), t))),
    h('div', { class: 'docs' }, shown.map(([t, kind, on]) => h('div', { class: 'doc ' + kind + (on ? ' in' : ' out') }, t))),
    h('div', { class: 'consequence ' + (leak ? 'bad' : 'good') }, h('span', { class: 'verdict ' + (leak ? 'bad' : 'good') }, leak ? 'Leak' : 'Safe'),
      h('p', null, leak ? 'The assistant quotes a confidential file to a junior analyst. Screenshots reach WhatsApp within the hour.' : '“I don’t have access to that information.” The assistant only sees what the analyst could already open.')),
    r.touched ? h('p', { class: 'lesson' }, sc.lesson) : h('p', { class: 'tapnote' }, 'Tap a switch.'));
}
function sceneLive(ep, sc) {
  const rp = ROLEPLAYS[sc.roleplay], name = rp.who.split(',')[0];
  return h('div', { class: 'sc sc-live' }, h('div', { class: 'livehead' }, h('div', { class: 'avatar c3' }, name[0]), h('div', null, h('b', null, name), h('span', null, rp.who.split(', ').slice(1).join(', '))), kindBadge('decide')),
    h('p', { class: 'lead' }, rp.situation), rolePlayDialogue(sc.roleplay));
}
function sceneTrap(ep) {
  return h('div', { class: 'sc sc-trap' }, trapView(ep.lab));
}
function sceneExhibit(ep, sc) {
  return h('div', { class: 'sc sc-exhibit' }, h('span', { class: 'kicker' }, sc.kicker), h('h2', null, sc.title),
    h('div', { class: 'exhibit' }, sc.cols.map(([t, items], c) => h('div', { class: 'excol' + (c === 1 ? ' core' : ''), style: 'animation-delay:' + (0.15 * c) + 's' },
      h('b', null, t), items.map((x, i) => h('span', { style: 'animation-delay:' + (0.15 * c + 0.08 * i + 0.2) + 's' }, x))))),
    h('p', { class: 'exfoot' }, sc.foot), h('p', { class: 'tapnote' }, 'The vendor says it is enterprise-grade. Look closely: you will vote in two screens.'));
}
function scenePack(ep, sc) {
  return h('div', { class: 'sc sc-pack' }, h('span', { class: 'kicker' }, sc.kicker), h('h2', null, sc.title),
    h('div', { class: 'packwrap' }, h('div', { class: 'packlist' }, sc.items.map((x, i) => h('div', { class: 'packitem', style: 'animation-delay:' + (0.18 * i) + 's' }, h('span', { class: 'tick' }, '✓'), x))),
      h('div', { class: 'stamp', style: 'animation-delay:' + (0.18 * sc.items.length + 0.2) + 's' }, h('span', null, 'Vendor risk rating'), h('b', null, sc.rating), h('small', null, sc.note))));
}
function sceneTimeline(ep, sc, st, i) {
  st.tl = st.tl || {}; const n = st.tl[i] || 0; const all = n >= sc.items.length;
  return h('div', { class: 'sc sc-timeline' }, h('span', { class: 'kicker alarm' }, 'System fail'), h('h2', null, sc.title + (all ? '' : ': no alarm went off')),
    h('div', { class: 'tline' }, sc.items.slice(0, n).map((f, k) => h('div', { class: 'tlrow' + (k === n - 1 ? ' fresh' : '') }, h('b', null, 'Hour ' + f.hour), h('span', null, f.t)))),
    all ? h('div', { class: 'consequence bad' }, h('span', { class: 'verdict bad' }, 'Outcome'), h('p', null, sc.outcome))
      : h('button', { type: 'button', class: 'btn primary', onclick: () => { st.tl[i] = n + 1; commit(); } }, n ? 'Next: Hour ' + sc.items[n].hour + ' →' : 'Go live: Monday, 9 a.m. →'),
    !all && n ? h('p', { class: 'tapnote' }, 'Could this have been seen in Exhibit A? Every time, yes.') : null);
}
function sceneDebrief(ep, sc) {
  return h('div', { class: 'sc sc-debrief' }, h('h2', null, sc.title),
    h('div', { class: 'dbrows' }, sc.rows.map((r, k) => h('div', { class: 'dbrow', style: 'animation-delay:' + (0.12 * k) + 's' }, h('span', { class: 'said' }, r[0]), h('span', { class: 'missed' }, r[1]), h('a', { class: 'fixed', href: '#e' + r[2] }, 'Module ' + r[2])))),
    h('p', { class: 'bigquote' }, sc.quote[0] + ' ', h('em', null, sc.quote[1])));
}
function sceneRecap(ep, st) {
  const m = meters(ep, st), sc = choiceScore(ep, st), n = stars(ep, st);
  const idx = EPISODES.indexOf(ep), next = EPISODES[idx + 1];
  if (!st.finished) { st.finished = true; persist(); }
  return h('div', { class: 'sc sc-recap' }, h('div', { class: 'stars' }, [0, 1, 2].map(k => h('span', { class: 'star' + (k < n ? ' on' : ''), style: 'animation-delay:' + (0.2 + 0.15 * k) + 's' }, '★'))),
    h('h2', null, ep.id === 'e00' ? 'Now rebuild NEXUS' : 'Episode ' + ep.n + ' complete'), h('p', { class: 'lead' }, sc.good + ' of ' + sc.total + ' decisions were strong moves.' + (ep.lab && trapLocked(ep.lab) ? ' Trap: ' + ({ good: 'dodged.', ok: 'half right.', bad: 'caught you.' })[trapResult(ep.lab)] : '')),
    ep.id !== 'e00' ? repairStrip(true) : null,
    h('div', { class: 'finalm' }, METERS.map(([k, t]) => h('div', null, h('b', null, m[k]), h('span', null, t)))),
    h('ul', { class: 'lessons' }, ep.scenes[ep.scenes.length - 1].lessons.map((l, k) => h('li', { style: 'animation-delay:' + (0.4 + 0.15 * k) + 's' }, l))),
    h('div', { class: 'btnrow center' },
      next ? h('a', { class: 'btn primary', href: '#' + next.id }, 'Next: ' + next.title + ' →') : h('a', { class: 'btn primary', href: '#' }, 'Back to the season'),
      h('button', { type: 'button', class: 'btn', onclick: () => { S.story[ep.id] = { i: 0, picks: {}, spots: {}, sorts: {}, tog: {}, live: {}, tl: {} }; if (ep.lab && S.traps) delete S.traps[ep.lab]; Story.typed = {}; commit(); } }, 'Replay'),
      ep.id === 'e09' || ep.id === 'e12' ? h('a', { class: 'btn', href: '#rag' }, 'Open the RAG Lab') : null,
      hdLayersFor(ep.id).map(l => h('a', { class: 'btn', href: '#harden-' + l.id }, 'Harden NEXUS · Layer ' + l.n)),
      ep.lab ? h('a', { class: 'btn', href: '#' + ep.lab }, 'Deep-dive workbench') : null, ep.lab ? h('a', { class: 'btn', href: '#deck-' + ep.lab }, 'Module slides') : null));
}

function sceneComplete(sc, st, i, ep_) {
  if (sc.type === 'choice') return st.picks[i] != null;
  if (sc.type === 'spots') return !!(st.spots[i] && st.spots[i].checked);
  if (sc.type === 'sort') return !!st.sorts[i] && Object.keys(st.sorts[i].ans).length >= sc.items.length;
  if (sc.type === 'toggle') return !!(st.tog[i] && st.tog[i].touched);
  if (sc.type === 'trap') return trapLocked(ep_.lab);
  if (sc.type === 'timeline') return ((st.tl || {})[i] || 0) >= sc.items.length;
  if (sc.type === 'live') return rpMade(sc.roleplay) === ROLEPLAYS[sc.roleplay].lines.length;
  return true;
}
function hintFor(sc) {
  return { choice: 'Pick one to continue', spots: 'Mark your answers, then Check', sort: 'Sort every card to continue', toggle: 'Flip a switch to continue', live: 'Answer every line to continue', trap: 'Lock in your answer to continue', timeline: 'Play the 72 hours to continue' }[sc.type] || '';
}

/* ---------- episode screen ---------- */
function renderEpisode(id) {
  const ep = EP[id], st = epState(id); st.i = Math.max(0, Math.min(ep.scenes.length - 1, st.i || 0));
  const i = st.i, sc = ep.scenes[i], key = id + ':' + i, m = meters(ep, st);
  const anim = Story.last !== key ? (Story.dir === 'b' ? ' enter-b' : ' enter-f') : '';
  Story.last = key;
  let body;
  if (sc.type === 'intro') body = sceneIntro(ep, sc);
  else if (sc.type === 'say') body = sceneSay(ep, sc, key);
  else if (sc.type === 'choice') body = sceneChoice(ep, sc, st, i);
  else if (sc.type === 'spots') body = sceneSpots(ep, sc, st, i);
  else if (sc.type === 'sort') body = sceneSort(ep, sc, st, i);
  else if (sc.type === 'toggle') body = sceneToggle(ep, sc, st, i);
  else if (sc.type === 'live') body = sceneLive(ep, sc);
  else if (sc.type === 'trap') body = sceneTrap(ep);
  else if (sc.type === 'exhibit') body = sceneExhibit(ep, sc);
  else if (sc.type === 'pack') body = scenePack(ep, sc);
  else if (sc.type === 'timeline') body = sceneTimeline(ep, sc, st, i);
  else if (sc.type === 'debrief') body = sceneDebrief(ep, sc);
  else body = sceneRecap(ep, st);
  const done = sceneComplete(sc, st, i, ep);
  const X = STORY_EXTRA[key] || {};
  if (X.lead || X.viz || X.why || X.explain) body = h('div', { class: 'scframe' }, X.lead ? storyLead(X.lead) : null, X.viz ? vizBlock(X.viz, key) : null, X.why ? storyWhy(X) : null,
    body, done && X.explain ? storyExplain(sc, st, i, X) : null);
  const go = d => { Story.dir = d > 0 ? 'f' : 'b'; Story.flash = null; Story.sortFx = null; st.i = i + d; commit(); };
  const isSpotsUnchecked = sc.type === 'spots' && !(st.spots[i] && st.spots[i].checked);
  const fl = Story.flash;
  return h('div', { class: 'stage' },
    h('header', { class: 'stagetop' },
      h('a', { class: 'close', href: '#', 'aria-label': 'Back to the season' }, '✕'),
      h('div', { class: 'eptitle' }, h('span', null, 'Episode ' + ep.n + ' · ' + ep.topic), h('b', null, ep.title)),
      h('div', { class: 'meters' }, METERS.map(([k, t]) => h('div', { class: 'mt' + (fl && fl.fx && fl.fx[k] ? (fl.fx[k] > 0 ? ' bump-up' : ' bump-down') : '') }, h('span', null, t), h('div', { class: 'mbar' }, h('i', { class: 'm-' + k, style: 'width:' + m[k] + '%' })))))),
    h('div', { class: 'dots' }, ep.scenes.map((x, k) => h('span', { class: 'dot' + (k < i ? ' past' : k === i ? ' now' : '') }))),
    h('main', { class: 'scenewrap' + anim }, body),
    sc.type === 'recap' ? null : h('footer', { class: 'stagebot' },
      h('button', { type: 'button', class: 'btn ghost', disabled: i === 0 ? true : null, onclick: () => go(-1) }, '← Back'),
      h('span', { class: 'hint' + (done ? ' next' : '') }, done ? upNext(ep, i) : hintFor(sc)),
      isSpotsUnchecked
        ? h('button', { type: 'button', class: 'btn primary', disabled: !Object.values((st.spots[i] || {}).sel || {}).some(Boolean) ? true : null, onclick: () => { st.spots[i].checked = true; commit(); } }, 'Check')
        : h('button', { type: 'button', class: 'btn primary', disabled: done ? null : true, onclick: () => go(1) }, i === 0 ? 'Begin →' : 'Continue →')));
}

/* ---------- season home ---------- */
function repairStrip(compact) {
  const fixed = NEXUS_FAILS.filter(f => f.fix.every(e => epDone(e))).length;
  return h('div', { class: 'repair' + (compact ? ' compact' : '') }, h('div', { class: 'repairhead' }, h('b', null, 'NEXUS repair board'), h('span', null, fixed + ' of 6 failures fixed')),
    h('div', { class: 'repairpills' }, NEXUS_FAILS.map(f => { const ok = f.fix.every(e => epDone(e));
      return h('a', { class: 'rpill' + (ok ? ' ok' : ''), href: '#' + (f.fix.find(e => !epDone(e)) || f.fix[0]), title: f.t }, h('b', null, 'H' + f.hour), h('span', null, ok ? 'fixed' : 'Mod ' + f.mod)); })));
}
function renderSeason() {
  const mods = EPISODES.filter(e => e.id !== 'e00');
  const opened = epDone('e00');
  const next = !opened ? EPISODES[0] : (mods.find(e => !epDone(e.id)) || mods[0]);
  const doneN = mods.filter(e => epDone(e.id)).length;
  Story.last = '';
  return h('div', { class: 'stage season' },
    h('div', { class: 'seasonhead' }, h('span', { class: 'kicker' }, 'Agentic AI Security & Governance · Season 1'), h('h1', null, 'Agents at Meridian'),
      h('p', { class: 'lead' }, opened ? 'NEXUS failed in 72 hours. Rebuild it one module at a time: every episode opens with a trap, and fixes part of NEXUS.' : 'It starts with a vote. Meridian Finance wants to launch Project NEXUS on Friday, and you are the AI Risk Committee.'),
      h('div', { class: 'btnrow' }, h('a', { class: 'btn primary big', href: '#' + next.id }, (next.id === 'e00' ? 'Start: the opening challenge' : (doneN ? 'Continue: ' : 'Next: ') + 'Episode ' + next.n) + ' →'),
        h('span', { class: 'small' }, opened ? doneN + ' of 10 episodes complete' : '30 minutes · then ten episodes')),
      h('div', { class: 'seasonnav' },
        h('a', { class: 'navcard', href: '#labs' }, h('b', null, 'Workbench'), h('span', null, 'Full labs, quizzes, case studies and room results')),
        h('a', { class: 'navcard', href: '#deck' }, h('b', null, 'Program deck'), h('span', null, DECK.order.length + ' slides, every module, with speaker notes')),
        h('a', { class: 'navcard', href: '#adv' }, h('b', null, 'Advanced path'), h('span', null, ADV_CASES.length + ' real attacks: inference, jailbreaks, poisoning, agents')),
        h('a', { class: 'navcard', href: '#kit' }, h('b', null, 'Take it to your CIO'), h('span', null, 'The take-home kit: 15 questions, a maturity check, the framework map')))),
    atHero('raghero'),
    h('a', { class: 'raghero', href: '#rag' }, h('span', { class: 'kicker' }, 'Core lab · Modules 09 and 12'), h('b', null, 'Build Ask Meridian: a RAG pipeline under attack'), h('span', null, (S.rag && S.rag.runs && S.rag.runs.length ? 'Runs so far: ' + S.rag.runs.length + '. Last: ' + S.rag.runs[S.rag.runs.length - 1].bad + ' incidents.' : 'Design it, run a day in production, see what breaks, rebuild.'))),
    h('a', { class: 'raghero hdhero', href: '#harden' }, h('span', { class: 'kicker' }, 'Core lab · Modules 08 to 15'), h('b', null, 'Harden NEXUS: seven defence layers'), h('span', null, (() => { const n = HARDEN_LAYERS.filter(l => hdOn(l.id)).length;
      return n ? n + ' of 7 layers online. Fire NEXUS’s failures at your pipeline and see what still gets through.' : 'Fire NEXUS’s own failures at the pipeline, then clear a layer at a time until they stop.'; })())),
    opened ? repairStrip(false) : h('a', { class: 'nexushero', href: '#e00' }, h('span', { class: 'kicker alarm' }, 'Opening challenge'), h('b', null, 'Approve Project NEXUS'), h('span', null, 'Vote first. Then watch what happens in the first 72 hours.')),
    h('div', { class: 'eps' }, mods.map((e, k) => { const st = (S.story || {})[e.id]; const n = st && st.finished ? stars(e, st) : -1;
      return h('a', { class: 'ep' + (n >= 0 ? ' done' : '') + (e === next ? ' next' : ''), href: '#' + e.id, style: 'animation-delay:' + (0.04 * k) + 's' },
        h('span', { class: 'epn' }, e.n), h('b', null, e.title), h('span', { class: 'ept' }, e.topic + ' · ' + e.scenes.length + ' scenes'),
        h('span', { class: 'epstars' }, n >= 0 ? [0, 1, 2].map(j => h('i', { class: j < n ? 'on' : '' }, '★')) : '')); })),
    h('div', { class: 'seasonfoot' }, opened ? h('a', { href: '#e00' }, 'Replay the opening challenge') : null, h('a', { class: 'facil-link', href: '#labs' }, 'Facilitator workbench: full labs, quizzes, case studies and room results →')));
}

/* Called by App.render for story routes. */
function renderStoryRoute(hash) {
  const app = document.getElementById('app');
  app.replaceChildren(hash === 'rag' ? renderRag() : hash.startsWith('harden') ? renderHarden(hash) : /^e\d\d$/.test(hash) && EP[hash] ? renderEpisode(hash) : renderSeason());
  animateViz(app);
  // typewriter for speech
  const el = app.querySelector('[data-typed]');
  if (el) {
    const k = el.getAttribute('data-typed'), text = el.getAttribute('data-text');
    const finish = () => { Story.typed[k] = true; el.textContent = text; el.removeAttribute('data-typed'); clearInterval(Story.tw); };
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else { let n = 0; clearInterval(Story.tw); Story.tw = setInterval(() => { n += 2; if (n >= text.length) finish(); else el.textContent = text.slice(0, n); }, 22); el.parentElement.addEventListener('click', finish); }
  }
}
