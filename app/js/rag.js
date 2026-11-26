'use strict';
/* RAG Lab · "Build Ask Meridian". Participants design a RAG pipeline under a
   budget, run a day in production (ordinary questions and real attack
   patterns flow through their design), read the incident report, then
   redesign and replay. Deterministic by design: the same design always gives
   the same outcome, so tables can compare. Route: '#rag'. */

const RAG_BUDGET = 13;
const RAG_STAGES = [
  { k: 'approach', name: 'Approach', q: 'How will the assistant know Meridian’s documents?', opts: [
    ['rag', 'Retrieval (RAG)', 'Look up relevant documents at question time, then answer from them.', 0],
    ['finetune', 'Fine-tune a model on all documents', 'Bake the documents into the model’s weights. No lookups.', 0],
    ['paste', 'Paste everything into every prompt', 'Long-context model reads the whole library each time.', 0]] },
  { k: 'sources', name: 'Sources', q: 'What goes into the knowledge base?', opts: [
    ['all', 'All of SharePoint (40,000 documents)', 'Maximum coverage, no curation.', 0],
    ['approved', 'Approved sources, each with an owner', 'Policies, product docs and runbooks. Less coverage.', 1],
    ['tickets', 'Approved sources, plus tickets marked untrusted', 'Adds support tickets, labelled as customer-written.', 2]] },
  { k: 'ingest', name: 'Ingestion', q: 'What happens to documents before indexing?', opts: [
    ['raw', 'Index them as they are', 'Fast and cheap.', 0],
    ['sanitize', 'Strip hidden text, redact secrets and personal data', 'Cleans every document on the way in.', 2]] },
  { k: 'store', name: 'Vector store', q: 'Where does the index live?', opts: [
    ['public', 'Vendor default: public endpoint, API key', 'Quickest to set up.', 0],
    ['private', 'Private network, encrypted, access-controlled', 'A little more setup.', 1]] },
  { k: 'access', name: 'Access', q: 'How are document permissions handled?', opts: [
    ['none', 'Everyone can retrieve everything', 'Simplest. One index for all.', 0],
    ['index', 'Permissions copied at indexing (monthly refresh)', 'Respects permissions as they were at indexing time.', 1],
    ['query', 'Permission check at question time', 'Retrieves only what the asker can open right now.', 3]] },
  { k: 'rank', name: 'Retrieval', q: 'How are results ranked?', opts: [
    ['similarity', 'Closest text match wins', 'The standard default.', 0],
    ['trust', 'Rank by source trust and freshness, then match', 'Official, current sources beat look-alikes.', 2]] },
  { k: 'gen', name: 'Generation', q: 'What may the assistant do with what it retrieves?', opts: [
    ['tools', 'Answer, and act: email and file tools enabled', 'Staff love it: “email this to my team”.', 0],
    ['data', 'Answer only; retrieved text is data, never instructions', 'No tools. Drafts that people send themselves.', 0]] },
  { k: 'output', name: 'Output', q: 'What is checked before staff see an answer?', opts: [
    ['none', 'Nothing: fastest answers', '', 0],
    ['dlp', 'Citations on every answer, plus a data-loss filter', 'Sources are shown; secrets and salary figures are masked.', 2]] },
  { k: 'updates', name: 'Updates', q: 'How do the parser and connectors update?', opts: [
    ['auto', 'Auto-update to the latest version', 'Always current.', 0],
    ['pinned', 'Pinned versions; every change re-reviewed', 'Updates wait for a short review.', 1]] }];
const RAG_EXPERT = { approach: 'rag', sources: 'tickets', ingest: 'sanitize', store: 'private', access: 'query', rank: 'trust', gen: 'data', output: 'dlp', updates: 'pinned' };
const RAG_PATH = ['Ingest', 'Store', 'Retrieve', 'Generate', 'Output'];

