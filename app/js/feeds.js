'use strict';
/* Reading: the curated OPML feed pack as a page. Every source says why it
   matters for this program and which modules it keeps current. The list
   itself comes from the OPML (feeds-data.js, generated); this file adds the
   course mapping and the news view. Headlines come from a snapshot
   (news-data.js, npm run news) and are refreshed live in the browser from
   feeds that allow it, or from all of them through NEWS_PROXY. */

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
const FeedV = { f: 'all' };

function feedHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function feedsFor(labId) { return FEED_ALL.filter(f => f.mods.includes(labId)); }
function feedOpmlText() { return FEED_ALL.map(f => f.title + '  ' + f.xml).join('\n'); }

/* ---------- news: snapshot first, live refresh on top ---------- */
/* Feeds that let a browser read them directly (they send CORS headers).
   With a proxy set, every feed is refreshed live through it. */
const NEWS_CORS = ['Embrace The Red', 'Simon Willison: prompt-injection', 'Federal Register: AI', "Hamel's Blog", 'Chip Huyen', 'Databricks Blog'];
/* e.g. 'https://feeds.example.workers.dev/?url=' (see scripts/feed-proxy-worker.js). Empty: no proxy. */
const NEWS_PROXY = '';
const NewsV = { items: (typeof NEWS !== 'undefined' ? NEWS.items : []).slice(), at: typeof NEWS !== 'undefined' ? NEWS.at : 0, live: {}, liveAt: 0, busy: false, tried: false, fresh: {} };
const NEWS_CAT = Object.fromEntries(FEED_ALL.map(f => [f.title, f.cat]));
const NEWS_TOPIC = Object.fromEntries(NEWS_TOPICS.map(t => [t[0], t]));

function newsAgo(ms) {
  const m = Math.max(0, (Date.now() - ms) / 60000);
  return m < 60 ? Math.max(1, Math.round(m)) + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : m < 2880 ? 'yesterday' : Math.round(m / 1440) + ' days ago';
}
function newsRanked() { return newsRank(NewsV.items, NEWS_CAT, Date.now()); }
function newsHot(n, labId) {
  const cut = Date.now() - 21 * 864e5;
  const pool = newsRanked().filter(it => it.date > cut && (!labId || (it.topics || []).some(t => NEWS_TOPIC[t][3].includes(labId))));
  return pool.slice(0, n);
}
function newsMerge(fresh) {
  const seen = new Set(NewsV.items.map(i => i.url)); let added = 0;
  fresh.forEach(it => { if (!seen.has(it.url)) { it.topics = newsTopics(it); NewsV.items.push(it); NewsV.fresh[it.url] = true; seen.add(it.url); added++; } });
  NewsV.items.sort((a, b) => b.date - a.date);
  return added;
}
async function newsRefresh() {
  if (NewsV.busy || typeof fetch !== 'function') return;
  NewsV.busy = true; NewsV.tried = true; rerender();
  const list = FEED_ALL.filter(f => NEWS_PROXY || NEWS_CORS.includes(f.title));
  let added = 0;
  await Promise.all(list.map(async f => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = setTimeout(() => ctl && ctl.abort(), 12000);
    try {
      const r = await fetch(NEWS_PROXY ? NEWS_PROXY + encodeURIComponent(f.xml) : f.xml, { signal: ctl && ctl.signal });
      if (!r.ok) throw new Error(r.status);
      const got = newsParse(await r.text(), f.title, 8);
      if (!got.length) throw new Error('empty');
      added += newsMerge(got); NewsV.live[f.title] = 'ok';
    } catch (e) { NewsV.live[f.title] = 'fail'; } finally { clearTimeout(tm); }
  }));
  NewsV.busy = false; NewsV.liveAt = Date.now(); NewsV.added = added; rerender();
}

