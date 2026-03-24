# NeuroLoop Skill Index

NeuroLoop is a biometric AI companion powered by a real-time EXG device (Muse, OpenBCI Ganglion, Neurable MW75 Neuro, Hermes V1).
It reads brainwaves and physiology continuously, and uses that data to inform every response.

NeuroSkill exposes the EXG analysis API through a local WebSocket server and HTTP tunnel.
The `npx neuroskill <command>` script is the fastest way to query it from a terminal, shell
script, or any automation pipeline.

Skills are loaded contextually — the harness injects the relevant skill file into the
system prompt when the user's message matches the skill's domain.

---

## EXG Data & API Skills

| Skill | Loaded when | Description |
|---|---|---|
| [neuroskill-transport](skills/skills/neuroskill-transport/SKILL.md) | transport/connection questions | WebSocket & HTTP transport, port discovery, Quick Start, output modes (`--json` / `--full`), and global CLI flags. |
| [neuroskill-status](skills/skills/neuroskill-status/SKILL.md) | status/device questions | `status` command — full system snapshot: device state, signal quality, EXG scores, band powers, ratios, embeddings, labels, sleep summary, and recording history. |
| [neuroskill-sessions](skills/skills/neuroskill-sessions/SKILL.md) | session/history questions | `session` and `sessions` commands — per-session metric breakdowns with first/second-half trends, session listing, and Unix timestamp helpers. |
| [neuroskill-search](skills/skills/neuroskill-search/SKILL.md) | comparison/trend questions | `search` and `compare` commands — ANN search for neurally similar EXG moments across all history, and A/B session comparison with metric deltas and UMAP enqueuing. |
| [neuroskill-sleep](skills/skills/neuroskill-sleep/SKILL.md) | sleep/fatigue context | `sleep`, `sleep-schedule`, and `umap` commands — EXG-based sleep stage classification (Wake/N1/N2/N3/REM) with efficiency and bout analysis, sleep schedule management, and 3D UMAP projection. |
| [neuroskill-labels](skills/skills/neuroskill-labels/SKILL.md) | label/search context | `label`, `search-labels`, and `interactive` commands — creating EXG text annotations, semantic vector search over labels, and cross-modal 4-layer graph search combining text and EXG similarity. |
| [neuroskill-screenshots](skills/skills/neuroskill-screenshots/SKILL.md) | screenshot/visual memory questions | `search-images`, `screenshots-around`, `screenshots-for-eeg`, and `eeg-for-screenshots` commands — OCR text search, CLIP visual similarity search, temporal screenshot lookup, and cross-modal EEG↔screenshot queries. |
| [neuroskill-streaming](skills/skills/neuroskill-streaming/SKILL.md) | streaming/calibration context | `listen`, `say`, `notify`, `calibrate`, `calibrations`, `timer`, and `raw` commands — real-time WebSocket event streaming, TTS, OS notifications, calibration profile CRUD, focus timer, and raw JSON passthrough. |
| [neuroskill-hooks](skills/skills/neuroskill-hooks/SKILL.md) | hooks/trigger/automation questions | `hooks` commands — proactive hook rules, scenarios, thresholds, keyword-based EEG triggers, hook audit log, and threshold suggestion from real data. |
| [neuroskill-dnd](skills/skills/neuroskill-dnd/SKILL.md) | do-not-disturb/focus-mode questions | `dnd` commands — DND automation status, force-enable/disable, EEG-threshold bypass, and OS focus mode integration. |
| [neuroskill-llm](skills/skills/neuroskill-llm/SKILL.md) | on-device LLM questions | `llm` commands — local LLM server management, model catalog, GGUF downloads, model selection, vision projector, single-shot and interactive chat with tool calling. |
| [neuroskill-data-reference](skills/skills/neuroskill-data-reference/SKILL.md) | metric field questions | All metric fields — band powers, EXG ratios and indices, core scores, complexity measures, PPG/HRV, motion and artifact markers, sleep stage codes, indices, and consciousness metrics. |
| [neuroskill-evidence](skills/skills/neuroskill-evidence/SKILL.md) | evidence/research questions | Scientific evidence and references for EXG metrics, protocols, and neurofeedback approaches. |
| [neuroskill-recipes](skills/skills/neuroskill-recipes/SKILL.md) | scripting/automation questions | Use-case recipes and scripting patterns — focus monitoring, stress tracking, sleep analysis, ADHD queries, meditation tracking, A/B comparison, time-range queries, and automation with cron/Python/Node.js/HTTP. |

---

## HealthKit Integration

