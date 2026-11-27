'use strict';
/* Guided paths: the open-source front door. One Start page (#), one page per
   path (#path-<id>), a Library (#library) for everything that is reference
   rather than journey, and the helpers every screen uses to show "where am I
   on my path" and to offer exactly one Next step.

   A path is an ordered list of routes grouped into chapters. Each route
   belongs to at most one path, so any screen can work out its path and
   position from the URL alone. Add or reorder steps in PATHS below. */

/* Two versions of the app. New (default): guided paths. Classic: the original
   workshop app, with the story home at # and no paths. Progress is shared. */
function isClassic() { return !!S.classic; }
function wsOn() { return !!(S.workshop || S.classic); }
function setVersion(classic) { S.classic = !!classic; persist(); if (location.hash.slice(1)) location.hash = ''; else rerender(); }
function versionSwitch(cls) {
  return h('button', { type: 'button', class: 'btn ' + (cls || ''), title: isClassic() ? 'Switch to the guided-path version' : 'Switch back to the original workshop version',
    onclick: () => setVersion(!isClassic()) }, isClassic() ? 'Try the new version →' : 'Classic version');
}
function homeBack() { return isClassic() ? h('a', { class: 'back', href: '#' }, '← Back to the story mode') : h('a', { class: 'back', href: '#library' }, '← Library'); }

const DEV = { name: 'Subramanya Navada', short: 'Subramanya', url: 'https://www.linkedin.com/in/subramanya-navada-b27018194' };

const PATHS = [
  { id: 'foundations', n: 1, tone: '#F2B544', title: 'How AI agents fail', who: 'New to AI security · no code needed',
    blurb: 'Follow one company as its AI agent launches, fails in 72 hours, and gets rebuilt. Every episode is a few screens: you decide, you see what happens.',
    chapters: [['The launch that failed', ['e00']], ['Principles and runtime', ['e07', 'e08', 'e09']], ['Trust and attacks', ['e10', 'e11', 'e12']],
      ['Shipping, watching, proving', ['e13', 'e14', 'e15']], ['Put it all together', ['e16']]] },
  { id: 'build', n: 2, tone: '#5CE1E6', title: 'Secure a RAG and agent system', who: 'For engineers and architects who build with LLMs',
    blurb: 'Watch each attack break a real pipeline, place the control that stops it, then see how the control itself still fails. Ends with a full defence-in-depth build.',
    chapters: [['Knowledge: RAG', ['atlas-rag-poison', 'atlas-rag-inject', 'atlas-rag-embed', 'atlas-rag-leak', 'adv-nn-chunk', 'rag']],
      ['Tools: MCP', ['atlas-mcp-vectors', 'atlas-mcp-boundary', 'atlas-mcp-priv', 'adv-nn-mcpwire', 'adv-nn-mcpstack']],
      ['Shipping it', ['atlas-ship-sdlc', 'atlas-ship-change', 'atlas-ship-runtime', 'adv-nn-flaky']],
      ['Watching it run', ['atlas-soc-telemetry', 'atlas-soc-detect', 'atlas-soc-exfil', 'atlas-soc-kill', 'adv-nn-noise']],
      ['Defence in depth', ['harden']]] },
  { id: 'internals', n: 3, tone: '#A98BF5', title: 'Attacks inside the model', who: 'You know the controls and want the mechanism',
    blurb: 'Live instruments that run the real arithmetic on your device: attention, gradients, weights, parsers and serving. Drag, scrub and break things.',
    chapters: [['Prompt injection', ['adv-nn-inject', 'adv-nn-pihood', 'adv-nn-files']],
      ['Agents, memory and identity', ['adv-nn-agent', 'adv-nn-memory', 'adv-nn-badge', 'adv-nn-impostor']],
      ['Training and weights', ['adv-nn-backdoor', 'adv-nn-grad', 'adv-nn-refusal', 'adv-nn-rome']],
      ['Serving', ['adv-nn-infer']]] },
  { id: 'gov', n: 4, tone: '#5FD08F', track: true, title: 'Governance and responsible AI', who: 'Risk, compliance and product owners',
    blurb: 'NIST AI RMF, ISO 42001, the EU AI Act, fairness, explainability, oversight and approval boards, each as one hands-on instrument.',
    chapters: [['Governance', ['adv-nn-gvx', 'adv-nn-gvtier', 'adv-nn-gvfair', 'adv-nn-gvexplain', 'adv-nn-gvhuman', 'adv-nn-gvboard']]] },
  { id: 'ops', n: 5, tone: '#FF9C7A', track: true, title: 'AI security operations', who: 'SOC analysts and on-call engineers',
    blurb: 'Telemetry, detections, baselines, hunting, the SOC’s own AI and kill switches. One incident runs through all six.',
    chapters: [['Operations', ['adv-nn-optel', 'adv-nn-opdetect', 'adv-nn-opbase', 'adv-nn-ophunt', 'adv-nn-opsoar', 'adv-nn-opkill']]] }
];
PATHS.forEach(p => { p.steps = p.chapters.flatMap(([, rs]) => rs); });
const PATH_BY = Object.fromEntries(PATHS.map(p => [p.id, p]));
const PATH_OF = {}; PATHS.forEach(p => p.steps.forEach((r, i) => { PATH_OF[r] = { p, i }; }));

