/**
 * neuroskill/run.ts — low-level neuroskill process executor.
 *
 * Invokes the neuroskill CLI and returns parsed JSON or raw text.
 * All other modules import from here.
 *
 * Cross-platform notes:
 *   • On Windows, `npx` is a `.cmd` batch file — `execFile` cannot launch it
 *     directly; we must use `shell: true` so cmd.exe interprets the `.cmd`.
 *   • The Skill server port (default 18444) is auto-discovered or persisted
 *     in ~/.neuroloop/neuroskill_port.json.  We pass `--port <n>` to the CLI
 *     so it skips mDNS discovery (faster, more reliable on all platforms).
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getLocalNeuroSkillBinPath } from "../runtime-updates.ts";

// ---------------------------------------------------------------------------
// Auth status — describes how we're connected to the daemon
// ---------------------------------------------------------------------------

export type AuthStatus = "local" | "lan" | "remote" | "none";

/** Cached auth status, updated by checkAuthStatus(). */
let _authStatus: AuthStatus = "none";

/** Get the last-known auth status without re-probing. */
export function getAuthStatus(): AuthStatus { return _authStatus; }

/**
 * Determine how (or whether) we're connected to the skill daemon.
 *  - "local"  — daemon reachable on 127.0.0.1; token auto-read from disk.
 *  - "lan"    — daemon reachable on a LAN address (future use).
 *  - "remote" — iroh relay (future use).
 *  - "none"   — daemon unreachable.
 */
export async function checkAuthStatus(): Promise<AuthStatus> {
	// Try localhost first (the common case).
	const port = await discoverSkillServer();
	if (port !== null) {
		_authStatus = "local";
		return "local";
	}
	// TODO: LAN and iroh remote discovery will be added here.
	_authStatus = "none";
	return "none";
}

/**
 * Return the platform-specific path to the daemon auth token file.
 */
export function getDaemonTokenPath(): string {
	const configDir = process.env.XDG_CONFIG_HOME
		|| (process.platform === "win32"
			? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"))
			: join(homedir(), process.platform === "darwin" ? "Library/Application Support" : ".config"));
	return join(configDir, "skill", "daemon", "auth.token");
}

const execFileAsync = promisify(execFile);

/** Max ms to wait for a single neuroskill call before giving up. */
export const NEUROSKILL_TIMEOUT_MS = 30_000;

export interface NeuroSkillResult<T = unknown> {
	ok: boolean;
	/** Parsed JSON — present when the output is valid JSON. */
	data?: T;
	/** Raw stdout — always set on success. */
	text?: string;
	error?: string;
}

// ---------------------------------------------------------------------------
// Port management — persist discovered/configured port
// ---------------------------------------------------------------------------

const AGENT_DIR = join(homedir(), ".neuroloop");
const PORT_FILE = join(AGENT_DIR, "neuroskill_port.json");
let _port = 18444;

// ---------------------------------------------------------------------------
// Binary resolution priority: "bundled" (default) or "system"
// ---------------------------------------------------------------------------

export type BinPriority = "bundled" | "system";
let _binPriority: BinPriority = "bundled";

export function getBinPriority(): BinPriority { return _binPriority; }
export function setBinPriority(p: BinPriority): void { _binPriority = p; saveConfig(); }

interface ConfigFile { port?: number; binPriority?: BinPriority }

function loadConfig(): { port: number; binPriority: BinPriority } {
	try {
		if (existsSync(PORT_FILE)) {
			const cfg = JSON.parse(readFileSync(PORT_FILE, "utf8")) as ConfigFile;
			const port = (typeof cfg.port === "number" && cfg.port > 0 && cfg.port <= 65535) ? cfg.port : 18444;
			const binPriority = cfg.binPriority === "system" ? "system" : "bundled";
			return { port, binPriority };
		}
	} catch { /* use defaults */ }
	return { port: 18444, binPriority: "bundled" };
}

function saveConfig(): void {
	try {
		if (!existsSync(AGENT_DIR)) mkdirSync(AGENT_DIR, { recursive: true, mode: 0o700 });
		writeFileSync(PORT_FILE, JSON.stringify({ port: _port, binPriority: _binPriority }), { encoding: "utf8", mode: 0o600 });
	} catch { /* non-fatal */ }
}

// Back-compat aliases
function savePort(port: number): void { _port = port; saveConfig(); }

{
	const cfg = loadConfig();
	_port = cfg.port;
	_binPriority = cfg.binPriority;
}

/** Get the current Skill server port. */
export function getSkillPort(): number { return _port; }

/** Set the Skill server port (persisted). */
export function setSkillPort(port: number): void { _port = port; savePort(port); }

/**
 * Probe the Skill server at a given port.  Returns true if responsive.
 */
export async function probeSkillServer(port: number = _port): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
			signal: AbortSignal.timeout(2000),
		});
		if (!res.ok) return false;
		// Validate this is actually the Skill server, not a random HTTP service
		const body = (await res.json()) as Record<string, unknown>;
		return body.ok === true || typeof body.status === "string";
	} catch { return false; }
}

/**
 * Try to discover the Skill server.  Tries the saved port, then common
 * alternatives, then a platform-specific process scan.
 * Returns the port if found, null otherwise.  Updates the persisted port on success.
 */
