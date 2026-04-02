import type { ProviderConfig } from "@mariozechner/pi-coding-agent";
import { runNeuroSkill, discoverSkillServer, getSkillPort } from "./neuroskill/index.ts";

interface ProviderRegistry {
	registerProvider: (id: string, cfg: ProviderConfig) => void;
}

function localModelEntry(
	id: string,
	opts: { contextWindow?: number; supportsVision?: boolean } = {},
) {
	return {
		id,
		name: id,
		reasoning: false,
		input: (opts.supportsVision ? ["text", "image"] : ["text"]) as ("text" | "image")[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: opts.contextWindow ?? 32768,
		maxTokens: 8192,
		compat: {
			supportsStore: false,
			supportsReasoningEffort: false,
			supportsDeveloperRole: false,
			requiresToolResultName: false,
			supportsStrictMode: false,
		},
	};
}

export async function registerSkillLlmProvider(modelRegistry: ProviderRegistry): Promise<boolean> {
	try {
		const discoveredPort = await discoverSkillServer();
		if (!discoveredPort) return false;
		const baseUrl = `http://127.0.0.1:${discoveredPort}`;

		const res = await fetch(`${baseUrl}/llm/status`, {
			signal: AbortSignal.timeout(2000),
		});
		if (!res.ok) return false;

		const status = (await res.json()) as {
			status: string;
			model?: string;
			model_name?: string;
			n_ctx?: number;
			supports_vision?: boolean;
		};
		if (status.status !== "running" && status.status !== "ok") return false;

		const modelName = status.model_name ?? status.model;
		if (!modelName) return false;

		const models = [
			localModelEntry(modelName, {
				contextWindow: status.n_ctx ?? 32768,
				supportsVision: status.supports_vision ?? false,
			}),
		];

		try {
			const modelsRes = await fetch(`${baseUrl}/v1/models`, {
				signal: AbortSignal.timeout(1500),
			});
			if (modelsRes.ok) {
				const body = (await modelsRes.json()) as { data?: Array<{ id: string }> };
				for (const m of body.data ?? []) {
					if (m.id && m.id !== modelName) models.push(localModelEntry(m.id));
				}
			}
		} catch {
			// ignore; active model is enough
		}

		modelRegistry.registerProvider("skill-llm", {
			baseUrl: `${baseUrl}/v1`,
			apiKey: "SKILL_LLM_API_KEY",
			api: "openai-completions",
			models,
		});
		return true;
	} catch {
		return false;
	}
}

export async function startSkillLlmServer(mode: "local" | "remote" | "auto" = "auto"): Promise<{ ok: boolean; message: string }> {
	const localStart = async () => runNeuroSkill(["llm", "start"]);
	const remoteAttempts = [
		{ command: "llm_start", args: { mode: "remote" } },
		{ command: "llm_start", args: { remote: true } },
		{ command: "llm_start", args: { backend: "remote" } },
	];

	const tryRemote = async () => {
		for (const payload of remoteAttempts) {
			const r = await runNeuroSkill(["raw", JSON.stringify(payload)]);
			if (r.ok) return r;
		}
		return { ok: false, error: "remote llm_start ws command not supported" };
	};

	if (mode === "local") {
		const r = await localStart();
		return { ok: r.ok, message: r.ok ? "Skill LLM local server started." : (r.error ?? "Failed to start local server") };
	}

	if (mode === "remote") {
		const r = await tryRemote();
		if (r.ok) return { ok: true, message: "Skill LLM remote server started via WS." };
		return { ok: false, message: r.error ?? "Failed to start remote server" };
	}

	const remote = await tryRemote();
	if (remote.ok) return { ok: true, message: "Skill LLM remote server started via WS." };
	const local = await localStart();
	if (local.ok) return { ok: true, message: "Remote start unavailable; local llama.cpp server started." };
	return { ok: false, message: local.error ?? "Failed to start Skill LLM server" };
}

export async function autoBootSkillLlmIfConfigured(): Promise<void> {
	const raw = (process.env.NEUROLOOP_SKILL_LLM_BOOT ?? "off").toLowerCase();
	const mode = raw === "remote" || raw === "local" || raw === "auto" ? raw : "off";
	if (mode === "off") return;
	await startSkillLlmServer(mode);
}

export async function getSkillServerBaseUrl(): Promise<string> {
	const port = (await discoverSkillServer()) ?? getSkillPort();
	return `http://127.0.0.1:${port}`;
}