/* ---------- what a step is ---------- */
function stepInfo(r) {
  if (/^e\d\d$/.test(r) && typeof EP !== 'undefined' && EP[r]) { const e = EP[r];
    const intro = e.scenes.find(x => x.type === 'intro');
    return { kind: 'Episode', title: e.title, line: (intro && intro.text) || e.topic, min: e.scenes.length * 2 }; }
  if (r.startsWith('atlas-')) { const st = ATLAS.find(x => x.id === r.slice(6)); const ln = st && AT_LINES.find(l => l.id === st.line);
    return st ? { kind: 'Scene', title: st.t, line: st.hook || (ln ? ln.name : ''), min: st.min } : { kind: 'Scene', title: r, line: '', min: 12 }; }
  if (r.startsWith('adv-nn-')) { const x = NN_BY[r.slice(7)];
    return x ? { kind: 'Instrument', title: x.title, line: x.blurb, min: 15 } : { kind: 'Instrument', title: r, line: '', min: 15 }; }
  if (r === 'rag') return { kind: 'Build lab', title: 'Build Ask Meridian', line: 'Design a RAG pipeline on a budget, run a day of attacks through it, read the incident report, rebuild.', min: 30 };
  if (r === 'harden') return { kind: 'Build lab', title: 'Harden NEXUS', line: 'Seven defence layers against one agent’s real failures. Switch each control off and on.', min: 45 };
  return { kind: 'Step', title: r, line: '', min: 10 };
}
function stepDone(r) {
  try {
    if (/^e\d\d$/.test(r)) return epDone(r);
    if (r.startsWith('atlas-')) return !!atDone(r.slice(6));
    if (r.startsWith('adv-nn-')) return !!(S.nn && S.nn[r.slice(7)] && S.nn[r.slice(7)].done);
    if (r === 'rag') return !!(S.rag && S.rag.runs && S.rag.runs.length);
    if (r === 'harden') return HARDEN_LAYERS.every(l => hdOn(l.id));
  } catch (e) { /* state not ready */ }
  return false;
}
function pathProgress(p) { const done = p.steps.filter(stepDone).length; return { done, total: p.steps.length, frac: done / p.steps.length, next: p.steps.find(r => !stepDone(r)) }; }
function pathMinutes(p) { return sum(p.steps.map(r => stepInfo(r).min)); }
function hrs(min) { return min < 90 ? min + ' min' : (Math.round(min / 30) / 2) + ' h'; }

