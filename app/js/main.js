'use strict';
/* App shell: home with the program map, the lab view with Do / Answers /
   Room tabs, presenter mode, result codes and the room collector. */

/* From the deck's journey, outcomes, takeaways and 90-day plan slides. */
const LEAD_Q = { m07: 'Are our AI principles real, or just posters?', m08: 'Can our AI adjust safely in real time?', m09: 'Would our AI platform pass a pre-production review?',
  m10: 'What does our AI trust, and on what basis?', m11: 'How could someone turn our agents against us?', m12: 'Can our knowledge and tool links be poisoned?',
  m13: 'What must be true before and after an agent goes live?', m14: 'Would we notice an attack, and could we stop it?', m15: 'Can we prove control to boards and regulators?', m16: 'Can we apply all of it under pressure?' };
const OUTCOMES = [['Govern', 'Set principles, classify AI risk and run approval decisions with confidence.', 'Modules 07, 08, 15'], ['Challenge', 'Ask the questions that expose weak AI architecture before it ships.', 'Modules 09, 10'],
  ['Defend', 'Understand how agents are attacked and sponsor the right controls.', 'Modules 11, 12, 14'], ['Prove', 'Report AI risk to boards and regulators with evidence, not assurances.', 'Modules 13, 15']];
const TAKEAWAYS = ['Agents act, so AI risk is now operating risk.', 'Principles need owners, tests and evidence.', 'Trust nothing by default: users, agents, content or tools.',
  'Untrusted content plus a powerful tool is the core danger.', 'Real controls live in code at the gateway, not in prompts.', 'If the SOC cannot see it or stop it, it is not ready.'];
const PLAN = [['know', 'Days 0–30 · Know', ['Complete the AI inventory, vendor AI included', 'Name an owner for every system', 'Score each with the tiering model']],
  ['control', 'Days 31–60 · Control', ['Launch the AI governance council', 'Make the readiness check a go-live gate', 'Send telemetry from the top three agents to the SOC']],
  ['prove', 'Days 61–90 · Prove', ['Test a kill switch, timed', 'Run a first AI incident tabletop', 'Present the first quarterly AI risk report']]];
function planText() {
  const P = S.plan || {};
  return ['MY 90-DAY PLAN · ' + (S.table || ''), 'Weakest takeaway: ' + (P.weak != null ? TAKEAWAYS[+P.weak] : 'not chosen'),
    ...PLAN.map(([k, t, acts]) => t + ': ' + [...acts.filter((_, i) => (P[k] || {})[i]), ...(((P.mine || {})[k] || '').trim() ? [P.mine[k].trim()] : [])].join('; ')),
    'Questions I can now answer: ' + App.labs.filter(l => (P.ans || {})[l.id]).map(l => 'M' + l.n).join(', ')].join('\n');
}
function wrapUp() {
  const P = S.plan || (S.plan = {}); P.ans = P.ans || {}; P.mine = P.mine || {};
  return box('wrapup', label('Close · key takeaways and your 90-day plan'),
    h('h3', null, 'Which of the six takeaways is your organization weakest on?'),
    seg(TAKEAWAYS.map((t, i) => [String(i), (i + 1) + '. ' + t]), P.weak, v => { if (v == null) delete P.weak; else P.weak = v; }, 'Weakest takeaway', 'multi'),
    h('h3', null, 'Which of the ten leadership questions can you now answer?'),
    chips(App.labs.map(l => [l.id, 'M' + l.n + ' · ' + LEAD_Q[l.id]]), P.ans, 'Questions I can answer'),
    h('h3', null, 'Know, control, prove: your three commitments'),
    h('div', { class: 'plangrid' }, PLAN.map(([k, t, acts]) => { const set = P[k] || (P[k] = {});
      return h('div', { class: 'plancol' }, h('b', null, t), chips(acts.map((a, i) => [String(i), a]), set, t)); })),
    h('pre', { class: 'memo-out' }, planText()), h('div', { class: 'btnrow' }, copyButton(planText, 'Copy my 90-day plan')));
}
function statusOf(id) {
  const st = S.labs[id]; const lab = App.byId[id];
  if (!st || !Object.keys(st).length) return ['Not started', ''];
  let done = false; try { done = lab.done(st); } catch (e) { done = false; }
  return done ? ['Done', 'done'] : ['In progress', 'started'];
}

