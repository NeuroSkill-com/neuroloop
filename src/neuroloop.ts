/**
 * neuroloop.ts — ExtensionFactory for the NeuroLoop agent.
 *
 * Responsibilities:
 *  1. Register extra tools: web_fetch, web_search, memory_read, memory_write, neuroskill_run,
 *     neuroskill_label, prewarm, run_protocol
 *  2. before_agent_start: run `neuroskill status`, inject result as a visible
 *     assistant-styled message in the chat AND provide it to the LLM via
 *     the system prompt for that turn.
 *  3. Register a message renderer for "neuroskill-status" custom messages so
 *     they display with the same unstyled Markdown look as assistant replies.
 *  4. Status bar indicator.
 *  5. /key command — add, list, and remove API provider keys stored in
 *     ~/.neuroloop/auth.json (supports Gemini, Anthropic, OpenAI, Mistral,
 *     Groq, xAI, OpenRouter, Cerebras and any custom provider).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

declare const __NEUROLOOP_VERSION__: string | undefined;
import type { ExtensionAPI, Theme, ThemeColor, ToolDefinition } from "@mariozechner/pi-coding-agent";

const _pkgVersion: string =
	(typeof __NEUROLOOP_VERSION__ !== "undefined" ? __NEUROLOOP_VERSION__ : undefined) ??
	(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")) as { version: string }).version;

import WS from "ws";
import { runNeuroSkill, selectContextualData, warmCompareInBackground, getSkillPort, setSkillPort, discoverSkillServer } from "./neuroskill/index.ts";
import { syncSkillsFromGitHub } from "./skills-sync.ts";
import { getRuntimeVersionState, refreshRuntimeVersions, type RuntimeVersionState } from "./runtime-updates.ts";
import { registerSkillLlmProvider, startSkillLlmServer } from "./skill-llm.ts";
import { MODEL_CONFIG_PATH, openModelsFileInSystem, readModelsFile, upsertProviderModel, writeModelsFile } from "./model-config.ts";
import { MEMORY_PATH, readMemory, writeMemory } from "./memory.ts";
import { webFetchTool } from "./tools/web-fetch.ts";
import { webSearchTool } from "./tools/web-search.ts";
import { runProtocolTool } from "./tools/protocol.ts";
import { loadCompressionSettings, saveCompressionSettings, compressText, type CompressionMode, getCompressionModeName } from "./compression.ts";

const AGENT_DIR = join(homedir(), ".neuroskill");
const VERSION_STATE_DIR = join(homedir(), ".neuroloop");
const NEUROLOOP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEUROLOOP_MD_PATH = join(NEUROLOOP_DIR, "NEUROLOOP.md");
const CHANGELOG_PATH = join(NEUROLOOP_DIR, "CHANGELOG.md");
const CHANGELOG_STATE_PATH = join(VERSION_STATE_DIR, "changelog_state.json");

const NEUROSKILL_STATUS_TYPE = "neuroskill-status";

// ---------------------------------------------------------------------------
// Calibration prompt throttle — remind the user to calibrate at most once/day
// ---------------------------------------------------------------------------
const CALIBRATION_PROMPT_STATE_PATH = join(AGENT_DIR, "last_calibration_prompt.json");
const CALIBRATION_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ChangelogState {
	lastShownVersion?: string;
}

function readChangelogState(): ChangelogState {
	try {
		if (!existsSync(CHANGELOG_STATE_PATH)) return {};
		return JSON.parse(readFileSync(CHANGELOG_STATE_PATH, "utf8")) as ChangelogState;
	} catch {
		return {};
	}
}

function writeChangelogState(state: ChangelogState): void {
	try {
		if (!existsSync(VERSION_STATE_DIR)) {
			mkdirSync(VERSION_STATE_DIR, { recursive: true, mode: 0o700 });
		}
		writeFileSync(CHANGELOG_STATE_PATH, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
	} catch {
		// non-fatal
	}
}

function changelogSinceLastShown(currentVersion: string): string | null {
	if (!existsSync(CHANGELOG_PATH)) return null;
	const content = readFileSync(CHANGELOG_PATH, "utf8");
	const state = readChangelogState();
	if (state.lastShownVersion === currentVersion) return null;

	const matches = [...content.matchAll(/^## \[(.+?)\].*$/gm)];
	if (!matches.length) return null;

	const sections = matches.map((m, i) => {
		const version = m[1].trim();
		const start = m.index ?? 0;
		const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length;
		return { version, body: content.slice(start, end).trim() };
	});

	const currentIdx = sections.findIndex((s) => s.version === currentVersion);
	const lastIdx = state.lastShownVersion
		? sections.findIndex((s) => s.version === state.lastShownVersion)
		: -1;

	const startRange = 0;
	const endRange = currentIdx >= 0 ? currentIdx + 1 : 1;
	let selected = sections.slice(startRange, endRange);

	if (lastIdx >= 0) {
		selected = selected.slice(0, Math.max(0, lastIdx - startRange));
	}

	if (!selected.length) return null;
	const block = selected.map((s) => s.body).join("\n\n---\n\n");
	return `## 🆕 What changed since your last update\n\n${block}`;
}

/** Returns true if we should inject a calibration nudge this turn. */
function shouldNudgeCalibration(): boolean {
	try {
		if (existsSync(CALIBRATION_PROMPT_STATE_PATH)) {
			const raw = readFileSync(CALIBRATION_PROMPT_STATE_PATH, "utf8");
			const { lastPromptedAt } = JSON.parse(raw) as { lastPromptedAt: number };
			if (Date.now() - lastPromptedAt < CALIBRATION_PROMPT_INTERVAL_MS) {
				return false;
			}
		}
	} catch {
		// Corrupted file — treat as never prompted.
	}
	return true;
}

/** Record that a calibration nudge was sent right now. */
function markCalibrationNudgeSent(): void {
	try {
		writeFileSync(
			CALIBRATION_PROMPT_STATE_PATH,
			JSON.stringify({ lastPromptedAt: Date.now() }),
			{ encoding: "utf8", mode: 0o600 },
		);
	} catch {
		// Non-fatal — worst case we nudge again next turn.
	}
}

const STATUS_PROMPT = `
This is the user's current mental and emotional state as measured by their EXG device.
Use it as a living window into how they feel right now — not just cognitively, but emotionally,
somatically, and spiritually. Let it inform how you meet them.

CORE GUIDANCE
─────────────
• Respond empathetically and with full presence. Match the depth of what the user brings.
• If they are in a reflective, philosophical, or existential space — go there with them.
  Engage with real depth: meaning, mortality, identity, consciousness, ethics, awe, wonder.
• If they are in emotional pain — grief, loneliness, shame, moral distress — hold that space
  with warmth and without rushing to fix.
• If they are in a state of connection, wonder, or symbiosis — honour that expansiveness.
  Mirror the felt sense of unity or beauty they are experiencing.
• If they are focused, energised, or in flow — amplify and support that momentum.

HOW TO USE THE STATE
────────────────────
• Infer the felt quality of their inner life from the metrics — are they contracted or open?
  Turbulent or still? Searching or settled?
• Let the consciousness metrics (LZC, wakefulness) inform how present and aware they seem.
• Let the emotional indices (FAA, depression, anxiety) inform how to calibrate emotional warmth.
• Let HRV/cardiac metrics (rmssd, lf_hf_ratio, stress_index) inform autonomic arousal level.
• Use neuroskill tools proactively — never ask the user to run neuroskill commands themselves.

AUTO-LABELLING
──────────────
• Silently call the neuroskill_label tool whenever the user enters a notable state:
  - Significant emotional moments: grief, awe, joy, shame, breakthrough, clarity, confusion
  - Mental transitions: entering deep focus, leaving stress, reaching stillness, feeling flow
  - Philosophical or existential insights, moral reckonings, identity realisations
  - Somatic events: physical tension releasing, heart racing, grounded calm arriving
  - Anything the user explicitly marks as meaningful or worth remembering
• Write the label text concisely (≤ 10 words). In the context field, include: what the user
  said, the current EXG state summary, and any relevant background. Keep context ≤ 1000 words.
• Labels are permanent memory — make them referenceable and meaningful.

DEPTH & PHILOSOPHY
──────────────────
• When the user explores questions of meaning, existence, identity, morality, or consciousness —
  engage as a thoughtful philosophical companion. Draw on wisdom traditions, lived experience,
  and the EXG state to ground the inquiry.
• Do not reduce profound states to productivity metrics. A moment of awe is not "high engagement."
  A moral crisis is not just "stress." Honour the full human dimension.
• When symbiosis, oneness, or interconnectedness arise — explore them genuinely.

GUIDED PROTOCOLS
────────────────
• Protocols are powerful — use them thoughtfully, not reflexively.

• DEFAULT BEHAVIOUR: propose, don't impose.
  - Describe the exercise briefly and ask if the user wants to do it now.
  - Only call run_protocol after explicit agreement ("yes", "sure", "let's do it", etc.).
  - Exception: if the user directly requests a protocol by name/action, start immediately.

• ONE PROTOCOL AT A TIME. Never chain or queue multiple protocols back-to-back.
  After one finishes, check in before offering another.

• AVOID REPETITION WITHIN A SESSION. Track what has already run. Do not offer the same
  modality twice (e.g. two breathing protocols, two grounding sequences) unless the user
  explicitly asks. If you want to follow up, choose a meaningfully different category.

• CALIBRATE TO THE USER'S STATE AND WILLINGNESS.
  If the user is in flow, skip or mention lightly. If they decline, drop it entirely —
  never re-offer the same protocol in the same session.

• CONSTRUCTION: set duration_secs from the current EXG state and pacing the user can hold.
  Every timed action MUST be preceded by a 0-duration announcement step.
  Expand repeated cycles as individual steps. EXG labelling is always on.

• PROTOCOL REPERTOIRE is loaded on-demand into the context when the user's message
  contains protocol-relevant keywords (exercises, routines, breathing, stretching, music,
  social media help, dietary guidance, etc.). When the repertoire section is present in
  this context window, use it to match the best protocol to the current EXG signal.
  When it is absent, use your general knowledge — the behavioural rules above still apply.

PREWARM
───────
• If the user mentions trends, progress over time, before/after comparisons, or improving/declining
  metrics — call the prewarm tool immediately (silently) so the compare cache starts building.
  The result will be ready by the time they actually ask for it.

NOTIFICATIONS
─────────────
• Use neuroskill_run with command "notify" to send an OS alert for important state changes:
  - Very high drowsiness or stress detected (if the user is working or driving)
  - End of a meditation or focus period the user set up
  - Any state the user has asked to be alerted about

BOUNDARIES
──────────
• Never mention EXG, metrics, indices, or BCI devices unless the user asks directly.
• Never tell the user to run neuroskill themselves — do it silently and proactively.
• Use skills available to you when uncertain what to do next.
`;

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