/* Each event returns {o: good|warn|bad, at: pipeline stage index, title, text, fix, mod, owner, cost: {leak, wrong, money}} */
const RAG_EVENTS = [
  { id: 'leave', who: 'A branch officer', ask: '“How many days of annual leave do I get?”', kind: 'Ordinary question', run: d => {
    if (d.approach === 'finetune') return { o: 'warn', at: 3, title: 'Answered from last year’s policy', text: 'The fine-tuned model learned the 2025 policy. Leave rose from 21 to 24 days in April; retraining is quarterly.', fix: 'Retrieval of current, owned sources', mod: '12', owner: 'HR policy owner', cost: { wrong: 1 } };
    if (d.sources === 'all' && d.rank === 'similarity') return { o: 'warn', at: 2, title: 'Quoted the 2022 policy', text: 'Three versions of the leave policy sit on SharePoint. The oldest matched best, so staff were told 18 days.', fix: 'Rank by source trust and freshness, or curate sources', mod: '12', owner: 'Knowledge owner', cost: { wrong: 1 } };
    return { o: 'good', at: 4, title: 'Correct: 24 days, with the policy cited', text: 'The current, owned policy was retrieved and cited.', fix: '', mod: '12', owner: '', cost: {} }; } },
  { id: 'salary', who: 'A junior analyst', ask: '“What are the salary bands for directors?”', kind: 'Curious question', run: d => {
    if (d.approach !== 'rag' || d.access === 'none') {
      if (d.output === 'dlp' && d.approach === 'rag') return { o: 'warn', at: 4, title: 'Figures masked, but the document was exposed', text: 'The filter hid the numbers, yet the answer named the confidential “Director pay review” paper and its authors.', fix: 'Permission-aware retrieval', mod: '12', owner: 'CHRO / data owner', cost: { leak: 1 } };
      return { o: 'bad', at: 2, title: 'Director salary bands disclosed', text: d.approach === 'finetune' ? 'The model memorised the pay paper during fine-tuning. You cannot remove it without retraining.' : 'HR files were retrievable by anyone. Screenshots reach WhatsApp within the hour.', fix: 'Permission-aware retrieval (impossible after fine-tuning)', mod: '12', owner: 'CHRO / data owner', cost: { leak: 1, money: 0 } }; }
    return { o: 'good', at: 2, title: '“I don’t have access to that information.”', text: 'The analyst cannot open HR files, so neither can the assistant on her behalf.', fix: '', mod: '12', owner: '', cost: {} }; } },
  { id: 'mover', who: 'Priya, moved from HR to Sales last week', ask: '“Is there a restructuring plan for my old team?”', kind: 'Permission change', run: d => {
    if (d.approach === 'rag' && d.access === 'query') return { o: 'good', at: 2, title: 'Blocked: her HR access ended last week', text: 'Permissions were checked at the moment she asked.', fix: '', mod: '10', owner: '', cost: {} };
    return { o: 'bad', at: 2, title: 'Confidential restructuring list shown', text: d.access === 'index' && d.approach === 'rag' ? 'The index still carries last month’s permissions, when Priya was in HR. 46 names on a draft redundancy list.' : 'Anyone can retrieve HR drafts. 46 names on a draft redundancy list.', fix: 'Check permissions at question time, not indexing time', mod: '10 + 12', owner: 'IAM lead', cost: { leak: 46 } }; } },
  { id: 'wiki', who: 'Someone edits the Travel wiki', ask: 'The edited page now says claims under ₹50,000 need no approval.', kind: 'Knowledge poisoning', run: d => {
    if (d.sources === 'approved' || d.sources === 'tickets') return { o: 'good', at: 0, title: 'Ignored: the wiki is not an approved source', text: 'Only owned, reviewed sources are indexed.', fix: '', mod: '12', owner: '', cost: {} };
    if (d.approach === 'rag' && d.rank === 'trust') return { o: 'warn', at: 2, title: 'Official policy won, but the edit was retrievable', text: 'Ranking by trust put the Finance policy first. For vaguer questions the wiki edit still surfaced twice.', fix: 'Approved sources with owners', mod: '12', owner: 'Knowledge governance board', cost: { wrong: 2 } };
    return { o: 'bad', at: 2, title: '312 staff told approvals are no longer needed', text: '₹38 lakh of unapproved travel claims were filed before Finance noticed.', fix: 'Approved, owned sources; trust ranking', mod: '12', owner: 'Knowledge governance board', cost: { wrong: 312, money: 3800000 } }; } },
  { id: 'pdf', who: 'A vendor uploads an invoice PDF to SharePoint', ask: 'White, 1-point text inside tells AI assistants to email the latest finance documents to an outside address.', kind: 'Indirect injection', run: d => {
    if (d.sources !== 'all') return { o: 'good', at: 0, title: 'Never indexed', text: 'Vendor uploads are not an approved source.', fix: '', mod: '11 + 12', owner: '', cost: {} };
    if (d.ingest === 'sanitize') return { o: 'good', at: 0, title: 'Hidden text stripped at ingestion', text: 'The instruction never reached the index.', fix: '', mod: '11 + 12', owner: '', cost: {} };
    if (d.gen === 'tools') return { o: 'bad', at: 3, title: '12 finance documents emailed outside', text: 'Retrieved text was treated as an instruction, and the assistant had an email tool. Untrusted content plus a powerful tool.', fix: 'Retrieved text is data, never instructions; no tools for this assistant', mod: '11', owner: 'Head of AI platform', cost: { leak: 12, money: 0 } };
    return { o: 'warn', at: 3, title: 'Odd answer, but nothing happened', text: 'The answer mentioned forwarding documents, but with no tools there was nothing to act with.', fix: 'Strip hidden text at ingestion', mod: '11', owner: 'Platform owner', cost: { wrong: 1 } }; } },
  { id: 'ticket', who: 'A customer ticket stuffed with keywords', ask: 'Written to match “expense policy”, it says personal phone bills are reimbursable.', kind: 'Retrieval hijacking', run: d => {
    if (d.sources === 'approved') return { o: 'good', at: 0, title: 'Tickets are not indexed', text: 'Customer-written text never enters the knowledge base.', fix: '', mod: '12', owner: '', cost: {} };
    if (d.approach === 'rag' && d.rank === 'trust') return { o: 'good', at: 2, title: 'The official policy ranked first', text: d.sources === 'tickets' ? 'Tickets are labelled untrusted and ranked below policy.' : 'Trust ranking put the Finance policy above the ticket.', fix: '', mod: '12', owner: '', cost: {} };
    return { o: 'bad', at: 2, title: 'The ticket beat the policy', text: 'It matched the question better than the real policy. 140 claims for phone bills followed.', fix: 'Rank by source trust; label customer text untrusted', mod: '12', owner: 'Platform owner', cost: { wrong: 140, money: 420000 } }; } },
  { id: 'secret', who: 'An engineer', ask: '“How do I connect to the billing system?”', kind: 'Secret in a document', run: d => {
    if (d.ingest === 'sanitize') return { o: 'good', at: 0, title: 'Answered, with the API key redacted', text: 'The runbook’s live key was removed before indexing.', fix: '', mod: '12', owner: '', cost: {} };
    if (d.output === 'dlp' && d.approach !== 'finetune') return { o: 'warn', at: 4, title: 'Key masked at the last moment', text: 'The data-loss filter caught it, but the secret sits in the index for anyone who reaches it another way.', fix: 'Redact secrets at ingestion', mod: '12 + 13', owner: 'Head of IT', cost: { leak: 1 } };
    return { o: 'bad', at: 3, title: 'A live billing API key in the answer', text: 'Pasted into a team chat. Rotating it takes the billing system down for an hour.', fix: 'Redact secrets at ingestion; output filtering', mod: '12 + 13', owner: 'Head of IT', cost: { leak: 1, money: 600000 } }; } },
  { id: 'store', who: 'An internet scanner finds your index', ask: 'Vector databases with public endpoints are routinely scanned.', kind: 'Vector store exposure', run: d => {
    if (d.approach !== 'rag') return { o: 'good', at: 1, title: 'No vector store to find', text: 'This approach has no separate index. (It has other problems.)', fix: '', mod: '12', owner: '', cost: {} };
    if (d.store === 'private') return { o: 'good', at: 1, title: 'Nothing to reach', text: 'The index is on a private network and encrypted.', fix: '', mod: '12', owner: '', cost: {} };
    return { o: 'bad', at: 1, title: 'The whole index copied', text: d.sources === 'all' ? 'Embeddings and text chunks of 40,000 documents, including HR and finance, downloaded. A personal data breach.' : 'Embeddings and text chunks of every approved document downloaded.', fix: 'Private network, encryption, access control', mod: '12', owner: 'Infrastructure lead', cost: { leak: d.sources === 'all' ? 40000 : 3000 } }; } },
  { id: 'update', who: 'The PDF parser publishes version 2.4', ask: 'The new version quietly copies every parsed document to an outside server.', kind: 'Supply-chain update', run: d => {
    if (d.updates === 'pinned') return { o: 'good', at: 0, title: 'Held for review, then rejected', text: 'The diff showed new outbound network calls.', fix: '', mod: '12 + 13', owner: '', cost: {} };
    return { o: 'bad', at: 0, title: 'Every new document copied outside for 9 days', text: 'Like the postmark-mcp case: trust earned by clean versions, then abused.', fix: 'Pinned versions; re-review every change', mod: '12 + 13', owner: 'MCP / connector registry owner', cost: { leak: 2100 } }; } }];

