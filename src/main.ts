// Suppress the "Update Available" banner — version management is handled externally.
process.env.PI_SKIP_VERSION_CHECK = "1";

/**
 * main.ts — NeuroLoop agent entry point.
 *
 * Builds a pi agent session with:
 * - agentDir: ~/.neuroloop  (sessions, auth, settings, models)
 * - ./skills/* + METRICS.md injected as individual skills
 * - neuroloopExtension factory (neuroskill status hook, custom tools)
 * - All built-in pi providers available (Anthropic, OpenAI, Gemini, …)
 * - All Ollama models auto-discovered; gpt-oss:20b always present as default
 * - Full interactive TUI via InteractiveMode
 *
 * Model selection priority (handled by findInitialModel inside createAgentSession):
 *   1. Model saved in session history
 *   2. Default from ~/.neuroloop/settings.json
 *   3. First built-in provider with a valid API key / OAuth token
 *   4. First Ollama model (gpt-oss:20b when no other Ollama model listed first)
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	InteractiveMode,
	ModelRegistry,
	SessionManager,
	SettingsManager,
	type Skill,
} from "@mariozechner/pi-coding-agent";

import { neuroloopExtension } from "./neuroloop.ts";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const MAIN_FILE = fileURLToPath(import.meta.url);
const SRC_DIR = dirname(MAIN_FILE);
const NEUROLOOP_DIR = join(SRC_DIR, "..");
const AGENT_DIR = join(homedir(), ".neuroloop");
const SKILLS_DIR = join(NEUROLOOP_DIR, "skills");
const METRICS_MD_PATH = join(NEUROLOOP_DIR, "METRICS.md");

// ---------------------------------------------------------------------------
// Auth, models, settings — all stored under ~/.neuroloop
// ---------------------------------------------------------------------------

const authStorage = AuthStorage.create(join(AGENT_DIR, "auth.json"));
const modelRegistry = new ModelRegistry(authStorage, join(AGENT_DIR, "models.json"));
const settingsManager = SettingsManager.create(process.cwd(), AGENT_DIR);

// ---------------------------------------------------------------------------
// Ollama — auto-discover all available models, always include gpt-oss:20b.
// Must happen before createAgentSession so the models participate in the
// initial model-selection step (findInitialModel).
// ---------------------------------------------------------------------------

const DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";

/** Build a model entry for registerProvider from a name + optional param-size tag. */
function ollamaModelEntry(id: string, paramSize = "") {
	const bigModel = /\b(70b|72b|110b|180b)\b/i.test(paramSize);
	return {
		id,
		name: paramSize ? `${id} (${paramSize})` : id,
		reasoning: false,
		input: ["text"] as ("text" | "image")[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: bigModel ? 65536 : 32768,
		maxTokens: bigModel ? 16384 : 8192,
		compat: {
			supportsStore: false,
			supportsReasoningEffort: false,
			supportsDeveloperRole: false,
			requiresToolResultName: false,
			supportsStrictMode: false,
		},
	};
}

async function registerOllamaModels(): Promise<void> {
	// Start with the preconfigured default so it's always available even when
	// Ollama is unreachable, and so it appears first in the model list.
	const models = [ollamaModelEntry(DEFAULT_OLLAMA_MODEL)];
	const seen = new Set<string>([DEFAULT_OLLAMA_MODEL]);

	try {
		const res = await fetch("http://localhost:11434/api/tags", {
			signal: AbortSignal.timeout(3000),
		});
		if (res.ok) {
			type TagEntry = { name: string; details?: { parameter_size?: string } };
			const { models: tags = [] } = (await res.json()) as { models?: TagEntry[] };
			for (const tag of tags) {
				if (!seen.has(tag.name)) {
					models.push(ollamaModelEntry(tag.name, tag.details?.parameter_size ?? ""));
					seen.add(tag.name);
				}
			}
		}
	} catch {
		// Ollama not running — proceed with just the default model.
	}

	modelRegistry.registerProvider("ollama", {
		baseUrl: "http://localhost:11434/v1",
		// "OLLAMA_API_KEY" is treated as an env-var name by resolveConfigValue;
		// falls back to the literal string (truthy) so hasAuth("ollama") is always true.
		apiKey: "OLLAMA_API_KEY",
		api: "openai-completions",
		models,
	});
}

await registerOllamaModels();

// ---------------------------------------------------------------------------
// Resource loader
// ---------------------------------------------------------------------------

// Populated by skillsOverride; printed to the terminal after the TUI exits.
let loadedSkills: Skill[] = [];

const loader = new DefaultResourceLoader({
	cwd: process.cwd(),
	agentDir: AGENT_DIR,
	settingsManager,

	// Load individual skills from ./skills/<name>/SKILL.md + METRICS.md
	skillsOverride: (base) => {
		const extra: Skill[] = [];

		// Scan ./skills/ directory — each subdirectory must contain SKILL.md with
		// name/description frontmatter matching the Agent Skills specification.
		if (existsSync(SKILLS_DIR)) {
			for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				const skillFile = join(SKILLS_DIR, entry.name, "SKILL.md");
				if (!existsSync(skillFile)) continue;

				// Parse YAML frontmatter to extract name and description.
				const content = readFileSync(skillFile, "utf8");
				const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
				if (!fmMatch) continue;

				const fm = fmMatch[1];
				const nameMatch = fm.match(/^name:\s*(.+)$/m);
				const descMatch = fm.match(/^description:\s*(.+)$/m);
				if (!nameMatch || !descMatch) continue;

				extra.push({
					name: nameMatch[1].trim(),
					description: descMatch[1].trim(),
						// Package-relative path: "neuroloop/skills/…/SKILL.md"
					// Consistent regardless of cwd or where npm installed the package.
					filePath: `${basename(NEUROLOOP_DIR)}/${relative(NEUROLOOP_DIR, skillFile)}`,
					baseDir: join(SKILLS_DIR, entry.name),
					source: "path",
					disableModelInvocation: false,
				});
			}
		}

		// METRICS.md as an additional reference skill.
		if (existsSync(METRICS_MD_PATH)) {
			extra.push({
				name: "neuroskill-metrics",
				description: "NeuroSkill EXG metrics reference — all indices, band powers, scores, and their scientific basis.",
				filePath: `${basename(NEUROLOOP_DIR)}/${relative(NEUROLOOP_DIR, METRICS_MD_PATH)}`,
				baseDir: NEUROLOOP_DIR,
				source: "path",
				disableModelInvocation: false,
			});
		}

		loadedSkills = [...base.skills, ...extra];
		return { skills: loadedSkills, diagnostics: base.diagnostics };
	},

	// Brief context note (doesn't duplicate the skills above).
	agentsFilesOverride: (base) => {
		const note = [
			"# NeuroLoop Agent",
			"",
			"EXG-aware coding agent. A live neuroskill status snapshot is injected as an",
			"assistant message before every turn. Use the `neuroskill_run` tool to query",
			"any other neuroskill command.",
			"",
			`Skills dir: ${SKILLS_DIR}`,
			`METRICS.md: ${METRICS_MD_PATH}`,
		].join("\n");

		return {
			agentsFiles: [
				...base.agentsFiles,
				{ path: `${basename(NEUROLOOP_DIR)}/NEUROLOOP.md`, content: note },
			],
		};
	},

	// Extension factory: neuroskill status hook + custom tools
	extensionFactories: [neuroloopExtension],
});

await loader.reload();

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const { session, modelFallbackMessage } = await createAgentSession({
	cwd: process.cwd(),
	agentDir: AGENT_DIR,
	authStorage,
	modelRegistry,
	resourceLoader: loader,
	sessionManager: SessionManager.create(process.cwd(), join(AGENT_DIR, "sessions")),
	settingsManager,
	// No explicit model — let findInitialModel choose:
	//   built-in providers win if they have API keys / OAuth tokens,
	//   otherwise the first Ollama model (gpt-oss:20b) is used.
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const mode = new InteractiveMode(session, {
	modelFallbackMessage,
	initialMessage: process.argv[2],
});

await mode.run();

// ---------------------------------------------------------------------------
// Post-exit: print loaded skills with package-relative paths.
// ---------------------------------------------------------------------------

console.log(`\nSkills loaded (${loadedSkills.length}):`);
for (const skill of loadedSkills) {
	console.log(`  ${skill.name}`);
}