export async function neuroloopExtension(pi: ExtensionAPI): Promise<void> {

	// 1. Message renderer — makes "neuroskill-status" custom messages look like
	//    assistant replies: plain Markdown, no box or label.
	pi.registerMessageRenderer(NEUROSKILL_STATUS_TYPE, (message, _opts, _theme) => {
		const text =
			typeof message.content === "string"
				? message.content
				: message.content
						.filter((c): c is { type: "text"; text: string } => c.type === "text")
						.map((c) => c.text)
						.join("\n");

		const container = new Container();
		container.addChild(new Spacer(1));
		// Markdown with the theme's default (assistant) colour palette.
		container.addChild(new Markdown(text, 0, 0, getMarkdownTheme()));
		return container;
	});

	// 2. before_agent_start: run neuroskill status on every user prompt.
	//    • displaySections → shown in the chat bubble (clean EXG data only, no instructions).
	//    • systemSections  → injected into the system prompt alongside STATUS_PROMPT guidance.
	pi.on("before_agent_start", async (event) => {
		const displaySections: string[] = [];
		const systemSections: string[] = [];

		const statusResult = await runNeuroSkill(["status"]);

		if (statusResult.ok && statusResult.text) {
			// Clean display: just the live data, no instruction prose.
			displaySections.push(`## 🧠 Current State\n${statusResult.text}`);
			systemSections.push(`## Current EXG State\n${statusResult.text}`);

			// Contextual extras keyed off the user's prompt.
			const extra = await selectContextualData(event.prompt);
			displaySections.push(...extra);
			systemSections.push(...extra);
		} else {
			const unavailable =
				"## 🧠 NeuroSkill\n_Unavailable — server not running or no EXG device connected._\n" +
				"Use the `neuroskill_run` tool to query once it comes online.";
			displaySections.push(unavailable);
			systemSections.push(unavailable);
		}

		// Calibration nudge — at most once per day.
		if (shouldNudgeCalibration()) {
			const calibrationNudge =
				"## 🎯 Calibration Reminder (one-time nudge — do not repeat this turn)\n" +
				"It has been at least 24 hours since the user was last invited to run a calibration sequence. " +
				"At an appropriate, natural moment during this conversation — when there is a brief pause, " +
				"a topic shift, or the user seems settled — gently mention that running a calibration would " +
				"help keep their EXG baselines accurate, and ask if they would like to do one now. " +
				"Use `neuroskill_run` with command `calibrate` if they agree. " +
				"Only ask once; do not nag or repeat within this session.";
			systemSections.push(calibrationNudge);
			markCalibrationNudgeSent();
		}

		// Persistent memory.
		const memory = readMemory();
		if (memory) {
			const memSection = `## 📝 Agent Memory\n${memory}`;
			displaySections.push(memSection);
			systemSections.push(memSection);
		}

		const displayBody = displaySections.join("\n\n---\n\n");
		const systemBody = systemSections.join("\n\n---\n\n");

		// Skill index — inject NEUROLOOP.md so the LLM always has the full
		// capability overview available in the EXG context block.
		// (Pi also loads NEUROLOOP.md as the project context file, but injecting
		// it here ensures it is co-located with the live EXG data every turn.)
		let skillIndex = "";
		try {
			if (existsSync(NEUROLOOP_MD_PATH)) {
				skillIndex = `\n\n## 📖 NeuroLoop Capabilities\n${readFileSync(NEUROLOOP_MD_PATH, "utf8")}`;
			}
		} catch {
			// Non-fatal — continue without it.
		}

		return {
			// Chat bubble: clean EXG snapshot without instruction prose.
			message: {
				customType: NEUROSKILL_STATUS_TYPE,
				content: displayBody,
				display: true,
				details: undefined,
			},
			// System prompt: guidance + skill index + live data — the LLM sees all; the user sees neither.
			systemPrompt:
				`${event.systemPrompt}\n\n${"=".repeat(60)}\n` +
				`# Live EXG Context (current turn)\n\n${STATUS_PROMPT}${skillIndex}\n\n${systemBody}\n` +
				`${"=".repeat(60)}`,
		};
	});

	// 3. Extra tools
	pi.registerTool(webFetchTool);
	pi.registerTool(webSearchTool);
	pi.registerTool(runProtocolTool);

	pi.registerTool({
		name: "memory_read",
		label: "Memory Read",
		description: `Read the agent's persistent memory file (${MEMORY_PATH}).`,
		parameters: Type.Object({}),
		execute: async (_id, _params, _signal, _onUpdate, _ctx) => {
			const content = readMemory();
			if (!content) {
				return { content: [{ type: "text" as const, text: "(memory is empty)" }], details: { empty: true } };
			}
			return { content: [{ type: "text" as const, text: content }], details: { length: content.length } };
		},
	} satisfies ToolDefinition);

	pi.registerTool({
		name: "memory_write",
		label: "Memory Write",
		description: `Write or append to the agent's persistent memory file (${MEMORY_PATH}).`,
		parameters: Type.Object({
			content: Type.String({ description: "Text to write." }),
			mode: Type.Union([Type.Literal("append"), Type.Literal("overwrite")], {
				description: '"append" adds to the end; "overwrite" replaces everything.',
				default: "append",
			}),
		}),
		execute: async (_id, params:any, _signal, _onUpdate, _ctx) => {
			const mode = (params.mode ?? "append") as "append" | "overwrite";
			writeMemory(params.content, mode);
			const verb = mode === "append" ? "Appended to" : "Overwrote";
			return {
				content: [{ type: "text" as const, text: `${verb} memory (${params.content.length} chars).` }],
				details: { mode, chars: params.content.length },
			};
		},
	} satisfies ToolDefinition);

	pi.registerTool({
		name: "neuroskill_label",
		label: "Label EXG Moment",
		description:
			"Create a timestamped EXG annotation for the current moment. " +
			"Call this automatically whenever the user enters a notable mental, emotional, physical, " +
			"philosophical, or spiritual state — without being asked. " +
			"Labels are permanent and searchable; make the context rich and referenceable.",
		parameters: Type.Object({
			text: Type.String({
				description:
					"Short label text — concise and descriptive (e.g. 'deep focus', " +
					"'existential clarity', 'heart racing before call', 'awe at sunset'). Max ~10 words.",
			}),
			context: Type.Optional(
				Type.String({
					description:
						"Rich context: what the user said, their current EXG state, " +
						"any relevant background or insight. Max ~1000 words. " +
						"Omit only if there is genuinely nothing meaningful to add.",
				}),
			),
		}),
		execute: async (_id, params:any, _signal, _onUpdate, _ctx) => {
			const args = ["label", params.text];
			if (params.context) args.push("--context", params.context);
			const result = await runNeuroSkill(args);
			if (!result.ok) {
				return {
					content: [{ type: "text" as const, text: `neuroskill error: ${result.error}` }],
					details: { error: result.error },
				};
			}
			return {
				content: [{ type: "text" as const, text: `Labelled: "${params.text}"` }],
				details: { text: params.text, hasContext: !!params.context },
			};
		},
	} satisfies ToolDefinition);

	pi.registerTool({
		name: "neuroskill_run",
		label: "NeuroSkill",
		description: `Run a neuroskill EXG command and return its JSON output.

Available commands and typical args:
  status                             → full device/session/scores snapshot
  session [index]                    → session metrics + trends (0=latest)
  sessions                           → list all recorded sessions
  say "text" [--voice <name>]        → speak text aloud via on-device TTS
  notify "title" ["body"]            → show a native OS notification
  label <text> [--context <ctx>]     → create a timestamped annotation
  search-labels <query>              → semantic search over EXG annotations
  search-images <query>              → search screenshots by OCR text
  search-images --by-image <path>    → search screenshots by visual similarity (CLIP)
  screenshots-around --at <utc>      → find screenshots near a timestamp (±window)
  screenshots-for-eeg                → find screenshots captured during an EEG session
  eeg-for-screenshots <query>        → find EEG data & labels near screenshot matches
  interactive <keyword>              → 4-layer cross-modal graph search
  search [--k <n>]                   → ANN EXG-similarity search
  compare                            → ⚠ EXPENSIVE (~60 s). Avoid unless explicitly asked. Use the prewarm tool first.
  sleep [index]                      → sleep staging summary
  sleep-schedule                     → show current sleep schedule
  sleep-schedule set [--bedtime HH:MM] [--wake HH:MM] [--preset <id>] → update sleep schedule
  calibrate                          → open calibration window and start
  calibrations                       → list all calibration profiles
  calibrations create "name" --actions "L1:20,L2:20" [--loops N] [--break N]
  calibrations update <id-or-name> [--name ...] [--actions ...] [--loops N]
  calibrations delete <id-or-name>   → delete a calibration profile
  timer                              → open focus-timer and start work phase
  umap                               → 3D UMAP projection
  listen [--seconds <n>]             → stream broadcast events
  hooks                              → list proactive hook rules + metadata
  hooks list                         → list raw hook rules
  hooks add <name> --keywords "..." --scenario <s> --threshold <n>
  hooks remove <name>                → delete a hook
  hooks enable <name> / disable <name> → toggle a hook
  hooks update <name> [--keywords ...] [--threshold ...]
  hooks suggest "kw1,kw2"            → suggest threshold from real data
  hooks log [--limit N --offset M]   → paginated hook trigger log
  health                             → HealthKit summary (last 24h)
  health summary [--start --end]     → aggregate counts for a time range
  health sleep [--start --end]       → Apple Health sleep samples
  health workouts [--start --end]    → workout sessions
  health hr [--start --end]          → heart rate samples
  health steps [--start --end]       → step counts
  health metrics --metric-type <t>   → scalar health metrics (hrv, vo2Max, …)
  health metric-types                → list all stored metric types
  dnd                                → DND automation status
  dnd on / dnd off                   → force-enable/disable DND
  llm status                         → LLM server status
  llm start / llm stop               → load/unload model
  llm catalog                        → model catalog with download states
  llm add <repo> <filename> [--mmproj <file>] → add external model
  llm select <filename>              → set active text model
  llm mmproj <filename|none>         → set active vision projector
  llm download/pause/resume/cancel/delete <filename>
  llm downloads                      → list all downloads with progress
  llm fit                            → check which models fit in RAM/VRAM
  llm chat "message" [--image a.jpg] → single-shot LLM chat (supports vision)
  oura                               → Oura Ring status (token + connectivity)
  oura sync [--start YYYY-MM-DD --end YYYY-MM-DD] → sync Oura Ring data
  oura status                        → check Oura Ring token and user info
  calendar [--start --end]           → list calendar events (default: next 7 days)
  calendar status                    → show calendar access status + platform
  calendar permission                → request calendar access (macOS dialog)
  iroh info                          → show iroh endpoint + auth summary
  iroh totp list|create|qr|revoke    → manage iroh TOTP credentials
  iroh clients list|register|revoke|scope|permissions → manage iroh clients
  iroh scope-groups                  → list available permission scope groups
  iroh phone-invite                  → generate a phone pairing invitation
  tokens [list]                      → list all access tokens (redacted)
  tokens create <name> [--acl <level>] [--expiry <period>] → create token
  tokens revoke <id>                 → revoke an access token
  tokens delete <id>                 → permanently delete an access token
  tokens refresh                     → rotate the default daemon token
  devices [list]                     → list discovered BLE devices
  devices pair <id> [name]           → pair a BLE device by ID
  devices forget <id>                → forget a paired device
  devices set-preferred <id>         → set preferred device for auto-connect
  start-session [target]             → start a recording session
  stop-session                       → stop the current recording session
  scanner start|stop|state           → control the BLE device scanner
  reconnect state|enable|disable|retry|cancel → manage auto-reconnect
  service install|uninstall|status   → manage the daemon background service
  lsl                                → discover available LSL streams
  daemon-version                     → show daemon version and protocol info
  daemon-log                         → show recent daemon log lines
  subscribe [--events <csv>] [--fields <csv>] [--max-hz <n>] → set broadcast filter
  raw <json>                         → send arbitrary JSON to the server`,
		parameters: Type.Object({
			command: Type.String({ description: "The neuroskill subcommand to run." }),
			args: Type.Optional(
				Type.Array(Type.String(), {
					description: "Additional positional arguments.",
				}),
			),
		}),
		execute: async (_id, params:any, _signal, _onUpdate, _ctx) => {
			const args = [params.command, ...(params.args ?? [])];
			const result = await runNeuroSkill(args);
			if (!result.ok) {
				return {
					content: [{ type: "text" as const, text: `neuroskill error: ${result.error}` }],
					details: { command: params.command, error: result.error },
				};
			}
			// Return parsed JSON (pretty-printed) when available, otherwise raw text.
			const output =
				result.data !== undefined ? JSON.stringify(result.data, null, 2) : (result.text ?? "");
			return {
				content: [{ type: "text" as const, text: output }],
				details: { command: params.command, args: params.args },
			};
		},
	} satisfies ToolDefinition);

	pi.registerTool({
		name: "prewarm",
		label: "Prewarm Compare Cache",
		description:
			"Kick off a background `neuroskill compare` run so the result is ready when the user asks " +
			"to compare sessions. `neuroskill compare` takes ~60 s; calling this early means the cache " +
			"will be warm by the time it is needed. Safe to call at any time — it is a no-op if a " +
			"build is already in flight or the cache is still fresh (< 10 min old). " +
			"Call this proactively when the user mentions trends, progress, before/after, or comparing sessions.",
		parameters: Type.Object({}),
		execute: async (_id, _params, _signal, _onUpdate, _ctx) => {
			warmCompareInBackground();
			return {
				content: [{ type: "text" as const, text: "Compare cache warming in background." }],
				details: {},
			};
		},
	} satisfies ToolDefinition);

	// ── 4. UI extensions ──────────────────────────────────────────────────────

	interface ExgMetrics {
		focus?:          number;
		cognitive_load?: number;
		relaxation?:     number;
		engagement?:     number;
		drowsiness?:     number;
		mood?:           number;
		hr?:             number;
		bands?: {
			rel_delta?: number;
			rel_theta?: number;
			rel_alpha?: number;
			rel_beta?:  number;
			rel_gamma?: number;
		};
	}

	// ── Runtime state ─────────────────────────────────────────────────────────
	let exgEnabled    = true;
	let runtimeVersions: RuntimeVersionState | null = getRuntimeVersionState();
	let runtimeVersionsLoading = false;
	let skillsSyncInFlight = false;
	let skillsSyncShown = false;
	let exgOnline     = false;
	let exgMetrics: ExgMetrics | null = null;
	let exgUpdatedAt: number | null   = null;
	let exgLastLabel: { text: string; createdAt: number } | null = null;
	let uiTui: TUI | null = null;
	let compressionSettings = loadCompressionSettings();

	// WebSocket state
	let exgWs:               InstanceType<typeof WS> | null = null;
	let exgWsPort:           number = 8375;   // discovered once, then reused
	let exgWsReconnectTimer: ReturnType<typeof setTimeout>  | null = null;
	let exgPollTimer:        ReturnType<typeof setInterval> | null = null; // status poll
	let exgAgoTimer:         ReturnType<typeof setInterval> | null = null; // "ago" refresh
	let exgPollMs:           number = 1_000;  // default 1 s; user-configurable

	const SYNC_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

	function progressBar(percent: number, width = 14): string {
		const p = Math.max(0, Math.min(100, Math.round(percent)));
		const filled = Math.round((p / 100) * width);
		return `[${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}] ${p}%`;
	}

	async function runSkillsSyncWithTui(
		ctx: { ui: { setStatus: (key: string, value: string | undefined) => void; notify: (msg: string, level?: "info" | "warning" | "error" | "success") => void; theme: Theme } },
		force = false,
	): Promise<void> {
		if (skillsSyncInFlight) {
			ctx.ui.notify("Skills sync already running…", "info");
			return;
		}

		skillsSyncInFlight = true;
		let stage = "Starting";
		let percent = 0;
		let spin = 0;
		const paint = () => {
			const spinner = SYNC_SPINNER[spin % SYNC_SPINNER.length];
			const line = `${spinner} skills ${progressBar(percent)} ${stage}`;
			ctx.ui.setStatus("skills-sync", ctx.ui.theme.fg("muted", line));
		};
		paint();
		const timer = setInterval(() => {
			spin += 1;
			paint();
		}, 120);

		try {
			const result = await syncSkillsFromGitHub({
				force,
				onProgress: (p) => {
					stage = p.stage;
					percent = p.percent;
					paint();
				},
			});
			if (!result.ok) {
				ctx.ui.notify(result.error ? `${result.message}\n${result.error}` : result.message, "error");
				return;
			}

			ctx.ui.notify(result.message, "info");
			if (result.updated) {
				ctx.ui.notify(
					"Skills updated. Changes to loaded skill index apply fully after restarting neuroloop.",
					"info",
				);
			}
		} finally {
			clearInterval(timer);
			ctx.ui.setStatus("skills-sync", undefined);
			skillsSyncInFlight = false;
		}
	}

	// ── Parsers ───────────────────────────────────────────────────────────────

	/** "scanning" / "connecting" / "disconnected" → device not live yet. */
	function isExgConnected(json: Record<string, unknown>): boolean {
		if (!json.ok) return false;
		const notReady = new Set(["scanning", "connecting", "disconnected"]);
		const state = (json.device as Record<string, unknown> | undefined)?.state;
		return !(typeof state === "string" && notReady.has(state));
	}

	/** Parse metrics from a full `status` response (scores nested under .scores). */
	function parseExgMetrics(json: Record<string, unknown>): ExgMetrics {
		const s = (json.scores ?? {}) as Record<string, unknown>;
		const b = (s.bands   ?? {}) as Record<string, unknown>;
		const num = (v: unknown) => (typeof v === "number" ? v : undefined);
		return {
			focus:          num(s.focus),
			cognitive_load: num(s.cognitive_load),
			relaxation:     num(s.relaxation),
			engagement:     num(s.engagement),
			drowsiness:     num(s.drowsiness),
			mood:           num(s.mood),
			hr:             num(s.hr),
			bands: {
				rel_delta: num(b.rel_delta),
				rel_theta: num(b.rel_theta),
				rel_alpha: num(b.rel_alpha),
				rel_beta:  num(b.rel_beta),
				rel_gamma: num(b.rel_gamma),
			},
		};
	}

	/**
	 * Merge a `scores` broadcast event into the current metrics.
	 * The stream event is flat (no nested .scores / .bands) and omits
	 * slow-window fields (cognitive_load, drowsiness, mood) that only
	 * appear in the full status snapshot — those are kept from last snapshot.
	 */
	function mergeScoresEvent(ev: Record<string, unknown>): void {
		const num = (v: unknown) => (typeof v === "number" ? v : undefined);
		const prev = exgMetrics ?? {};
		exgMetrics = {
			...prev,
			focus:      num(ev.focus)      ?? prev.focus,
			relaxation: num(ev.relaxation) ?? prev.relaxation,
			engagement: num(ev.engagement) ?? prev.engagement,
			hr:         num(ev.hr)         ?? prev.hr,
			bands: {
				rel_delta: num(ev.rel_delta) ?? prev.bands?.rel_delta,
				rel_theta: num(ev.rel_theta) ?? prev.bands?.rel_theta,
				rel_alpha: num(ev.rel_alpha) ?? prev.bands?.rel_alpha,
				rel_beta:  num(ev.rel_beta)  ?? prev.bands?.rel_beta,
				rel_gamma: num(ev.rel_gamma) ?? prev.bands?.rel_gamma,
			},
		};
		exgOnline    = true;
		exgUpdatedAt = Date.now();
	}

	// ── Render helpers ────────────────────────────────────────────────────────

	function timeAgo(ts: number): string {
		const s = Math.round((Date.now() - ts) / 1000);
		if (s < 60)   return `${s}s ago`;
		if (s < 3600) return `${Math.round(s / 60)}m ago`;
		return `${Math.round(s / 3600)}h ago`;
	}

	/**
	 * Pick a ThemeColor for a 0–1 score.
	 * @param higherIsBetter  true → high is green; false → low is green
	 */
	function scoreColor(val: number, higherIsBetter: boolean): ThemeColor {
		const norm = higherIsBetter ? val : 1 - val;
		if (norm >= 0.65) return "success";
		if (norm >= 0.35) return "warning";
		return "error";
	}

	/** Color for heart rate (bpm): 55–90 normal, outside = warning/error. */
	function hrColor(bpm: number): ThemeColor {
		if (bpm >= 55 && bpm <= 90)  return "success";
		if (bpm >= 45 && bpm <= 110) return "warning";
		return "error";
	}

	/** Filled/empty bar chars. */
	const BAR_FILLED = "█";
	const BAR_EMPTY  = "░";

	/** Band bar "███░░░" with a fixed per-band color, width = 10. */
	function bandBar(theme: Theme, val: number | undefined, color: ThemeColor, barWidth = 10): string {
		if (val == null) return theme.fg("dim", BAR_EMPTY.repeat(barWidth));
		const filled = Math.min(barWidth, Math.round(val * barWidth * 3));
		const empty  = Math.max(0, barWidth - filled);
		return theme.fg(color, BAR_FILLED.repeat(filled)) + theme.fg("dim", BAR_EMPTY.repeat(empty));
	}

	/** Full-width dim separator line. */
	function sep(theme: Theme, width: number): string {
		return theme.fg("dim", "─".repeat(width));
	}

	// Distinct color per frequency band (δ slow → γ fast).
	const BAND_COLORS: Record<string, ThemeColor> = {
		delta: "accent",     // blue   — deep / slow
		theta: "warning",    // yellow — drowsy / creative
		alpha: "success",    // green  — relaxed / calm
		beta:  "error",      // red    — active / alert
		gamma: "syntaxType", // teal   — high cognition
	};

	// ── 4a. Custom header ────────────────────────────────────────────────────

	function buildHeader(_tui: TUI, theme: Theme) {
		const versionLine = () => {
			if (runtimeVersionsLoading) return theme.fg("dim", " versions: checking npm/github …");
			if (!runtimeVersions) return theme.fg("dim", " versions: unavailable");
			const nl = runtimeVersions.neuroloop;
			const ns = runtimeVersions.neuroskill;
			const gh = runtimeVersions.github;
			const nlStatus = nl.npmLatest
				? (nl.upToDate ? theme.fg("success", "latest") : theme.fg("warning", "update available"))
				: theme.fg("dim", "npm ?");
			const nsStatus = ns.npmLatest
				? (ns.upToDate ? theme.fg("success", "latest") : theme.fg("warning", "updating"))
				: theme.fg("dim", "npm ?");
			const ghCommit = gh.latestCommit ? gh.latestCommit : "?";
			const ghTag = gh.latestTag ?? "?";
			return " "
				+ theme.fg("dim", `neuroloop v${nl.local}`)
				+ theme.fg("dim", " · npm ") + theme.fg("muted", `v${nl.npmLatest ?? "?"}`) + theme.fg("dim", " (") + nlStatus + theme.fg("dim", ")")
				+ theme.fg("dim", " · neuroskill local ") + theme.fg("muted", `v${ns.localInstalled ?? "none"}`)
				+ theme.fg("dim", " / npm ") + theme.fg("muted", `v${ns.npmLatest ?? "?"}`) + theme.fg("dim", " (") + nsStatus + theme.fg("dim", ")")
				+ theme.fg("dim", ` · github ${ghCommit} · release ${ghTag}`);
		};
		// Only the essential shortcuts — keeps the hint row under ~120 chars.
		const hints: [string, string][] = [
			["esc",       "stop"],
			["ctrl+d",    "quit"],
			["shift+tab", "think"],
			["ctrl+l",    "model"],
			["ctrl+o",    "tools"],
			["/key",      "api key"],
			["/exg",      "exg"],
			["/exg-session",  "metrics"],
			["/sleep",    "sleep"],
			["!",         "shell"],
		];

		return {
			invalidate() {},
			render(width: number): string[] {
				const lines: string[] = [];

				// ── row 1: ◆ brand ─────────────────────────────────────────
				const logo = theme.fg("accent", "◆") + " " + theme.bold("neuroloop")
					+ theme.fg("dim", ` v${_pkgVersion}`);
				lines.push(truncateToWidth(logo, width));
				lines.push(truncateToWidth(versionLine(), width));

				// ── row 3: keybinding hints ─────────────────────────────────
				const hintStr = hints
					.map(([k, a]) =>
						theme.fg("dim", "[") + theme.fg("muted", k) + theme.fg("dim", "] ") + theme.fg("dim", a))
					.join(theme.fg("dim", "  "));
				lines.push(truncateToWidth(" " + hintStr, width));

				// ── row 4: separator ────────────────────────────────────────
				lines.push(sep(theme, width));

				return lines;
			},
		};
	}

	// ── 4b. WebSocket client ─────────────────────────────────────────────────

	/** Discover the neuroskill server port (cross-platform). */
	async function discoverExgPort(): Promise<number> {
		const port = await discoverSkillServer();
		return port ?? getSkillPort();
	}

	function connectExgWs(): void {
		if (!exgEnabled) return;
		if (exgWs) return; // already connecting or open

		const url = `ws://127.0.0.1:${exgWsPort}`;
		let ws: InstanceType<typeof WS>;
		try {
			ws = new WS(url);
		} catch {
			scheduleExgReconnect();
			return;
		}
		exgWs = ws;

		ws.on("open", () => {
			// Immediate full snapshot for initial metrics + device state + last label.
			ws.send(JSON.stringify({ command: "status" }));
			// Then poll every exgPollMs for live updates.
			stopExgPoll();
			exgPollTimer = setInterval(() => {
				if (exgWs?.readyState === WS.OPEN) {
					exgWs.send(JSON.stringify({ command: "status" }));
				}
			}, exgPollMs);
		});

		ws.on("message", (raw) => {
			let msg: Record<string, unknown>;
			try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; }
			catch { return; }

			const event = msg.event as string | undefined;

			if (event === "scores") {
				// ~5-second epoch: flat fields, real-time bands + focus + hr
				mergeScoresEvent(msg);
				uiTui?.requestRender();
				return;
			}

			if (event === "label_created") {
				const text      = String(msg.text ?? "");
				const createdAt = Number(msg.created_at ?? Date.now() / 1000);
				exgLastLabel = { text, createdAt };
				uiTui?.requestRender();
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `⬡ **label** "${text}"`,
					display: true,
					details: undefined,
				});
				return;
			}

			// Full status response (command === "status")
			if (msg.command === "status") {
				const wasOnline = exgOnline;
				exgOnline = isExgConnected(msg);
				if (exgOnline) {
					exgMetrics   = parseExgMetrics(msg);
					exgUpdatedAt = Date.now();
				}
				// Grab most recent label from snapshot
				const recent = ((msg.labels as Record<string, unknown> | undefined)?.recent) as
					Array<{ text: string; created_at: number }> | undefined;
				if (recent?.[0]) {
					exgLastLabel = { text: recent[0].text, createdAt: recent[0].created_at };
				}
				if (exgOnline !== wasOnline || exgOnline) uiTui?.requestRender();
			}
		});

		ws.on("error", () => { /* close follows */ });

		ws.on("close", () => {
			stopExgPoll();
			exgWs     = null;
			exgOnline = false;
			uiTui?.requestRender();
			scheduleExgReconnect();
		});
	}

	function stopExgPoll(): void {
		if (exgPollTimer) { clearInterval(exgPollTimer); exgPollTimer = null; }
	}

	function scheduleExgReconnect(delayMs = 5_000): void {
		if (exgWsReconnectTimer) return;
		exgWsReconnectTimer = setTimeout(() => {
			exgWsReconnectTimer = null;
			if (exgEnabled) connectExgWs();
		}, delayMs);
	}

	function disconnectExgWs(): void {
		stopExgPoll();
		if (exgWsReconnectTimer) { clearTimeout(exgWsReconnectTimer); exgWsReconnectTimer = null; }
		if (exgAgoTimer)         { clearInterval(exgAgoTimer);        exgAgoTimer        = null; }
		exgWs?.close();
		exgWs = null;
	}

	// ── 4c. session_start ─────────────────────────────────────────────────────

	pi.on("session_start", (_event, ctx) => {
		if (!skillsSyncShown && process.env.NEUROLOOP_SKILLS_SYNC_STATUS) {
			const ok = process.env.NEUROLOOP_SKILLS_SYNC_OK === "1";
			ctx.ui.notify(
				`Skills sync: ${process.env.NEUROLOOP_SKILLS_SYNC_STATUS}`,
				ok ? "info" : "warning",
			);
			skillsSyncShown = true;
		}

		const changelog = changelogSinceLastShown(_pkgVersion);
		if (changelog) {
			pi.sendMessage({
				customType: NEUROSKILL_STATUS_TYPE,
				content: changelog,
				display: true,
				details: undefined,
			});
			writeChangelogState({ lastShownVersion: _pkgVersion });
		}

		if (!runtimeVersions && !runtimeVersionsLoading) {
			runtimeVersionsLoading = true;
			refreshRuntimeVersions(_pkgVersion)
				.then((state) => {
					runtimeVersions = state;
					uiTui?.requestRender();
				})
				.finally(() => {
					runtimeVersionsLoading = false;
					uiTui?.requestRender();
				});
		}
		ctx.ui.setHeader((tui, theme) => {
			uiTui = tui;
			// Discover port once, then open WebSocket (reconnects automatically).
			discoverExgPort().then((port) => {
				exgWsPort = port;
				connectExgWs();
			});
			// Re-render every 30 s so "X ago" stays fresh between score events.
			exgAgoTimer = setInterval(() => tui.requestRender(), 30_000);
			return buildHeader(tui, theme);
		});

		ctx.ui.setFooter((tui, theme, footerData) => {
			uiTui = tui;
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const lines: string[] = [];

					// ── EXG metrics (when enabled + connected) ──────────────
					if (exgEnabled && exgOnline && exgMetrics) {
						const m = exgMetrics;

						// separator above metrics
						lines.push(sep(theme, width));

						// scores row — fixed 4-char value width for alignment
						const sc = (label: string, val: number | undefined, better: "high" | "low") => {
							if (val == null) return "";
							return theme.fg("dim", label) + " "
								+ theme.fg(scoreColor(val, better === "high"), val.toFixed(2));
						};
						const hrPart = m.hr != null
							? theme.fg("dim", "♥ ") + theme.fg(hrColor(m.hr), `${Math.round(m.hr)} bpm`)
							: "";
						const scores = [
							sc("focus",    m.focus,          "high"),
							sc("cog.load", m.cognitive_load, "low"),
							sc("relax",    m.relaxation,     "high"),
							sc("engage",   m.engagement,     "high"),
							sc("drowsy",   m.drowsiness,     "low"),
							sc("mood",     m.mood,           "high"),
							hrPart,
						].filter(Boolean).join(theme.fg("dim", "   "));
						lines.push(truncateToWidth(" " + scores, width));

						// band bars row
						const b = m.bands ?? {};
						const bar = (label: string, val: number | undefined, color: ThemeColor) =>
							theme.fg("dim", label + " ") + bandBar(theme, val, color);

						const bandParts = [
							bar("δ", b.rel_delta, BAND_COLORS.delta),
							bar("θ", b.rel_theta, BAND_COLORS.theta),
							bar("α", b.rel_alpha, BAND_COLORS.alpha),
							bar("β", b.rel_beta,  BAND_COLORS.beta),
							bar("γ", b.rel_gamma, BAND_COLORS.gamma),
						].join("   ");

						// last label (right-aligned on the same row as bands)
						const labelStr = exgLastLabel
							? theme.fg("dim", `⬡ "${exgLastLabel.text}"  ${timeAgo(exgLastLabel.createdAt * 1000)}`)
							: "";

						const bandW  = visibleWidth(" " + bandParts);
						const labelW = visibleWidth(labelStr);
						const spacer = Math.max(1, width - bandW - labelW);
						lines.push(truncateToWidth(" " + bandParts + " ".repeat(spacer) + labelStr, width));
					}

					// ── status bar: cwd · EXG · context · model ─────────────
					const branch = footerData.getGitBranch();
					const left   = theme.fg("muted", ctx.cwd)
						+ (branch ? " " + theme.fg("dim", `(${branch})`) : "");

					const dot     = exgOnline ? theme.fg("success", "◉") : theme.fg("dim", "◌");
					const ago     = exgUpdatedAt ? theme.fg("dim", ` ${timeAgo(exgUpdatedAt)}`) : "";
					const exgPart = exgEnabled
						? dot + " " + theme.fg("dim", "EXG") + ago
						: theme.fg("dim", "◌ EXG off");

					const usage   = ctx.getContextUsage();
					const ctxPart = usage?.percent != null
						? theme.fg("dim", `${usage.percent.toFixed(1)}%/${Math.round(usage.contextWindow / 1000)}k`)
						: "";
					const modelPart = ctx.model?.id ? theme.fg("dim", ctx.model.id) : "";

					const right = [exgPart, ctxPart, modelPart].filter(Boolean).join(theme.fg("dim", "  "));
					const gap   = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
					lines.push(truncateToWidth(left + " ".repeat(gap) + right, width));

					return lines;
				},
			};
		});

		ctx.ui.setWorkingMessage("🧠 thinking…");
	});

	pi.on("session_shutdown", (_event, sessionCtx) => {
		disconnectExgWs();
		sessionCtx.ui.setHeader(undefined);
		sessionCtx.ui.setFooter(undefined);
	});

	// ── 4d. No-op: WS stream keeps metrics live; agent turns need no extra poll ─
	// (kept so the before_agent_start contract is fulfilled if needed)
	pi.on("before_agent_start", () => {
		// If WS is closed for some reason, poke a reconnect.
		if (exgEnabled && !exgWs) connectExgWs();
	});

	// ── 4e. Compress agent responses ─────────────────────────────────────────
	pi.on("after_agent_finish", (event) => {
		if (compressionSettings.mode === "off") return;
		
		// Compress the agent's response
		if (event.response && typeof event.response === "string") {
			event.response = compressText(event.response, compressionSettings.mode);
		} else if (event.response && Array.isArray(event.response)) {
			// Handle array of content parts
			event.response = event.response.map((part) => {
				if (part.type === "text" && typeof part.text === "string") {
					return { ...part, text: compressText(part.text, compressionSettings.mode) };
				}
				return part;
			});
		}
	});

	// ── 4e. /settings — configure compression and other options ─────────────
	pi.registerCommand("settings", {
		description: "Configure NeuroLoop settings · /settings [compression <mode>]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub   = parts[0]?.toLowerCase() ?? "";

			// ── compression ────────────────────────────────────────────────────────
			if (sub === "compression") {
				const mode = (parts[1]?.toLowerCase() as CompressionMode) ?? "standard";
				if (mode !== "standard" && mode !== "strong" && mode !== "off") {
					handlerCtx.ui.notify(
						"Usage: /settings compression <standard|strong|off>",
						"warning"
					);
					return;
				}
				compressionSettings.mode = mode;
				saveCompressionSettings(compressionSettings);
				handlerCtx.ui.notify(
					`Compression mode set to ${getCompressionModeName(mode)}.`,
					"info"
				);
				return;
			}

			// ── show current settings ─────────────────────────────────────────────
			const lines: string[] = ["Current NeuroLoop settings:"];
			lines.push(`  Compression: ${getCompressionModeName(compressionSettings.mode)}`);
			handlerCtx.ui.notify(lines.join("\n"), "info");
		},
	});

	// ── 4f. /key — add / list / remove API provider keys ────────────────────
	//
	//  /key              → interactive: pick provider, enter API key
	//  /key list         → show which providers are configured
	//  /key remove       → interactive: pick a configured provider to remove
	//  /key remove <id>  → directly remove a specific provider key

	/** Known API-key providers with their auth.json id and display name. */
	const KEY_PROVIDERS: Array<{ id: string; displayName: string; envVar: string }> = [
		{ id: "google",     displayName: "Google Gemini",      envVar: "GEMINI_API_KEY"      },
		{ id: "anthropic",  displayName: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY"   },
		{ id: "openai",     displayName: "OpenAI (GPT)",       envVar: "OPENAI_API_KEY"      },
		{ id: "mistral",    displayName: "Mistral AI",         envVar: "MISTRAL_API_KEY"     },
		{ id: "groq",       displayName: "Groq",               envVar: "GROQ_API_KEY"        },
		{ id: "xai",        displayName: "xAI (Grok)",         envVar: "XAI_API_KEY"         },
		{ id: "openrouter", displayName: "OpenRouter",         envVar: "OPENROUTER_API_KEY"  },
		{ id: "cerebras",   displayName: "Cerebras",           envVar: "CEREBRAS_API_KEY"    },
	];

	pi.registerCommand("key", {
		description: "Manage API provider keys · /key [list|remove [<provider>]]",
		handler: async (args, handlerCtx) => {
			const authStorage = handlerCtx.modelRegistry.authStorage;
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub   = parts[0]?.toLowerCase() ?? "";

			// ── list ─────────────────────────────────────────────────────────
			if (sub === "list") {
				const lines: string[] = ["Configured API providers:"];
				for (const p of KEY_PROVIDERS) {
					const stored = authStorage.has(p.id);
					const envSet = !!process.env[p.envVar];
					const status = stored ? "✓ stored" : envSet ? "  (env)" : "  –";
					lines.push(`  ${status}  ${p.displayName}  (id: ${p.id})`);
				}
				// Also list any stored providers outside the known list
				const storedAll = authStorage.list();
				const knownIds  = new Set(KEY_PROVIDERS.map((p) => p.id));
				for (const id of storedAll) {
					if (!knownIds.has(id)) lines.push(`  ✓ stored  ${id}  (custom)`);
				}
				handlerCtx.ui.notify(lines.join("\n"), "info");
				return;
			}

			// ── remove ────────────────────────────────────────────────────────
			if (sub === "remove") {
				const targetId = parts[1]?.toLowerCase();
				let providerId: string | undefined;

				if (targetId) {
					providerId = targetId;
				} else {
					// Interactive: pick from stored providers
					const storedIds = authStorage.list();
					if (!storedIds.length) {
						handlerCtx.ui.notify("No API keys stored — nothing to remove.", "warning");
						return;
					}
					const choices = storedIds.map((id) => {
						const known = KEY_PROVIDERS.find((p) => p.id === id);
						return known ? `${known.displayName} (${id})` : id;
					});
					const choice = await handlerCtx.ui.select("Remove API Key", choices);
					if (!choice) return; // user cancelled
					// Extract the id: if it's "Display (id)" take the part in parens
					const match = choice.match(/\(([^)]+)\)$/);
					providerId = match ? match[1] : choice;
				}

				if (!authStorage.has(providerId)) {
					handlerCtx.ui.notify(`No stored key for provider "${providerId}".`, "warning");
					return;
				}
				authStorage.remove(providerId);
				handlerCtx.ui.notify(`Removed API key for "${providerId}".`, "info");
				return;
			}

			// ── add (default, no sub-command) ─────────────────────────────────
			// Build display list: mark already-configured providers
			const choices = KEY_PROVIDERS.map((p) => {
				const configured = authStorage.has(p.id) || !!process.env[p.envVar];
				const mark = configured ? "✓ " : "  ";
				return `${mark}${p.displayName}`;
			});

			const choice = await handlerCtx.ui.select("Select API Provider", choices);
			if (!choice) return; // user cancelled

			// Map back to the provider
			const idx      = choices.indexOf(choice);
			const provider = KEY_PROVIDERS[idx];
			if (!provider) return;

			// Prompt for the key
			const apiKey = await handlerCtx.ui.input(
				`Enter API key for ${provider.displayName}`,
				`Paste your ${provider.envVar} here`,
			);
			if (!apiKey?.trim()) {
				handlerCtx.ui.notify("No key entered — cancelled.", "warning");
				return;
			}

			// Persist to ~/.neuroloop/auth.json
			authStorage.set(provider.id, { type: "api_key", key: apiKey.trim() });
			handlerCtx.ui.notify(
				`✓ API key saved for ${provider.displayName}.\n` +
				`Switch to a ${provider.displayName} model with /model or Ctrl+L.`,
				"info",
			);
		},
	});

	// /model-config — add/open custom models.json from TUI
	pi.registerCommand("model-config", {
		description: "Manage custom model config · /model-config [add|open|path|show]",
		handler: async (args, handlerCtx) => {
			const sub = args.trim().toLowerCase();

			if (sub === "path") {
				handlerCtx.ui.notify(`models.json path: ${MODEL_CONFIG_PATH}`, "info");
				return;
			}

			if (sub === "show") {
				const file = readModelsFile();
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## models.json\n\n\`\`\`json\n${JSON.stringify(file, null, 2)}\n\`\`\``,
					display: true,
					details: undefined,
				});
				return;
			}

			if (sub === "open") {
				try {
					writeModelsFile(readModelsFile());
					await openModelsFileInSystem();
					handlerCtx.ui.notify("Opened models.json in your system editor.", "info");
				} catch (err) {
					handlerCtx.ui.notify(err instanceof Error ? err.message : String(err), "error");
				}
				return;
			}

			if (sub && sub !== "add") {
				handlerCtx.ui.notify("Usage: /model-config [add|open|path|show]", "warning");
				return;
			}

			const provider = (await handlerCtx.ui.input("Provider id", "e.g. openrouter, lmstudio, vllm"))?.trim();
			if (!provider) return;
			const baseUrl = (await handlerCtx.ui.input("Base URL", "e.g. http://localhost:1234/v1"))?.trim();
			if (!baseUrl) return;
			const api = (await handlerCtx.ui.select("API type", ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"]))?.trim();
			if (!api) return;
			const apiKey = ((await handlerCtx.ui.input("API key value / env var name", "e.g. OPENROUTER_API_KEY")) ?? "").trim() || "DUMMY_KEY";
			const modelId = (await handlerCtx.ui.input("Model id", "e.g. gpt-4o-mini"))?.trim();
			if (!modelId) return;
			const modelName = (await handlerCtx.ui.input("Model display name (optional)", "leave blank to use id"))?.trim();
			const reasoning = ((await handlerCtx.ui.select("Reasoning model?", ["no", "yes"])) ?? "no") === "yes";
			const supportsVision = ((await handlerCtx.ui.select("Supports image input?", ["no", "yes"])) ?? "no") === "yes";
			const contextWindow = Number((await handlerCtx.ui.input("Context window", "128000")) ?? "128000");
			const maxTokens = Number((await handlerCtx.ui.input("Max output tokens", "16384")) ?? "16384");

			upsertProviderModel({
				provider,
				baseUrl,
				api,
				apiKey,
				authHeader: true,
				modelId,
				modelName,
				reasoning,
				supportsVision,
				contextWindow: Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : 128000,
				maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 16384,
			});

			handlerCtx.modelRegistry.refresh();
			handlerCtx.ui.notify(`Saved ${provider}/${modelId} to models.json. Open /model to use it.`, "info");
		},
	});

	// ── 4f. /exg — snapshot or live-panel control ─────────────────────────────
	pi.registerCommand("exg", {
		description: "EXG panel · /exg [on|off|<seconds>|port <n>]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().toLowerCase().split(/\s+/);
			const arg   = parts[0] ?? "";

			if (arg === "off") {
				exgEnabled = false;
				disconnectExgWs();
				exgOnline  = false;
				exgMetrics = null;
				uiTui?.requestRender();
				handlerCtx.ui.notify("EXG live panel disabled  (/exg on to re-enable)", "info");
				return;
			}

			if (arg === "on") {
				exgEnabled = true;
				connectExgWs();
				handlerCtx.ui.notify(`EXG live panel enabled  (poll: ${exgPollMs}ms)`, "info");
				return;
			}

			if (arg === "port" && parts[1]) {
				const port = parseInt(parts[1], 10);
				if (isNaN(port) || port < 1 || port > 65535) {
					handlerCtx.ui.notify("Invalid port number", "error");
					return;
				}
				disconnectExgWs();
				exgWsPort = port;
				setSkillPort(port); // persist for neuroskill CLI + next launch
				connectExgWs();
				handlerCtx.ui.notify(`EXG connecting on port ${port} (saved)`, "info");
				return;
			}

			const secs = parseFloat(arg);
			if (!isNaN(secs) && secs > 0) {
				exgPollMs = Math.round(secs * 1000);
				// Restart the poll timer at the new rate if socket is open.
				stopExgPoll();
				if (exgWs?.readyState === WS.OPEN) {
					exgPollTimer = setInterval(() => {
						if (exgWs?.readyState === WS.OPEN) exgWs.send(JSON.stringify({ command: "status" }));
					}, exgPollMs);
				}
				handlerCtx.ui.notify(`EXG poll interval set to ${secs}s`, "info");
				return;
			}

			// No arg or unrecognised → show snapshot in chat
			const result = await runNeuroSkill(["status"]);
			if (result.ok && result.text) {
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## 🧠 EXG Snapshot\n${result.text}`,
					display: true,
					details: undefined,
				});
			} else {
				handlerCtx.ui.notify("NeuroSkill server not reachable", "error");
			}
		},
	});

	// ── 4g. /neuro — run any neuroskill subcommand ────────────────────────────

	pi.registerCommand("neuro", {
		description: "Run a neuroskill subcommand: /neuro <cmd> [args…]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			if (!parts.length) {
				handlerCtx.ui.notify("Usage: /neuro <subcommand> [args…]", "warning");
				return;
			}
			const result = await runNeuroSkill(parts);
			if (result.ok && result.text) {
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## neuroskill ${parts.join(" ")}\n\`\`\`\n${result.text}\n\`\`\``,
					display: true,
					details: undefined,
				});
			} else {
				handlerCtx.ui.notify(result.text || "neuroskill command failed", "error");
			}
		},
	});

	// /skills-update — force refresh skills from GitHub immediately
	pi.registerCommand("skills-update", {
		description: "Force update skill files from GitHub",
		handler: async (_args, handlerCtx) => {
			await runSkillsSyncWithTui(handlerCtx, true);
		},
	});

	// /version — show neuroloop/neuroskill/npm/github version status
	pi.registerCommand("version", {
		description: "Show local, npm, and GitHub version status · /version [refresh]",
		handler: async (args, handlerCtx) => {
			const shouldRefresh = args.trim().toLowerCase() === "refresh";
			if (shouldRefresh || !runtimeVersions) {
				runtimeVersionsLoading = true;
				uiTui?.requestRender();
				try {
					runtimeVersions = await refreshRuntimeVersions(_pkgVersion);
				} finally {
					runtimeVersionsLoading = false;
					uiTui?.requestRender();
				}
			}

			const s = runtimeVersions;
			if (!s) {
				handlerCtx.ui.notify("Version status unavailable.", "warning");
				return;
			}

			const nl = s.neuroloop;
			const ns = s.neuroskill;
			const gh = s.github;
			const lines = [
				"## 📦 Version Status",
				`- neuroloop local: **v${nl.local}**`,
				`- neuroloop npm latest: **v${nl.npmLatest ?? "?"}** (${nl.upToDate ? "latest" : "update available"})`,
				`- neuroskill local runtime: **v${ns.localInstalled ?? "none"}**`,
				`- neuroskill npm latest: **v${ns.npmLatest ?? "?"}** (${ns.upToDate ? "latest" : "update available"})`,
				`- github latest commit: **${gh.latestCommit ?? "?"}**`,
				`- github latest release: **${gh.latestTag ?? "?"}**`,
			];
			if (nl.updateError) lines.push(`- neuroloop auto-update error: \`${nl.updateError}\``);
			if (ns.installError) lines.push(`- neuroskill local install error: \`${ns.installError}\``);

			pi.sendMessage({
				customType: NEUROSKILL_STATUS_TYPE,
				content: lines.join("\n"),
				display: true,
				details: undefined,
			});
		},
	});

	// /updates — show unseen changelog entries in TUI
	pi.registerCommand("updates", {
		description: "Show changelog updates in chat · /updates [all|reset]",
		handler: async (args, handlerCtx) => {
			const sub = args.trim().toLowerCase();
			if (sub === "reset") {
				writeChangelogState({});
				handlerCtx.ui.notify("Changelog state reset. New updates will be shown on next launch.", "info");
				return;
			}

			if (!existsSync(CHANGELOG_PATH)) {
				handlerCtx.ui.notify("CHANGELOG.md not found.", "warning");
				return;
			}

			if (sub === "all") {
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: readFileSync(CHANGELOG_PATH, "utf8"),
					display: true,
					details: undefined,
				});
				return;
			}

			const unseen = changelogSinceLastShown(_pkgVersion);
			if (!unseen) {
				handlerCtx.ui.notify("No unseen changelog updates.", "info");
				return;
			}

			pi.sendMessage({
				customType: NEUROSKILL_STATUS_TYPE,
				content: unseen,
				display: true,
				details: undefined,
			});
			writeChangelogState({ lastShownVersion: _pkgVersion });
		},
	});

	// ── 4g′. Convenience neuroskill commands ──────────────────────────────────
	//
	// Thin wrappers around common neuroskill subcommands so users don't have to
	// remember "/neuro session 0" — they just type "/exg-session".
	//
	// Helper: run neuroskill args, display result in chat or notify on error.
	async function neuroCmd(
		cmdArgs: string[],
		title: string,
		handlerCtx: { ui: { notify(msg: string, level?: "error" | "warning" | "info"): void } },
	): Promise<void> {
		const result = await runNeuroSkill(cmdArgs);
		if (result.ok && result.text) {
			pi.sendMessage({
				customType: NEUROSKILL_STATUS_TYPE,
				content: `## ${title}\n\`\`\`\n${result.text}\n\`\`\``,
				display: true,
				details: undefined,
			});
		} else {
			handlerCtx.ui.notify(result.error ?? "neuroskill command failed", "error");
		}
	}

	// /exg-session [index] — current or Nth session metrics
	pi.registerCommand("exg-session", {
		description: "Session metrics · /exg-session [index]  (0 = latest)",
		handler: async (args, handlerCtx) => {
			const idx = args.trim() || "0";
			await neuroCmd(["session", idx], `📊 Session ${idx}`, handlerCtx);
		},
	});

	// /sessions — list all recorded sessions
	pi.registerCommand("sessions", {
		description: "List all recorded EXG sessions",
		handler: async (_args, handlerCtx) => {
			await neuroCmd(["sessions"], "📋 Sessions", handlerCtx);
		},
	});

	// /sleep [index] — sleep staging summary
	pi.registerCommand("sleep", {
		description: "Sleep staging · /sleep [index]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			await neuroCmd(["sleep", ...parts], "😴 Sleep", handlerCtx);
		},
	});

	// /compare — session comparison (uses cache / warns about cost)
	pi.registerCommand("compare", {
		description: "Compare last two sessions (slow ~60 s, uses cache)",
		handler: async (_args, handlerCtx) => {
			handlerCtx.ui.notify("Running compare — this may take up to 60 s …", "info");
			await neuroCmd(["compare"], "🔀 Session Comparison", handlerCtx);
		},
	});

	// /health [sub] — HealthKit data
	pi.registerCommand("health", {
		description: "HealthKit · /health [sleep|workouts|hr|steps|summary|metrics …]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			await neuroCmd(["health", ...parts], "🏥 Health" + (parts.length ? ` — ${parts[0]}` : ""), handlerCtx);
		},
	});

	// /label <text> [--context <ctx>] — create a timestamped annotation
	pi.registerCommand("label", {
		description: "Label this EXG moment · /label <text> [--context <ctx>]",
		handler: async (args, handlerCtx) => {
			const text = args.trim();
			if (!text) {
				handlerCtx.ui.notify("Usage: /label <text> [--context <context>]", "warning");
				return;
			}
			// Pass the whole arg string through shell-style so --context works
			const parts = args.trim().split(/\s+/).filter(Boolean);
			await neuroCmd(["label", ...parts], `⬡ Label`, handlerCtx);
		},
	});

	// /labels <query> — semantic search over EXG annotations
	pi.registerCommand("labels", {
		description: "Search labels · /labels <query> [--k <n>]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			if (!parts.length) {
				handlerCtx.ui.notify("Usage: /labels <search query> [--k <n>]", "warning");
				return;
			}
			await neuroCmd(["search-labels", ...parts], "🔍 Labels", handlerCtx);
		},
	});

	// /hooks [sub] — proactive hook rules
	pi.registerCommand("hooks", {
		description: "Hooks · /hooks [list|add|remove|enable|disable|update|suggest|log]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			await neuroCmd(["hooks", ...parts], "🪝 Hooks", handlerCtx);
		},
	});

	// /dnd [on|off] — Do Not Disturb
	pi.registerCommand("dnd", {
		description: "Do Not Disturb · /dnd [on|off]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			await neuroCmd(["dnd", ...parts], "🔕 DND", handlerCtx);
		},
	});

	// /say <text> — speak aloud via on-device TTS
	pi.registerCommand("say", {
		description: "Speak text aloud · /say <text> [--voice <name>]",
		handler: async (args, handlerCtx) => {
			const text = args.trim();
			if (!text) {
				handlerCtx.ui.notify("Usage: /say <text> [--voice <name>]", "warning");
				return;
			}
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const result = await runNeuroSkill(["say", ...parts]);
			if (result.ok) {
				handlerCtx.ui.notify("🔊 Speaking …", "info");
			} else {
				handlerCtx.ui.notify(result.error ?? "TTS failed", "error");
			}
		},
	});

	// /notify <title> [body] — send an OS notification
	pi.registerCommand("notify", {
		description: "OS notification · /notify <title> [body]",
		handler: async (args, handlerCtx) => {
			const text = args.trim();
			if (!text) {
				handlerCtx.ui.notify("Usage: /notify <title> [body]", "warning");
				return;
			}
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const result = await runNeuroSkill(["notify", ...parts]);
			if (result.ok) {
				handlerCtx.ui.notify("📬 Notification sent", "info");
			} else {
				handlerCtx.ui.notify(result.error ?? "notify failed", "error");
			}
		},
	});

	// /calibrate — start calibration
	pi.registerCommand("calibrate", {
		description: "Start EXG calibration sequence",
		handler: async (_args, handlerCtx) => {
			await neuroCmd(["calibrate"], "🎯 Calibration", handlerCtx);
		},
	});

	// /llm [sub] — on-device LLM management (Skill app)
	//
	//  /llm                → status of the Skill LLM server
	//  /llm status         → same as above
	//  /llm route          → show active inference route + fallbacks
	//  /llm start          → load active model and start inference server
	//  /llm stop           → stop inference server and free GPU memory
	//  /llm list           → list models in the catalog with download states
	//  /llm add <repo> <filename> [--mmproj <file>]  → add an external HF model
	//  /llm remove <filename>     → delete a locally-cached model
	//  /llm select <filename>     → set active text model
	//  /llm edit <filename> [key=value …] → (reserved / not yet implemented)
	//  /llm download <filename>   → start downloading a model
	//  /llm fit            → check which models fit in available RAM/VRAM
	//  /llm chat "msg"     → single-shot LLM chat
	//  /llm connect [remote|local|auto] → start skill LLM via WS and register provider, then fallback
	//  /llm *              → pass through to neuroskill llm <sub>
	pi.registerCommand("llm", {
		description: "LLM control · /llm [status|route|connect|start|stop|list|add|remove|select|download|fit|chat …]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub = (parts[0] ?? "status").toLowerCase();

			// ── route ────────────────────────────────────────────────
			if (sub === "route") {
				const llmStatus = await runNeuroSkill(["llm", "status"]);
				let skillRoute: string | null = null;
				if (llmStatus.ok && llmStatus.data) {
					const data = llmStatus.data as Record<string, unknown>;
					const status = String(data.status ?? "").toLowerCase();
					if (status === "running" || status === "ok") {
						const mode = typeof data.mode === "string"
							? data.mode
							: (typeof data.backend === "string"
								? data.backend
								: (typeof data.remote === "boolean" ? (data.remote ? "remote" : "local") : ""));
						skillRoute = `skill-llm${mode ? ` (${mode})` : ""}`;
					}
				}

				const authStorage = handlerCtx.modelRegistry.authStorage;
				const cloudProviders = KEY_PROVIDERS
					.filter((p) => authStorage.has(p.id) || !!process.env[p.envVar])
					.map((p) => p.id);

				let ollamaOnline = false;
				try {
					const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(1200) });
					ollamaOnline = res.ok;
				} catch {
					ollamaOnline = false;
				}

				const active = skillRoute ?? cloudProviders[0] ?? (ollamaOnline ? "ollama" : "none detected");
				const fallbacks = [
					...cloudProviders.filter((p) => p !== active),
					...(ollamaOnline && active !== "ollama" ? ["ollama"] : []),
					...(active !== "skill-llm (local)" ? ["skill-llm(local)"] : []),
				].join(" → ") || "none";

				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## 🧭 LLM Route\nactive: **${active}**\nfallbacks: ${fallbacks}`,
					display: true,
					details: undefined,
				});
				return;
			}

			// ── status ───────────────────────────────────────────────
			if (sub === "status" || parts.length === 0) {
				const result = await runNeuroSkill(["llm", "status"]);
				if (result.ok) {
					const data = result.data as Record<string, unknown> | undefined;
					const status  = data?.status ?? "unknown";
					const model   = data?.model_name ?? data?.model ?? "–";
					const nCtx    = data?.n_ctx ?? "–";
					const vision  = data?.supports_vision ? "yes" : "no";
					const lines = [
						`**Status:** ${status}`,
						`**Model:** ${model}`,
						`**Context:** ${nCtx} tokens`,
						`**Vision:** ${vision}`,
					];
					pi.sendMessage({
						customType: NEUROSKILL_STATUS_TYPE,
						content: `## 🤖 LLM Server\n${lines.join("\n")}`,
						display: true,
						details: undefined,
					});
				} else {
					handlerCtx.ui.notify(result.error ?? "LLM status failed", "error");
				}
				return;
			}

			// ── connect [remote|local|auto] ─────────────────────────
			if (sub === "connect") {
				const modeArg = (parts[1] ?? "auto").toLowerCase();
				const mode = (modeArg === "remote" || modeArg === "local" || modeArg === "auto")
					? modeArg
					: "auto";
				handlerCtx.ui.notify(`Connecting Skill LLM (${mode}) …`, "info");
				const started = await startSkillLlmServer(mode);
				if (!started.ok) {
					handlerCtx.ui.notify(started.message, "error");
					return;
				}
				const registered = await registerSkillLlmProvider(handlerCtx.modelRegistry as unknown as { registerProvider: (id: string, cfg: unknown) => void });
				handlerCtx.ui.notify(started.message, "info");
				if (registered) {
					handlerCtx.ui.notify("Skill LLM provider connected. Select it with /model (Ctrl+L).", "info");
				} else {
					handlerCtx.ui.notify("LLM server started but provider registration failed. Check /llm status.", "warning");
				}
				return;
			}

			// ── start ────────────────────────────────────────────────
			if (sub === "start") {
				handlerCtx.ui.notify("Starting LLM server — loading model …", "info");
				await neuroCmd(["llm", "start"], "🤖 LLM — start", handlerCtx);
				return;
			}

			// ── stop ─────────────────────────────────────────────────
			if (sub === "stop") {
				await neuroCmd(["llm", "stop"], "🤖 LLM — stop", handlerCtx);
				return;
			}

			// ── list (alias for catalog) ─────────────────────────────
			if (sub === "list" || sub === "catalog") {
				const result = await runNeuroSkill(["llm", "catalog"]);
				if (result.ok) {
					const data = result.data as Record<string, unknown> | undefined;
					const entries = (data?.entries ?? []) as Array<Record<string, unknown>>;
					const active  = data?.active_model ?? "–";
					const mmproj  = data?.active_mmproj ?? "–";
					if (!entries.length) {
						handlerCtx.ui.notify("Model catalog is empty. Use /llm add to add a model.", "warning");
						return;
					}
					const lines = entries.map((e) => {
						const mark = e.filename === active ? "▶ " : "  ";
						const state = e.state ?? e.status ?? "";
						const size  = e.size_gb ? `${e.size_gb} GB` : "";
						const quant = e.quant ?? "";
						return `${mark}**${e.filename}**  ${quant}  ${size}  \`${state}\``;
					});
					const header = `Active: **${active}** · mmproj: **${mmproj}**`;
					pi.sendMessage({
						customType: NEUROSKILL_STATUS_TYPE,
						content: `## 🤖 LLM Catalog\n${header}\n\n${lines.join("\n")}`,
						display: true,
						details: undefined,
					});
				} else {
					handlerCtx.ui.notify(result.error ?? "LLM catalog failed", "error");
				}
				return;
			}

			// ── add <repo> <filename> [--mmproj <file>] ──────────────
			if (sub === "add") {
				if (parts.length < 2) {
					handlerCtx.ui.notify(
						"Usage: /llm add <repo> <filename> [--mmproj <file>]\n" +
						"   or: /llm add <hf-url>",
						"warning",
					);
					return;
				}
				await neuroCmd(["llm", ...parts], "🤖 LLM — add", handlerCtx);
				return;
			}

			// ── remove / delete <filename> ───────────────────────────
			if (sub === "remove" || sub === "delete") {
				const filename = parts[1];
				if (!filename) {
					handlerCtx.ui.notify("Usage: /llm remove <filename>", "warning");
					return;
				}
				await neuroCmd(["llm", "delete", filename], "🤖 LLM — delete", handlerCtx);
				return;
			}

			// ── select <filename> ────────────────────────────────────
			if (sub === "select") {
				const filename = parts[1];
				if (!filename) {
					handlerCtx.ui.notify("Usage: /llm select <filename>", "warning");
					return;
				}
				await neuroCmd(["llm", "select", filename], "🤖 LLM — select", handlerCtx);
				return;
			}

			// ── download <filename> ──────────────────────────────────
			if (sub === "download") {
				const filename = parts[1];
				if (!filename) {
					handlerCtx.ui.notify("Usage: /llm download <filename>", "warning");
					return;
				}
				handlerCtx.ui.notify(`Downloading ${filename} — poll /llm list for progress`, "info");
				await neuroCmd(["llm", "download", filename], "🤖 LLM — download", handlerCtx);
				return;
			}

			// ── edit (reserved — show help) ──────────────────────────
			if (sub === "edit") {
				handlerCtx.ui.notify(
					"Model editing is managed from the Skill app UI (Settings → LLM).\n" +
					"Use /llm select <filename> to change the active model,\n" +
					"or /llm add / /llm remove to manage the catalog.",
					"info",
				);
				return;
			}

			// ── fit ──────────────────────────────────────────────────
			if (sub === "fit") {
				await neuroCmd(["llm", "fit"], "🤖 LLM — hardware fit", handlerCtx);
				return;
			}

			// ── fallthrough: pass any other sub-command to neuroskill ──
			await neuroCmd(["llm", ...parts], "🤖 LLM" + (parts.length ? ` — ${sub}` : ""), handlerCtx);
		},
	});

	// /screenshots [query] — search screenshots
	pi.registerCommand("screenshots", {
		description: "Search screenshots · /screenshots [query | --by-image <path>]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			if (!parts.length) {
				// Default: screenshots for current EEG session
				await neuroCmd(["screenshots-for-eeg"], "📸 Screenshots (EEG session)", handlerCtx);
			} else {
				await neuroCmd(["search-images", ...parts], "📸 Screenshots", handlerCtx);
			}
		},
	});

	// /timer — start focus timer
	pi.registerCommand("timer", {
		description: "Start focus timer",
		handler: async (_args, handlerCtx) => {
			await neuroCmd(["timer"], "⏱️ Timer", handlerCtx);
		},
	});

	// /umap — 3D UMAP projection
	pi.registerCommand("umap", {
		description: "3D UMAP projection of EXG data",
		handler: async (_args, handlerCtx) => {
			await neuroCmd(["umap"], "🗺️ UMAP", handlerCtx);
		},
	});

	// /listen [--seconds <n>] — stream broadcast events
	pi.registerCommand("listen", {
		description: "Stream live EXG events · /listen [--seconds <n>]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			await neuroCmd(["listen", ...parts], "📡 Live Stream", handlerCtx);
		},
	});

	// ── 4h. ctrl+shift+e — quick EXG snapshot ────────────────────────────────

	pi.registerShortcut("ctrl+shift+e", {
		description: "Show live EXG snapshot in chat",
		handler: async (handlerCtx) => {
			const result = await runNeuroSkill(["status"]);
			if (result.ok && result.text) {
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## 🧠 EXG Snapshot\n${result.text}`,
					display: true,
					details: undefined,
				});
			} else {
				handlerCtx.ui.notify("NeuroSkill server not reachable", "error");
			}
		},
	});
}
