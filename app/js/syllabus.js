'use strict';
/* The Syllabus tab: Modules 10–15 taught topic by topic, in syllabus order.
   Each topic is a short card (what it means, where it shows up at Meridian)
   with one tap-to-answer check and a link to where the workbench practises it.
   Answers live in S.topics, apart from the lab's own state. */

function syllabusFor(id) { return SYLLABUS[id] || null; }
function syllabusTopics(id) { const sy = SYLLABUS[id]; return sy ? sy.groups.flatMap(g => g[1]) : []; }
function topicState(id) { S.topics = S.topics || {}; return S.topics[id] || (S.topics[id] = {}); }
function topicProgress(id) {
  const all = syllabusTopics(id), st = (S.topics || {})[id] || {};
  return { total: all.length, done: all.filter((_, k) => st[k] != null).length, right: all.filter((t, k) => st[k] === t.a).length };
}
// Show options in a rotated order, so the right answer is not always in the same place.
function topicOrder(t, k) { const n = t.o.length, r = k % n; return [...Array(n).keys()].map(i => (i + r) % n); }

function practiseLink(lab, go) {
  if (!go) return null;
  if (go === 'rag') return h('a', { href: '#rag' }, 'Build Ask Meridian (core lab)');
  if (go.startsWith('harden-')) { const l = HD[go.slice(7)]; return l ? h('a', { href: '#' + go }, 'Harden NEXUS · Layer ' + l.n + ': ' + l.title) : null; }
  const names = { do: '2 · Work task', drills: '3 · Quick quiz', scen: '4 · Case studies', deck: 'Deck' };
  return h('button', { type: 'button', class: 'linkbtn', onclick: () => { S.tab[lab.id] = go; commit(); window.scrollTo(0, 0); } }, names[go] || go);
}

function topicCard(lab, t, k) {
  const st = topicState(lab.id), pick = st[k], done = pick != null, ok = pick === t.a;
  return h('article', { class: 'topic' + (done ? (ok ? ' good' : ' bad') : ''), id: 'topic-' + k },
    h('div', { class: 'topichead' }, h('span', { class: 'topicn' }, String(k + 1)), h('h3', null, t.t), done ? pill(ok ? 'Right' : 'Review', ok ? 'good' : 'bad') : null),
    h('p', null, t.say),
    h('p', { class: 'topiceg' }, h('b', null, 'At Meridian: '), t.eg),
    h('div', { class: 'topicq' }, h('b', null, t.q),
      h('div', { class: 'moves' }, topicOrder(t, k).map((oi, j) => h('button', { type: 'button', class: 'move' + (done ? (oi === pick ? ' picked ' + (ok ? 'good' : 'bad') : oi === t.a ? ' best' : ' dim') : ''),
        'aria-disabled': done ? 'true' : null, onclick: () => { if (done) return; st[k] = oi; commit(); } },
        h('span', { class: 'mvkey' }, String.fromCharCode(65 + j)), h('span', { class: 'mvtext' }, t.o[oi]))))),
    done ? h('div', { class: 'answer ' + (ok ? 'good' : 'bad') }, h('b', null, ok ? 'Right.' : 'The strongest answer is marked with a dashed border.'), h('p', null, t.why)) : null,
    t.go ? h('p', { class: 'small topicgo' }, 'Practise it: ', practiseLink(lab, t.go)) : null,
    atFor(lab.id, k) ? h('p', { class: 'small topicgo' }, 'Watch it: ', h('a', { href: '#atlas-' + atFor(lab.id, k).id }, 'the animated stop on the 10-hour map')) : null);
}

function syllabusPane(lab) {
  const sy = syllabusFor(lab.id), p = topicProgress(lab.id);
  let k = 0;
  return [
    box('sylhead', label('Module ' + lab.n + ' syllabus · ' + sy.hours + ' hours · ' + p.total + ' topics'),
      h('p', { class: 'sub' }, 'Each topic in the order it is taught: what it means, where it shows up at Meridian, and one question to check it. The work task, quiz and case studies then practise it.'),
      stats(stat(p.done + ' / ' + p.total, 'Topics checked'), stat(p.right, 'Right first time', 'good')), meter(p.total ? p.done / p.total : 0, 'accent', 'Topics checked'),
      h('ol', { class: 'sylindex' }, syllabusTopics(lab.id).map((t, i) => { const v = topicState(lab.id)[i];
        return h('li', { class: v == null ? '' : v === t.a ? 'good' : 'bad' }, h('a', { href: '#' + lab.id, onclick: e => { e.preventDefault(); const el = document.getElementById('topic-' + i); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t.t)); }))),
    sy.groups.map(([name, topics]) => [name ? h('h2', { class: 'sylgroup' }, name) : null, topics.map(t => topicCard(lab, t, k++))]),
    h('div', { class: 'btnrow end' }, confirmTwice('topics-' + lab.id, 'Clear syllabus answers', () => { delete S.topics[lab.id]; }, 'warn'))];
}
