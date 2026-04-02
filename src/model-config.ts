import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MODEL_CONFIG_PATH = join(homedir(), ".neuroloop", "models.json");

export interface ModelConfigModel {
	id: string;
	name?: string;
	reasoning?: boolean;
	input?: Array<"text" | "image">;
	contextWindow?: number;
	maxTokens?: number;
	cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export interface ModelConfigProvider {
	baseUrl?: string;
	api?: string;
	apiKey?: string;
	authHeader?: boolean;
	headers?: Record<string, string>;
	models?: ModelConfigModel[];
}

interface ModelsFile {
	providers: Record<string, ModelConfigProvider>;
}

function defaultModelsFile(): ModelsFile {
	return { providers: {} };
}

export function readModelsFile(): ModelsFile {
	try {
		if (!existsSync(MODEL_CONFIG_PATH)) return defaultModelsFile();
		const parsed = JSON.parse(readFileSync(MODEL_CONFIG_PATH, "utf8")) as ModelsFile;
		if (!parsed.providers || typeof parsed.providers !== "object") return defaultModelsFile();
		return parsed;
	} catch {
		return defaultModelsFile();
	}
}

export function writeModelsFile(file: ModelsFile): void {
	const dir = join(homedir(), ".neuroloop");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(MODEL_CONFIG_PATH, JSON.stringify(file, null, 2) + "\n", {
		encoding: "utf8",
		mode: 0o600,
	});
}

export function upsertProviderModel(params: {
	provider: string;
	baseUrl: string;
	api: string;
	apiKey: string;
	authHeader: boolean;
	modelId: string;
	modelName?: string;
	reasoning: boolean;
	supportsVision: boolean;
	contextWindow: number;
	maxTokens: number;
}): void {
	const file = readModelsFile();
	const provider = file.providers[params.provider] ?? {};

	provider.baseUrl = params.baseUrl;
	provider.api = params.api;
	provider.apiKey = params.apiKey;
	provider.authHeader = params.authHeader;

	const models = provider.models ?? [];
	const idx = models.findIndex((m) => m.id === params.modelId);
	const model: ModelConfigModel = {
		id: params.modelId,
		name: params.modelName?.trim() || undefined,
		reasoning: params.reasoning,
		input: params.supportsVision ? ["text", "image"] : ["text"],
		contextWindow: params.contextWindow,
		maxTokens: params.maxTokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};

	if (idx >= 0) models[idx] = { ...models[idx], ...model };
	else models.push(model);

	provider.models = models;
	file.providers[params.provider] = provider;
	writeModelsFile(file);
}

export async function openModelsFileInSystem(): Promise<void> {
	const path = MODEL_CONFIG_PATH;
	if (process.platform === "darwin") {
		await execFileAsync("open", [path]);
		return;
	}
	if (process.platform === "win32") {
		await execFileAsync("cmd", ["/c", "start", "", path], { shell: true, windowsHide: true });
		return;
	}
	await execFileAsync("xdg-open", [path]);
}
