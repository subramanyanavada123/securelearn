# Agentic AI Labs

Hands-on labs for Modules 07–16 of the **Agentic AI Security & Governance** program. Participants open the app on their phones and work in tables of four or five, in role and against the clock. No technical background is needed.

Live app: https://claude.ai/artifact/2SNepAFvq2HNnVBXJ5NLfS

## Story mode (the home screen)

**Agents at Meridian** opens with the deck's challenge, *Approve Project NEXUS*: you vote on a launch, watch it fail hour by hour, then rebuild NEXUS through ten episodes, one per module. Every episode starts with a fail-first trap and its reveal, and a repair board on the home screen turns NEXUS's six failures green as you go. You are Meridian's new Head of AI Risk. Each episode is a sequence of single screens, with no scrolling. In each screen a character speaks, you make one decision, tap items on an animated diagram, sort cards one at a time, flip switches, or talk to a stakeholder live. Every choice shows its consequence and moves three meters: Safety, Trust and Speed. Each episode ends with stars and its key lessons. The detailed labs below are the facilitator's deep-dive workbench at `#labs`.

**Every question is framed for leaders.** Before each decision, a character bridges from the last scene, an animated visual sets the stakes (a loss counter, tomorrow's headline, a live countdown, an attack travelling through a chain of systems), a "Why this matters to you" brief puts it in business terms, and tap-to-reveal definitions explain any jargon. Once answered, "What a leader takes from this" explains the strongest answer and what the other choices would have done, and the footer says what comes next. The framing lives in `app/js/story-extra.js`; the visuals in `app/js/story-viz.js`.

## The program deck (`#deck`)

The workbench carries the full program deck: 155 slides with speaker notes, shown at their original 1920×1080 layout and scaled to fit. Every lab has a **Deck** tab with its module's slides; `#deck` shows the whole deck with a chip per section, and `#deck-m07` opens it at a module. Arrow keys, swipes or taps move between slides, and Full screen presents. The home screen and the header link to both the workbench and the deck.

The deck's source is in `deck/` (exported from the Slides artifact). After updating it, run `npm run deck` to regenerate `app/js/deck-data.js`; the script refuses any slide markup that could load or run something.

## The 10-hour map (`#atlas`)

Modules 12, 13 and 14 as one navigable journey: four lines (RAG Security, MCP Security, Secure Productization, SOC & Runtime Defense) and 44 stops, one per syllabus topic, in syllabus order. The map page shows the ten hours as a metro map with a clock time for every stop, progress, a *Highlights* filter (14 stops, about 3 hours 20) and a *Not seen yet* filter. Every stop (`#atlas-<id>`) is one animated scene in four moves: **watch it break** (the failure plays beat by beat on a diagram: red for the attack, amber for sensitive data, blue for normal traffic), **place the control** (tap the box where one control would have stopped it; a wrong box explains why it is too late), **watch it hold** (the same scene replays with the control in place) and **go one level up**. That last move is written for a room that has already built the control: three ways the secure design still fails, each replayed on the diagram against the working control (the shield cracks, the attack completes) with the hardening that closes it, then four checks whose answer is a fact, an everyday picture of the idea, the documented case with a link to its Advanced-path walk-through, a question for the room, and links to the topic's syllabus check and practice. **The playbook** (`#atlas-playbook`) gathers all 44 topics on one page: baseline control, 132 failure modes with their hardening, and 176 tick-off checks. It copies as plain text and prints. Round-two content lives in `app/js/atlas-deep.js`. Two playgrounds compute on the page: an embedding space where a keyword-stuffed ticket moves into the top three until trust-weighted ranking is switched on (Embedding manipulation, Retrieval hijacking), and a detection tuner where lowering a threshold buys false alarms until a second signal is added (Detection engineering, Runtime anomaly detection). Each Module 12–14 lab page and syllabus card links to its stops. Scenes are data in `app/js/atlas-data.js` (nodes on a 3×3 grid, beats, the control's position); the engine is `app/js/atlas.js`. The map plans Module 12 at four hours (two for RAG, two for MCP); change the `min` values to re-time it.