function ragState() { S.rag = S.rag || { d: {}, phase: 'brief', i: 0, runs: [] }; return S.rag; }
function ragSpend(d) { return sum(RAG_STAGES.map(st => { const o = st.opts.find(x => x[0] === d[st.k]); return o ? o[3] : 0; })); }
function ragDesignComplete(d) { return RAG_STAGES.every(st => d[st.k]); }
function ragEffective(d) {
  const e = Object.assign({}, d);
  if (d.approach !== 'rag') { e.access = 'none'; e.rank = 'similarity'; if (d.approach === 'finetune') e.output = d.output === 'dlp' ? 'dlp' : 'none'; }
  return e;
}
function ragResults(d) { const e = ragEffective(d); return RAG_EVENTS.map(ev => Object.assign({ id: ev.id }, ev.run(e))); }
function ragUseful(d) { // usefulness: coverage and helpfulness, 0–100
  let u = 70; if (d.sources === 'all') u += 15; if (d.sources === 'tickets') u += 8; if (d.gen === 'tools') u += 10; if (d.approach === 'paste') u -= 25; if (d.approach === 'finetune') u -= 10; if (d.access === 'query') u -= 3; return Math.max(0, Math.min(100, u));
}
function ragTally(res) {
  const t = { good: 0, warn: 0, bad: 0, leak: 0, wrong: 0, money: 0 };
  res.forEach(r => { t[r.o]++; t.leak += (r.cost.leak || 0); t.wrong += (r.cost.wrong || 0); t.money += (r.cost.money || 0); });
  return t;
}
function ragStars(t) { return t.bad === 0 && t.warn <= 1 ? 3 : t.bad <= 1 ? 2 : t.bad <= 3 ? 1 : 0; }
function lakh(n) { return n >= 10000000 ? '₹' + (n / 10000000).toFixed(1) + ' crore' : n >= 100000 ? '₹' + (n / 100000).toFixed(1) + ' lakh' : n ? '₹' + n.toLocaleString('en-IN') : '₹0'; }