export async function discoverSkillServer(): Promise<number | null> {
	// 1. Saved / default port
	if (await probeSkillServer(_port)) return _port;

	// 2. Default daemon port (if saved port differs)
	if (_port !== 18444 && await probeSkillServer(18444)) { setSkillPort(18444); return 18444; }

	// 3. Platform-specific discovery (macOS/Linux only — lsof can filter by process name)
	if (process.platform !== "win32") {
		const { exec } = await import("node:child_process");
		const discoveredPort = await new Promise<number | null>((resolve) => {
			exec(
				"lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -iE 'skill|neuroskill' | head -5",
				(_, stdout) => {
					if (!stdout) { resolve(null); return; }
					for (const line of stdout.split("\n")) {
						const m = line.match(/:(\d{4,5})\s/);
						if (m) { resolve(parseInt(m[1], 10)); return; }
					}
					resolve(null);
				},
			);
		});
		if (discoveredPort && await probeSkillServer(discoveredPort)) {
			setSkillPort(discoveredPort);
			return discoveredPort;
		}
	}
	// Windows: steps 1+2 (direct HTTP probe on common ports) already cover all
	// practical cases — netstat -ano only shows PIDs, not process names, so
	// there is nothing useful to filter on.

	return null;
}

// ---------------------------------------------------------------------------
// Label helper — uses raw JSON to reliably set label_start_utc
// ---------------------------------------------------------------------------

/**
 * Create a label via `neuroskill raw` JSON command.
 * This bypasses the CLI `label` subcommand which has a bug where `--at`
 * doesn't forward `label_start` to the server, causing NOT NULL violations.
 */
export async function createLabel(text: string, context?: string): Promise<NeuroSkillResult> {
	const payload: Record<string, unknown> = {
		command: "label",
		text,
		label_start_utc: Math.floor(Date.now() / 1000),
	};
	if (context) payload.context = context;
	return runNeuroSkill(["raw", JSON.stringify(payload)]);
}

// ---------------------------------------------------------------------------
// Run neuroskill CLI
// ---------------------------------------------------------------------------

const IS_WINDOWS = process.platform === "win32";

/** Maximum stdout buffer — neuroskill compare can be large. */
const MAX_BUFFER = 8 * 1024 * 1024; // 8 MB

/**
 * Escape a single argument for safe use with cmd.exe when shell: true.
 * Wraps in double quotes and escapes inner double-quotes, percent signs,
 * and other cmd.exe metacharacters.  On non-Windows this is a no-op.
 */
function escapeArg(arg: string): string {
	if (!IS_WINDOWS) return arg;
	// If the arg is safe (no special chars), skip quoting
	if (/^[a-zA-Z0-9_./:=@-]+$/.test(arg)) return arg;
	// Escape double quotes inside, then wrap in double quotes.
	// Also escape % to %% so cmd.exe doesn't expand env vars.
	const escaped = arg.replace(/%/g, "%%").replace(/"/g, '\\"');
	return `"${escaped}"`;
}

/**
 * Run a neuroskill command and return its output.
 * Stderr (mDNS discovery, transport info) is always ignored.
 * Returns parsed JSON when output is valid JSON, otherwise raw text.
 *
 * On Windows, `shell: true` is required because `npx` is a `.cmd` script
 * that cmd.exe must interpret.  All arguments are escaped to prevent
 * shell injection.  We also pass `--port` to skip mDNS discovery inside
 * the CLI (faster, avoids Bonjour dependency on Windows).
 */
export async function runNeuroSkill<T = unknown>(args: string[]): Promise<NeuroSkillResult<T>> {
	try {
		const localBin = getLocalNeuroSkillBinPath();
		const hasLocalBin = existsSync(localBin);
		const cliArgs = ["--port", String(_port), ...args.map(escapeArg)];

		// Resolve binary: bundled-first (default) prefers the local install,
		// system-first prefers npx/global and falls back to bundled.
		let bin: string;
		let finalArgs: string[];
		if (_binPriority === "bundled" && hasLocalBin) {
			bin = localBin;
			finalArgs = cliArgs;
		} else if (_binPriority === "system") {
			bin = "npx";
			finalArgs = ["neuroskill", ...cliArgs];
		} else if (hasLocalBin) {
			bin = localBin;
			finalArgs = cliArgs;
		} else {
			bin = "npx";
			finalArgs = ["neuroskill", ...cliArgs];
		}

		const { stdout } = await execFileAsync(bin, finalArgs, {
			timeout: NEUROSKILL_TIMEOUT_MS,
			maxBuffer: MAX_BUFFER,
			env: { ...process.env },
			// Windows: npx is a .cmd batch file — must run through cmd.exe
			shell: IS_WINDOWS,
			// Windows: hide the transient cmd.exe window
			...(IS_WINDOWS && { windowsHide: true }),
		});

		const text = stdout.trim();
		if (!text) return { ok: false, error: "empty response" };

		try {
			const data = JSON.parse(text) as T;
			return { ok: true, data, text };
		} catch {
			return { ok: true, text };
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, error: msg };
	}
}