/* ---------- where am I ---------- */
function pathCtx(route) { if (S.classic) return null; const r = route == null ? location.hash.slice(1) : route; return PATH_OF[/^harden-/.test(r) ? 'harden' : r] || null; }
function pathNote(route) { if (S.classic) return; const c = pathCtx(route); if (c && S.path !== c.p.id) { S.path = c.p.id; persist(); } }
function pathCrumb(fallback) { const c = pathCtx(); return c ? c.p.title + ' · ' + (c.i + 1) + ' of ' + c.p.steps.length : fallback; }
function pathBack(fallback) { const c = pathCtx(); return c ? '#path-' + c.p.id : fallback; }
function pathNextTarget() {
  const c = pathCtx(); if (!c) return null;
  const nx = c.p.steps[c.i + 1];
  return nx ? { href: '#' + nx, label: 'Next: ' + stepInfo(nx).title + ' →' } : { href: '#path-' + c.p.id, label: 'Finish the path →' };
}
/* The one primary "go on" link at the end of a unit. Off a path it keeps the unit's own destination. */
function pathGo(href, label, cls) { const t = pathNextTarget(); return h('a', { class: cls || 'labbtn go', href: t ? t.href : href }, t ? t.label : label); }
/* Slim bar for normal-layout pages (map scenes) that sit on a path. */
function pathBar() {
  const c = pathCtx(); if (!c) return null;
  const t = pathNextTarget(), n = c.p.steps.length;
  return h('nav', { class: 'pathbar', style: '--tone:' + c.p.tone, 'aria-label': 'Your path' },
    h('a', { class: 'pbback', href: '#path-' + c.p.id }, '← ', h('b', null, c.p.title)),
    h('ol', { class: 'pbdots', 'aria-label': 'Step ' + (c.i + 1) + ' of ' + n }, c.p.steps.map((r, k) => h('li', { class: k === c.i ? 'now' : stepDone(r) ? 'done' : '' }))),
    h('span', { class: 'pbpos' }, 'Step ' + (c.i + 1) + ' of ' + n),
    h('a', { class: 'btn primary small', href: t.href }, t.label));
}

/* ---------- the developer ---------- */
function devNote(p) {
  return 'Hi ' + DEV.short + ', I ' + (p ? 'just finished the “' + p.title + '” path' : 'have been learning') + ' on Agentic AI Labs. '
    + 'Thanks for making it open. One thing I would love to see next: ';
}
function devCard(p, big) {
  return h('aside', { class: 'devcard' + (big ? ' big' : ''), 'aria-label': 'About the developer' },
    h('span', { class: 'devav', 'aria-hidden': 'true' }, 'SN'),
    h('div', { class: 'devtxt' },
      h('span', { class: 'kicker' }, p ? 'You finished the path' : 'Meet the developer'),
      h('b', null, p ? 'Tell ' + DEV.short + ' what to build next' : 'Built in the open by ' + DEV.name),
      h('p', null, p ? 'Paths grow from what learners ask for. Copy a ready-made note, paste it into your LinkedIn connection request, and add the topic you want.'
        : 'A free, open-source lab for learning AI security by doing. Found a gap or a bug, or want a topic covered? Connect and say so: requests shape the next path.')),
    h('div', { class: 'devacts' },
      h('a', { class: 'btn primary', href: DEV.url, target: '_blank', rel: 'noopener noreferrer' }, 'Connect on LinkedIn ↗'),
      copyButton(() => devNote(p), 'Copy a note to send')));
}

