'use strict';
/* #kit: Take it to your CIO. The playbook from kit-data.js as one page a
   participant can work through, score for their own organisation, print and
   share. Maturity scores, the follow-up checklist and the region filter live
   in S.kit, apart from the labs. */

function kitState() { return S.kit || (S.kit = { mat: {}, after: {}, region: 'All' }); }
const KIT_TONE = { r: ['Red', 'bad'], a: ['Amber', 'amber'], g: ['Green', 'good'] };
function kitVerdict() {
  const m = kitState().mat, n = KIT.maturity.filter((_, i) => m[i]).length, reds = KIT.maturity.filter((_, i) => m[i] === 'r').length;
  if (reds >= 2) return [reds + ' reds: start with inventory and governance, not tools.', 'bad'];
  if (n < KIT.maturity.length) return ['Score every row from what you hear. ' + n + ' of ' + KIT.maturity.length + ' scored.', ''];
  return [(reds ? 'One red' : 'No reds') + ': inventory and governance are in place. Move to the gap assessment.', 'good'];
}
function kitScorecard() {
  const m = kitState().mat;
  return ['AI security maturity check (Take it to your CIO, as of ' + KIT.asOf + ')', ''].concat(KIT.maturity.map(([area, ...cells], i) => area + ': ' + (m[i] ? KIT_TONE[m[i]][0].toUpperCase() + ' — ' + cells['rag'.indexOf(m[i])] : 'not scored')), ['', kitVerdict()[0]]).join('\n');
}
const kitQuestions = () => KIT.qs.map(([t, q], i) => (i + 1) + '. ' + t + ': ' + q).join('\n');
const kitLink = () => location.href.split('#')[0] + '#kit';
const kitA = (t, url) => url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, t) : t;