function topicChips(it, max) {
  return h('span', { class: 'ntopics' }, (it.topics || []).slice(0, max || 3).map(t => h('i', null, NEWS_TOPIC[t][1])));
}
function newsMods(it) {
  const mods = [...new Set((it.topics || []).flatMap(t => NEWS_TOPIC[t][3]))].slice(0, 3);
  return h('span', { class: 'feedmods' }, mods.map(m => App.byId[m] ? h('a', { href: '#' + m, title: App.byId[m].title }, 'M' + App.byId[m].n) : null));
}
function newsCard(it, i, top, maxHeat) {
  const cat = NEWS_CAT[it.src] || 'lab';
  return h('article', { class: 'ncard glow c-' + cat + (top ? ' top' : '') + (NewsV.fresh[it.url] ? ' isnew' : ''), style: '--i:' + i },
    h('div', { class: 'nmeta' }, h('span', { class: 'nsrc' }, it.src), h('span', null, newsAgo(it.date)), NewsV.fresh[it.url] ? h('span', { class: 'nnew' }, 'New') : null),
    h('a', { class: 'ntitle', href: it.url, target: '_blank', rel: 'noopener' }, it.title),
    it.sum ? h('p', { class: 'clamp' }, it.sum) : null,
    h('div', { class: 'nfoot' }, topicChips(it), newsMods(it)),
    h('div', { class: 'nheat', title: 'Heat ' + it.heat, 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.round(100 * it.heat / (maxHeat || 1)) + '%' })));
}
function newsStatus() {
  const nLive = Object.values(NewsV.live).filter(v => v === 'ok').length, nTry = Object.keys(NewsV.live).length;
  const txt = NewsV.busy ? 'Pulling the latest…'
    : NewsV.liveAt ? (nLive ? nLive + ' of ' + nTry + ' feeds refreshed live ' + newsAgo(NewsV.liveAt) + (NewsV.added ? ' · ' + NewsV.added + ' new' : ' · nothing newer') + ' · the rest from the snapshot of ' + newsAgo(NewsV.at)
      : 'Live refresh is blocked here. Showing the snapshot pulled ' + newsAgo(NewsV.at) + '.')
    : 'Snapshot pulled ' + newsAgo(NewsV.at) + ' from ' + FEED_ALL.length + ' feeds.';
  return h('div', { class: 'newsstatus' + (nLive ? ' live' : '') + (NewsV.busy ? ' busy' : '') },
    h('span', { class: 'ndot', 'aria-hidden': 'true' }), h('span', { 'aria-live': 'polite' }, txt),
    typeof fetch === 'function' ? h('button', { type: 'button', class: 'btn small', disabled: NewsV.busy ? true : null, onclick: newsRefresh }, NewsV.busy ? 'Refreshing' : 'Refresh') : null);
}
function newsLatest(list) {
  let day = '';
  return h('ol', { class: 'nlist' }, list.slice(0, 60).map((it, i) => {
    const d = new Date(it.date), key = d.toDateString(), today = new Date().toDateString(), yest = new Date(Date.now() - 864e5).toDateString();
    const head = key !== day ? (day = key, h('li', { class: 'nday' }, key === today ? 'Today' : key === yest ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }))) : null;
    return [head, h('li', { class: 'nrow c-' + (NEWS_CAT[it.src] || 'lab') + (NewsV.fresh[it.url] ? ' isnew' : ''), style: '--i:' + Math.min(i, 14) },
      h('span', { class: 'nsrc' }, it.src), h('a', { href: it.url, target: '_blank', rel: 'noopener' }, it.title), topicChips(it, 2))];
  }));
}

function feedCard(f, i) {
  const last = NewsV.items.find(it => it.src === f.title);
  return h('article', { class: 'feed glow c-' + f.cat, style: '--i:' + i },
    h('div', { class: 'feedhead' }, h('span', { class: 'feedmono', 'aria-hidden': 'true' }, f.title.replace(/^The\s+/, '').slice(0, 1)),
      h('div', { class: 'feedname' }, h('b', null, f.title), h('span', null, feedHost(f.html))),
      f.pick ? h('span', { class: 'feedpick' }, 'Start here') : null),
    h('p', null, f.why),
    last ? h('a', { class: 'feedlast', href: last.url, target: '_blank', rel: 'noopener' }, h('span', null, 'Latest · ' + newsAgo(last.date)), last.title) : null,
    h('div', { class: 'feedfoot' },
      h('div', { class: 'feedmods' }, f.mods.map(m => App.byId[m] ? h('a', { href: '#' + m, title: App.byId[m].title }, 'M' + App.byId[m].n) : null)),
      h('a', { class: 'feedgo', href: f.html, target: '_blank', rel: 'noopener' }, 'Visit'),
      h('a', { class: 'feedgo rss', href: f.xml, target: '_blank', rel: 'noopener', 'aria-label': 'RSS feed for ' + f.title }, 'RSS')));
}