function programMap() {
  const labs = App.labs, W = 1000, H = 250, g = [];
  const pos = labs.map((_, i) => { const row = i < 5 ? 0 : 1; const col = row === 0 ? i : 9 - i; return [110 + col * 195, row === 0 ? 70 : 185]; });
  const d = pos.map(([x, y], i) => (i ? 'L' : 'M') + ' ' + x + ' ' + y).join(' ');
  g.push(s('path', { d: d.replace(/L (\d+) 185/, (m0, x) => 'C 980 70, 980 185, ' + x + ' 185'), class: 'route' }));
  labs.forEach((l, i) => {
    const [x, y] = pos[i], [, k] = statusOf(l.id);
    g.push(s('g', { class: 'stop ' + (k || 'todo'), tabindex: 0, role: 'link', 'aria-label': 'Module ' + l.n + ': ' + l.title,
      onclick: () => { location.hash = l.id; }, onkeydown: e => { if (e.key === 'Enter') location.hash = l.id; } },
      s('circle', { cx: x, cy: y, r: 27 }), s('text', { x, y: y + 6, class: 'sn', 'text-anchor': 'middle' }, l.n),
      s('text', { x, y: y + 48, class: 'sl', 'text-anchor': 'middle' }, l.mod)));
  });
  return svgWrap(W, H, 'Program map of Modules 07 to 16', 560, g);
}

