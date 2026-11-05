'use strict';
/* Take it to your CIO: the AI Security CIO Meeting Playbook (Claude Docs, 3 Nov 2026),
   reworked for participants who will run the conversation in their own organisation.
   The facts and sources are the playbook's; "see" links point to the lab or case on
   this site that shows each risk live. */

const KIT = {
  asOf: '3 Nov 2026',
  goal: 'Leave the room knowing where the CIO’s AI estate stands, which framework they will be measured against, and one concrete next step they agree to.',
  rules: [
    ['Talk 20%, listen 80%.', 'Open with the three “why now” points, then spend the meeting on the discovery questions.'],
    ['Anchor to frameworks the CIO already respects.', 'Name NIST, ISO, OWASP or the national guidance for their country, not your own model.'],
    ['Bring one page.', 'Print the framework map and the maturity check; leave them behind.'],
    ['Ask for one thing.', 'A 2-week AI inventory and risk-tiering sprint is the easiest yes.']],
  why: [
    ['AI now acts, not just answers.', 'Agents can change records, send messages and trigger transactions, which is why Stanford re-tiered AI risk by tool access and autonomy, not only data. Six Five Eyes agencies issued their first joint agent guidance on 1 May 2026. CSA research reports 82% of enterprises found AI agents outside their inventory and 65% had an agent security incident in the past year.', ['adv-nn-agent', 'The over-eager agent']],
    ['The rulebook arrived in 2026.', 'ETSI EN 304 223 (Jan), CSA’s AI-CAIQ with 320 questions (June) and ISO/IEC 27090 (Oct) mean auditors and customers now have a standard question set to ask.', null],
    ['Deadlines moved; obligations did not.', 'EU high-risk duties now start 2 Dec 2027, about 13 months away, and conformity work takes longer than that. Enterprise buyers already add AI addenda to security reviews, which one analysis says add 4 to 8 weeks to deals.', null]],
  closer: 'Which of these is closest to what keeps you up at night?',
  // [theme, question, listen for, maps to, [route, lab or case that shows it]]
  qs: [
    ['Inventory', 'How many AI systems and agents are running today, including SaaS features and staff-built tools?', 'A number and a list; “we think about 20” is a red flag', 'ISO 27090, Five Eyes guidance', ['adv-nn-agent', 'The over-eager agent: what one task can reach']],
    ['Ownership', 'Who owns AI risk: you, the CISO, or a committee?', 'One named owner with a budget', 'NIST AI RMF Govern, ISO 42001', null],
    ['Risk tiers', 'How do you decide whether an AI use case is low, medium or high risk?', 'Criteria beyond data class: autonomy, tool access, impact', 'Stanford AISF, China TC260 grading', null],
    ['Agents', 'Can any AI system take an action without a human approving it? Which ones?', 'Named actions, approval gates, a kill switch', 'OWASP Agentic ASI01–ASI10', ['adv-nn-agent', 'The over-eager agent: be the human in the loop']],
    ['Access', 'Do agents run on their own identities with least privilege, or on shared or user credentials?', 'Separate service identities, scoped tokens', 'Five Eyes “privilege” risk', ['adv-nn-badge', 'The borrowed badge: tokens and escalation']],
    ['Data', 'What data classes are allowed into which AI tools, and how is that enforced?', 'Approved-tool list per data class, DLP', 'Stanford tiered tool list, DPDP / GDPR', ['adv-slackai', 'Case: Slack AI leaks a private channel’s key']],
    ['Prompt injection', 'How do you protect against instructions hidden in emails, documents or web pages the AI reads?', 'Input separation, output checks, red-team results', 'OWASP LLM01, ETSI EN 304 223', ['adv-nn-files', 'The poisoned file: hidden text in PDFs and images']],
    ['Vendors', 'What do you ask AI vendors today? Is AI in your vendor questionnaire?', 'Use of AI-CAIQ or SIG AI domain', 'CSA AICM, SIG 2026', ['adv-toolpoison', 'Case: tool poisoning and rug pulls']],
    ['Model supply chain', 'Which models and versions are in use, and who approves a change?', 'Pinned versions, evaluation before upgrade', 'OWASP LLM03, ISO 27090', ['adv-nn-rome', 'Rewrite one fact in the weights']],
    ['Testing', 'When did anyone last red-team an AI system here, and what did they find?', 'A date and a finding list', 'UK Code, NIST AI 600-1', ['adv-nn-inject', 'The Injection Range: test a defence stack']],
    ['Monitoring', 'Do AI prompts, tool calls and outputs reach the SOC?', 'Logs in the SIEM, alerts defined', 'NIST Cyber AI Profile, Five Eyes accountability risk', ['adv-nn-impostor', 'Who’s that agent?: trace an incident']],
    ['Incidents', 'Has the incident plan got an AI scenario, and who would you notify, by when?', 'Named scenario; regulator timelines (e.g. CERT-In 6 hours in India)', 'RBI FREE-AI, India AI Governance Guidelines', ['adv-nn-memory', 'The poisoned memory: an incident that survives cleanup']],
    ['Regulation', 'Which rules apply to you: EU AI Act, sector regulator, national guidance?', 'A mapped list with dates', 'EU AI Act, RBI, MeitY, Singapore CSA', null],
    ['Customers', 'Are your own customers sending you AI security questionnaires yet?', 'Deals slowed by AI questions', 'AI-CAIQ, STAR for AI', null],
    ['Priorities', 'If you could fix one AI risk in the next 90 days, which would it be?', 'Their words; this becomes your proposal', '—', null]],
  // [area, red, amber, green]
  maturity: [
    ['Inventory', 'No list; shadow AI unknown', 'Partial list of approved tools', 'Complete register of models, agents, SaaS AI features'],
    ['Governance', 'No owner or policy', 'Policy exists, no named owner', 'Named owner, board-approved policy, annual review'],
    ['Risk tiering', 'Every AI use treated the same', 'Tiered by data class only', 'Tiered by data, autonomy, tool access and impact'],
    ['Agents and access', 'Agents use shared or user credentials', 'Some scoping, no approval gates', 'Own identities, least privilege, human approval for irreversible actions, kill switch'],
    ['Testing', 'Never red-teamed', 'One-off test before launch', 'Regular red teaming against OWASP lists, tracked over time'],
    ['Monitoring and response', 'AI activity not logged', 'Logged, not watched', 'In the SIEM, AI incident scenarios rehearsed'],
    ['Vendors', 'No AI questions for vendors', 'Ad-hoc AI questions', 'AI-CAIQ or SIG AI domain in procurement']],
  // [document, url, issuer, status, what it gives you]
  sets: [
    ['AI-CAIQ v1.1 + AI Controls Matrix v1.1', 'https://cloudsecurityalliance.org/artifacts/ai-controls-matrix-v1-1', 'Cloud Security Alliance', 'Released June 2026, free', '320 assessment questions mapped to 247 controls in 18 domains; mappings to the EU AI Act, NIST AI RMF and AI 600-1; feeds STAR for AI certification'],
    ['SIG 2026, AI domain', 'https://sharedassessments.org/sig/', 'Shared Assessments', 'Released Sept 2025, paid licence', 'Third-party risk questionnaire with 21 domains, including AI; mapped to NIST AI RMF and ISO/IEC 42001'],
    ['Stanford AI Security Framework (AISF)', 'https://uit.stanford.edu/security/agenticai/governance-framework', 'Stanford University IT', 'Current, reviewed annually', 'Low / moderate / high AI risk tiers based on data sensitivity, tool access, autonomy and influence on decisions; built on NIST AI RMF, EU AI Act and OWASP AIVSS'],
    ['AI security questionnaire template', 'https://glacis-landing-4fg.pages.dev/guide-ai-security-questionnaire', 'Glacis (vendor)', 'Updated April 2026', '80+ questions in 8 categories mapped to SIG, ATLAS, OWASP and the EU AI Act; a commercial template, not an official standard']],
  // [region group for the filter, region label, document, url, issuer, status, why the CIO cares]
  laws: [
    ['Global', 'International', 'ISO/IEC 27090:2026', 'https://digital.nemko.com/news/isoiec-27090-published-as-new-ai-cybersecurity-standard', 'ISO/IEC JTC 1/SC 27', 'Published 14 Oct 2026', 'Newest AI-security standard: poisoning, model theft, prompt injection and mitigations; guidance only, not certifiable'],
    ['Global', 'International', 'ISO/IEC 42001', null, 'ISO/IEC', '2023, certifiable', 'The certifiable AI management system; pairs with 27001 and 27090'],
    ['Europe', 'Europe / global', 'ETSI EN 304 223', 'https://www.helpnetsecurity.com/2026/01/19/etsi-european-standard-ai-security/', 'ETSI', 'Published Jan 2026', '13 baseline principles across design, development, deployment, maintenance and end of life'],
    ['Europe', 'EU', 'EU AI Act + Digital Omnibus', 'https://casrai.org/news/digital-omnibus-ai-act', 'European Union', 'GPAI duties since Aug 2025; Annex III high-risk now 2 Dec 2027; Annex I 2 Aug 2028', 'Legal duties, including cybersecurity for high-risk systems; deadlines moved, scope did not'],
    ['Europe', 'UK', 'AI Cyber Security Code of Practice', 'https://www.gov.uk/government/publications/ai-cyber-security-code-of-practice/code-of-practice-for-the-cyber-security-of-ai', 'DSIT with NCSC', 'Jan 2025, voluntary', '13 principles for developers, system operators and data custodians; basis of the ETSI standard'],
    ['Americas', 'US', 'NIST Cyber AI Profile (IR 8596) + COSAiS overlays', 'https://csrc.nist.gov/projects/cosais', 'NIST', 'Profile in preliminary draft; SP 800-53 overlays in development, incl. agent volumes', 'Puts AI on CSF 2.0 and SP 800-53, which most security teams already run'],
    ['Americas', 'US', 'NIST AI RMF + AI 600-1', 'https://natlawreview.com/article/nist-issues-preliminary-draft-cyber-ai-profile-framework-poised-alter-security', 'NIST', 'AI RMF 2023; GenAI profile 2024', 'The most widely used AI risk framework; most other documents map to it'],
    ['Global', 'Five Eyes', 'Careful Adoption of Agentic AI Services', 'https://www.mayerbrown.com/en/insights/publications/2026/06/multi-agency-guidance-on-securing-agentic-ai-systems', 'CISA, NSA, ASD ACSC, CCCS, NCSC-NZ, NCSC-UK', '1 May 2026', 'First joint government guidance on agents; 5 risk categories and 100+ practices'],
    ['Asia', 'Singapore', 'Securing AI Systems guidelines + Agentic AI addendum', 'https://www.bakermckenzie.com/en/insight/publications/2026/07/singapore-csas-addendum-on-securing-agentic-ai-systems', 'Cyber Security Agency of Singapore', 'Guidelines 2024; addendum finalised June 2026', 'Lifecycle controls plus agent-specific threats such as rogue actions and data disclosure'],
    ['Asia', 'India', 'India AI Governance Guidelines', 'https://www.mondaq.com/india/new-technology/1704828/meity-releases-india-ai-governance-guidelines-with-deliberate-focus-on-enabling-innovation-over-restraint', 'MeitY (IndiaAI Mission)', '5 Nov 2025', 'Principles-based, graded oversight; leans on CERT-In rules and the DPDP Act'],
    ['Asia', 'India, finance', 'FREE-AI', 'https://lexplosion.in/rbis-move-toward-ethical-and-responsible-ai-in-financial-sector/', 'Reserve Bank of India', 'Aug 2025', '26 recommendations in 6 pillars; asks for board-approved AI policy, AI in BCP, incident reporting, security testing'],
    ['Asia', 'China', 'AI Safety Governance Framework 2.0', 'https://carnegieendowment.org/china/research/2025/10/how-china-views-ai-risks-and-what-to-do-about-them', 'TC260 and CNCERT-CC', 'Sept 2025, non-binding', 'Risk grading by intelligence level, application and scale; precursor to national standards'],
    ['Global', 'Community', 'OWASP Top 10 for LLM Apps 2025 and Agentic Apps 2026', 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026', 'OWASP GenAI Security Project', 'Nov 2024 / Dec 2025', 'The threat lists engineers test against: prompt injection, data disclosure, goal hijack, tool misuse']],
  // [they say, you say]
  pushback: [
    ['Our existing security controls cover AI.', 'Most do; the gaps are the AI-specific ones: prompt injection, poisoning, agent permissions. ISO 27090 and NIST’s overlays exist because 27001 and 800-53 alone don’t name them.'],
    ['The EU AI Act was delayed, so there’s time.', 'Only the high-risk duties moved, to Dec 2027; GPAI and transparency rules still apply. Conformity work typically takes longer than the remaining runway.'],
    ['We only use Copilot / ChatGPT Enterprise, not our own models.', 'Then the risk sits in data access and connectors. Stanford, for example, approves each tool for specific data classes only. Which data classes can reach yours?'],
    ['We have no agents.', 'Many teams find agents they didn’t know about. A two-week inventory confirms it either way.'],
    ['Too many frameworks; which one?', 'Pick one management spine (NIST AI RMF or ISO 42001), one threat list (OWASP), and one questionnaire (AI-CAIQ). Map local rules onto that.'],
    ['No budget this year.', 'Start with inventory and risk tiering; it needs people time, not tools, and makes next year’s budget case.']],
  plan: [
    ['Weeks 1–2', 'Inventory and risk tiering', 'List every model, agent and AI SaaS feature; tier each low / moderate / high using Stanford-style criteria.', 'An AI register and a one-page risk heat map.'],
    ['Weeks 3–6', 'Gap assessment', 'Run the high-tier systems and top vendors through the relevant AI-CAIQ sections; test the top agents against the OWASP Agentic Top 10.', 'A ranked gap list mapped to NIST AI RMF or ISO 42001.'],
    ['Weeks 7–12', 'Fix the top five', 'Typically agent permissions, prompt-injection defences, AI logging into the SOC, an AI incident runbook, and AI questions in procurement.', null]],
  after: ['Send a thank-you within 24 hours with the CIO’s answer to question 15 in their words', 'Attach the framework map and maturity check, scored from what you heard', 'Propose a date for the inventory kick-off', 'Note which frameworks they named, and use only those in the follow-up'],
  sources: [
    ['CSA: AI Controls Matrix v1.1', 'https://cloudsecurityalliance.org/artifacts/ai-controls-matrix-v1-1'],
    ['CSA: AICM v1.1 announcement (320-question AI-CAIQ)', 'https://cloudsecurityalliance.org/blog/2026/07/14/ai-controls-matrix-v1-1-strengthening-the-foundation-for-trustworthy-ai'],
    ['Vorp Labs: SIG 2026 tracker', 'https://vorplabs.com/security-framework-changes/sig'],
    ['Stanford UIT: AI Security Framework', 'https://uit.stanford.edu/security/agenticai/governance-framework'],
    ['ETIH: Stanford rewrites AI security rules', 'https://www.edtechinnovationhub.com/news/stanford-rewrites-ai-security-rules-as-ai-agents-gain-power-to-act'],
    ['Nemko: ISO/IEC 27090 published', 'https://digital.nemko.com/news/isoiec-27090-published-as-new-ai-cybersecurity-standard'],
    ['Help Net Security: ETSI EN 304 223', 'https://www.helpnetsecurity.com/2026/01/19/etsi-european-standard-ai-security/'],
    ['GOV.UK: Code of Practice for the Cyber Security of AI', 'https://www.gov.uk/government/publications/ai-cyber-security-code-of-practice/code-of-practice-for-the-cyber-security-of-ai'],
    ['CASRAI: Digital Omnibus AI Act deadlines', 'https://casrai.org/news/digital-omnibus-ai-act'],
    ['NIST: COSAiS control overlays', 'https://csrc.nist.gov/projects/cosais'],
    ['National Law Review: Cyber AI Profile', 'https://natlawreview.com/article/nist-issues-preliminary-draft-cyber-ai-profile-framework-poised-alter-security'],
    ['Mayer Brown: Five Eyes agentic AI guidance', 'https://www.mayerbrown.com/en/insights/publications/2026/06/multi-agency-guidance-on-securing-agentic-ai-systems'],
    ['CSA research note (agent inventory figures)', 'https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/05/CSA_research_note_cisa-agentic-ai-five-risk-framework-implementation_20260524-csa-styled.pdf'],
    ['Baker McKenzie: Singapore agentic AI addendum', 'https://www.bakermckenzie.com/en/insight/publications/2026/07/singapore-csas-addendum-on-securing-agentic-ai-systems'],
    ['AZB & Partners: India AI Governance Guidelines', 'https://www.mondaq.com/india/new-technology/1704828/meity-releases-india-ai-governance-guidelines-with-deliberate-focus-on-enabling-innovation-over-restraint'],
    ['CIO&Leader: CERT-In six-hour rule in AI incidents', 'https://www.cioandleader.com/?p=33169'],
    ['Lexplosion: RBI FREE-AI', 'https://lexplosion.in/rbis-move-toward-ethical-and-responsible-ai-in-financial-sector/'],
    ['Carnegie: China AI Safety Governance Framework 2.0', 'https://carnegieendowment.org/china/research/2025/10/how-china-views-ai-risks-and-what-to-do-about-them'],
    ['OWASP: Top 10 for Agentic Applications 2026', 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026'],
    ['HackerOne: OWASP LLM Top 10 2025', 'https://www.hackerone.com/ai/owasp-top-10-llms-2025'],
    ['Tian Pan: the 80-question wall (deal-delay figures)', 'https://tianpan.co/blog/2026/04/27/80-question-wall-enterprise-ai-security-questionnaire'],
    ['Glacis: AI security questionnaire template', 'https://glacis-landing-4fg.pages.dev/guide-ai-security-questionnaire']]
};