## Core RAG Lab (`#rag`)

**Build Ask Meridian** is the hands-on core of Modules 09 and 12. Participants design a knowledge assistant's pipeline under a 13-point budget, choosing the approach (RAG, fine-tuning or pasting everything) and an option at each of eight stages: sources, ingestion, vector store, access, retrieval, generation, output and updates. Their design then runs through a day in production: nine events, from ordinary questions to a stale policy, a stale permission after a role change, a poisoned wiki, hidden instructions in a vendor PDF, a keyword-stuffed ticket, a secret in a runbook, an exposed vector store and an auto-updating parser. Each event animates through the pipeline and is stopped, weakened or succeeds. The incident report counts incidents, records exposed, wrong answers and direct loss, names the control, owner and module for each, and compares the design with an expert one. Participants redesign and replay; their run history shows the improvement. The simulation is deterministic, so tables with the same design see the same result.

## Harden NEXUS (`#harden`)

The second core lab rebuilds NEXUS as seven defence layers, one per kind of failure: permission-aware knowledge (Module 12), identity (10), untrusted content (11), tools and approvals (08), supply chain (12), go-live gates and the SOC (13 and 14), governance (15). A console fires NEXUS's own failures through one pipeline, and only the layers a table has cleared defend. Each layer is a brief, an off/on simulation of three scenarios, four drills and a debrief that links to the module's episode, lab and slides. Content is in `app/js/harden-data.js`.

## Advanced path (`#adv`)