function howItWorks() {
  return box('how', label('How these labs work'),
    h('p', { class: 'howlead' }, 'Each lab is a piece of real leadership work, not a test. You make the calls your job would ask of you, see the consequences, then compare with an expert answer.'),
    h('ol', { class: 'howsteps' },
      h('li', null, h('b', null, 'Syllabus. '), 'Modules 10–15 open on their syllabus: every topic in teaching order, with a Meridian example and one quick check.'),
      h('li', null, h('b', null, 'Work task. '), 'Follow the numbered steps. Every step says what kind of action it is.'),
      h('li', null, h('b', null, 'Check my work. '), 'Scores your choices and opens the expert answers.'),
      h('li', null, h('b', null, 'Quick quiz. '), 'Short questions on the module’s concepts, with instant feedback.'),
      h('li', null, h('b', null, 'Case studies. '), 'Real incidents: make three calls per case, see what happens, then compare with the expert’s answer.')),
    h('div', { class: 'kindgrid' }, Object.entries(KINDS).map(([k, v]) => h('div', { class: 'kindrow' }, kindBadge(k), h('span', null, v.hint)))));
}
function home() {
  const done = App.labs.filter(l => statusOf(l.id)[1] === 'done').length;
  const minutes = sum(App.labs.map(l => l.min));
  const tbl = h('div', { id: 'tbl', class: 'tablepick', role: 'group', 'aria-label': 'Your table', tabindex: '-1' },
    [...Array(12)].map((_, i) => { const t = 'Table ' + (i + 1);
      return h('button', { type: 'button', 'aria-pressed': String(S.table === t), onclick: () => { S.table = t; commit(); paintChrome(); } }, String(i + 1)); }));
  return [
    h('section', { class: 'hero' },
      h('a', { class: 'back', href: '#' }, '← Back to the story mode'),
      h('span', { class: 'eyebrow' }, 'Facilitator workbench · Modules 07–16'),
      h('h1', null, 'Ten labs where leaders make the calls'),
      h('p', null, 'Each lab puts your table in role, against the clock, on realistic material: architecture diagrams, permission maps, agent logs, tool manifests and a live incident. No technical background needed.')),
    h('a', { class: 'deckhero', href: '#deck' }, h('span', { class: 'kicker' }, 'Program deck · ' + DECK.order.length + ' slides'), h('b', null, DECK.title),
      h('span', null, 'Present any section from here. Each lab also has a Deck tab with its module’s slides and speaker notes.')),
    h('a', { class: 'deckhero advhero', href: '#adv' }, h('span', { class: 'kicker' }, 'Advanced path · ' + ADV_CASES.length + ' real attacks'), h('b', null, 'How AI systems actually get broken'),
      h('span', null, ADV_TRACKS.map(t => t.name).join(' · '))),
    h('a', { class: 'deckhero kithero', href: '#kit' }, h('span', { class: 'kicker' }, 'Take-home kit · for participants'), h('b', null, 'Take it to your CIO'),
      h('span', null, 'Why now, 15 questions, a maturity check to score, the global framework map and a 90-day plan. Share the link at the end of the session.')),
    howItWorks(),
    h('div', { class: 'homegrid' },
      h('div', { class: 'tablebox' }, h('span', { class: 'label' }, 'Your table'), tbl,
        h('p', { class: 'small' }, 'Tap your table number on every phone at your table. Answers stay on this device until you share a result code.')),
      h('div', { class: 'box dark' }, label('Your progress'), stats(stat(done + ' / 10', 'Labs done'), stat(Math.round(minutes / 60 * 10) / 10 + ' h', 'Hands-on time')), meter(done / 10, 'accent', 'Labs done'))),
    programMap(),
    h('div', { class: 'grid' }, App.labs.map(l => { const [t, k] = statusOf(l.id);
      return h('a', { class: 'card', href: '#' + l.id },
        h('div', { class: 'row' }, h('span', { class: 'modnum' }, 'M' + l.n), h('span', { class: 'meta' }, l.mod), h('span', { class: 'status ' + k }, t)),
        h('h3', null, syllabusFor(l.id) ? syllabusFor(l.id).name : l.title), h('p', { class: 'leadq' }, LEAD_Q[l.id]),
        syllabusFor(l.id) ? h('span', { class: 'meta' }, (p => p.done + ' of ' + p.total + ' syllabus topics checked · work task: ' + l.title)(topicProgress(l.id))) : h('span', { class: 'meta' }, l.format + ' · ' + l.min + ' min'),
        h('span', { class: 'meta' }, scenariosFor(l).length + ' scenarios · ' + sum((l.drills || []).map(d => d.items.length)) + ' drill items'));
    })),
    h('div', { class: 'tips' }, [['Take a role', 'People argue harder from a role than as themselves.'], ['Watch the clock', 'Time pressure shows how people really decide.'], ['Compare tables', 'Where tables disagree, there is a lesson.'], ['Use your own systems', 'Share only what you are allowed to; anonymise freely.']]
      .map(([b, t]) => h('div', { class: 'tip' }, h('b', null, b), h('span', null, t)))),
    h('div', { class: 'outcomes' }, OUTCOMES.map(([v, t, m]) => h('div', { class: 'tip' }, h('b', null, v), h('span', null, t), h('span', { class: 'small' }, m)))),
    wrapUp(),
    box('facil', label('For facilitators'),
      h('ol', { class: 'plain numbered' },
        h('li', null, 'Project this app on the main screen. Use ', h('b', null, 'Present'), ' inside a lab for larger text.'),
        h('li', null, 'Each table works on a phone and taps ', h('b', null, 'Share with the room'), ' at the end of the lab. That gives a result code to paste into the room chat.'),
        h('li', null, 'On the projected screen, open the lab’s ', h('b', null, 'Room'), ' tab and paste all the codes at once. The room view compares every table.'),
        h('li', null, 'Every lab has three parts: 1 · Work task (numbered steps, each labelled Decide, Simulate, Quiz or Read), 2 · Quick quiz (instant feedback) and 3 · Case studies (the module’s live scenarios and leadership discussion, each with an expert answer).'),
        h('li', null, 'Ask tables to tap Check my work only after the room has compared. Facilitator notes are at the bottom of each Expert answers tab.')))
  ];
}