function kitPage() {
  const st = kitState(), [verdict, vtone] = kitVerdict(), regions = ['All', ...new Set(KIT.laws.map(r => r[0]))];
  const sec = (id, n, title, lead, ...body) => h('section', { class: 'kitsec', id: 'kit-' + id }, h('h2', { class: 'sylgroup' }, h('span', { class: 'kitn' }, n), title), lead ? h('p', { class: 'advlead' }, lead) : null, ...body);
  const jump = id => e => { e.preventDefault(); const el = document.getElementById('kit-' + id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return [
    h('section', { class: 'hero' },
      h('a', { class: 'back', href: '#' }, '← Back to the story mode'),
      h('span', { class: 'eyebrow' }, 'Take-home kit · as of ' + KIT.asOf),
      h('h1', null, 'Take it to your CIO'),
      h('p', null, 'A one-page playbook for the conversation that starts on Monday: why now, 15 questions, a maturity check you can score, the frameworks your CIO will be measured against, and a 90-day plan to propose.'),
      h('div', { class: 'btnrow kitacts' }, copyButton(kitLink, 'Copy link to share'), h('button', { type: 'button', class: 'btn', onclick: () => window.print() }, 'Print or save as PDF'))),
    h('nav', { class: 'kitnav', 'aria-label': 'Kit sections' }, [['goal', 'Goal'], ['why', 'Why now'], ['qs', '15 questions'], ['mat', 'Maturity check'], ['map', 'Framework map'], ['push', 'Pushback'], ['plan', '90 days'], ['after', 'Follow-up']]
      .map(([id, t]) => h('a', { href: '#kit', onclick: jump(id) }, t))),
    sec('goal', '1', 'The goal', KIT.goal,
      h('div', { class: 'tips' }, KIT.rules.map(([b, t]) => h('div', { class: 'tip' }, h('b', null, b), h('span', null, t))))),
    sec('why', '2', 'Open with why now (3 minutes)', 'Three points, each tied to a document the CIO can check later.',
      h('ol', { class: 'kitwhy' }, KIT.why.map(([b, t, see]) => h('li', null, h('b', null, b + ' '), t, see ? h('a', { class: 'kitsee', href: '#' + see[0] }, 'See it live: ' + see[1] + ' →') : null))),
      box('kitcloser', h('p', null, 'Close the opening with: ', h('b', null, '“' + KIT.closer + '”'), ' Then move to the questions.'))),
    sec('qs', '3', 'Ask 15 questions, not 80', 'The first three alone tell you how mature they are. Each one links to the lab or case on this site that shows the risk, so you can show it, not just ask it.',
      h('div', { class: 'kitqs' }, KIT.qs.map(([t, q, listen, maps, see], i) => h('article', { class: 'kitq' + (i < 3 ? ' first' : '') },
        h('div', { class: 'kitqhead' }, h('span', { class: 'kitqn' }, String(i + 1)), h('span', { class: 'kitqt' }, t)),
        h('p', { class: 'kitqq' }, q),
        h('p', { class: 'small' }, h('b', null, 'Listen for: '), listen),
        h('p', { class: 'small kitmaps' }, h('b', null, 'Maps to: '), maps),
        see ? h('a', { class: 'kitsee', href: '#' + see[0] }, 'See it live: ' + see[1] + ' →') : null))),
      h('div', { class: 'btnrow' }, copyButton(kitQuestions, 'Copy the 15 questions'))),
    sec('mat', '4', 'Score the maturity check', 'Score each row from what you hear, or for your own organisation. Two or more reds means start with inventory and governance, not tools.',
      h('div', { class: 'kitmat' }, KIT.maturity.map(([area, ...cells], i) => h('div', { class: 'kitmatrow' },
        h('b', { class: 'kitarea' }, area),
        h('div', { class: 'kitcells' }, 'rag'.split('').map((k, j) => h('button', { type: 'button', class: 'kitcell ' + KIT_TONE[k][1] + (st.mat[i] === k ? ' on' : ''), 'aria-pressed': String(st.mat[i] === k),
          onclick: () => { st.mat[i] = st.mat[i] === k ? undefined : k; commit(); } }, h('i', null, KIT_TONE[k][0]), h('span', null, cells[j]))))))),
      h('div', { class: 'kitverdict ' + vtone }, h('b', null, verdict)),
      h('div', { class: 'btnrow' }, copyButton(kitScorecard, 'Copy my scorecard'), confirmTwice('kit-mat', 'Clear scores', () => { st.mat = {}; }, 'warn'))),
    sec('map', '5', 'The framework map', 'There is no single “Stanford 80 questions” list. The closest ready-made question sets are CSA’s AI-CAIQ (320 questions) and the AI domain of the Shared Assessments SIG. Everything else is a framework, standard or law the questions map back to. Name the ones your CIO already respects.',
      h('h3', { class: 'kith3' }, 'Question sets you can hand to a vendor or team'),
      h('div', { class: 'kittable' }, h('table', null, h('thead', null, h('tr', null, ['Document', 'Issuer', 'Status', 'What it gives you'].map(t => h('th', null, t)))),
        h('tbody', null, KIT.sets.map(([d, u, i, s2, w]) => h('tr', null, h('td', null, kitA(d, u)), h('td', null, i), h('td', null, s2), h('td', null, w)))))),
      h('h3', { class: 'kith3' }, 'Frameworks, standards and laws by region'),
      h('div', { class: 'kitregions', role: 'group', 'aria-label': 'Filter by region' }, regions.map(r => h('button', { type: 'button', class: 'kitchip' + (st.region === r ? ' on' : ''), 'aria-pressed': String(st.region === r), onclick: () => { st.region = r; commit(); } }, r))),
      h('div', { class: 'kittable' }, h('table', null, h('thead', null, h('tr', null, ['Region', 'Document', 'Issuer', 'Status', 'Why the CIO cares'].map(t => h('th', null, t)))),
        h('tbody', null, KIT.laws.filter(r => st.region === 'All' || r[0] === st.region).map(([, reg, d, u, i, s2, w]) => h('tr', null, h('td', null, reg), h('td', null, kitA(d, u)), h('td', null, i), h('td', null, s2), h('td', null, w))))))),
    sec('push', '6', 'Pushback you will hear', 'Tap a line to see a response.',
      h('div', { class: 'kitpush' }, KIT.pushback.map(([they, you]) => h('details', { class: 'kitpushi' }, h('summary', null, '“' + they + '”'), h('p', null, you))))),
    sec('plan', '7', 'Propose 90 days, ask for 2 weeks', 'Ask for step 1 only; steps 2 and 3 show where it leads.',
      h('ol', { class: 'kitplan' }, KIT.plan.map(([when, what, how, out], i) => h('li', { class: i ? '' : 'ask' }, h('span', { class: 'kitwhen' }, when + (i ? '' : ' · the ask')), h('b', null, what), h('p', null, how), out ? h('p', { class: 'small' }, h('b', null, 'Output: '), out) : null)))),
    sec('after', '8', 'After the meeting', null,
      h('ul', { class: 'kitafter' }, KIT.after.map((t, i) => h('li', null, h('label', null, h('input', { type: 'checkbox', checked: st.after[i] ? true : null, onchange: e => { st.after[i] = e.target.checked; persist(); } }), h('span', null, t)))))),
    box('kitsrc', label('Sources'), h('ul', { class: 'kitsources' }, KIT.sources.map(([t, u]) => h('li', null, kitA(t, u)))),
      h('p', { class: 'small' }, 'Compiled ' + KIT.asOf + '. Standards and deadlines move: check the dates before you quote them.'))
  ];
}
// Print every pushback answer, not just the open ones.
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('beforeprint', () => document.querySelectorAll('.kitpushi').forEach(d => { d.open = true; }));