**How AI systems actually get broken** is for participants who already know the controls. It opens with **Inside the model**, eight full-screen lab instruments (`#adv-nn-backdoor`, `#adv-nn-refusal`, `#adv-nn-rome`, `#adv-nn-inject`, `#adv-nn-files`, `#adv-nn-infer`, and two slow-motion deep dives, `#adv-nn-pihood` and `#adv-nn-grad`). Each opens on a briefing (what this is, the real-world version, what you will do; the ? button reopens it), and every step has a “what you’re seeing” legend keyed to numbered markers on the canvas and one plain line on why it matters. Every drag also works as a tap. Each is a live canvas with one action per step and a short line of narration; the arithmetic is real and runs on the device with fixed seeds (`app/js/neural.js`), the scenes are in `app/js/lab.js`. *Backdoor a neural network*: feed the filter files, stamp a trigger patch on two malware files and relabel them safe, watch real gradient descent retrain the 64–8–2 network (signals pulse along the edges, weight maps recolour, one neuron's trigger ring fills red), pass the vendor's 200-file test, drag the patch onto malware and watch it get through, zoom into the neuron that learned it, then find the poison in an activation scatter, quarantine it and retrain. *Delete a model's refusal*: send prompts at the refusal wall, aim an arrow to find the refusal direction, drag a slider to cut it out (harmful prompts slide through the wall) or push it the other way (the model refuses to translate an email), then drag three gibberish suffix tokens onto a prompt. *Rewrite one fact*: ask the model, scrub a causal trace to find the layer that stores the fact, drag a lie onto the memory layer and watch the rank-one update sweep through it, re-ask every question (only the fact and its paraphrase change), then compare file fingerprints. *The Injection Range* (`app/js/inject.js`) takes prompt injection apart: X-ray ten channels (web page, email, PDF, image, wiki, tool output, MCP tool, calendar invite, code, direct chat) to see what the model reads and the human does not; arm a payload from eight techniques and six goals; launch it at an agent with email, payments, memory and files; then switch on the twelve defence layers the market sells, from AI firewall classifiers and spotlighting to data-flow policy, approvals, egress control, DLP and AI-DR. Classifier layers catch with a probability (illustrative rates that follow published patterns, not product measurements), rule layers always; the last step lets the attacker retry every channel × technique 50 times and shows the breach rate as a heat map. *The poisoned file* (`app/js/files.js`) shows what people see against what parsers hand the model, format by format: peel a CV into its eight layers (white text, 0.5-point text, text outside the crop box, a hidden optional-content layer, invisible text mode in a compressed stream, an annotation, metadata) beside what a PDF loader returns; sweep a lens over a shop page to find six hidden elements (comment, alt text, `display:none`, `font-size:0`, off-screen, same-colour text); visit the same URL as a person and as an AI agent and get a different page (cloaking); mutate one JSON file until a regex validator approves `viewer` while `JSON.parse` runs `admin` (duplicate key, escaped key) and an install prompt shows 40 harmless characters of a padded tool description; shrink a 512-pixel photo to the model's 64-pixel input and watch `APPROVE PAYMENT` appear (an image-scaling attack that rewrites 0.4% of the pixels, and only the ones a nearest-neighbour resize samples); drag a high-pass “model's eye” across a sky that hides text 2 levels out of 255 brighter; feed all four files to an agent; then switch on seven parser rules and watch the twenty hiding places close. The resize, the faint-text reveal and both JSON parsers run for real on the page; the agent's actions are illustrative. *Inside inference* (`app/js/infer.js`) opens by pulling one request apart into six observable layers — your prompt, assembled context, token ids, output scores, KV-cache state and the response on the wire, each tagged with who can observe it, in the same exploded isometric style as the PDF — then follows it through the serving pipeline (tokeniser, shared GPU batch, KV cache, sampler, response stream) and shows the security issue at each stage: untrusted text sharing the prompt's trust band, tenants sharing hardware, a shared prefix cache answering “was this sent before?” by timing, full score vectors handed out per query, and streamed chunk sizes that track the answer's length. Six serving-layer controls (trust-marked tokens, per-tenant pools, per-tenant cache scope, no raw logprobs, padded chunks, per-caller token budgets) close the stages; timings are illustrative. The two deep dives (`app/js/hood.js`) slow one mechanism down to its arithmetic. *Under the hood: prompt injection* runs a hand-built attention layer (eight readable features, an instruction head and a task head; real dot-product attention, softmax and value mixing): the context as one token stream, each token as numbers, the score breakdown for any token, the mixed intent, and the sampled action, then four attacks (override, polite authority, fake delimiter, invisible Unicode) against four in-model defences (spotlighting, instruction hierarchy, a sanitiser, an attention-tracking detector). Its weights were tuned so the outcomes follow published patterns: injected orders pull the instruction head off the user's request, a fake system tag beats the hierarchy, and stacked defences still leave a per-try chance that compounds over retries. *Under the hood: one poisoned gradient step* follows one poisoned file through the forward pass, the loss, backpropagated blame and the per-pixel weight update, then tallies over a whole training run how hard 600 clean files and 2 poisoned files pushed each weight: clean files argue back on every malware pixel, nothing argues back on the trigger pixels. Then come 36 documented attacks from 2023–2025 in eight tracks: prompt injection in depth (indirect injection, system-prompt leaks, Slack AI, hidden prompts in papers and CVs, ASCII smuggling), inference-time attacks (training-data extraction, model stealing, token-length side channels), jailbreaks and evasion (many-shot, Best-of-N, Crescendo and Skeleton Key, guardrail evasion), poisoning (250-document backdoors, sleeper agents, web-scale and RAG poisoning, subliminal learning), the AI supply chain (malicious model files, slopsquatting, namespace reuse, s1ngularity, the Amazon Q wiper prompt), agent hijacks (EchoLeak, GitHub and Supabase MCP leaks, tool poisoning, Morris II, memory spyware), AI as the attacker (GTG-1002, one-day exploitation, the Arup deepfake) and modern defences (CaMeL and the Rule of Two, spotlighting and instruction hierarchy against adaptive attacks, how guardrails are being absorbed into the security platforms, model signing, constitutional classifiers). Each case opens on its own hands-on signature interaction (`app/js/sigs.js`, `app/js/sigs2.js`): repeat a word until the model leaks, steal a layer through the API, guess an encrypted chat’s topic from packet sizes, smuggle text past a guardrail, extract a system prompt, steal a key through Slack AI, buy expired dataset domains, hunt the wiper line in a pull request, replay the s1ngularity install against your defences, patch EchoLeak one bypass at a time, race an AI intrusion against your SOC, verify a deepfake CFO, spend a budget on the AI security stack, and more. Under each sits a *What changes on Monday* card for the security team (`app/js/take-data.js`): the control to deploy, a detection rule to copy, a red-team test to run and the question to ask a vendor or the board. Each case walks the chain stage by stage on a diagram, then shows why the controls in place lost and what detection would have seen, then asks two scored calls. Every case cites its source. Content is at mechanism level, with no working payloads, and lives in `app/js/advanced-data.js`; `#adv-<id>` opens a case.

## The syllabus (Modules 10–15)

Modules 10–15 open on a **Syllabus** tab that follows the programme syllabus topic by topic, in teaching order: what the topic means, where it shows up at Meridian, one tap-to-answer check, and a link to where the workbench practises it. Each module page carries its syllabus title; the work task is the module's hands-on exercise. The syllabus text is in `app/js/syllabus-data.js`; edit it there when the syllabus changes.

## The ten labs

Each lab opens with the module's fail-first trap, then has five tabs: **1 · Work task** (a mission card, then numbered steps, each labelled Decide, Simulate, Write or Read, ending with **Check my work**), **2 · Quick quiz** (instant right/wrong feedback with the reason), **3 · Case studies** (the deck’s live scenarios and leadership discussion, each with an expert answer), **Expert answers** (opened by Check my work, with facilitator notes) and **Room** (compares every table).

| Module | Lab | Main exercise |
|---|---|---|
| 07 Responsible AI | Score one of your own AI systems | Six-principle scorecard, radar, regulator challenges, 30-day gap |
| 08 Responsive AI | Autonomy, runtime policy and escalation | Sort board, agent-loop diagram, risk map, policy generator |
| 09 Architecture review | Architecture review workshop | Warm-up flaw hunt; three exercise workbenches with threat registers, eight questions, verdicts and deliverables |
| 10 Trust | Trust architecture: who can a hijacked agent become? | Identity propagation switch, radial blast-radius map, live attack chains |
| 11 Attacks | Watch an injection, then defend against it | Hidden-text demo, context window, defence simulator, Gandalf log |
| 12 RAG & MCP | Secure retrieval and the tool approval board | RAG pipeline coverage, permission-aware retrieval demo, MCP approval board with a rug-pull round |
| 13 Productization | Go / no-go for ClaimsBot | Readiness pack, private briefs, conditions, risk grid, decision memo |
| 14 SOC | Find the attack, build the detection | Log console, timeline, detection workbench, kill-switch trade-off |
| 15 Governance | Classify eight use cases, brief the board | EU AI Act and internal tiers, heat map, decision rights, board dashboard, board report |
| 16 Capstone | RAG, MCP and the Aria incident | Exercises, deliverables checklist, branching tabletop, weighted rubric |

**No typing, all tapping.** Participants never type an answer. Each case study is three calls: every option locks in when tapped, shows its consequence and scores 10 (strong), 5 (partly there) or 0 (risky), with stars per case and the strongest move revealed when a table misses it. Leadership discussions are tapped positions (ready, partly, gap) with a readiness gauge. Modules 12, 13, 15 and 16 have a stakeholder role-play (a sponsor, the business owner, the Audit Committee chair, a journalist): the table picks a reply to each of three lines, the stakeholder reacts in character, a mood bar shows whether the table is winning the room, and a debrief scores the conversation. Lab write-ups are picks too: the system profile, evidence and 30-day gap in Module 07, owners and the eight questions in Module 09, notices built from sentence cards in Module 16. Nothing calls an AI service.

The home screen adds the ten leadership questions, the four program outcomes, and a wrap-up with the six takeaways and a 90-day plan. [COVERAGE.md](COVERAGE.md) maps every deck slide to where the app covers it.

## Running a session

1. Project the app on the main screen. Inside a lab, **Present** enlarges everything.
2. Each table taps its table number on the home screen and works through the lab on a phone.
3. At the end, each table taps **Share with the room** and pastes its result code into the room chat.
4. On the projector, open the lab's **Room** tab and paste all the codes at once. The room view compares every table.
5. Reveal answers after the comparison.

Answers are saved in each phone's browser. Nothing is sent anywhere unless a table shares its code.

**Optional live room.** If every participant is signed in to the same claude.ai organization as the artifact's owner, the app can share results live instead of through codes. To turn this on, republish with the `db` capability. That limits access to the organization and disables public links. The code already handles both modes.

## Project layout

```
app/
  index.html          page shell (the artifact host adds the document skeleton)
  css/app.css         design tokens (light and dark) and all component styles
  js/core.js          DOM/SVG builders, state, controls, lab clock, result codes, live room
  js/schematics.js    SVG helpers: edges, radar charts, room-result renderers
  js/scenario-data.js scenarios and leadership discussions, generated from the deck
  js/drills.js        Quick quiz and Case studies tabs (render, answers, room, summary)
  js/flows.js         guided steps per lab and the kinds of action (Decide, Simulate, Quiz, Read)
  js/case-play-data.js the scored options for every case-study call and discussion position
  js/play.js          tap-to-play pieces: move cards that lock in, stars, position cards, sentence builders
  js/roleplay.js      stakeholder role-plays as dialogue choices, for the labs and the story
  js/trap-data.js     fail-first traps and reveals, generated from the deck
  js/trap.js          the trap and reveal component, shared by the story and the labs
  js/deck-data.js     the program deck, generated from deck/ by scripts/import-deck.mjs
  js/deck.js          the slide viewer: Deck tabs and the #deck page
  js/story-extra.js   the framing of every episode question: bridge, stakes, why, terms, explanation
  js/story-viz.js     the animated stakes visuals and the question frame
  js/story-data.js    the story season: the NEXUS opening, ten episodes, the NEXUS failure timeline
  js/rag.js           the core RAG Lab: pipeline design, production run, incident report
  js/harden-data.js   Harden NEXUS: seven layers, their simulations and drills, the console attacks
  js/harden.js        Harden NEXUS: console, layer screens, scoring
  js/syllabus-data.js the Modules 10–15 syllabus, one card per topic
  js/syllabus.js      the Syllabus tab
  js/atlas-data.js    the 10-hour map: four lines, 44 stops, each an animated scene with its real case
  js/atlas-deep.js    round two for every stop: three ways the secure design fails, hardening, four checks
  js/atlas.js         the map page, the scene player, round two, the playbook and the two playgrounds
  js/story.js         story engine: one-screen scenes, animation, meters, routing ('#' and '#e07'…)
  js/labs/m07–m16.js  one file per lab: data, render, answers, aggregation, summary
  js/main.js          home, lab view, tabs, presenter mode, room collector
scripts/
  check-syntax.mjs    syntax-checks every script the page loads
  smoke.mjs           renders every lab and tab in jsdom, clicks every control, checks result codes,
                      drill answer keys and that all 34 deck scenarios and 9 discussions are present
```

There is no build step: the scripts are plain browser JavaScript, loaded in order.

## Hosting it yourself

`app/index.html` is a page body: the artifact host adds the doctype, charset and viewport when it serves it. To host the labs anywhere else (GitHub Pages, Netlify, S3, any static server), run `npm run build` and upload the contents of `dist/`.

## Testing

```
npm install
npm test
```

## Deploying

The app is published as a multi-file Claude artifact from the `app/` folder, with `index.html` as the page and the CSS and JS files alongside it. Republish to the same artifact URL to keep the link participants already have.
