import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const AGENT_DIR = join(homedir(), ".neuroloop");
const RUNTIME_PREFIX = join(AGENT_DIR, "runtime");
const RUNTIME_NODE_MODULES = join(RUNTIME_PREFIX, "node_modules");
const IS_WINDOWS = process.platform === "win32";

export interface RuntimeVersionState {
	checkedAt: number;
	neuroloop: {
		local: string;
		npmLatest?: string;
		upToDate?: boolean;
		updated?: boolean;
		updateError?: string;
	};
	neuroskill: {
		localInstalled?: string;
		npmLatest?: string;
		upToDate?: boolean;
		installedNow?: boolean;
		installError?: string;
	};
	github: {
		latestCommit?: string;
		latestTag?: string;
		error?: string;
	};
}

let runtimeState: RuntimeVersionState | null = null;

function parseSemver(v: string): number[] {
	const [core] = v.trim().split("-");
	return core.split(".").map((n) => parseInt(n, 10) || 0);
}

function compareSemver(a: string, b: string): number {
	const av = parseSemver(a);
	const bv = parseSemver(b);
	const max = Math.max(av.length, bv.length);
	for (let i = 0; i < max; i++) {
		const ai = av[i] ?? 0;
		const bi = bv[i] ?? 0;
		if (ai > bi) return 1;
		if (ai < bi) return -1;
	}
	return 0;
}

async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T> {
	const res = await fetch(url, {
		headers: {
			"accept": "application/json",
			"user-agent": "neuroloop-version-check",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return (await res.json()) as T;
}

async function getNpmLatestVersion(pkg: string): Promise<string | undefined> {
	try {
		const data = await fetchJson<{ version?: string }>(`https://registry.npmjs.org/${pkg}/latest`, 6000);
		return data.version;
	} catch {
		return undefined;
	}
}

function getInstalledRuntimeVersion(pkg: string): string | undefined {
	try {
		const p = join(RUNTIME_NODE_MODULES, pkg, "package.json");
		if (!existsSync(p)) return undefined;
		const data = JSON.parse(readFileSync(p, "utf8")) as { version?: string };
		return data.version;
	} catch {
		return undefined;
	}
}

export function getLocalNeuroSkillBinPath(): string {
	return join(RUNTIME_NODE_MODULES, ".bin", IS_WINDOWS ? "neuroskill.cmd" : "neuroskill");
}

async function installRuntimePackage(pkg: string, version: string): Promise<void> {
	if (!existsSync(RUNTIME_PREFIX)) mkdirSync(RUNTIME_PREFIX, { recursive: true, mode: 0o700 });
	await execFileAsync("npm", ["install", "--prefix", RUNTIME_PREFIX, "--no-save", `${pkg}@${version}`], {
		timeout: 180_000,
		maxBuffer: 4 * 1024 * 1024,
		env: { ...process.env },
		...(IS_WINDOWS ? { shell: true, windowsHide: true } : {}),
	});
}

async function tryUpdateGlobalNeuroloop(version: string): Promise<string | undefined> {
	try {
		await execFileAsync("npm", ["install", "-g", `neuroloop@${version}`], {
			timeout: 180_000,
			maxBuffer: 4 * 1024 * 1024,
			env: { ...process.env },
			...(IS_WINDOWS ? { shell: true, windowsHide: true } : {}),
		});
		return undefined;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}

export async function refreshRuntimeVersions(localNeuroloopVersion: string): Promise<RuntimeVersionState> {
	const state: RuntimeVersionState = {
		checkedAt: Date.now(),
		neuroloop: { local: localNeuroloopVersion },
		neuroskill: {},
		github: {},
	};

	const [npmNeuroloop, npmNeuroskill] = await Promise.all([
		getNpmLatestVersion("neuroloop"),
		getNpmLatestVersion("neuroskill"),
	]);

	state.neuroloop.npmLatest = npmNeuroloop;
	if (npmNeuroloop) {
		state.neuroloop.upToDate = compareSemver(localNeuroloopVersion, npmNeuroloop) >= 0;
		if (!state.neuroloop.upToDate) {
			state.neuroloop.updateError = await tryUpdateGlobalNeuroloop(npmNeuroloop);
			state.neuroloop.updated = !state.neuroloop.updateError;
		}
	}

	state.neuroskill.npmLatest = npmNeuroskill;
	const installed = getInstalledRuntimeVersion("neuroskill");
	state.neuroskill.localInstalled = installed;
	if (npmNeuroskill) {
		const upToDate = installed ? compareSemver(installed, npmNeuroskill) >= 0 : false;
		state.neuroskill.upToDate = upToDate;
		if (!upToDate) {
			try {
				await installRuntimePackage("neuroskill", npmNeuroskill);
				state.neuroskill.localInstalled = getInstalledRuntimeVersion("neuroskill") ?? npmNeuroskill;
				state.neuroskill.installedNow = true;
				state.neuroskill.upToDate = true;
			} catch (err) {
				state.neuroskill.installError = err instanceof Error ? err.message : String(err);
			}
		}
	}

	try {
		const commit = await fetchJson<{ sha?: string }>(
			"https://api.github.com/repos/NeuroSkill-com/neuroloop/commits/main",
			6000,
		);
		state.github.latestCommit = commit.sha?.slice(0, 7);
	} catch (err) {
		state.github.error = err instanceof Error ? err.message : String(err);
	}

	try {
		const rel = await fetchJson<{ tag_name?: string }>(
			"https://api.github.com/repos/NeuroSkill-com/neuroloop/releases/latest",
			6000,
		);
		state.github.latestTag = rel.tag_name;
	} catch {
		// optional
	}

	runtimeState = state;
	return state;
}

export function getRuntimeVersionState(): RuntimeVersionState | null {
	return runtimeState;
}
