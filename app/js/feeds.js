'use strict';
/* Reading: the curated OPML feed pack as a page. Every source says why it
   matters for this program and which modules it keeps current. The list
   itself comes from the OPML (feeds-data.js, generated); this file adds the
   course mapping. Browsers block cross-site RSS reads, so the page links out
   and hands over the OPML instead of fetching live headlines. */

/* Keyed by feed title as it appears in the OPML. [modules, why it matters here, start-here pick] */
const FEED_MAP = {
  'Embrace The Red': [['m11', 'm12'], 'Agent and tool exploit write-ups with disclosure timelines: the cases behind Modules 11 and 12, as they happen.', 1],
  'Simon Willison: prompt-injection': [['m11', 'm12'], 'The running record of prompt injection in shipped products, and of why each fix did not hold.', 1],
  'OWASP Gen AI Security Project': [['m10', 'm11', 'm14'], 'Where the LLM Top 10 and agentic threat lists change first. Quote it in risk reviews.', 1],
  'Trail of Bits Blog': [['m09', 'm13'], 'Audit findings on ML stacks: pickles, model loaders and the tooling a pre-production review should check.'],
  'Google Online Security Blog': [['m14'], 'Threat intelligence on real adversary use of AI: what a SOC should expect to see.'],
  'Schneier on Security': [['m15'], 'Security and AI policy commentary for the board conversation.'],
  'The EU AI Act Newsletter': [['m07', 'm15'], 'Fortnightly on what the AI Act now requires and by when. The deadline tracker for Module 15.', 1],
  'Center for Security and Emerging Technology': [['m15'], 'Policy research with the evidence behind it: useful when a regulator asks why.'],
  'Transformer': [['m15'], 'Weekly AI policy news, from the US, EU and UK in one place.'],
  'Import AI': [['m07', 'm08'], 'Weekly research digest: which capabilities arrived and what they change for governance.'],
  'AI as Normal Technology': [['m07'], 'The counterweight to hype: how to tell a real risk from a headline.'],
  'Federal Register: AI': [['m15'], 'Primary US rule-making that mentions AI. Low-level, but it is the source.'],
  'AI Alignment Forum': [['m08'], 'Technical safety research: model behaviour, oversight and evaluation.'],
  'Eugene Yan': [['m09', 'm13'], 'How production LLM systems are actually built: patterns to check in architecture review.'],
  "Hamel's Blog": [['m13'], 'Evals in practice: the testing discipline behind “It passed. Ship it?”', 1],
  'Chip Huyen': [['m09'], 'ML systems design, low volume and high signal.'],
  'Marvelous MLOps': [['m13'], 'MLOps lifecycle in detail: versioning, deployment and monitoring.'],
  'Ahead of AI': [['m09'], 'How models are trained and tuned, explained from the papers.'],
  'Latent Space': [['m12'], 'AI engineering news: agents, MCP and the tools your teams are adopting this month.'],
  'Interconnects': [['m13'], 'Training and open models: what you inherit when you pull weights from a hub.'],
  'Hugging Face Blog': [['m13'], 'The model hub itself: formats, safetensors, signing and supply chain changes.'],
  'PyTorch': [['m13'], 'Framework releases, including the security fixes your images need.'],
  'Netflix TechBlog': [['m09'], 'ML platforms at scale: what a mature platform review looks like.'],
  'AWS Machine Learning Blog': [['m09', 'm14'], 'Vendor, high volume. Skim for guardrail and logging features you can turn on.'],
  'Databricks Blog': [['m13'], 'Vendor. MLflow and model registry changes for the lifecycle controls.'],
  'OpenAI News': [['m07'], 'Primary source for model releases, system cards and usage policy changes.'],
  'Google DeepMind News': [['m07', 'm08'], 'Primary source for model releases and safety frameworks.']
};
const FEED_GROUP = { 'AI Security': ['sec', 'Security'], 'AI Governance & Policy': ['gov', 'Governance'], 'MLOps & ML Engineering': ['ops', 'MLOps'], 'Primary Sources — AI Labs': ['lab', 'AI labs'] };
const FEED_ALL = FEEDS.groups.flatMap(g => g.items.map(it => {
  const [mods = [], why = it.note, pick = 0] = FEED_MAP[it.title] || [];
  const [cat, short] = FEED_GROUP[g.name] || ['lab', g.name];
  return Object.assign({ group: g.name, cat, short, mods, why: why || it.note, pick: !!pick }, it);
}));
const FeedV = { f: 'pick' };

function feedHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function feedsFor(labId) { return FEED_ALL.filter(f => f.mods.includes(labId)); }
function feedOpmlText() { return FEED_ALL.map(f => f.title + '  ' + f.xml).join('\n'); }

function feedCard(f, i) {
  return h('article', { class: 'feed glow c-' + f.cat, style: '--i:' + i },
    h('div', { class: 'feedhead' }, h('span', { class: 'feedmono', 'aria-hidden': 'true' }, f.title.replace(/^The\s+/, '').slice(0, 1)),
      h('div', { class: 'feedname' }, h('b', null, f.title), h('span', null, feedHost(f.html))),
      f.pick ? h('span', { class: 'feedpick' }, 'Start here') : null),
    h('p', null, f.why),
    h('div', { class: 'feedfoot' },
      h('div', { class: 'feedmods' }, f.mods.map(m => App.byId[m] ? h('a', { href: '#' + m, title: App.byId[m].title }, 'M' + App.byId[m].n) : null)),
      h('a', { class: 'feedgo', href: f.html, target: '_blank', rel: 'noopener' }, 'Visit'),
      h('a', { class: 'feedgo rss', href: f.xml, target: '_blank', rel: 'noopener', 'aria-label': 'RSS feed for ' + f.title }, 'RSS')));
}

function feedsPage() {
  const filters = [['pick', 'Start here'], ['all', 'All ' + FEED_ALL.length], ...Object.values(FEED_GROUP).map(([k, t]) => [k, t])];
  const list = FEED_ALL.filter(f => FeedV.f === 'all' || (FeedV.f === 'pick' ? f.pick : f.cat === FeedV.f));
  return [
    h('section', { class: 'hero' },
      h('span', { class: 'eyebrow' }, 'Reading · ' + FEED_ALL.length + ' sources · ' + FEEDS.groups.length + ' groups'),
      h('h1', null, 'Stay ahead after the session'),
      h('p', null, 'The attacks in these labs change every month. These are the sources that report them first, plus the policy and MLOps writers worth a weekly read. Each one is tagged with the modules it keeps current.'),
      h('div', { class: 'btnrow' },
        h('a', { class: 'btn primary', href: FEEDS.file, download: FEEDS.file }, 'Download the OPML'),
        copyButton(feedOpmlText, 'Copy feed URLs'))),
    h('p', { class: 'small feedhow' }, 'Import the OPML into any feed reader (Feedly, Inoreader, NetNewsWire, Thunderbird, Outlook) to subscribe to all ' + FEED_ALL.length + ' at once.'),
    h('div', { class: 'seg filterbar', role: 'group', 'aria-label': 'Filter sources' }, filters.map(([k, t]) =>
      h('button', { type: 'button', 'aria-pressed': String(FeedV.f === k), onclick: () => { FeedV.f = k; App.viewKey = null; rerender(); } }, t))),
    h('div', { class: 'feedgrid' }, list.map(feedCard))
  ];
}

/* A quiet line at the end of a lab's Expert answers. */
function feedStrip(labId) {
  const fs = feedsFor(labId); if (!fs.length) return null;
  return h('div', { class: 'feedstrip' }, h('span', { class: 'label' }, 'Keep reading'),
    fs.slice(0, 4).map(f => h('a', { href: f.html, target: '_blank', rel: 'noopener', title: f.why }, f.title)),
    h('a', { class: 'more', href: '#feeds' }, 'All sources →'));
}