const FeedTab = { t: 'hot' };
function feedsPage() {
  if (!NewsV.tried && typeof fetch === 'function') setTimeout(newsRefresh, 400);
  const cats = Object.values(FEED_GROUP);
  const filters = FeedTab.t === 'src' ? [['pick', 'Start here'], ['all', 'All ' + FEED_ALL.length], ...cats] : [['all', 'Everything'], ...cats];
  if (FeedTab.t !== 'src' && FeedV.f === 'pick') FeedV.f = 'all';
  const inCat = cat => FeedV.f === 'all' || FeedV.f === cat;
  const tab = (k, t, sub) => h('button', { type: 'button', 'aria-pressed': String(FeedTab.t === k), onclick: () => { FeedTab.t = k; if (k === 'src') FeedV.f = 'pick'; App.viewKey = null; rerender(); } }, t, h('small', null, sub));
  let body;
  if (FeedTab.t === 'hot') {
    const hot = newsHot(40).filter(it => inCat(NEWS_CAT[it.src])).slice(0, 8), max = hot.length ? hot[0].heat : 1;
    body = hot.length ? h('div', { class: 'hotgrid' }, hot.map((it, i) => newsCard(it, i, i === 0, max)))
      : box('', h('p', { class: 'sub' }, 'Nothing in the last three weeks for this filter. Try Latest, or run npm run news.'));
  } else if (FeedTab.t === 'new') body = newsLatest(newsRanked().filter(it => inCat(NEWS_CAT[it.src])).sort((a, b) => b.date - a.date));
  else body = h('div', { class: 'feedgrid' }, FEED_ALL.filter(f => FeedV.f === 'all' || (FeedV.f === 'pick' ? f.pick : f.cat === FeedV.f)).map(feedCard));
  const week = NewsV.items.filter(it => it.date > Date.now() - 7 * 864e5).length;
  return [
    h('section', { class: 'hero' },
      h('span', { class: 'eyebrow' }, 'Reading · ' + FEED_ALL.length + ' sources · ranked for this course'),
      h('h1', null, 'What changed this week'),
      h('p', null, 'The attacks in these labs change every month. This page pulls the sources that report them first, ranks what is hot for this course (fresh, on-topic, and covered by several sources), and links each story to the module it updates.')),
    newsStatus(),
    h('div', { class: 'seg bigseg newstabs', role: 'group', 'aria-label': 'View' },
      tab('hot', 'Hot now', 'ranked for this course'), tab('new', 'Latest', week + ' stories this week'), tab('src', 'Sources', FEED_ALL.length + ' feeds · OPML')),
    h('div', { class: 'seg filterbar', role: 'group', 'aria-label': 'Filter' }, filters.map(([k, t]) =>
      h('button', { type: 'button', 'aria-pressed': String(FeedV.f === k), onclick: () => { FeedV.f = k; App.viewKey = null; rerender(); } }, t))),
    body,
    FeedTab.t === 'src' ? h('div', { class: 'btnrow opmlrow' },
      h('a', { class: 'btn primary', href: FEEDS.file, download: FEEDS.file }, 'Download the OPML'), copyButton(feedOpmlText, 'Copy feed URLs'),
      h('span', { class: 'small' }, 'Import it into Feedly, Inoreader, NetNewsWire, Thunderbird or Outlook to follow all ' + FEED_ALL.length + '.')) : null
  ];
}

/* A quiet line at the end of a lab's Expert answers: this module in the news. */
function feedStrip(labId) {
  const hot = newsHot(2, labId), fs = feedsFor(labId);
  if (!hot.length && !fs.length) return null;
  return h('div', { class: 'feedstrip' }, h('span', { class: 'label' }, hot.length ? 'In the news' : 'Keep reading'),
    hot.length ? hot.map(it => h('a', { href: it.url, target: '_blank', rel: 'noopener', title: it.src + ' · ' + newsAgo(it.date) }, it.title))
      : fs.slice(0, 4).map(f => h('a', { href: f.html, target: '_blank', rel: 'noopener', title: f.why }, f.title)),
    h('a', { class: 'more', href: '#feeds' }, 'All news →'));
}
