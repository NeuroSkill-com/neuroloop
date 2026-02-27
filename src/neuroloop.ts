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
import { fileURLToPath } from "node:url";

import { Container, Markdown, Spacer } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";

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
This is the user's current mental and emotional state as measured by their EEG device.
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
  said, the current EEG state summary, and any relevant background. Keep context ≤ 1000 words.
• Labels are permanent memory — make them referenceable and meaningful.

DEPTH & PHILOSOPHY
──────────────────
• When the user explores questions of meaning, existence, identity, morality, or consciousness —
  engage as a thoughtful philosophical companion. Draw on wisdom traditions, lived experience,
  and the EEG state to ground the inquiry.
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

• CONSTRUCTION: set duration_secs from the current EEG state and pacing the user can hold.
  Every timed action MUST be preceded by a 0-duration announcement step.
  Expand repeated cycles as individual steps. EEG labelling is always on.

• PROTOCOL REPERTOIRE is loaded on-demand into the context when the user's message
  contains protocol-relevant keywords (exercises, routines, breathing, stretching, music,
  social media help, dietary guidance, etc.). When the repertoire section is present in
  this context window, use it to match the best protocol to the current EEG signal.
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
• Never mention EEG, metrics, indices, or BCI devices unless the user asks directly.
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
	//    • displaySections → shown in the chat bubble (clean EEG data only, no instructions).
	//    • systemSections  → injected into the system prompt alongside STATUS_PROMPT guidance.
	pi.on("before_agent_start", async (event) => {
		const displaySections: string[] = [];
		const systemSections: string[] = [];

		const statusResult = await runNeuroSkill(["status"]);

		if (statusResult.ok && statusResult.text) {
			// Clean display: just the live data, no instruction prose.
			displaySections.push(`## 🧠 Current State\n${statusResult.text}`);
			systemSections.push(`## Current EEG State\n${statusResult.text}`);

			// Contextual extras keyed off the user's prompt.
			const extra = await selectContextualData(event.prompt);
			displaySections.push(...extra);
			systemSections.push(...extra);
		} else {
			const unavailable =
				"## 🧠 NeuroSkill\n_Unavailable — server not running or no EEG device connected._\n" +
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
				"help keep their EEG baselines accurate, and ask if they would like to do one now. " +
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
		// capability overview available in the EEG context block.
		// (Pi also loads NEUROLOOP.md as the project context file, but injecting
		// it here ensures it is co-located with the live EEG data every turn.)
		let skillIndex = "";
		try {
			if (existsSync(NEUROLOOP_MD_PATH)) {
				skillIndex = `\n\n## 📖 NeuroLoop Capabilities\n${readFileSync(NEUROLOOP_MD_PATH, "utf8")}`;
			}
		} catch {
			// Non-fatal — continue without it.
		}

		return {
			// Chat bubble: clean EEG snapshot without instruction prose.
			message: {
				customType: NEUROSKILL_STATUS_TYPE,
				content: displayBody,
				display: true,
				details: undefined,
			},
			// System prompt: guidance + skill index + live data — the LLM sees all; the user sees neither.
			systemPrompt:
				`${event.systemPrompt}\n\n${"=".repeat(60)}\n` +
				`# Live EEG Context (current turn)\n\n${STATUS_PROMPT}${skillIndex}\n\n${systemBody}\n` +
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
		label: "Label EEG Moment",
		description:
			"Create a timestamped EEG annotation for the current moment. " +
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
						"Rich context: what the user said, their current EEG state, " +
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
		description: `Run a neuroskill EEG command and return its JSON output.

Available commands and typical args:
  status                             → full device/session/scores snapshot
  session [index]                    → session metrics + trends (0=latest)
  sessions                           → list all recorded sessions
  search-labels <query>              → semantic search over EEG annotations
  interactive <keyword>              → 4-layer cross-modal graph search
  label <text>                       → create a timestamped annotation
  search [--k <n>]                   → ANN EEG-similarity search
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

	// 4. Status bar
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setStatus("neuroloop", existsSync(NEUROLOOP_MD_PATH) ? "neuroloop ready" : "neuroloop: no NEUROLOOP.md");
	});

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus("neuroloop", undefined);
	});
}