function ragPipe(d, focus, hl) {
  return h('div', { class: 'ragpipe' }, RAG_STAGES.map((st, i) => {
    const o = st.opts.find(x => x[0] === d[st.k]);
    const risky = o && RAG_EXPERT[st.k] !== o[0];
    return h('button', { type: 'button', class: 'ragnode' + (focus === i ? ' focus' : '') + (o ? (risky ? ' set risky' : ' set') : '') + (hl && hl[i] ? ' ' + hl[i] : ''),
      onclick: () => { const R = ragState(); if (R.phase === 'build') { R.focus = i; commit(); } } },
      h('span', { class: 'rn' }, String(i + 1)), h('b', null, st.name), h('small', null, o ? o[1].split(':')[0].split(',')[0] : 'Choose'));
  }));
}

function ragBrief(R) {
  return h('div', { class: 'sc sc-rag' }, art('library'), h('span', { class: 'kicker' }, 'Core lab · Module 09 workshop · Module 12'), h('h1', null, 'Build Ask Meridian'),
    h('p', { class: 'lead' }, 'Meridian wants a knowledge assistant for 6,000 staff, live in two weeks. You design its pipeline under a budget of ' + RAG_BUDGET + ' points. Then it runs for a day in production: nine events, from ordinary questions to real attack patterns. You will see exactly what your design lets through.'),
    h('div', { class: 'ragsteps' }, [['1', 'Design', 'Nine decisions, one budget'], ['2', 'Run a day', 'Nine events through your pipeline'], ['3', 'Incident report', 'What it cost, and who owns the fix'], ['4', 'Rebuild', 'Change your design, run it again']].map(([n, t, s2]) => h('div', null, h('b', null, n), h('span', null, t), h('small', null, s2)))));
}
function ragBuild(R) {
  const d = R.d, focus = R.focus || 0, st = RAG_STAGES[focus], spend = ragSpend(d), over = spend > RAG_BUDGET;
  return h('div', { class: 'sc sc-rag build' },
    h('div', { class: 'ragtop' }, h('h2', null, 'Design the pipeline'), h('div', { class: 'budget' + (over ? ' over' : '') }, h('span', null, 'Budget'), meter(spend / RAG_BUDGET, over ? 'bad' : 'accent', 'Budget used'), h('b', null, spend + ' / ' + RAG_BUDGET))),
    ragPipe(d, focus),
    h('div', { class: 'ragstage', key: focus }, h('p', { class: 'prompt-small' }, 'Stage ' + (focus + 1) + ' of ' + RAG_STAGES.length + ' · ' + st.name), h('h3', null, st.q),
      h('div', { class: 'cards n' + st.opts.length }, st.opts.map(([k, t, desc, cost], j) => h('button', { type: 'button', class: 'card-opt' + (d[st.k] === k ? ' picked' : ''), style: 'animation-delay:' + (0.05 * j) + 's',
        onclick: () => { d[st.k] = k; if (focus < RAG_STAGES.length - 1 && !d[RAG_STAGES[focus + 1].k]) R.focus = focus + 1; commit(); } },
        h('div', { class: 'optrow' }, h('span', { class: 'optkey' }, String.fromCharCode(65 + j)), h('span', { class: 'cost' + (cost ? '' : ' free') }, cost ? cost + ' pts' : 'free')), h('b', null, t), desc ? h('span', null, desc) : null)))),
    d.approach && d.approach !== 'rag' ? h('p', { class: 'flagline' }, d.approach === 'finetune' ? 'Fine-tuning: no per-person permissions, no citations, and documents cannot be removed without retraining. Access and retrieval choices no longer apply.' : 'Pasting everything: every person sees every document, and cost per question is huge. Access and retrieval choices no longer apply.') : null,
    over ? h('p', { class: 'flagline' }, 'Over budget by ' + (spend - RAG_BUDGET) + '. Something has to give: that is the governance decision.') : null);
}
function ragRun(R) {
  const res = R.res, i = R.i, ev = RAG_EVENTS[i], r = res[i];
  const t = ragTally(res.slice(0, i + 1));
  const hl = {}; for (let k = 0; k < RAG_PATH.length; k++) hl[k + 1] = k < r.at ? 'pass' : k === r.at ? (r.o === 'good' ? 'block' : r.o === 'warn' ? 'weak' : 'hit') : 'idle';
  return h('div', { class: 'sc sc-rag run' },
    h('div', { class: 'ragtop' }, h('h2', null, 'A day in production'), h('div', { class: 'tally' }, h('span', { class: 't-good' }, '✓ ' + t.good), h('span', { class: 't-warn' }, '! ' + t.warn), h('span', { class: 't-bad' }, '✗ ' + t.bad), h('span', null, lakh(t.money)))),
    h('div', { class: 'ragflow' }, RAG_PATH.map((p, k) => h('div', { class: 'flownode ' + (hl[k + 1] || ''), style: 'animation-delay:' + (0.35 * k) + 's' }, h('b', null, p))), h('i', { class: 'packet ' + r.o, style: '--stop:' + r.at })),
    h('div', { class: 'eventcard', key: i }, h('div', { class: 'evhead' }, h('span', { class: 'kicker' }, 'Event ' + (i + 1) + ' of ' + RAG_EVENTS.length + ' · ' + ev.kind), h('span', { class: 'small' }, ev.who)), h('p', { class: 'evask' }, ev.ask)),
    h('div', { class: 'consequence ' + (r.o === 'warn' ? 'ok' : r.o), style: 'animation-delay:1.9s' }, h('span', { class: 'verdict ' + (r.o === 'good' ? 'good' : r.o === 'warn' ? 'amber' : 'bad') }, r.o === 'good' ? 'Stopped' : r.o === 'warn' ? 'Weakened' : 'It happened'),
      h('b', null, r.title), h('p', null, r.text), r.fix ? h('p', { class: 'small' }, 'Control that stops it: ' + r.fix + ' · Module ' + r.mod) : null));
}
function ragReport(R) {
  const res = R.res, t = ragTally(res), n = ragStars(t), d = R.d;
  const diff = RAG_STAGES.filter(st => d[st.k] !== RAG_EXPERT[st.k]);
  return h('div', { class: 'sc sc-rag report' },
    h('div', { class: 'ragtop' }, h('h2', null, 'Incident report · Run ' + R.runs.length), h('div', { class: 'stars small' }, [0, 1, 2].map(k => h('span', { class: 'star' + (k < n ? ' on' : '') }, '★')))),
    h('div', { class: 'finalm' }, h('div', null, h('b', null, t.bad), h('span', null, 'Incidents')), h('div', null, h('b', null, t.leak.toLocaleString('en-IN')), h('span', null, 'Records exposed')), h('div', null, h('b', null, t.wrong), h('span', null, 'Wrong answers')), h('div', null, h('b', null, lakh(t.money)), h('span', null, 'Direct loss')), h('div', null, h('b', null, ragUseful(d) + '%'), h('span', null, 'Usefulness'))),
    h('div', { class: 'reprows' }, res.map((r, k) => h('div', { class: 'reprow ' + r.o, style: 'animation-delay:' + (0.06 * k) + 's' }, h('span', { class: 'ri' }, r.o === 'good' ? '✓' : r.o === 'warn' ? '!' : '✗'), h('b', null, r.title), h('small', null, r.o === 'good' ? 'Stopped' : (r.fix + ' · owner: ' + r.owner + ' · Module ' + r.mod))))),
    R.runs.length > 1 ? h('p', { class: 'small runs' }, 'Your runs: ' + R.runs.map((x, k) => 'Run ' + (k + 1) + ': ' + x.bad + ' incidents, ' + lakh(x.money)).join(' → ')) : null,
    diff.length ? details('Compare with the expert design (' + diff.length + ' differences)', false, h('ul', { class: 'plain' }, diff.map(st => h('li', null, h('b', null, st.name + ': '), 'you chose “' + nameOf(st.opts, d[st.k]) + '”; expert: “' + nameOf(st.opts, RAG_EXPERT[st.k]) + '”')))) : h('p', { class: 'goodline' }, 'Your design matches the expert design.'));
}

