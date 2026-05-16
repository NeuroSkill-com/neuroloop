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

import {
	initTheme, wrapTheme, symbols, getActiveTheme, setActiveTheme, BUILTIN_THEMES,
	evaluateToasts, resetToastCooldowns, setSmartToastsEnabled, isSmartToastsEnabled,
	createCommandPalette, type PaletteCommand,
	createRenderScheduler, type RenderScheduler,
	createExgPanel, pushHistory, clearHistory, type ExgPanel,
	createOverlayManager, type OverlayManager,
	renderLogo, renderTagline,
	createLlmPanel, type LlmPanel, type LlmModelEntry,
} from "./tui/index.ts";

const _pkgVersion: string =
	(typeof __NEUROLOOP_VERSION__ !== "undefined" ? __NEUROLOOP_VERSION__ : undefined) ??
	(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")) as { version: string }).version;

import WS from "ws";
import { runNeuroSkill, createLabel, selectContextualData, warmCompareInBackground, getSkillPort, setSkillPort, discoverSkillServer, checkAuthStatus, getAuthStatus, getDaemonTokenPath } from "./neuroskill/index.ts";
import { syncSkillsFromGitHub } from "./skills-sync.ts";
import { getRuntimeVersionState, refreshRuntimeVersions, type RuntimeVersionState } from "./runtime-updates.ts";
import { registerSkillLlmProvider, startSkillLlmServer, getSkillServerBaseUrl, authHeaders } from "./skill-llm.ts";
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
// Compact text formatter for status JSON — saves tokens vs raw JSON
// ---------------------------------------------------------------------------

function formatStatusText(d: Record<string, any>): string {
	const lines: string[] = [];
	const r = (v: number, dec = 1) => typeof v === "number" ? v.toFixed(dec) : "–";

	// Device
	if (d.device) {
		const dev = d.device;
		lines.push(`**Device** ${dev.name ?? "unknown"} · ${dev.state ?? "?"} · battery ${r(dev.battery, 0)}% · ${dev.eeg_samples ?? 0} EEG samples`);
	}

	// Session
	if (d.session) {
		const s = d.session;
		const dur = s.duration_secs != null ? `${Math.floor(s.duration_secs / 60)}m${s.duration_secs % 60}s` : "?";
		lines.push(`**Session** duration ${dur}`);
	}

	// Scores (key metrics only)
	if (d.scores) {
		const s = d.scores;
		const items: string[] = [];
		const add = (label: string, key: string, dec = 1) => { if (s[key] != null) items.push(`${label} ${r(s[key], dec)}`); };
		add("focus", "focus"); add("relax", "relaxation"); add("engage", "engagement");
		add("meditation", "meditation"); add("drowsiness", "drowsiness"); add("mood", "mood");
		add("cog.load", "cognitive_load"); add("snr", "snr");
		if (items.length) lines.push(`**Scores** ${items.join(" · ")}`);

		// Bands (relative %)
		const bands: string[] = [];
		const addB = (sym: string, key: string) => { if (s[key] != null) bands.push(`${sym} ${(s[key] * 100).toFixed(1)}%`); };
		addB("δ", "rel_delta"); addB("θ", "rel_theta"); addB("α", "rel_alpha"); addB("β", "rel_beta"); addB("γ", "rel_gamma");
		if (bands.length) lines.push(`**Bands** ${bands.join(" · ")}`);

		// Ratios (compact)
		const ratios: string[] = [];
		const addR = (label: string, key: string, dec = 2) => { if (s[key] != null && s[key] !== 0) ratios.push(`${label} ${r(s[key], dec)}`); };
		addR("FAA", "faa"); addR("TAR", "tar"); addR("BAR", "bar"); addR("TBR", "tbr");
		addR("DTR", "dtr"); addR("PSE", "pse"); addR("APF", "apf", 1);
		addR("coherence", "coherence"); addR("SEF95", "sef95", 1); addR("laterality", "laterality_index");
		if (ratios.length) lines.push(`**Ratios** ${ratios.join(" · ")}`);

		// Complexity
		const cx: string[] = [];
		const addC = (label: string, key: string, dec = 3) => { if (s[key] != null && s[key] !== 0) cx.push(`${label} ${r(s[key], dec)}`); };
		addC("Hjorth-act", "hjorth_activity", 1); addC("Hjorth-mob", "hjorth_mobility");
		addC("Hjorth-cplx", "hjorth_complexity"); addC("perm.ent", "permutation_entropy");
		addC("Higuchi", "higuchi_fd"); addC("DFA", "dfa_exponent"); addC("samp.ent", "sample_entropy");
		addC("PAC-θγ", "pac_theta_gamma");
		if (cx.length) lines.push(`**Complexity** ${cx.join(" · ")}`);

		// Per-channel summary (dominant band only)
		if (Array.isArray(s.channels) && s.channels.length > 0) {
			const chSummary = s.channels.map((ch: any) =>
				`${ch.channel}:${ch.dominant_symbol ?? ch.dominant ?? "?"}`
			).join(" ");
			lines.push(`**Channels** ${chSummary}`);
		}

		// Consciousness / headache / migraine
		const extra: string[] = [];
		const addE = (label: string, key: string, dec = 1) => { if (s[key] != null) extra.push(`${label} ${r(s[key], dec)}`); };
		addE("consciousness", "consciousness_integration");
		addE("wakefulness", "consciousness_wakefulness");
		addE("LZC", "consciousness_lzc");
		addE("headache", "headache_index");
		addE("migraine", "migraine_index");
		if (extra.length) lines.push(`**Neuro** ${extra.join(" · ")}`);
	}

	// Embeddings
	if (d.embeddings) {
		lines.push(`**Embeddings** total ${d.embeddings.total ?? 0}`);
	}

	return lines.join("\n");
}

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

		// Get status: prefer the already-open WS connection (instant),
		// fall back to the neuroskill CLI (slower, may timeout).
		let statusResult: { ok: boolean; data?: any } = { ok: false };

		if (exgWs && exgWs.readyState === WS.OPEN) {
			// CLI failed — try direct WS status command on our existing connection.
			try {
				const wsData = await new Promise<Record<string, unknown>>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("ws status timeout")), 5000);
					const handler = (raw: { toString(): string }) => {
						try {
							const m = JSON.parse(raw.toString()) as Record<string, unknown>;
							if ((m as any).command === "status") {
								clearTimeout(timeout);
								exgWs!.off("message", handler);
								resolve(m);
							}
						} catch {}
					};
					exgWs!.on("message", handler);
					exgWs!.send(JSON.stringify({ command: "status" }));
				});
				statusResult = { ok: true, data: wsData as any };
			} catch { /* fall through to CLI */ }
		}

		// Fall back to CLI only if WS didn't work
		if (!statusResult.ok) {
			statusResult = await runNeuroSkill(["--json", "status"]);
		}

		if (statusResult.ok && statusResult.data) {
			// Compact human-readable summary for the chat bubble (saves tokens).
			const summary = formatStatusText(statusResult.data as Record<string, any>);
			displaySections.push(`## 🧠 Current State\n${summary}`);
			// LLM gets the same compact summary — raw JSON wastes too many tokens.
			systemSections.push(`## Current EXG State\n${summary}`);

			// Contextual extras keyed off the user's prompt.
			const extra = await selectContextualData(event.prompt);
			displaySections.push(...extra);
			systemSections.push(...extra);
		} else if (exgOnline) {
			// WS is connected (EXG live) but CLI status failed — daemon is up, just CLI hiccup
			displaySections.push("## 🧠 NeuroSkill™\n_Connected — live EXG data available._");
			systemSections.push("## 🧠 NeuroSkill™\n_Connected — live EXG data available. Use neuroskill_run tool for queries._");
		} else {
			let unavailable: string;
			if (getAuthStatus() === "local") {
				unavailable =
					"## 🧠 NeuroSkill™\n_Daemon not running. Start it with:_ `npm run daemon`\n" +
					"Use the `neuroskill_run` tool to query once it comes online.";
			} else {
				unavailable =
					"## 🧠 NeuroSkill™\n_Not connected to a NeuroSkill server. Use `/connect` to set up._\n" +
					"Use the `neuroskill_run` tool to query once it comes online.";
			}
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
			const result = await createLabel(params.text, params.context);
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
		label: "NeuroSkill™",
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
  history stats                      → recording history stats
  history daily [--limit <days>]     → daily recording minutes
  history find --start <utc>         → find session CSV for a timestamp
  history delete <csv_path>          → delete a session file
  metrics --start <utc> --end <utc>  → session metrics for a time range
  timeseries --start <utc> --end <utc> → timeseries data (band powers, scores)
  sleep-stages --start <utc> --end <utc> → sleep stage epochs
  csv-metrics <csv_path>             → metrics for a single CSV file
  day-metrics <paths>                → aggregated metrics for multiple CSVs
  location <csv_path> --start --end  → GPS location points for a session
  embedding-count --start --end      → count EEG embeddings in a time range
  labels list                        → list all labels
  labels update <id> "text"          → update label text/context
  labels delete <id>                 → delete a label
  labels search-by-eeg --start --end → find labels near EEG embeddings
  labels index-stats                 → label HNSW index statistics
  labels rebuild-index               → rebuild label HNSW indices
  index stats                        → global EEG search index stats
  index rebuild                      → rebuild global search index
  settings <key> [json]              → get/set daemon settings (filter, storage, tts, inference, overlap, gpu, ...)
  activity bands                     → latest EEG band powers
  activity window                    → current active window
  models status|config|catalog       → EXG model management
  models reembed                     → trigger label/embedding reprocessing
  screenshots config|metrics|ocr-status|dir → screenshot pipeline status
  skills list|sync|disabled          → skills management
  web-cache stats|list|clear         → web cache management
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
			// Split command on whitespace so "hooks add" becomes ["hooks", "add"]
			const cmdParts = (params.command as string).trim().split(/\s+/);
			const args = [...cmdParts, ...(params.args ?? [])];
			// Route label commands through createLabel to avoid NOT NULL constraint bug
			if (cmdParts[0] === "label") {
				const ctxIdx = args.indexOf("--context");
				const ctx = ctxIdx >= 0 ? args[ctxIdx + 1] : undefined;
				// Text is everything between "label" and the first flag
				const textParts: string[] = [];
				for (let i = 1; i < args.length; i++) {
					if (args[i].startsWith("--")) break;
					textParts.push(args[i]);
				}
				const result = await createLabel(textParts.join(" "), ctx);
				if (!result.ok) {
					return {
						content: [{ type: "text" as const, text: `neuroskill error: ${result.error}` }],
						details: { command: params.command, error: result.error },
					};
				}
				const output = result.data !== undefined ? JSON.stringify(result.data, null, 2) : (result.text ?? "");
				return {
					content: [{ type: "text" as const, text: output }],
					details: { command: params.command, args: params.args },
				};
			}
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

	// NOTE: Ctrl+K clears terminal on Mac/Linux, Ctrl+E is editor line-end,
	// Ctrl+L is model selector — all conflict with built-in shortcuts.
	// Overlays are accessible via /commands (command palette), /exg, /llm.

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
	let skillsSyncLastAt: Date | null = null;
	let skillsSyncTimer: ReturnType<typeof setInterval> | null = null;
	const SKILLS_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
	let exgOnline     = false;
	let exgConnecting = false;
	let exgConnectSpin = 0;
	let exgConnectSpinTimer: ReturnType<typeof setInterval> | null = null;
	let exgMetrics: ExgMetrics | null = null;
	let exgUpdatedAt: number | null   = null;
	let exgLastLabel: { text: string; createdAt: number } | null = null;
	let exgDeviceName: string | null = null;
	let exgDeviceKind: string | null = null;
	let exgDeviceChannels = 0;
	let exgDeviceRate = 0;
	let uiTui: TUI | null = null;
	let uiNotify: ((msg: string, level?: "info" | "warning" | "error") => void) | null = null;
	let sessionModelRegistry: { registerProvider: (id: string, cfg: unknown) => void } | null = null;
	let compressionSettings = loadCompressionSettings();

	// ── TUI overlay state ────────────────────────────────────────────────────
	let renderScheduler: RenderScheduler | null = null;
	let overlayManager: OverlayManager | null = null;
	let commandPalette: ReturnType<typeof createCommandPalette> | null = null;
	let exgPanel: ExgPanel | null = null;
	let llmPanel: LlmPanel | null = null;
	let overlayKeyCleanup: (() => void) | null = null;

	// Initialize theme from persisted preference
	initTheme();

	// Show ASCII art logo only on first render, then collapse to compact
	let logoShown = false;

	// LLM download progress (rendered in footer)
	interface LlmDownloadEntry { filename: string; progress: number; state: string }
	let llmDownloads: LlmDownloadEntry[] = [];
	let llmDownloadSpin = 0;
	let llmDownloadPollTimer: ReturnType<typeof setInterval> | null = null;

	let llmDownloadPollInFlight = false;

	function startLlmDownloadPoll(): void {
		if (llmDownloadPollTimer) return;
		llmDownloadPollTimer = setInterval(async () => {
			// Guard against overlapping polls (fetch can take > 2 s)
			if (llmDownloadPollInFlight) return;
			llmDownloadPollInFlight = true;
			try {
				const baseUrl = await getSkillServerBaseUrl();
				const res = await fetch(`${baseUrl}/v1/llm/downloads`, {
					headers: authHeaders(), signal: AbortSignal.timeout(3000),
				});
				if (!res.ok) return;
				const downloads = (await res.json()) as Array<{ filename: string; state: string; progress: number; status_msg?: string }>;

				// Check for completions/failures and notify
				for (const prev of llmDownloads) {
					const cur = downloads.find((d) => d.filename === prev.filename);
					if (!cur || cur.state === "downloaded") {
						uiNotify?.(`${prev.filename} downloaded successfully.`, "info");
					} else if (cur.state === "failed" || cur.state === "cancelled") {
						uiNotify?.(`${prev.filename} download ${cur.state}.`, "error");
					}
				}

				// Keep only active downloads
				llmDownloads = downloads
					.filter((d) => d.state === "downloading" || d.state === "paused")
					.map((d) => {
						// Daemon may report progress as 0–1 or 0–100; normalise to 0–100
						let pct = d.progress ?? 0;
						if (pct > 0 && pct <= 1) pct *= 100;
						return { filename: d.filename, progress: pct, state: d.state };
					});
				llmDownloadSpin++;
				uiTui?.requestRender();

				// Stop polling when no active downloads remain
				if (llmDownloads.length === 0) stopLlmDownloadPoll();
			} catch { /* retry next tick */ }
			finally { llmDownloadPollInFlight = false; }
		}, 2000);
	}

	function stopLlmDownloadPoll(): void {
		if (llmDownloadPollTimer) { clearInterval(llmDownloadPollTimer); llmDownloadPollTimer = null; }
		llmDownloads = [];
		uiTui?.requestRender();
	}

	// WebSocket state
	let exgWs:               InstanceType<typeof WS> | null = null;
	let exgWsPort:           number = 18444;  // discovered once, then reused
	let exgWsReconnectTimer: ReturnType<typeof setTimeout>  | null = null;
	let exgPollTimer:        ReturnType<typeof setInterval> | null = null; // status poll
	// exgAgoTimer removed — render scheduling is now handled by RenderScheduler
	let exgPollMs:           number = 1_000;  // default 1 s; user-configurable

	const SYNC_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

	function progressBar(percent: number, width = 14): string {
		const p = Math.max(0, Math.min(100, Math.round(percent)));
		const filled = Math.round((p / 100) * width);
		return `[${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}] ${p}%`;
	}

	async function runSkillsSyncWithTui(
		ctx: { ui: { setStatus: (key: string, value: string | undefined) => void; notify: (msg: string, level?: "info" | "warning" | "error") => void; theme: Theme } },
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

			skillsSyncLastAt = new Date();
			ctx.ui.notify(
				result.updated
					? `Skills updated at ${skillsSyncLastAt.toLocaleTimeString()}. Restart neuroloop to apply changes to loaded skill index.`
					: `Skills up to date (synced at ${skillsSyncLastAt.toLocaleTimeString()})`,
				"info",
			);
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

	/** Parse metrics from a full `status` response (scores nested under .scores).
	 *  Band powers are available as top-level rel_delta..rel_gamma on the scores
	 *  object (BandSnapshot fields), not under a nested .bands key. */
	function parseExgMetrics(json: Record<string, unknown>): ExgMetrics {
		const s = (json.scores ?? {}) as Record<string, unknown>;
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
				rel_delta: num(s.rel_delta),
				rel_theta: num(s.rel_theta),
				rel_alpha: num(s.rel_alpha),
				rel_beta:  num(s.rel_beta),
				rel_gamma: num(s.rel_gamma),
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
			focus:          num(ev.focus)          ?? prev.focus,
			cognitive_load: num(ev.cognitive_load) ?? prev.cognitive_load,
			relaxation:     num(ev.relaxation)     ?? prev.relaxation,
			engagement:     num(ev.engagement)     ?? prev.engagement,
			drowsiness:     num(ev.drowsiness)     ?? prev.drowsiness,
			mood:           num(ev.mood)           ?? prev.mood,
			hr:             num(ev.hr)             ?? prev.hr,
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

		// Smart toast notifications for notable brain state events
		if (uiNotify && exgMetrics) {
			evaluateToasts(exgMetrics, uiNotify);
		}

		// Push to history for sparklines in the EXG sidebar panel
		if (exgMetrics) {
			pushHistory({ ...exgMetrics, ts: exgUpdatedAt });
		}
	}

	// ── Render helpers ────────────────────────────────────────────────────────

	function timeAgo(ts: number): string {
		const s = Math.round((Date.now() - ts) / 1000);
		if (s <= 5)   return "";
		if (s < 60)   return `${s}s ago`;
		if (s < 3600) return `${Math.round(s / 60)}m ago`;
		if (s < 86400) return `${Math.round(s / 3600)}h ago`;
		return `${Math.round(s / 86400)}d ago`;
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

	/** Band bar "███░░░" with a fixed per-band color, width = 10.
	 *  `scale` is the max value among the displayed bands (δ–γ),
	 *  so bars are always relative to each other — not squished by
	 *  high_gamma dominating the total power. */
	function bandBar(theme: Theme, val: number | undefined, color: ThemeColor, scale: number, barWidth = 10): string {
		if (val == null || scale <= 0) return theme.fg("dim", BAR_EMPTY.repeat(barWidth));
		const norm = val / scale;  // 0..1 relative to the strongest displayed band
		const filled = Math.min(barWidth, Math.round(norm * barWidth));
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

	function buildHeader(_tui: TUI, baseTheme: Theme) {
		const theme = wrapTheme(baseTheme);
		const s = symbols();
		// Only the 5 most important shortcuts — keeps the hint row clean.
		const hints: [string, string][] = [
			["esc",       "stop"],
			["ctrl+d",    "quit"],
			["/help",     "commands"],
			["/exg",      "brain"],
			["/connect",  "server"],
			["/llm",      "models"],
		];

		return {
			invalidate() {},
			render(width: number): string[] {
				const lines: string[] = [];

				// ── ASCII art logo (first render only) or compact logo ────
				const authSt = getAuthStatus();
				let connDot: string;
				if (exgOnline) {
					if (authSt === "local")       connDot = theme.fg("success", " ●") + theme.fg("dim", " Local");
					else if (authSt === "lan")    connDot = theme.fg("warning", " ●") + theme.fg("dim", " LAN");
					else if (authSt === "remote") connDot = theme.fg("accent", " ●") + theme.fg("dim", " Remote");
					else                          connDot = theme.fg("success", " ●") + theme.fg("dim", " Connected");
				} else if (exgConnecting) {
					const spinner = SYNC_SPINNER[exgConnectSpin % SYNC_SPINNER.length];
					connDot = theme.fg("warning", ` ${spinner}`) + theme.fg("dim", " Connecting…");
				} else {
					const lastSeen = exgUpdatedAt ? theme.fg("dim", ` · last seen ${timeAgo(exgUpdatedAt)}`) : "";
					connDot = theme.fg("dim", " ○ Offline") + lastSeen;
				}

				if (!logoShown) {
					// Show full ASCII art logo in pink
					lines.push(""); // top padding
					lines.push(...renderLogo(width, theme));
					lines.push(renderTagline(width, theme, _pkgVersion));
					lines.push(""); // spacing

					// Connection status centered beneath
					const connLine = theme.fg("accent", s.logo) + " " + theme.bold("NeuroLoop™") + connDot;
					const connWidth = visibleWidth(s.logo + " NeuroLoop™") + visibleWidth(connDot);
					const connPad = Math.max(0, Math.floor((width - connWidth) / 2));
					lines.push(truncateToWidth(" ".repeat(connPad) + connLine, width));

					// Collapse after first render (use a short delay so the logo is visible)
					setTimeout(() => { logoShown = true; }, 8_000);
				} else {
					// Compact header: website + brand line
					const website = theme.fg("accent", "🌐") + " " + theme.fg("dim", "https://www.neuroskill.com");
					lines.push(truncateToWidth(website, width));

					const logo = theme.fg("accent", s.logo) + " " + theme.bold("NeuroLoop™")
						+ theme.fg("dim", ` v${_pkgVersion}`) + connDot;
					lines.push(truncateToWidth(logo, width));
				}

				// ── row 2b: device info ──────────────────────────────────
				if (exgOnline && exgDeviceName) {
					const kindMap: Record<string, string> = {
						muse: "BLE", brainbit: "BLE", openbci: "Serial",
						cognionics: "USB", lsl: "LSL", serial: "Serial",
					};
					const isVirtual = exgDeviceName.toLowerCase().includes("virtual");
					const transport = isVirtual ? "Virtual" : (kindMap[exgDeviceKind ?? ""] ?? exgDeviceKind ?? "");
					const chInfo = exgDeviceChannels > 0
						? theme.fg("dim", ` ${exgDeviceChannels}ch`)
						: "";
					const rateInfo = exgDeviceRate > 0
						? theme.fg("dim", ` @ ${Math.round(exgDeviceRate)}Hz`)
						: "";
					const transportTag = transport
						? theme.fg("muted", ` [${transport}]`)
						: "";
					lines.push(truncateToWidth(
						" " + theme.fg("dim", "⎈ ") + theme.fg("accent", exgDeviceName)
						+ transportTag + chInfo + rateInfo,
						width,
					));
				}

				// ── row 3: skills sync status ───────────────────────────
				if (skillsSyncLastAt) {
					const ago = timeAgo(skillsSyncLastAt.getTime()) || "just now";
					const syncLine = " " + theme.bold("NeuroSkill™") + theme.fg("dim", ` skills synced ${ago}`);
					lines.push(truncateToWidth(syncLine, width));
				}

				// ── row 4: keybinding hints ─────────────────────────────────
				const hintStr = hints
					.map(([k, a]) =>
						theme.fg("muted", k) + theme.fg("dim", " " + a))
					.join(theme.fg("dim", " · "));
				lines.push(truncateToWidth(" " + hintStr, width));

				// ── row 5: keybinding hints for overlays ─────────────────────
				const overlayHints = theme.fg("muted", "/exg") + theme.fg("dim", " brain")
					+ theme.fg("dim", " · ") + theme.fg("muted", "/llm") + theme.fg("dim", " models")
					+ theme.fg("dim", " · ") + theme.fg("muted", "/theme") + theme.fg("dim", " colors")
					+ theme.fg("dim", " · ") + theme.fg("muted", "/toasts") + theme.fg("dim", " alerts");
				lines.push(truncateToWidth(" " + overlayHints, width));

				// ── row 6: separator ────────────────────────────────────────
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

	function startConnectSpinner(): void {
		if (exgConnectSpinTimer) return;
		exgConnecting = true;
		exgConnectSpin = 0;
		exgConnectSpinTimer = setInterval(() => {
			exgConnectSpin++;
			uiTui?.requestRender();
		}, 80);
		uiTui?.requestRender();
	}

	function stopConnectSpinner(): void {
		exgConnecting = false;
		if (exgConnectSpinTimer) { clearInterval(exgConnectSpinTimer); exgConnectSpinTimer = null; }
	}

	function connectExgWs(): void {
		if (!exgEnabled) return;
		if (exgWs) return; // already connecting or open

		startConnectSpinner();

		// Load daemon token for WS auth (same file neuroskill CLI reads)
		const wsToken = (() => {
			try {
				const p = getDaemonTokenPath();
				return readFileSync(p, "utf8").trim();
			} catch { return ""; }
		})();
		const tokenParam = wsToken ? `?token=${encodeURIComponent(wsToken)}` : "";
		const url = `ws://127.0.0.1:${exgWsPort}/v1/events${tokenParam}`;
		let ws: InstanceType<typeof WS>;
		try {
			ws = new WS(url);
		} catch {
			scheduleExgReconnect();
			return;
		}
		exgWs = ws;

		ws.on("open", () => {
			stopConnectSpinner();
			exgReconnectAttempt = 0; // reset backoff on successful connect
			uiNotify?.(`Connected to NeuroSkill™ on port ${exgWsPort}`, "info");
			// Check LLM server status — auto-start if stopped and notify user.
			(async () => {
				try {
					const hdrs = authHeaders();
					const baseUrl = await getSkillServerBaseUrl();
					const r = await fetch(`${baseUrl}/v1/llm/server/status`, {
						signal: AbortSignal.timeout(3000), headers: hdrs,
					});
					if (r.ok) {
						const status = (await r.json()) as { status: string; model_name?: string };
						if (status.status === "stopped") {
							uiNotify?.("LLM server is stopped — use /llm start to load a model", "warning");
							// Auto-start: try to start the server so chat works immediately
							try {
								await fetch(`${baseUrl}/v1/llm/server/start`, {
									method: "POST", headers: { ...hdrs, "Content-Type": "application/json" },
									body: "{}", signal: AbortSignal.timeout(5000),
								});
								uiNotify?.("LLM server starting…", "info");
							} catch { /* user can /llm start manually */ }
						} else if (status.status === "running" && status.model_name) {
							uiNotify?.(`LLM: ${status.model_name}`, "info");
						}
					}
				} catch { /* daemon may not support this endpoint */ }
			})();
			// Try to register the LLM provider now that daemon is reachable.
			// Retry a few times since the LLM server may still be loading.
			if (sessionModelRegistry) {
				const reg = sessionModelRegistry;
				(async () => {
					for (let i = 0; i < 5; i++) {
						if (await registerSkillLlmProvider(reg)) return;
						await new Promise((r) => setTimeout(r, 3000));
					}
				})();
			}
			// Subscribe to high-rate events neuroloop actually consumes (band power
			// for the score history). The daemon filters these by default; without
			// this subscribe, neuroloop's score widgets render zeros forever.
			ws.send(JSON.stringify({ command: "subscribe", events: ["EegBands"] }));
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

			// Events can arrive as EventEnvelope {type, payload} or flat {event, ...}
			const eventType = (msg.type ?? msg.event) as string | undefined;
			const payload = (msg.payload ?? msg) as Record<string, unknown>;

			if (eventType === "EegBands" || eventType === "scores") {
				// The daemon now includes top-level rel_delta..rel_gamma
				// (averaged across channels, normalised to δ–γ only).
				// Use those directly; fall back to per-channel averaging
				// for older daemon versions.
				if (typeof payload.rel_delta === "number") {
					mergeScoresEvent(payload);
				} else {
					const channels = payload.channels as Array<Record<string, unknown>> | undefined;
					if (channels?.length) {
						const avg = (key: string) => {
							let sum = 0; let n = 0;
							for (const ch of channels) {
								const v = ch[key];
								if (typeof v === "number") { sum += v; n++; }
							}
							return n > 0 ? sum / n : undefined;
						};
						const absDelta     = avg("delta") ?? 0;
						const absTheta     = avg("theta") ?? 0;
						const absAlpha     = avg("alpha") ?? 0;
						const absBeta      = avg("beta")  ?? 0;
						const absGamma     = avg("gamma") ?? 0;
						const absHighGamma = avg("high_gamma") ?? 0;
						const total = absDelta + absTheta + absAlpha + absBeta + absGamma + absHighGamma;
						const flat: Record<string, unknown> = { ...payload };
						if (total > 0) {
							flat.rel_delta = absDelta / total;
							flat.rel_theta = absTheta / total;
							flat.rel_alpha = absAlpha / total;
							flat.rel_beta  = absBeta  / total;
							flat.rel_gamma = absGamma / total;
						}
						mergeScoresEvent(flat);
					} else {
						mergeScoresEvent(payload);
					}
				}
				if (renderScheduler) renderScheduler.requestDataRender(); else uiTui?.requestRender();
				exgPanel?.refresh();
				return;
			}

			if (eventType === "label_created") {
				const text      = String(payload.text ?? "");
				const createdAt = Number(payload.created_at ?? Date.now() / 1000);
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
					const parsed = parseExgMetrics(msg);
					// Preserve band data from EegBands stream if the status
					// snapshot doesn't include bands (it usually doesn't).
					const prevBands = exgMetrics?.bands;
					if (prevBands && parsed.bands?.rel_delta == null) {
						parsed.bands = prevBands;
					}
					exgMetrics   = parsed;
					exgUpdatedAt = Date.now();
				}
				// Extract device info
				const dev = msg.device as Record<string, unknown> | undefined;
				if (dev) {
					exgDeviceName = (dev.name as string) ?? null;
					exgDeviceKind = (dev.kind as string) ?? null;
					exgDeviceChannels = (dev.eeg_channels as number) ?? 0;
					exgDeviceRate = (dev.eeg_sample_rate as number) ?? 0;
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
			const wasOnline = exgOnline;
			exgWs     = null;
			exgOnline = false;
			if (wasOnline) {
				uiNotify?.(`Disconnected from NeuroSkill™ (port ${exgWsPort})`, "warning");
			} else if (exgReconnectAttempt === 0) {
				uiNotify?.("Could not connect to NeuroSkill™ — retrying…", "error");
			}
			uiTui?.requestRender();
			scheduleExgReconnect();
		});
	}

	function stopExgPoll(): void {
		if (exgPollTimer) { clearInterval(exgPollTimer); exgPollTimer = null; }
	}

	let exgReconnectAttempt = 0;
	function scheduleExgReconnect(): void {
		if (exgWsReconnectTimer) return;
		// Exponential backoff: 500ms, 1s, 2s, 4s, 5s (capped)
		const delay = Math.min(500 * Math.pow(2, exgReconnectAttempt), 5_000);
		exgReconnectAttempt++;
		exgWsReconnectTimer = setTimeout(() => {
			exgWsReconnectTimer = null;
			if (exgEnabled) connectExgWs();
		}, delay);
	}

	function disconnectExgWs(): void {
		stopExgPoll();
		if (exgWsReconnectTimer) { clearTimeout(exgWsReconnectTimer); exgWsReconnectTimer = null; }
		// ago timer now handled by renderScheduler
		exgWs?.close();
		exgWs = null;
	}

	// ── 4c. session_start ─────────────────────────────────────────────────────

	pi.on("session_start", (_event, ctx) => {
		// Clear the terminal once before any output so we start fresh.
		process.stdout.write("\x1b[2J\x1b[H");

		uiNotify = (msg, level) => ctx.ui.notify(msg, level);
		sessionModelRegistry = ctx.modelRegistry as unknown as { registerProvider: (id: string, cfg: unknown) => void };
		if (!skillsSyncShown && process.env.NEUROLOOP_SKILLS_SYNC_STATUS) {
			const ok = process.env.NEUROLOOP_SKILLS_SYNC_OK === "1";
			skillsSyncLastAt = new Date();
			const updated = process.env.NEUROLOOP_SKILLS_SYNC_UPDATED === "1";
			ctx.ui.notify(
				updated
					? `Skills synced at ${skillsSyncLastAt.toLocaleTimeString()}`
					: `Skills up to date (synced at ${skillsSyncLastAt.toLocaleTimeString()})`,
				ok ? "info" : "warning",
			);
			skillsSyncShown = true;
		}

		// Periodic skills sync — runs silently in the background every 10 minutes.
		if (!skillsSyncTimer) {
			skillsSyncTimer = setInterval(async () => {
				if (skillsSyncInFlight) return;
				skillsSyncInFlight = true;
				try {
					const result = await syncSkillsFromGitHub();
					skillsSyncLastAt = new Date();
					if (result.updated && uiNotify) {
						uiNotify(`Skills updated at ${skillsSyncLastAt.toLocaleTimeString()}`, "info");
					}
				} catch {
					// Non-fatal — silent background sync.
				} finally {
					skillsSyncInFlight = false;
				}
			}, SKILLS_SYNC_INTERVAL_MS);
		}

		// First-run welcome — shown only once ever.
		const firstRunMarker = join(AGENT_DIR, ".welcome-shown");
		if (!existsSync(firstRunMarker)) {
			pi.sendMessage({
				customType: NEUROSKILL_STATUS_TYPE,
				content:
					"Welcome to neuroloop! \u{1F9E0}\n\n" +
					"Quick start:\n" +
					"- Connect your EEG device and start Skill app\n" +
					"- Type naturally \u2014 I can see your brain state\n" +
					"- /exg to toggle live metrics \u00B7 /help for all commands\n\n" +
					"Learn more at https://www.neuroskill.com",
				display: true,
				details: undefined,
			});
			mkdirSync(dirname(firstRunMarker), { recursive: true });
			writeFileSync(firstRunMarker, new Date().toISOString(), "utf8");
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
		ctx.ui.setHeader((tui, baseTheme) => {
			uiTui = tui;
			const theme = wrapTheme(baseTheme);

			// ── Render scheduler (replaces blunt 30s timer) ──────────────
			renderScheduler?.stop();
			renderScheduler = createRenderScheduler(tui);
			renderScheduler.start();

			// ── Overlay manager ──────────────────────────────────────────
			overlayManager?.dispose();
			overlayManager = createOverlayManager();
			overlayKeyCleanup?.();
			overlayKeyCleanup = overlayManager.installKeyHandler(tui);

			// ── Command palette (Ctrl+K) ─────────────────────────────────
			commandPalette?.dispose();
			const paletteCommands: PaletteCommand[] = [
				{ name: "exg",           description: "EXG panel on/off/settings" },
				{ name: "connect",       description: "Connect to NeuroSkill server" },
				{ name: "llm",           description: "LLM server management" },
				{ name: "key",           description: "Manage API provider keys" },
				{ name: "model-config",  description: "Custom model configuration" },
				{ name: "config",        description: "NeuroLoop settings" },
				{ name: "theme",         description: "Switch color theme" },
				{ name: "neuro",         description: "Run neuroskill subcommand" },
				{ name: "version",       description: "Show version status" },
				{ name: "updates",       description: "Show changelog updates" },
				{ name: "skills-update", description: "Force sync skills from GitHub" },
				{ name: "calibrate",     description: "Start EXG calibration" },
				{ name: "label",         description: "Create EXG annotation" },
				{ name: "labels",        description: "Label management" },
				{ name: "timer",         description: "Focus timer" },
				{ name: "say",           description: "Text-to-speech" },
				{ name: "notify",        description: "Send OS notification" },
				{ name: "health",        description: "HealthKit data queries" },
				{ name: "sleep",         description: "Sleep staging" },
				{ name: "compare",       description: "Compare EXG sessions" },
				{ name: "toasts",        description: "Toggle brain state notifications" },
				{ name: "help",          description: "Show all commands" },
			];
			commandPalette = createCommandPalette(tui, theme, {
				commands: paletteCommands,
				onSelect: (cmd) => {
					// Send as user message so the command handler picks it up
					if (cmd.action) {
						cmd.action();
					} else {
						pi.sendUserMessage(`/${cmd.name}`);
					}
				},
			});
			overlayManager.register({
				id: "command-palette",
				modal: true,
				show: () => commandPalette?.show(),
				hide: () => commandPalette?.hide(),
				isVisible: () => commandPalette?.isVisible() ?? false,
			});

			// ── EXG sidebar panel (Ctrl+E) ───────────────────────────────
			exgPanel?.dispose();
			exgPanel = createExgPanel(tui, theme, {
				getMetrics: () => exgMetrics ? { ...exgMetrics, ts: exgUpdatedAt ?? Date.now() } : null,
				getOnline: () => exgOnline,
				getDeviceName: () => exgDeviceName,
			});
			overlayManager.register({
				id: "exg-panel",
				modal: false,
				show: () => exgPanel?.show(),
				hide: () => exgPanel?.hide(),
				isVisible: () => exgPanel?.isVisible() ?? false,
			});

			// ── LLM manager panel (Ctrl+L or /llm) ──────────────────────
			llmPanel?.dispose();
			llmPanel = createLlmPanel(tui, theme, {
				fetchCatalog: async () => {
					try {
						const baseUrl = await getSkillServerBaseUrl();
						const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
							headers: authHeaders(), signal: AbortSignal.timeout(5000),
						});
						if (!res.ok) return null;
						const data = (await res.json()) as Record<string, unknown>;
						const raw = (data.entries ?? []) as Array<Record<string, unknown>>;
						const entries: LlmModelEntry[] = raw.map(e => {
							const fname = String(e.filename ?? "");
							// Merge live download progress from the poll tracker
							// (llmDownloads is already normalised to 0–100)
							const live = llmDownloads.find(d => d.filename === fname);
							const state = live?.state ?? String(e.state ?? e.status ?? "not_downloaded");
							// Catalog may report 0–1 or 0–100; live data is always 0–100
							let progress: number | undefined;
							if (live) {
								progress = live.progress;
							} else if (typeof e.progress === "number") {
								progress = e.progress <= 1 && e.progress > 0 ? e.progress * 100 : e.progress;
							}
							return {
								filename:    fname,
								state,
								sizeGb:      typeof e.size_gb === "number" ? e.size_gb : undefined,
								quant:       e.quant ? String(e.quant) : undefined,
								paramsB:     e.params_b ? String(e.params_b) : undefined,
								familyName:  e.family_name ? String(e.family_name) : undefined,
								recommended: !!e.recommended,
								isMmproj:    !!e.is_mmproj,
								progress,
							};
						});
						return {
							entries,
							activeModel:  String(data.active_model ?? "–"),
							activeMmproj: String(data.active_mmproj ?? "–"),
						};
					} catch { return null; }
				},
				fetchStatus: async () => {
					try {
						const baseUrl = await getSkillServerBaseUrl();
						const res = await fetch(`${baseUrl}/v1/llm/server/status`, {
							headers: authHeaders(), signal: AbortSignal.timeout(3000),
						});
						if (!res.ok) return null;
						const data = (await res.json()) as Record<string, unknown>;
						return {
							status:        String(data.status ?? "unknown"),
							modelName:     data.model_name ? String(data.model_name) : undefined,
							nCtx:          typeof data.n_ctx === "number" ? data.n_ctx : undefined,
							supportsVision: !!data.supports_vision,
						};
					} catch { return null; }
				},
				onAction: async (action, filename) => {
					// Run LLM actions directly — never send to the LLM
					const notify = uiNotify ?? (() => {});
					try {
						const baseUrl = await getSkillServerBaseUrl();
						const hdrs = { ...authHeaders(), "Content-Type": "application/json" };

						if (action === "start") {
							notify("Starting LLM server…", "info");
							fetch(`${baseUrl}/v1/llm/server/start`, { method: "POST", headers: hdrs, body: "{}", signal: AbortSignal.timeout(10000) })
								.then(() => notify("LLM server starting — loading model", "info"))
								.catch(e => notify(`Start failed: ${e instanceof Error ? e.message : String(e)}`, "error"));
							return;
						} else if (action === "stop") {
							fetch(`${baseUrl}/v1/llm/server/stop`, { method: "POST", headers: hdrs, signal: AbortSignal.timeout(5000) })
								.then(() => notify("LLM server stopped", "info"))
								.catch(e => notify(`Stop failed: ${e instanceof Error ? e.message : String(e)}`, "error"));
							return;
						} else if (action === "select" && filename) {
							await fetch(`${baseUrl}/v1/llm/select`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(5000) });
							notify(`Active model set to ${filename}`, "info");
						} else if (action === "download" && filename) {
							notify(`Starting download: ${filename}`, "info");
							if (!llmDownloads.find(d => d.filename === filename)) {
								llmDownloads.push({ filename, progress: 0, state: "downloading" });
							}
							startLlmDownloadPoll();
							uiTui?.requestRender();
							// Fire-and-forget REST call
							fetch(`${baseUrl}/v1/llm/download/start`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(10000) })
								.then(r => { if (!r.ok) notify(`Download request failed: HTTP ${r.status}`, "error"); })
								.catch(e => notify(`Download request failed: ${e instanceof Error ? e.message : String(e)}`, "error"));
						} else if (action === "pause" && filename) {
							await fetch(`${baseUrl}/v1/llm/download/pause`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(5000) });
							notify(`${filename}: paused`, "info");
						} else if (action === "resume" && filename) {
							await fetch(`${baseUrl}/v1/llm/download/resume`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(5000) });
							notify(`${filename}: resumed`, "info");
						} else if (action === "connect") {
							notify("Connecting Skill LLM…", "info");
							const started = await startSkillLlmServer("auto");
							notify(started.message, started.ok ? "info" : "error");
							if (started.ok && sessionModelRegistry) {
								await registerSkillLlmProvider(sessionModelRegistry);
							}
						} else if (action === "fit") {
							const result = await runNeuroSkill(["llm", "fit"]);
							if (result.ok && result.text) {
								pi.sendMessage({ customType: NEUROSKILL_STATUS_TYPE, content: `## 📐 LLM Fit\n\`\`\`\n${result.text}\n\`\`\``, display: true, details: undefined });
							} else {
								notify("Failed to check model fit", "error");
							}
						} else if (action === "route") {
							// Show route info as a chat message (read-only, not sent to LLM)
							const llmStatus = await runNeuroSkill(["llm", "status"]);
							let routeInfo = "unknown";
							if (llmStatus.ok && llmStatus.data) {
								const data = llmStatus.data as Record<string, unknown>;
								if (String(data.status ?? "").toLowerCase() === "running") {
									routeInfo = `skill-llm${data.mode ? ` (${data.mode})` : ""}`;
								}
							}
							notify(`LLM route: ${routeInfo}`, "info");
						}
					} catch (e) {
						notify(`LLM action failed: ${e instanceof Error ? e.message : String(e)}`, "error");
					}
				},
			});
			overlayManager.register({
				id: "llm-panel",
				modal: true,
				show: () => llmPanel?.show(),
				hide: () => llmPanel?.hide(),
				isVisible: () => llmPanel?.isVisible() ?? false,
			});

			// ── Global keyboard shortcuts ────────────────────────────────
			// Keyboard shortcuts are registered via registerShortcut() in
			// the extension setup (outside session_start), not via raw
			// addInputListener, to avoid interfering with framework
			// handlers like Ctrl+D (quit) and Ctrl+L (model selector).

			// Check auth/connection status, then discover port and open WebSocket.
			checkAuthStatus().then(() => tui.requestRender());
			discoverExgPort().then((port) => {
				exgWsPort = port;
				connectExgWs();
			});

			return buildHeader(tui, theme);
		});

		ctx.ui.setFooter((tui, baseTheme, footerData) => {
			uiTui = tui;
			const theme = wrapTheme(baseTheme);
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

						// timestamp — prominent so users notice stale data
						const agoRaw = exgUpdatedAt ? timeAgo(exgUpdatedAt) : "";
						const agoStr = agoRaw ? theme.fg("muted", ` ${agoRaw}`) : "";
						lines.push(truncateToWidth(" " + scores + agoStr, width));

						// divider between scores and bands
						lines.push(truncateToWidth(" " + theme.fg("dim", "│"), width));

						// band bars row — scale bars relative to the strongest
						// displayed band (δ–γ) so they're always visible even when
						// high_gamma dominates the total relative power.
						// Show percentage next to each bar to match Tauri's display.
						const b = m.bands ?? {};
						const bandVals = [b.rel_delta, b.rel_theta, b.rel_alpha, b.rel_beta, b.rel_gamma];
						const bandScale = Math.max(...bandVals.map(v => v ?? 0), 1e-9);
						const bar = (label: string, val: number | undefined, color: ThemeColor) => {
							const pct = val != null ? Math.round(val * 100) : 0;
							const pctStr = theme.fg(color, String(pct).padStart(2) + "%");
							return theme.fg("dim", label + " ") + bandBar(theme, val, color, bandScale) + " " + pctStr;
						};

						const bandParts = [
							bar("δ", b.rel_delta, BAND_COLORS.delta),
							bar("θ", b.rel_theta, BAND_COLORS.theta),
							bar("α", b.rel_alpha, BAND_COLORS.alpha),
							bar("β", b.rel_beta,  BAND_COLORS.beta),
							bar("γ", b.rel_gamma, BAND_COLORS.gamma),
						].join("  ");

						// last label (right-aligned on the same row as bands)
						const labelStr = exgLastLabel
							? theme.fg("dim", `⬡ "${exgLastLabel.text}"  ${timeAgo(exgLastLabel.createdAt * 1000)}`)
							: "";

						const bandW  = visibleWidth(" " + bandParts);
						const labelW = visibleWidth(labelStr);
						const spacer = Math.max(1, width - bandW - labelW);
						lines.push(truncateToWidth(" " + bandParts + " ".repeat(spacer) + labelStr, width));
					} else if (exgEnabled && !exgOnline) {
						lines.push(sep(theme, width));
						const agoText = (exgUpdatedAt != null && exgUpdatedAt > 0) ? timeAgo(exgUpdatedAt) : "";
						const lastSeen = agoText ? ` · last seen ${agoText}` : "";
						lines.push(truncateToWidth(" " + theme.fg("dim", `◌ EXG offline${lastSeen} — /connect to reconnect`), width));
					}

					// ── LLM download progress ────────────────────────────
					if (llmDownloads.length) {
						lines.push(sep(theme, width));
						for (const dl of llmDownloads) {
							const icon = dl.state === "paused"
								? theme.fg("warning", "⏸")
								: theme.fg("accent", SYNC_SPINNER[llmDownloadSpin % SYNC_SPINNER.length]);
							const pct = Math.max(0, Math.min(100, Math.round(dl.progress)));
							const barWidth = 20;
							const filled = Math.round((pct / 100) * barWidth);
							const empty = Math.max(0, barWidth - filled);
							const bar = theme.fg("accent", "█".repeat(filled)) + theme.fg("dim", "░".repeat(empty));
							const pctStr = theme.bold(`${pct}%`);
							lines.push(truncateToWidth(
								" " + icon + "  " +
								theme.fg("accent", dl.filename) + "  " +
								bar + " " + pctStr,
								width,
							));
						}
						lines.push(""); // spacing before status bar
					}

					// ── status bar: cwd · EXG · context · model ─────────────
					const branch = footerData.getGitBranch();
					const left   = theme.fg("muted", ctx.cwd)
						+ (branch ? " " + theme.fg("dim", `(${branch})`) : "");

					const dot     = exgOnline ? theme.fg("success", "◉") : theme.fg("dim", "◌");
					const agoVal  = exgUpdatedAt ? timeAgo(exgUpdatedAt) : "";
					const ago     = agoVal ? theme.fg("dim", ` ${agoVal}`) : "";
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

		ctx.ui.setWorkingMessage("thinking…");
	});

	pi.on("session_shutdown", (_event, sessionCtx) => {
		stopConnectSpinner();
		stopLlmDownloadPoll();
		disconnectExgWs();

		// Clean up TUI overlays and schedulers
		renderScheduler?.stop(); renderScheduler = null;
		overlayManager?.dispose(); overlayManager = null;
		commandPalette?.dispose(); commandPalette = null;
		exgPanel?.dispose(); exgPanel = null;
		llmPanel?.dispose(); llmPanel = null;
		overlayKeyCleanup?.(); overlayKeyCleanup = null;
		clearHistory();
		resetToastCooldowns();

		uiNotify = null;
		sessionModelRegistry = null;
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
	pi.on("agent_end", (event: { type: string; messages: any[] }) => {
		if (compressionSettings.mode === "off") return;

		// Compress text in agent messages
		for (const msg of event.messages) {
			if (msg.content && typeof msg.content === "string") {
				msg.content = compressText(msg.content, compressionSettings.mode);
			} else if (msg.content && Array.isArray(msg.content)) {
				msg.content = msg.content.map((part: any) => {
					if (part.type === "text" && typeof part.text === "string") {
						return { ...part, text: compressText(part.text, compressionSettings.mode) };
					}
					return part;
				});
			}
		}
	});

	// ── 4e. /config — configure compression and other options ───────────────
	pi.registerCommand("config", {
		description: "Configure NeuroLoop settings · /config [compression <mode> | device <gpu|cpu>]",
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub   = parts[0]?.toLowerCase() ?? "";

			// ── device (gpu/cpu) ───────────────────────────────────────────────────
			if (sub === "device") {
				const device = parts[1]?.toLowerCase();
				if (device !== "gpu" && device !== "cpu") {
					// Show current device
					try {
						const baseUrl = await getSkillServerBaseUrl();
						const hdrs = authHeaders();
						const res = await fetch(`${baseUrl}/v1/settings/inference-device`, { headers: hdrs, signal: AbortSignal.timeout(3000) });
						if (res.ok) {
							const data = (await res.json()) as { device?: string };
							handlerCtx.ui.notify(`Inference device: ${data.device ?? "unknown"}\nUsage: /config device <gpu|cpu>`, "info");
						} else {
							handlerCtx.ui.notify("Usage: /config device <gpu|cpu>", "warning");
						}
					} catch {
						handlerCtx.ui.notify("Usage: /config device <gpu|cpu>", "warning");
					}
					return;
				}
				try {
					const baseUrl = await getSkillServerBaseUrl();
					const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
					const res = await fetch(`${baseUrl}/v1/settings/inference-device`, {
						method: "POST", headers: hdrs, body: JSON.stringify({ device }),
						signal: AbortSignal.timeout(5000),
					});
					if (res.ok) {
						handlerCtx.ui.notify(`Inference device set to ${device.toUpperCase()}.`, "info");
					} else {
						handlerCtx.ui.notify(`Failed to set device: HTTP ${res.status}`, "error");
					}
				} catch (e) {
					handlerCtx.ui.notify(`Failed to set device: ${e instanceof Error ? e.message : String(e)}`, "error");
				}
				return;
			}

			// ── compression ────────────────────────────────────────────────────────
			if (sub === "compression") {
				const mode = (parts[1]?.toLowerCase() as CompressionMode) ?? "standard";
				if (mode !== "standard" && mode !== "strong" && mode !== "off") {
					handlerCtx.ui.notify(
						"Usage: /config compression <standard|strong|off>",
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
			try {
				const baseUrl = await getSkillServerBaseUrl();
				const res = await fetch(`${baseUrl}/v1/settings/inference-device`, {
					headers: authHeaders(), signal: AbortSignal.timeout(2000),
				});
				if (res.ok) {
					const data = (await res.json()) as { device?: string };
					lines.push(`  Inference device: ${(data.device ?? "unknown").toUpperCase()}`);
				}
			} catch { /* daemon offline */ }
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

	// ── /theme — switch color theme ──────────────────────────────────────────
	pi.registerCommand("theme", {
		description: "Switch color theme · /theme [name]",
		handler: async (args, handlerCtx) => {
			const name = args.trim().toLowerCase();

			if (!name) {
				// Interactive: show theme picker
				const choices = BUILTIN_THEMES.map(t => {
					const active = t.id === getActiveTheme().id ? "● " : "  ";
					return `${active}${t.name} — ${t.description}`;
				});
				const choice = await handlerCtx.ui.select("Select Theme", choices);
				if (!choice) return;
				const idx = choices.indexOf(choice);
				const theme = BUILTIN_THEMES[idx];
				if (theme) {
					setActiveTheme(theme.id);
					uiTui?.requestRender(true);
					handlerCtx.ui.notify(`Theme set to ${theme.name}`, "info");
				}
				return;
			}

			// Direct name match
			const result = setActiveTheme(name);
			if (result) {
				uiTui?.requestRender(true);
				handlerCtx.ui.notify(`Theme set to ${result.name}`, "info");
			} else {
				const available = BUILTIN_THEMES.map(t => t.id).join(", ");
				handlerCtx.ui.notify(`Unknown theme "${name}". Available: ${available}`, "warning");
			}
		},
	});

	// ── /toasts — toggle smart brain state notifications ─────────────────────
	pi.registerCommand("toasts", {
		description: "Toggle brain state notifications · /toasts [on|off]",
		handler: async (args, handlerCtx) => {
			const arg = args.trim().toLowerCase();
			if (arg === "on") {
				setSmartToastsEnabled(true);
				handlerCtx.ui.notify("Smart brain state toasts enabled", "info");
			} else if (arg === "off") {
				setSmartToastsEnabled(false);
				handlerCtx.ui.notify("Smart brain state toasts disabled", "info");
			} else {
				const current = isSmartToastsEnabled();
				setSmartToastsEnabled(!current);
				handlerCtx.ui.notify(`Smart brain state toasts ${!current ? "enabled" : "disabled"}`, "info");
			}
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
				`Learn more at https://www.neuroskill.com`,
				"",
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
			// Parse --context flag if present
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const ctxIdx = parts.indexOf("--context");
			let labelText: string;
			let ctx: string | undefined;
			if (ctxIdx >= 0) {
				labelText = parts.slice(0, ctxIdx).join(" ");
				ctx = parts.slice(ctxIdx + 1).join(" ");
			} else {
				labelText = parts.join(" ");
			}
			const result = await createLabel(labelText, ctx);
			if (!result.ok) {
				handlerCtx.ui.notify(`Label error: ${result.error}`, "error");
			} else {
				handlerCtx.ui.notify(`⬡ Labelled: "${labelText}"`, "info");
			}
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
	// Cache catalog filenames for tab completion
	let llmCatalogCache: Array<{ filename: string; state: string; isMmproj: boolean }> = [];
	let llmCatalogCacheAt = 0;
	async function refreshLlmCatalogCache(): Promise<void> {
		if (Date.now() - llmCatalogCacheAt < 30_000 && llmCatalogCache.length > 0) return;
		try {
			const baseUrl = await getSkillServerBaseUrl();
			const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
				headers: authHeaders(), signal: AbortSignal.timeout(3000),
			});
			if (!res.ok) return;
			const data = (await res.json()) as { entries?: Array<Record<string, unknown>> };
			llmCatalogCache = (data.entries ?? []).map((e) => ({
				filename: String(e.filename ?? ""),
				state: String(e.state ?? "not_downloaded"),
				isMmproj: !!e.is_mmproj,
			}));
			llmCatalogCacheAt = Date.now();
		} catch { /* keep stale cache */ }
	}

	pi.registerCommand("llm", {
		description: "LLM control · /llm [models|status|route|connect|start|stop|list|add|remove|select|download|cancel|pause|resume|fit|chat …]",
		getArgumentCompletions(prefix: string) {
			const parts = prefix.trim().split(/\s+/);
			const sub = parts[0]?.toLowerCase() ?? "";
			const partial = (parts[1] ?? "").toLowerCase();

			// Subcommand completion
			if (parts.length <= 1) {
				const subs = ["models", "status", "route", "connect", "start", "stop", "list",
					"select", "download", "cancel", "pause", "resume", "add", "remove", "fit", "chat"];
				return subs
					.filter((s) => s.startsWith(sub))
					.map((s) => ({ value: s, label: s, description: "" }));
			}

			// Filename completion for subcommands that take a model filename
			const filenameSubs = new Set(["select", "download", "cancel", "pause", "resume", "remove", "delete"]);
			if (filenameSubs.has(sub) && parts.length === 2) {
				// Trigger async refresh (fire-and-forget — results show on next tab)
				refreshLlmCatalogCache();
				const models = llmCatalogCache.filter((m) => !m.isMmproj);
				// Filter by state for context-sensitive completions
				let filtered = models;
				if (sub === "select") filtered = models.filter((m) => m.state === "downloaded");
				else if (sub === "download") filtered = models.filter((m) => m.state !== "downloaded");
				else if (sub === "cancel" || sub === "pause") filtered = models.filter((m) => m.state === "downloading");
				else if (sub === "resume") filtered = models.filter((m) => m.state === "paused");
				else if (sub === "remove" || sub === "delete") filtered = models.filter((m) => m.state === "downloaded");
				return filtered
					.filter((m) => m.filename.toLowerCase().includes(partial))
					.map((m) => ({ value: `${sub} ${m.filename}`, label: m.filename, description: m.state }));
			}

			return null;
		},
		handler: async (args, handlerCtx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub = (parts[0] ?? "").toLowerCase();

			// No args → open LLM manager popup
			if (!sub) {
				if (llmPanel) {
					overlayManager?.show("llm-panel");
				} else {
					// Fallback if panel not initialized (shouldn't happen)
					handlerCtx.ui.notify("LLM panel not available — try /llm models", "warning");
				}
				return;
			}

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
			if (sub === "status") {
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
					handlerCtx.ui.notify("LLM server not running. Use /llm start or /llm models to manage models.", "warning");
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
				let data: Record<string, unknown> | undefined;
				try {
					const baseUrl = await getSkillServerBaseUrl();
					const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
						headers: authHeaders(), signal: AbortSignal.timeout(5000),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					data = (await res.json()) as Record<string, unknown>;
				} catch (e) {
					handlerCtx.ui.notify(`Failed to fetch catalog: ${e instanceof Error ? e.message : String(e)}`, "error");
					return;
				}
				{
					const entries = (data?.entries ?? []) as Array<Record<string, unknown>>;
					const active  = data?.active_model ?? "–";
					const mmproj  = data?.active_mmproj ?? "–";
					if (!entries.length) {
						handlerCtx.ui.notify("Model catalog is empty. Use /llm add to add a model.", "warning");
						return;
					}

					const downloaded: string[] = [];
					const available: string[] = [];
					const downloading: string[] = [];

					for (const e of entries) {
						if (e.is_mmproj) continue;
						const fname = String(e.filename ?? "");
						const state = String(e.state ?? e.status ?? "not_downloaded");
						const size  = e.size_gb ? `${Number(e.size_gb).toFixed(1)} GB` : "";
						const quant = e.quant ?? "";
						const family = e.family_name ?? "";
						const params = e.params_b ? `${e.params_b}B` : "";
						const info  = [quant, params, size].filter(Boolean).join("  ");
						const rec   = e.recommended ? " ⭐" : "";

						if (state === "downloaded") {
							const mark = fname === active ? "▶ " : "  ";
							downloaded.push(`${mark}**${fname}**  ${info}${rec}`);
						} else if (state === "downloading") {
							const pct = typeof e.progress === "number" ? ` ${Math.round(e.progress as number)}%` : "";
							downloading.push(`  ⬇ **${fname}**  ${info}${pct}`);
						} else {
							available.push(`  ○ ${family ? `_${family}_  ` : ""}**${fname}**  ${info}${rec}`);
						}
					}

					const sections: string[] = [];
					sections.push(`Active: **${active}**` + (mmproj !== "–" ? ` · mmproj: **${mmproj}**` : ""));
					if (downloaded.length) {
						sections.push("\n**Downloaded:**\n" + downloaded.join("\n"));
					}
					if (downloading.length) {
						sections.push("\n**Downloading:**\n" + downloading.join("\n"));
					}
					if (available.length) {
						sections.push("\n**Available to download:**\n" + available.join("\n"));
					}
					sections.push("\n`/llm download <file>` · `/llm pause|resume|cancel [file]` · `/llm select <file>` · `/llm start`");

					pi.sendMessage({
						customType: NEUROSKILL_STATUS_TYPE,
						content: `## 🤖 LLM Catalog\n${sections.join("\n")}`,
						display: true,
						details: undefined,
					});
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
				// Fire-and-forget: start download then immediately return
				// so the command handler doesn't block TUI input.
				handlerCtx.ui.notify(`Starting download: ${filename}`, "info");
				if (!llmDownloads.find((d) => d.filename === filename)) {
					llmDownloads.push({ filename, progress: 0, state: "downloading" });
				}
				startLlmDownloadPoll();
				uiTui?.requestRender();

				// Kick off the REST call in the background (non-blocking)
				(async () => {
					try {
						const baseUrl = await getSkillServerBaseUrl();
						const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
						const startRes = await fetch(`${baseUrl}/v1/llm/download/start`, {
							method: "POST", headers: hdrs,
							body: JSON.stringify({ filename }),
							signal: AbortSignal.timeout(10000),
						});
						if (!startRes.ok) {
							const body = await startRes.text().catch(() => "");
							uiNotify?.(`Download request failed: HTTP ${startRes.status} ${body}`, "error");
						}
					} catch (e) {
						uiNotify?.(`Download request failed: ${e instanceof Error ? e.message : String(e)}`, "error");
					}
				})();
				return;
			}

			// ── cancel / pause / resume ──────────────────────────────
			if (sub === "cancel" || sub === "pause" || sub === "resume") {
				const target = parts[1] ?? (llmDownloads.length === 1 ? llmDownloads[0].filename : undefined);
				if (!target) {
					if (llmDownloads.length > 1) {
						const names = llmDownloads.map((d) => d.filename).join(", ");
						handlerCtx.ui.notify(`Multiple downloads active: ${names}\nUsage: /llm ${sub} <filename>`, "warning");
					} else {
						handlerCtx.ui.notify(`No download in progress. Usage: /llm ${sub} <filename>`, "warning");
					}
					return;
				}
				const endpoint = sub === "cancel" ? "cancel" : sub === "pause" ? "pause" : "resume";
				try {
					const baseUrl = await getSkillServerBaseUrl();
					const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
					const res = await fetch(`${baseUrl}/v1/llm/download/${endpoint}`, {
						method: "POST", headers: hdrs,
						body: JSON.stringify({ filename: target }),
						signal: AbortSignal.timeout(5000),
					});
					if (res.ok) {
						if (sub === "cancel") {
							llmDownloads = llmDownloads.filter((d) => d.filename !== target);
							if (llmDownloads.length === 0) stopLlmDownloadPoll();
							uiTui?.requestRender();
						}
						handlerCtx.ui.notify(`${target}: ${sub} OK`, "info");
					} else {
						handlerCtx.ui.notify(`${sub} failed: HTTP ${res.status}`, "error");
					}
				} catch (e) {
					handlerCtx.ui.notify(`${sub} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
				}
				return;
			}

			// ── models (show catalog + command hints) ────────────────
			if (sub === "downloads" || sub === "models") {
				// Show catalog as a message — user interacts via /llm subcommands
				let data: Record<string, unknown> | undefined;
				try {
					const baseUrl = await getSkillServerBaseUrl();
					const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
						headers: authHeaders(), signal: AbortSignal.timeout(5000),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					data = (await res.json()) as Record<string, unknown>;
				} catch (e) {
					handlerCtx.ui.notify(`Failed to fetch catalog: ${e instanceof Error ? e.message : String(e)}`, "error");
					return;
				}
				const entries = (data?.entries ?? []) as Array<Record<string, unknown>>;
				const active  = data?.active_model ?? "–";
				if (!entries.length) {
					handlerCtx.ui.notify("Model catalog is empty. Use /llm add to add a model.", "warning");
					return;
				}

				const downloaded: string[] = [];
				const available: string[] = [];
				const downloading: string[] = [];

				for (const e of entries) {
					if (e.is_mmproj) continue;
					const fname = String(e.filename ?? "");
					const state = String(e.state ?? "not_downloaded");
					const size  = e.size_gb ? `${Number(e.size_gb).toFixed(1)} GB` : "";
					const quant = String(e.quant ?? "");
					const family = String(e.family_name ?? "");
					const params = e.params_b ? `${e.params_b}B` : "";
					const info  = [quant, params, size].filter(Boolean).join("  ");
					const rec   = e.recommended ? " ⭐" : "";

					if (state === "downloaded") {
						const mark = fname === active ? "▶ " : "  ";
						downloaded.push(`${mark}\`${fname}\`  ${info}${rec}`);
					} else if (state === "downloading") {
						const pct = typeof e.progress === "number" ? ` ${Math.round(e.progress as number)}%` : "";
						downloading.push(`  ⬇ \`${fname}\`  ${info}${pct}`);
					} else {
						available.push(`  ○ ${family ? `_${family}_  ` : ""}\`${fname}\`  ${info}${rec}`);
					}
				}

				const sections: string[] = [];
				sections.push(`Active: **${active}**`);
				if (downloaded.length) sections.push("\n**Downloaded:**\n" + downloaded.join("\n"));
				if (downloading.length) sections.push("\n**Downloading:**\n" + downloading.join("\n"));
				if (available.length) sections.push("\n**Available to download:**\n" + available.join("\n"));
				sections.push("");
				sections.push("**Commands:**");
				sections.push("  `/llm select <file>` — set active model");
				sections.push("  `/llm download <file>` — download a model");
				sections.push("  `/llm pause|resume|cancel [file]` — manage downloads");
				sections.push("  `/llm start` / `/llm stop` — server control");
				sections.push("  `/llm status` — show server status");

				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## 🤖 LLM Models\n${sections.join("\n")}`,
					display: true,
					details: undefined,
				});
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

	// ── 4g. /connect — set up daemon connection ─────────────────────────────

	pi.registerCommand("connect", {
		description: "Connect to a NeuroSkill server · /connect",
		handler: async (_args, handlerCtx) => {
			handlerCtx.ui.notify("Checking for local daemon...", "info");
			const authSt = await checkAuthStatus();

			if (authSt === "local") {
				const port = getSkillPort();
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content: `## Connected Locally\n\nDaemon found on \`127.0.0.1:${port}\`. Auth token loaded automatically from:\n\`${getDaemonTokenPath()}\``,
					display: true,
					details: undefined,
				});
				return;
			}

			const options = [
				"LAN — connect to a daemon on your network",
				"Remote — connect via iroh relay (TOTP pairing)",
				"Cancel",
			];
			const choice = await handlerCtx.ui.select(
				"No local daemon found. How would you like to connect?",
				options,
			);

			if (!choice || choice === "Cancel") return;

			if (choice.startsWith("LAN")) {
				const hostPort = await handlerCtx.ui.input(
					"Enter the daemon address (host:port, e.g. 192.168.1.10:18444):",
				);
				if (!hostPort) return;

				const token = await handlerCtx.ui.input(
					"Enter the daemon auth token.\n" +
					"Find it on the server machine at:\n" +
					"  macOS:   ~/Library/Application Support/skill/daemon/auth.token\n" +
					"  Linux:   ~/.config/skill/daemon/auth.token\n" +
					"  Windows: %APPDATA%\\skill\\daemon\\auth.token",
				);
				if (!token) return;

				const [host, portStr] = hostPort.includes(":") ? hostPort.split(":") : [hostPort, "18444"];
				const port = parseInt(portStr, 10) || 18444;
				try {
					const res = await fetch(`http://${host}:${port}/healthz`, {
						signal: AbortSignal.timeout(5000),
						headers: { Authorization: `Bearer ${token}` },
					});
					if (res.ok) {
						setSkillPort(port);
						pi.sendMessage({
							customType: NEUROSKILL_STATUS_TYPE,
							content: `## Connected via LAN\n\nDaemon reachable at \`${host}:${port}\`. Connection verified.`,
							display: true,
							details: undefined,
						});
					} else {
						handlerCtx.ui.notify(`Daemon responded with HTTP ${res.status}. Check your token.`, "error");
					}
				} catch (err) {
					handlerCtx.ui.notify(`Could not reach daemon at ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`, "error");
				}
				return;
			}

			if (choice.startsWith("Remote")) {
				pi.sendMessage({
					customType: NEUROSKILL_STATUS_TYPE,
					content:
						"## Remote Connection via iroh\n\n" +
						"**Step 1:** On the server machine, create a TOTP credential:\n" +
						"```\nneuroskill iroh totp create \"my-client\"\n```\n\n" +
						"**Step 2:** Open the authenticator app and get the 6-digit code.\n\n" +
						"**Step 3:** Enter the iroh endpoint ID and code below.",
					display: true,
					details: undefined,
				});

				const endpointId = await handlerCtx.ui.input("Enter the server's iroh endpoint ID:");
				if (!endpointId) return;

				const otp = await handlerCtx.ui.input("Enter the 6-digit TOTP code:");
				if (!otp) return;

				const scopeChoice = await handlerCtx.ui.select(
					"Permission scope:",
					[
						"read",
						"full",
					],
				);
				const scope = scopeChoice || "read";

				handlerCtx.ui.notify("Registering with iroh relay...", "info");
				const result = await runNeuroSkill([
					"iroh", "clients", "register", endpointId,
					"--otp", otp,
					"--scope", scope,
				]);

				if (result.ok) {
					pi.sendMessage({
						customType: NEUROSKILL_STATUS_TYPE,
						content: "## Remote Connection Established\n\nSuccessfully registered via iroh.\n```json\n" + result.text + "\n```",
						display: true,
						details: undefined,
					});
				} else {
					handlerCtx.ui.notify(`Registration failed: ${result.error}`, "error");
				}
				return;
			}
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
