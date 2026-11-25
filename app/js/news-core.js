'use strict';
/* News core: parse RSS/Atom, tag each item with course topics, and rank
   what is hot. Plain script with no DOM use, so the same code runs in the
   page (live refresh) and in scripts/pull-news.mjs (the snapshot). */

/* [id, label, pattern, modules, weight] */
const NEWS_TOPICS = [
  ['pi', 'Prompt injection', /prompt[- ]injection|indirect injection|injected instructions/i, ['m11', 'm12'], 3],
  ['mcp', 'MCP & tools', /\bMCP\b|model context protocol|tool poisoning|tool call/i, ['m12'], 3],
  ['agent', 'Agents', /\bagent(s|ic)?\b|autonomous|computer use|browser use/i, ['m11', 'm13'], 1],
  ['jb', 'Jailbreaks', /jailbreak|guardrail bypass|refusal/i, ['m11'], 2.5],
  ['poison', 'Poisoning & backdoors', /poison|backdoor|sleeper|trojan/i, ['m12', 'm13'], 3],
  ['supply', 'AI supply chain', /supply[- ]chain|pickle|safetensors|malicious (model|package)|typosquat|dependency/i, ['m13'], 2.5],
  ['leak', 'Data leakage', /exfiltrat|\bleak(s|ed|ing|age)?\b|secrets? exposed|training data extraction|memoriz/i, ['m11', 'm14'], 2.5],
  ['vuln', 'Vulnerabilities', /CVE-\d|vulnerab|exploit|zero[- ]day|RCE\b|remote code/i, ['m14'], 2],
  ['rag', 'RAG & retrieval', /\bRAG\b|retrieval|vector (db|database|store)|embedding/i, ['m12'], 1.5],
  ['soc', 'Detection & response', /threat intel|threat actor|incident response|detection engineering|\bSOC\b|SIEM|\bAPT\d+|ransomware/i, ['m14'], 1.5],
  ['fraud', 'Deepfakes & fraud', /deepfake|voice clone|fraud|phishing|scam/i, ['m14'], 2],
  ['reg', 'Regulation', /AI Act|regulat|executive order|legislat|GPAI|code of practice|federal register|rulemaking|\bbill\b/i, ['m15'], 2],
  ['gov', 'Governance & risk', /governance|risk management|NIST|ISO 42001|audit|assurance|accountab/i, ['m07', 'm15'], 1.5],
  ['safety', 'Safety & alignment', /alignment|safety|misalign|deceptive|scheming|oversight/i, ['m08'], 1.5],
  ['evals', 'Evals & red teaming', /\bevals?\b|evaluation|red[- ]team|benchmark/i, ['m13'], 1.5]
];
const NEWS_SRC_W = { sec: 1.25, gov: 1, ops: 0.8, lab: 0.9 };
/* A feed whose items must mention AI to count (broad keyword feeds). */
const NEWS_FEED_REQ = { 'Federal Register: AI': /artificial intelligence|\bAI\b|algorithm|automated decision|machine learning/ };
/* Noisy or vendor feeds count for less. */
const NEWS_FEED_W = { 'Federal Register: AI': 0.45, 'AWS Machine Learning Blog': 0.6, 'Databricks Blog': 0.6, 'PyTorch': 0.7, 'OpenAI News': 0.75 };

function newsDecode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function newsText(html, max) {
  const t = newsDecode(newsDecode(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return max && t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}
function newsTag(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i'));
    if (m && m[1].trim()) return m[1];
  }
  return '';
}
/* Only https links leave the page; anything else is dropped. */
function newsSafeUrl(u) { u = newsDecode(u).trim(); return /^https:\/\//i.test(u) ? u : /^http:\/\//i.test(u) ? u.replace(/^http:/i, 'https:') : ''; }

/* Parse one RSS or Atom document into items. */
function newsParse(xml, src, limit) {
  const out = [], atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks.slice(0, limit || 8)) {
    let link = '';
    if (atom) { const ls = [...b.matchAll(/<link\b([^>]*)\/?>/gi)].map(m => m[1]);
      const pick = ls.find(a => /rel="alternate"/i.test(a)) || ls.find(a => !/rel=/i.test(a)) || ls[0] || '';
      link = (pick.match(/href="([^"]+)"/i) || [])[1] || ''; }
    else link = newsText(newsTag(b, ['link'])) || newsText(newsTag(b, ['guid']));
    const title = newsText(newsTag(b, ['title']), 180);
    const date = Date.parse(newsText(newsTag(b, atom ? ['published', 'updated'] : ['pubDate', 'dc:date', 'published', 'updated']))) || 0;
    const sum = newsText(newsTag(b, atom ? ['summary', 'content'] : ['description', 'content:encoded', 'summary']), 220);
    const url = newsSafeUrl(link);
    if (title && url) out.push({ src, title, url, date, sum });
  }
  return out;
}
function newsTopics(it) {
  const text = it.title + ' ' + it.title + ' ' + (it.sum || '');
  return NEWS_TOPICS.filter(t => t[2].test(text)).map(t => t[0]);
}
/* Rank: recency, course relevance, and how many sources share the topic this week. */
function newsRank(items, srcCat, now) {
  const week = now - 7 * 864e5, buzz = {};
  items.forEach(it => { if (it.date > week) (it.topics || []).forEach(t => { (buzz[t] = buzz[t] || new Set()).add(it.src); }); });
  const byId = Object.fromEntries(NEWS_TOPICS.map(t => [t[0], t]));
  return items.map(it => {
    const ageH = Math.max(0, (now - (it.date || 0)) / 36e5);
    const rec = 70 * Math.exp(-ageH / 72);
    const rel = (it.topics || []).reduce((n, t) => n + 10 * byId[t][4], 0);
    const bz = (it.topics || []).reduce((n, t) => n + 4 * Math.max(0, ((buzz[t] && buzz[t].size) || 1) - 1), 0);
    const fresh = (ageH < 24 * 21 ? 1 : 0.35) * ((it.topics || []).some(t => t !== 'agent') ? 1 : 0.55);  // hot means recent and on-topic
    const req = NEWS_FEED_REQ[it.src] && !NEWS_FEED_REQ[it.src].test(it.title + ' ' + (it.sum || '')) ? 0.15 : 1;
    const heat = req * (rec + Math.min(rel, 50) + Math.min(bz, 25)) * fresh * (NEWS_SRC_W[srcCat[it.src]] || 1) * (NEWS_FEED_W[it.src] || 1);
    return Object.assign({}, it, { heat: Math.round(heat) });
  }).sort((a, b) => b.heat - a.heat || b.date - a.date);
}
if (typeof module !== 'undefined') module.exports = { NEWS_TOPICS, newsParse, newsTopics, newsRank, newsText, newsSafeUrl };
