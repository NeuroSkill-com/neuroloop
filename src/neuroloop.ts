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
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

declare const __NEUROLOOP_VERSION__: string;
import type { ExtensionAPI, Theme, ThemeColor, ToolDefinition } from "@mariozechner/pi-coding-agent";

import WS from "ws";
import { runNeuroSkill, selectContextualData, warmCompareInBackground } from "./neuroskill/index.ts";
import { MEMORY_PATH, readMemory, writeMemory } from "./memory.ts";
import { webFetchTool } from "./tools/web-fetch.ts";
import { webSearchTool } from "./tools/web-search.ts";
import { runProtocolTool } from "./tools/protocol.ts";

const AGENT_DIR = join(homedir(), ".neuroskill");
const NEUROLOOP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEUROLOOP_MD_PATH = join(NEUROLOOP_DIR, "NEUROLOOP.md");

const NEUROSKILL_STATUS_TYPE = "neuroskill-status";

// ---------------------------------------------------------------------------
// Calibration prompt throttle — remind the user to calibrate at most once/day
// ---------------------------------------------------------------------------
const CALIBRATION_PROMPT_STATE_PATH = join(AGENT_DIR, "last_calibration_prompt.json");
const CALIBRATION_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
			"utf8",
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
  search-labels <query>              → semantic search over EXG annotations
  interactive <keyword>              → 4-layer cross-modal graph search
  label <text>                       → create a timestamped annotation
  search [--k <n>]                   → ANN EXG-similarity search
  compare                            → ⚠ EXPENSIVE (~60 s, heavy compute). Avoid unless the user explicitly asks to compare sessions. Prefer session/sessions for trend questions. Use the prewarm tool first when compare will be needed soon.
  sleep [index]                      → sleep staging summary
  umap                               → 3D UMAP projection
  listen [--seconds <n>]             → stream broadcast events
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
	let exgOnline     = false;
	let exgMetrics: ExgMetrics | null = null;
	let exgUpdatedAt: number | null   = null;
	let exgLastLabel: { text: string; createdAt: number } | null = null;
	let uiTui: TUI | null = null;

	// WebSocket state
	let exgWs:               InstanceType<typeof WS> | null = null;
	let exgWsPort:           number = 8375;   // discovered once, then reused
	let exgWsReconnectTimer: ReturnType<typeof setTimeout>  | null = null;
	let exgPollTimer:        ReturnType<typeof setInterval> | null = null; // status poll
	let exgAgoTimer:         ReturnType<typeof setInterval> | null = null; // "ago" refresh
	let exgPollMs:           number = 1_000;  // default 1 s; user-configurable

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
		// Only the essential shortcuts — keeps the hint row under ~120 chars.
		const hints: [string, string][] = [
			["esc",       "stop"],
			["ctrl+d",    "quit"],
			["shift+tab", "think"],
			["ctrl+l",    "model"],
			["ctrl+o",    "tools"],
			["/exg",      "exg"],
			["!",         "shell"],
		];

		return {
			invalidate() {},
			render(width: number): string[] {
				const lines: string[] = [];

				// ── row 1: ◆ brand ─────────────────────────────────────────
				const logo = theme.fg("accent", "◆") + " " + theme.bold("neuroloop")
					+ theme.fg("dim", ` v${__NEUROLOOP_VERSION__}`);
				lines.push(truncateToWidth(logo, width));

				// ── row 2: keybinding hints ─────────────────────────────────
				const hintStr = hints
					.map(([k, a]) =>
						theme.fg("dim", "[") + theme.fg("muted", k) + theme.fg("dim", "] ") + theme.fg("dim", a))
					.join(theme.fg("dim", "  "));
				lines.push(truncateToWidth(" " + hintStr, width));

				// ── row 3: separator ────────────────────────────────────────
				lines.push(sep(theme, width));

				return lines;
			},
		};
	}

	// ── 4b. WebSocket client ─────────────────────────────────────────────────

	/** Discover the neuroskill server port via lsof; fall back to 8375. */
	function discoverExgPort(): Promise<number> {
		return new Promise((resolve) => {
			exec(
				"lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -i neuroskill | head -1",
				(_, stdout) => {
					const m = stdout.match(/:(\d{4,5})\s/);
					resolve(m ? parseInt(m[1], 10) : 8375);
				},
			);
		});
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

	// ── 4e. /exg — snapshot or live-panel control ─────────────────────────────
	//
	//  /exg              → show full snapshot in chat
	//  /exg on           → re-enable live panel + reconnect WS
	//  /exg off          → disable live panel + disconnect WS
	//  /exg <n>          → set poll interval to n seconds (e.g. /exg 0.5)
	//  /exg port <n>     → change server port and reconnect

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
				connectExgWs();
				handlerCtx.ui.notify(`EXG connecting on port ${port}`, "info");
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

	// ── 4f. /neuro — run any neuroskill subcommand ────────────────────────────

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

	// ── 4g. ctrl+shift+e — quick EXG snapshot ────────────────────────────────

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