function renderRag() {
  const R = ragState();
  const go = ph => { R.phase = ph; Story.flash = null; commit(); };
  let body, foot;
  if (R.phase === 'build') {
    body = ragBuild(R); const ok = ragDesignComplete(R.d) && ragSpend(R.d) <= RAG_BUDGET;
    foot = [h('button', { type: 'button', class: 'btn ghost', onclick: () => go('brief') }, '← Brief'), h('span', { class: 'hint' }, ok ? 'Ready to go live' : ragDesignComplete(R.d) ? 'Over budget' : 'Make all nine choices'),
      h('button', { type: 'button', class: 'btn primary', disabled: ok ? null : true, onclick: () => { R.res = ragResults(R.d); R.i = 0; R.phase = 'run'; commit(); } }, 'Go live →')];
  } else if (R.phase === 'run') {
    body = ragRun(R); const last = R.i >= RAG_EVENTS.length - 1;
    foot = [h('button', { type: 'button', class: 'btn ghost', onclick: () => go('build') }, '← Design'), h('span', { class: 'hint' }, 'Event ' + (R.i + 1) + ' of ' + RAG_EVENTS.length),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { if (last) { const t = ragTally(R.res); R.runs.push({ bad: t.bad, money: t.money }); R.phase = 'report'; } else R.i++; commit(); } }, last ? 'Incident report →' : 'Next event →')];
  } else if (R.phase === 'report') {
    body = ragReport(R);
    foot = pathCtx() ? [h('button', { type: 'button', class: 'btn ghost', onclick: () => { R.focus = 0; go('build'); } }, '↺ Redesign'), h('span', { class: 'hint' }, 'Redesign and run again, or move on'), pathGo('#', '', 'btn primary')]
      : [h('a', { class: 'btn ghost', href: '#' }, 'Home'), h('span', { class: 'hint' }, 'Change your design and run again'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { R.focus = 0; go('build'); } }, 'Redesign →')];
  } else {
    body = ragBrief(R);
    foot = [h('a', { class: 'btn ghost', href: pathBack('#') }, pathCtx() ? '← Path' : '← Home'), h('span', { class: 'hint' }, ''), h('button', { type: 'button', class: 'btn primary', onclick: () => { R.focus = R.focus || 0; go('build'); } }, 'Start designing →')];
  }
  const key = 'rag:' + R.phase + ':' + (R.phase === 'run' ? R.i : R.phase === 'build' ? (R.focus || 0) : '');
  const anim = Story.last !== key && R.phase !== 'build' ? ' enter-f' : ''; Story.last = key;
  return h('div', { class: 'stage' },
    h('header', { class: 'stagetop' }, h('a', { class: 'close', href: pathBack('#'), 'aria-label': pathCtx() ? 'Back to your path' : 'Home' }, '✕'),
      h('div', { class: 'eptitle' }, h('span', null, pathCrumb('Build lab · RAG pipelines')), h('b', null, 'Build Ask Meridian')),
      h('div', { class: 'ragphase' }, ['brief', 'build', 'run', 'report'].map((p, k) => h('span', { class: p === R.phase ? 'on' : '' }, ['Brief', 'Design', 'Run', 'Report'][k])))),
    h('div', { class: 'dots' }),
    h('main', { class: 'scenewrap' + anim }, body),
    h('footer', { class: 'stagebot' }, foot));
}