function checkWork(lab) {
  S.revealed[lab.id] = true; S.tab[lab.id] = 'ans'; commit();
  const t = document.querySelector('.tabs'); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function checkPanel(lab) {
  const rev = !!S.revealed[lab.id];
  return h('div', { class: 'checkpanel' }, h('div', null, h('h3', null, rev ? 'Your work has been checked' : 'Done with the work task?'),
    h('p', { class: 'sub' }, rev ? 'Expert answers are open, and the diagrams above now mark what you got right and what you missed.' : 'Check my work scores your choices and opens the expert answers. You can keep changing your answers afterwards.')),
    h('button', { type: 'button', class: 'btn primary big', onclick: () => checkWork(lab) }, rev ? 'See expert answers' : 'Check my work'));
}
function fullSummary(lab) {
  const st = L(lab.id);
  let main = ''; try { main = lab.summary(st); } catch (e) { main = ''; }
  return ['Module ' + lab.n + ' · ' + lab.title + ' · ' + (S.table || 'Unnamed table'), main, ...drillSummary(lab, st), ...scenarioSummary(lab, st)].filter(Boolean).join('\n');
}
function sharePanel(lab) {
  const st = S.labs[lab.id];
  if (!st || !Object.keys(st).length) return null;
  let code = ''; try { code = makeCode(lab.id); } catch (e) { code = ''; }
  let text = ''; try { text = fullSummary(lab); } catch (e) { text = ''; }
  return box('share', label('Share with the room'),
    h('p', { class: 'sub' }, 'Copy your result code and paste it into the room chat. The facilitator pastes all codes into the Room tab to compare tables.'),
    h('div', { class: 'codeline' }, h('code', null, code.length > 64 ? code.slice(0, 60) + '…' : code), h('span', { class: 'small' }, (S.table || 'Unnamed table'))),
    h('div', { class: 'btnrow' }, copyButton(() => makeCode(lab.id), 'Copy result code'), text ? copyButton(() => fullSummary(lab), 'Copy a plain-text summary') : null),
    S.table ? null : h('p', { class: 'flagline' }, 'Pick your table number on the home screen so the room knows whose result this is.'));
}

function roomPane(lab) {
  const live = !!App.db;
  const docs = live ? (App.room[lab.id] || []) : collectedDocs(lab.id);
  const collector = live ? null : box('', label('Collect results'),
    h('p', { class: 'sub' }, 'Paste the result codes tables shared. You can paste a whole chat at once; the app finds the codes in it.'),
    (() => {
      const ta = h('textarea', { id: 'collect-' + lab.id, placeholder: 'Paste codes here (they start with AIL1.' + lab.id + '.)', 'aria-label': 'Result codes' });
      const msg = h('p', { class: 'small', 'aria-live': 'polite' });
      const add = h('button', { type: 'button', class: 'btn primary', onclick: () => {
        const found = readCodes(ta.value).filter(c => c.lab === lab.id);
        const other = readCodes(ta.value).filter(c => c.lab !== lab.id).length;
        const bucket = S.collect[lab.id] || (S.collect[lab.id] = {});
        found.forEach(c => { bucket[c.id] = { table: c.table, data: c.data }; });
        persist(); ta.value = '';
        rerender();
        const m = document.querySelector('[data-collect-msg]');
        if (m) m.textContent = found.length ? 'Added ' + found.length + ' result' + (found.length === 1 ? '' : 's') + '.' + (other ? ' Ignored ' + other + ' from other labs.' : '') : 'No codes for this lab found in that text.';
      } }, 'Add results');
      msg.setAttribute('data-collect-msg', '');
      const mine = h('button', { type: 'button', class: 'btn', onclick: () => {
        const bucket = S.collect[lab.id] || (S.collect[lab.id] = {});
        bucket[S.tableId] = { table: S.table || 'This device', data: JSON.parse(JSON.stringify(L(lab.id))) }; commit();
      } }, 'Add this device’s answers');
      return [ta, h('div', { class: 'btnrow' }, add, mine, docs.length ? confirmTwice('clear-' + lab.id, 'Clear collected results', () => { delete S.collect[lab.id]; }, 'warn') : null), msg];
    })());
  if (!docs.length) return [collector, box('', h('h3', null, live ? 'Waiting for tables' : 'No results yet'), h('p', { class: 'sub' }, live ? 'Results appear as tables work. Project this tab on the main screen.' : 'Once codes are added, the room view compares every table here.'))].filter(Boolean);
  let blocks = []; try { blocks = lab.agg(docs); } catch (e) { blocks = []; }
  try { blocks = blocks.concat(drillAgg(lab, docs), scenarioAgg(lab, docs).filter(b => (b.items || b.rows).length)); } catch (e) { /* keep the lab's own blocks */ }
  return [collector,
    h('div', { class: 'roomhead' }, h('b', { class: 'n-tables' }, docs.length + ' table' + (docs.length === 1 ? '' : 's')), h('div', { class: 'roles' }, docs.map(d => h('span', { class: 'role' }, d._table)))),
    blocks.map(b => renderBlock(b, docs.length))].filter(Boolean);
}

function labView(lab) {
  const sy = syllabusFor(lab.id), sp = sy && topicProgress(lab.id), o = sy ? 1 : 0;
  const st = L(lab.id); const tab = S.tab[lab.id] || (sy ? 'topics' : 'do'); const rev = !!S.revealed[lab.id];
  const nd = sum((lab.drills || []).map(d => d.items.length)), ns = scenariosFor(lab).length;
  const nslides = deckIdsFor(lab.id).length;
  const tabs = [['deck', 'Deck' + (nslides ? ' (' + nslides + ')' : '')], ...(sy ? [['topics', '1 · Syllabus (' + sp.done + '/' + sp.total + ')']] : []), ['do', (1 + o) + ' · Work task'], ['drills', (2 + o) + ' · Quick quiz' + (nd ? ' (' + nd + ')' : '')], ['scen', (3 + o) + ' · Case studies' + (ns ? ' (' + ns + ')' : '')], ['ans', rev ? 'Expert answers ✓' : 'Expert answers'], ['room', 'Room']];
  let body;
  if (tab === 'topics' && sy) body = syllabusPane(lab);
  else if (tab === 'do') body = [trapPanel(lab), lab.id === 'm09' || lab.id === 'm12' ? h('a', { class: 'raglink', href: '#rag' }, h('b', null, 'Core lab: Build Ask Meridian'), h('span', null, 'Design a RAG pipeline, run a day of attacks through it, read the incident report, rebuild. →')) : null, hdLayersFor(lab.id).map(hdLink), missionCard(lab), clockPanel(lab), lab.render(st), rolePlayPanel(lab), checkPanel(lab), sharePanel(lab),
    h('div', { class: 'btnrow end' }, confirmTwice('reset-' + lab.id, 'Clear this lab’s answers', () => { delete S.labs[lab.id]; delete S.revealed[lab.id]; }, 'warn'))];
  else if (tab === 'ans') body = rev
    ? [lab.answers(st), details('Facilitator notes', false, h('ul', { class: 'plain' }, lab.guide.map(g => h('li', null, g)))),
      h('div', { class: 'btnrow' }, confirmTwice('hide-' + lab.id, 'Hide answers again', () => { delete S.revealed[lab.id]; }))]
    : [box('locked', h('h3', null, 'Finish the work task first'), h('p', { class: 'sub' }, 'Expert answers open when your table taps Check my work. In a facilitated session, wait until tables have compared in the Room: seeing answers first spoils the debate.'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => checkWork(lab) }, 'Check my work'))];
  else if (tab === 'deck') body = deckPane(lab);
  else if (tab === 'drills') body = [drillsPane(lab), sharePanel(lab)];
  else if (tab === 'scen') body = [scenariosPane(lab), sharePanel(lab)];
  else body = roomPane(lab);
  const idx = App.labs.indexOf(lab), prev = App.labs[idx - 1], next = App.labs[idx + 1];
  return [
    h('section', { class: 'labhead' },
      h('div', { class: 'crumbs' }, h('a', { class: 'back', href: '#labs' }, '← All labs'), h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn small', 'aria-pressed': String(!!S.present), onclick: () => { S.present = !S.present; commit(); } }, S.present ? 'Exit present mode' : 'Present')),
      h('span', { class: 'eyebrow' }, sy ? 'Module ' + lab.n + ' · ' + sy.hours + ' hours · ' + sp.total + ' syllabus topics' : 'Module ' + lab.n + ' · ' + lab.mod + ' · ' + lab.format + ' · ' + lab.min + ' min'),
      h('h1', null, sy ? sy.name : lab.title), sy ? h('p', { class: 'worktitle' }, h('b', null, 'Work task (' + lab.min + ' min): '), lab.title) : null, h('p', { class: 'leadq big' }, 'The leadership question: ' + LEAD_Q[lab.id]), h('p', { class: 'task' }, lab.task),
      h('div', { class: 'roles' }, lab.roles.map(r => h('span', { class: 'role' }, r)))),
    h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, t]) => h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(tab === k),
      onclick: () => { S.tab[lab.id] = k; commit(); if (k === 'room') watchRoom(lab.id); } }, t, k === 'ans' && rev ? ' ·' : ''))),
    h('div', { class: 'pane' }, body),
    h('nav', { class: 'pager' }, prev ? h('a', { href: '#' + prev.id }, '← M' + prev.n + ' ' + prev.mod) : h('span'), next ? h('a', { href: '#' + next.id }, 'M' + next.n + ' ' + next.mod + ' →') : h('span'))
  ];
}