/* ---------- Start (#) ---------- */
function pathCard(p) {
  const pr = pathProgress(p), started = pr.done > 0, done = pr.done === pr.total;
  return h('a', { class: 'pathcard' + (p.track ? ' track' : '') + (done ? ' done' : ''), href: '#path-' + p.id, style: '--tone:' + p.tone },
    h('span', { class: 'pcnum' }, String(p.n).padStart(2, '0')),
    h('span', { class: 'kicker' }, p.who),
    h('b', null, p.title),
    p.track ? null : h('span', { class: 'pcblurb' }, p.blurb),
    h('span', { class: 'pcmeta' }, pr.total + ' steps · about ' + hrs(pathMinutes(p))),
    h('span', { class: 'pcbar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (pr.frac * 100).toFixed(1) + '%' })),
    h('span', { class: 'pcgo' }, done ? 'Completed ✓' : started ? 'Continue · ' + pr.done + ' of ' + pr.total + ' →' : 'Start →'));
}
function siteNav() {
  return h('nav', { class: 'seasonnav', 'aria-label': 'Site' },
    h('a', { class: 'seasonbrand', href: isClassic() ? '#labs' : '#' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, 'AI'), 'Agentic AI Labs'),
    h('span', { class: 'spacer' }),
    navLinks().map(([href, t]) => h('a', { class: 'navcard', href }, t)), versionSwitch('small navswitch'), Theme.button());
}
function renderStart() {
  const cur = S.path && PATH_BY[S.path], cpr = cur && pathProgress(cur);
  const resume = cur && cpr.next ? h('a', { class: 'resume', href: '#' + cpr.next, style: '--tone:' + cur.tone },
    h('span', { class: 'kicker' }, 'Pick up where you left off'), h('b', null, stepInfo(cpr.next).title),
    h('span', null, cur.title + ' · step ' + (cur.steps.indexOf(cpr.next) + 1) + ' of ' + cur.steps.length), h('i', { class: 'corego', 'aria-hidden': 'true' }, '→')) : null;
  return h('div', { class: 'stage season start' }, siteNav(),
    h('header', { class: 'starthead' },
      h('span', { class: 'kicker' }, 'Open source · free · runs in your browser'),
      h('h1', null, 'Learn how AI agents get attacked, and how to stop it'),
      h('p', { class: 'lead' }, 'No install and no sign-up. Pick the path that fits you and press Next. Each step is one screen you play with, and your progress stays on this device.')),
    resume,
    h('section', { class: 'pathgrid', 'aria-label': 'Paths' }, PATHS.filter(p => !p.track).map(pathCard)),
    h('section', { 'aria-label': 'Specialist tracks' }, h('h2', { class: 'secthead' }, 'Specialist tracks'), h('div', { class: 'pathgrid tracks' }, PATHS.filter(p => p.track).map(pathCard))),
    h('a', { class: 'libstrip', href: '#library' }, h('b', null, 'Library'), h('span', null, '36 real attacks from 2023–2025, the full 44-scene map and playbook, every instrument, the CIO kit and a live reading list.'), h('i', { 'aria-hidden': 'true' }, '→')),
    devCard(null),
    siteFoot());
}
function siteFoot() {
  return h('footer', { class: 'sitefoot' }, h('span', null, 'Agentic AI Labs · open source · made by ', h('a', { href: DEV.url, target: '_blank', rel: 'noopener noreferrer' }, DEV.name)),
    h('span', { class: 'spacer' }), h('a', { href: '#library' }, 'Library'), h('a', { href: '#feeds' }, 'Reading'));
}

/* ---------- one path (#path-<id>) ---------- */
function renderPath(id) {
  const p = PATH_BY[id]; if (!p) return renderStart();
  const pr = pathProgress(p), done = pr.done === pr.total;
  let k = 0;
  const cta = done ? h('a', { class: 'btn primary big', href: '#' }, 'Choose another path →')
    : h('a', { class: 'btn primary big cta', href: '#' + pr.next, onclick: () => { S.path = p.id; persist(); } }, (pr.done ? 'Continue: ' : 'Start: ') + stepInfo(pr.next).title + ' →');
  return h('div', { class: 'stage season pathpage', style: '--tone:' + p.tone }, siteNav(),
    h('header', { class: 'starthead' },
      h('a', { class: 'pback', href: '#' }, '← All paths'),
      h('span', { class: 'kicker' }, (p.track ? 'Specialist track' : 'Path ' + p.n) + ' · ' + p.who),
      h('h1', null, p.title), h('p', { class: 'lead' }, p.blurb),
      h('div', { class: 'pathstat' }, h('span', { class: 'pcbar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (pr.frac * 100).toFixed(1) + '%' })),
        h('span', null, pr.done + ' of ' + pr.total + ' steps · about ' + hrs(pathMinutes(p)) + ' in all')),
      h('div', { class: 'btnrow' }, cta)),
    done ? devCard(p, true) : null,
    h('ol', { class: 'steplist' }, p.chapters.map(([ch, rs]) => h('li', { class: 'chapter' }, h('h2', { class: 'secthead' }, ch),
      h('ol', { class: 'pathsteps' }, rs.map(r => { const n = ++k, info = stepInfo(r), ok = stepDone(r), now = r === pr.next;
        return h('li', null, h('a', { class: 'step' + (ok ? ' done' : '') + (now ? ' now' : ''), href: '#' + r, onclick: () => { S.path = p.id; persist(); } },
          h('span', { class: 'stn' }, ok ? '✓' : String(n)),
          h('span', { class: 'sttxt' }, h('span', { class: 'stkind' }, info.kind + ' · ' + info.min + ' min' + (now ? ' · up next' : '')), h('b', null, info.title), info.line ? h('span', { class: 'stline' }, info.line) : null))); }))))),
    h('div', { class: 'otherpaths' }, h('span', { class: 'small' }, 'Other paths:'), PATHS.filter(x => x !== p).map(x => h('a', { href: '#path-' + x.id }, x.title))),
    siteFoot());
}

/* ---------- Library (#library) ---------- */
function renderLibrary() {
  const tile = (href, kicker, title, line, tone, onclick) => h('a', { class: 'coretile', href, style: '--tile:' + tone, onclick }, h('span', { class: 'kicker' }, kicker), h('b', null, title), h('span', { class: 'coreline' }, line), h('i', { class: 'corego', 'aria-hidden': 'true' }, '→'));
  const nInstr = NN_SIMS.length;
  return h('div', { class: 'stage season library' }, siteNav(),
    h('header', { class: 'starthead' }, h('a', { class: 'pback', href: '#' }, '← All paths'), h('span', { class: 'kicker' }, 'Library · reference, not a journey'),
      h('h1', null, 'Everything, to browse or look up'), h('p', { class: 'lead' }, 'The paths use a slice of this. Come here when you want a specific attack, a checklist or the whole map.')),
    h('div', { class: 'libgrid' },
      tile('#adv', 'Cases', 'Real attacks, 2023–2025', ADV_CASES.length + ' documented incidents in eight tracks, each walked stage by stage, with what to change on Monday.', '#FF8A8A', () => { AdvV.v = 'cases'; }),
      tile('#adv', 'Instruments', 'Every instrument', 'All ' + nInstr + ' hands-on instruments in one place, including the ones on the paths.', '#A98BF5', () => { AdvV.v = 'sims'; }),
      tile('#atlas', 'Map', 'The full map', ATLAS.length + ' animated scenes across RAG, MCP, shipping and the SOC. Filter by highlights or what you haven’t seen.', '#5CE1E6'),
      tile('#atlas-playbook', 'Checklist', 'The playbook', 'Baseline control, failure modes and hardening, and tick-off checks for all ' + ATLAS.length + ' topics. Copies as text.', '#5FD08F'),
      tile('#story', 'Story', 'Agents at Meridian', 'The full episode list for the NEXUS story, with replays and the repair board.', '#F2B544'),
      tile('#kit', 'Toolkit', 'CIO kit', 'Questions, policies and templates to take back to your organisation.', '#8DB6F2'),
      tile('#feeds', 'Reading', 'Reading and news', 'Curated feeds on AI security, governance and MLOps, with this week’s hot topics.', '#FF9C7A'),
      S.workshop ? tile('#labs', 'Workshop', 'Workbench', 'The ten facilitated labs with tables, room codes and expert answers.', '#B9C4DA') : null,
      S.workshop ? tile('#deck', 'Workshop', 'Slide deck', 'The program deck with speaker notes.', '#B9C4DA') : null),
    h('section', { class: 'wsbox' }, h('div', null, h('b', null, 'Running a workshop?'), h('p', { class: 'small' }, 'Workshop mode adds the facilitator workbench, the slide deck, table numbers and the room view that compares tables.')),
      h('button', { type: 'button', class: 'btn', 'aria-pressed': String(!!S.workshop), onclick: () => { S.workshop = !S.workshop; commit(); } }, S.workshop ? 'Workshop mode: on' : 'Turn on workshop mode')),
    h('section', { class: 'wsbox' }, h('div', null, h('b', null, 'Prefer the original version?'), h('p', { class: 'small' }, 'The classic version opens on the story, with the workbench, map, deck and Advanced path in the top menu and no guided paths. Your progress carries over both ways.')),
      versionSwitch()),
    devCard(null),
    siteFoot());
}

/* ---------- top navigation, shared by both layouts ---------- */
function navLinks() {
  if (S.classic) return [['#atlas', 'Map'], ['#labs', 'Workbench'], ['#deck', 'Deck'], ['#adv', 'Advanced'], ['#kit', 'CIO kit'], ['#feeds', 'Reading']];
  return [['#', 'Paths'], ['#library', 'Library'], ['#feeds', 'Reading'], ...(S.workshop ? [['#labs', 'Workbench'], ['#deck', 'Deck']] : [])];
}

/* Secondary links at the end of a unit: tucked away so the one Next stays obvious. */
function goDeeper(items, title) {
  const kids = [items].flat(Infinity).filter(Boolean); if (!kids.length) return null;
  if (S.classic) return h('div', { class: 'btnrow center' }, kids);
  return h('details', { class: 'godeeper' }, h('summary', null, title || 'Go deeper'), h('div', { class: 'btnrow' }, kids));
}