| Command | Description |
|---|---|
| `health` | 24-hour HealthKit summary — sleep, workouts, steps, HR, metrics |
| `health summary [--start --end]` | Aggregate counts for a time range |
| `health sleep [--start --end]` | Apple Health sleep samples |
| `health workouts [--start --end]` | Workout sessions |
| `health hr [--start --end]` | Heart rate samples |
| `health steps [--start --end]` | Step counts |
| `health metrics --metric-type <t>` | Scalar health metrics (restingHeartRate, hrv, vo2Max, …) |
| `health metric-types` | List all stored metric types |

Health data is automatically fetched when the user's prompt matches relevant domains
(sleep, sport, recovery, HRV, nutrition).

---

## Protocol & Intervention Skills

| Skill | Loaded when | Description |
|---|---|---|
| [neuroskill-protocols](skills/skills/neuroskill-protocols/SKILL.md) | protocol/exercise/routine intent detected | Full guided-protocol repertoire — 70+ mind-body practices matched to EXG metric signals. Covers breathing, meditation, stress regulation, sleep, somatic work, emotions, music, neck/eye/morning exercises, workout protocols, hydration, dietary guidance, and social-media/digital-addiction interventions. Loaded on-demand when the user asks for help, exercises, routines, or specific practices. |

---

## Tools Available to the Agent

| Tool | Purpose |
|---|---|
| `neuroskill_run` | Run any neuroskill EXG command and return its output (status, sessions, search, sleep, health, hooks, dnd, llm, screenshots, calibrations, etc.). |
| `neuroskill_label` | Create a timestamped EXG annotation for the current moment. |
| `run_protocol` | Execute a multi-step guided protocol with OS notifications, per-step timing, and EXG labelling. |
| `prewarm` | Kick off a background `neuroskill compare` run so results are ready when needed. |
| `memory_read` | Read the agent's persistent memory file. |
| `memory_write` | Write or append to the agent's persistent memory file. |
| `web_fetch` | Fetch a URL and return its content. |
| `web_search` | Search the web and return results. |

---

## Slash Commands

| Command | Description |
|---|---|
| `/key` | Interactive: choose a provider, paste your API key → saved to `~/.neuroloop/auth.json` |
| `/key list` | Show all supported providers and which ones are configured |
| `/key remove` | Interactive: pick a stored key to delete |
| `/key remove <id>` | Directly remove a specific provider key (e.g. `/key remove google`) |
| `/exg` | Show a full EXG snapshot in the chat |
| `/exg on` / `/exg off` | Enable or disable the live EXG footer panel |
| `/exg <seconds>` | Change the WebSocket poll interval |
| `/exg port <n>` | Connect to the NeuroSkill™ server on a different port |
| `/neuro <cmd> [args…]` | Run any neuroskill subcommand directly |
| `/session [index]` | Current or Nth session metrics (0 = latest) |
| `/sessions` | List all recorded EXG sessions |
| `/sleep [index]` | Sleep staging summary |
| `/compare` | Compare last two sessions (~60 s, uses cache) |
| `/health [sub]` | HealthKit data — `sleep`, `workouts`, `hr`, `steps`, `summary`, `metrics` |
| `/label <text>` | Create a timestamped EXG annotation (supports `--context`) |
| `/labels <query>` | Semantic search over EXG annotations (supports `--k`) |
| `/hooks [sub]` | Proactive hook rules — `list`, `add`, `remove`, `enable`, `disable`, `log` |
| `/dnd [on\|off]` | Do Not Disturb status / toggle |
| `/say <text>` | Speak text aloud via on-device TTS (supports `--voice`) |
| `/notify <title> [body]` | Send an OS notification |
| `/calibrate` | Start EXG calibration sequence |
| `/llm [sub]` | On-device LLM — `status`, `start`, `stop`, `catalog`, `select`, `chat` |
| `/screenshots [query]` | Search screenshots (OCR / CLIP) or get EEG-session screenshots |
| `/timer` | Start focus timer |
| `/umap` | 3D UMAP projection of EXG data |
| `/listen [--seconds n]` | Stream live EXG broadcast events |

---

## How Contextual Loading Works

On every user message, the harness:
1. Runs `neuroskill status` and injects the live EXG snapshot into the system prompt.
2. Detects domain signals in the user's prompt (stress, sleep, focus, health, screenshots, hooks, DND, LLM, protocols, etc.).
3. Runs the relevant neuroskill commands in parallel (session, search-labels, health, hooks, dnd, llm status, screenshots-for-eeg, etc.).
4. If protocol intent is detected, reads `skills/skills/neuroskill-protocols/SKILL.md` and injects
   the full protocol repertoire into the system prompt for that turn.
5. Injects this skill index so the LLM always knows what capabilities are available.