let lastView = '';
App.render = function () {
  const route = location.hash.slice(1), lab = /^adv-nn-/.test(route) && NN_BY[route.slice(7)];
  document.body.classList.toggle('labmode', !!lab);
  if (lab) { document.body.classList.remove('story', 'present'); document.getElementById('app').replaceChildren(labMount(lab.id)); return; }
  if (route === '' || route === 'rag' || /^harden(-\w+)?$/.test(route) || /^e\d\d$/.test(route)) { document.body.classList.add('story'); document.body.classList.remove('present'); renderStoryRoute(route); return; }
  document.body.classList.remove('story');
  const app = document.getElementById('app'); const id = currentLabId(); const y = window.scrollY;
  const deckRoute = route === 'deck' || route.startsWith('deck-'); if (!deckRoute) App.deckJump = null;
  const advRoute = route === 'adv' || route.startsWith('adv-'), kitRoute = route === 'kit';
  App.deckNav = null;
  const active = document.activeElement && document.activeElement.id;
  let view;
  try { view = deckRoute ? deckPage(route) : advRoute ? advPage(route) : kitRoute ? kitPage() : id ? labView(App.byId[id]) : home(); }
  catch (e) { console.error(e); view = [box('', h('h3', null, 'This lab could not load'), h('p', { class: 'sub' }, 'Clear its answers to start again.'), id ? h('button', { type: 'button', class: 'btn warn', onclick: () => { delete S.labs[id]; commit(); } }, 'Clear this lab') : null)]; }
  app.replaceChildren(...[view].flat(Infinity).filter(Boolean));
  const here = deckRoute ? 'deck' : advRoute || kitRoute ? route : id || '';
  if (lastView === here) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastView = here;
  const viewKey = (deckRoute ? 'deck' : advRoute || kitRoute ? route : id || 'labs') + ':' + (id ? (S.tab[id] || 'do') : '');
  if (viewKey !== App.viewKey) { App.viewKey = viewKey; app.classList.remove('fresh'); void app.offsetWidth; app.classList.add('fresh'); clearTimeout(App.freshT); App.freshT = setTimeout(() => app.classList.remove('fresh'), 1200); }
  if (active) { const el = document.getElementById(active); if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.focus(); }
  paintChrome(); tick();
};
function paintChrome() {
  document.getElementById('tablename').textContent = S.table || 'Set your table';
  document.getElementById('tablechip').classList.toggle('live', !!App.db);
  document.body.classList.toggle('present', !!S.present && !!currentLabId());
}

document.getElementById('brand').addEventListener('click', () => { location.hash = 'labs'; });
document.getElementById('tablechip').addEventListener('click', () => { location.hash = 'labs'; setTimeout(() => { const i = document.getElementById('tbl'); if (i) i.focus(); }, 60); });
window.addEventListener('hashchange', () => { App.render(); const id = currentLabId(); if (id && S.tab[id] === 'room') watchRoom(id); });
setInterval(tick, 500);
App.render();

(async () => {
  try {
    if (!window.claude || !window.claude.use) return;
    const db = await window.claude.use('db'); if (!db) return;
    App.db = db; paintChrome(); queueShare();
    const id = currentLabId(); if (id && S.tab[id] === 'room') watchRoom(id);
    App.render();
  } catch (e) { /* runs without the live room */ }
})();
