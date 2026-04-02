// Suppress the "Update Available" banner — version management is handled externally.
process.env.PI_SKIP_VERSION_CHECK = "1";

// Node ≥ 20 required for AbortSignal.any(), AbortSignal.timeout(), global fetch.
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
	console.error(`neuroloop requires Node.js >= 20 (running ${process.version})`);
	process.exit(1);
}

/**
 * main.ts — NeuroLoop agent entry point.
 *
 * Builds a pi agent session with:
 * - agentDir: ~/.neuroloop  (sessions, auth, settings, models)
 * - ./skills/* + METRICS.md injected as individual skills
 * - neuroloopExtension factory (neuroskill status hook, custom tools)
 * - All built-in pi providers available (Anthropic, OpenAI, Gemini, …)
 * - Skill app local LLM auto-discovered (port 8375, OpenAI-compatible /v1/*)
 * - All Ollama models auto-discovered; gpt-oss:20b always present as default
 * - Full interactive TUI via InteractiveMode
 *
 * Model selection priority (handled by findInitialModel inside createAgentSession):
 *   1. Model saved in session history
 *   2. Default from ~/.neuroloop/settings.json
 *   3. First built-in provider with a valid API key / OAuth token
 *   4. Skill app local LLM (skill-llm provider — auto-discovered on port 8375)
 *   5. First Ollama model (gpt-oss:20b when no other Ollama model listed first)
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
	createSyntheticSourceInfo,
	SessionManager,
	SettingsManager,
	type Skill,
} from "@mariozechner/pi-coding-agent";

import { neuroloopExtension } from "./neuroloop.ts";
import { syncSkillsFromGitHub } from "./skills-sync.ts";
import { refreshRuntimeVersions } from "./runtime-updates.ts";
import { autoBootSkillLlmIfConfigured, registerSkillLlmProvider } from "./skill-llm.ts";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const MAIN_FILE = fileURLToPath(import.meta.url);
const SRC_DIR = dirname(MAIN_FILE);
const NEUROLOOP_DIR = join(SRC_DIR, "..");
const AGENT_DIR = join(homedir(), ".neuroloop");
const SKILLS_DIR = join(NEUROLOOP_DIR, "skills");
const METRICS_MD_PATH = join(NEUROLOOP_DIR, "METRICS.md");
const LOCAL_NEUROLOOP_VERSION =
	(JSON.parse(readFileSync(join(NEUROLOOP_DIR, "package.json"), "utf8")) as { version: string }).version;

// Keep npm runtime bits fresh (neuroloop + local neuroskill CLI).
const runtime = await refreshRuntimeVersions(LOCAL_NEUROLOOP_VERSION);
if (runtime.neuroloop.npmLatest) {
	const badge = runtime.neuroloop.upToDate ? "up-to-date" : "update available";
	console.log(`neuroloop: v${runtime.neuroloop.local} (npm latest: v${runtime.neuroloop.npmLatest}, ${badge})`);
}
if (runtime.neuroloop.updated) {
	console.log("neuroloop: updated globally from npm.");
} else if (runtime.neuroloop.updateError) {
	console.warn(`neuroloop: global update failed (${runtime.neuroloop.updateError})`);
}
if (runtime.neuroskill.npmLatest) {
	console.log(
		`neuroskill: local ${runtime.neuroskill.localInstalled ?? "none"} (npm latest: ${runtime.neuroskill.npmLatest})`,
	);
	if (runtime.neuroskill.installedNow) {
		console.log("neuroskill: local runtime CLI updated.");
	}
	if (runtime.neuroskill.installError) {
		console.warn(`neuroskill: local install failed (${runtime.neuroskill.installError})`);
	}
}

// Pull latest skills from GitHub on every launch.
const skillsSync = await syncSkillsFromGitHub();
process.env.NEUROLOOP_SKILLS_SYNC_STATUS = skillsSync.message;
process.env.NEUROLOOP_SKILLS_SYNC_OK = skillsSync.ok ? "1" : "0";
process.env.NEUROLOOP_SKILLS_SYNC_UPDATED = skillsSync.updated ? "1" : "0";
console.log(`skills: ${skillsSync.message}`);
if (!skillsSync.ok && skillsSync.error) {
	console.warn(`skills: ${skillsSync.error}`);
}

// ---------------------------------------------------------------------------
// Auth, models, settings — all stored under ~/.neuroloop
// ---------------------------------------------------------------------------

const authStorage = AuthStorage.create(join(AGENT_DIR, "auth.json"));
const modelRegistry = ModelRegistry.create(authStorage, join(AGENT_DIR, "models.json"));
const settingsManager = SettingsManager.create(process.cwd(), AGENT_DIR);

// ---------------------------------------------------------------------------
// Skill LLM — optional boot (remote/local/auto) + provider registration.
// ---------------------------------------------------------------------------

await autoBootSkillLlmIfConfigured();
await registerSkillLlmProvider(modelRegistry);

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
					filePath: skillFile,
					baseDir: join(SKILLS_DIR, entry.name),
					sourceInfo: createSyntheticSourceInfo(skillFile, {
						source: "neuroloop/skills",
						scope: "project",
						origin: "top-level",
						baseDir: join(SKILLS_DIR, entry.name),
					}),
					disableModelInvocation: false,
				});
			}
		}

		// METRICS.md as an additional reference skill.
		if (existsSync(METRICS_MD_PATH)) {
			extra.push({
				name: "neuroskill-metrics",
				description: "NeuroSkill EXG metrics reference — all indices, band powers, scores, and their scientific basis.",
				filePath: METRICS_MD_PATH,
				baseDir: NEUROLOOP_DIR,
				sourceInfo: createSyntheticSourceInfo(METRICS_MD_PATH, {
					source: "neuroloop",
					scope: "project",
					origin: "top-level",
					baseDir: NEUROLOOP_DIR,
				}),
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
