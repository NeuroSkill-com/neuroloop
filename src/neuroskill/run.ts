/**
 * neuroskill/run.ts — low-level neuroskill process executor.
 *
 * Invokes the neuroskill CLI and returns parsed JSON or raw text.
 * All other modules import from here.
 *
 * Cross-platform notes:
 *   • On Windows, `npx` is a `.cmd` batch file — `execFile` cannot launch it
 *     directly; we must use `shell: true` so cmd.exe interprets the `.cmd`.
 *   • The Skill server port (default 8375) is auto-discovered or persisted
 *     in ~/.neuroloop/neuroskill_port.json.  We pass `--port <n>` to the CLI
 *     so it skips mDNS discovery (faster, more reliable on all platforms).
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getLocalNeuroSkillBinPath } from "../runtime-updates.ts";

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
let _port = 8375;

function loadPort(): number {
	try {
		if (existsSync(PORT_FILE)) {
			const { port } = JSON.parse(readFileSync(PORT_FILE, "utf8")) as { port: number };
			if (typeof port === "number" && port > 0 && port <= 65535) return port;
		}
	} catch { /* use default */ }
	return 8375;
}

function savePort(port: number): void {
	try {
		if (!existsSync(AGENT_DIR)) mkdirSync(AGENT_DIR, { recursive: true, mode: 0o700 });
		writeFileSync(PORT_FILE, JSON.stringify({ port }), { encoding: "utf8", mode: 0o600 });
	} catch { /* non-fatal */ }
}

_port = loadPort();

/** Get the current Skill server port. */
export function getSkillPort(): number { return _port; }

/** Set the Skill server port (persisted). */
export function setSkillPort(port: number): void { _port = port; savePort(port); }

/**
 * Probe the Skill server at a given port.  Returns true if responsive.
 */
export async function probeSkillServer(port: number = _port): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`, {
			signal: AbortSignal.timeout(2000),
		});
		if (!res.ok) return false;
		// Validate this is actually the Skill server, not a random HTTP service
		const body = (await res.json()) as Record<string, unknown>;
		return typeof body.status === "string";
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

	// 2. Common alternatives
	for (const p of [8375, 8376, 8377]) {
		if (p === _port) continue;
		if (await probeSkillServer(p)) { setSkillPort(p); return p; }
	}

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

		const { stdout } = await execFileAsync(hasLocalBin ? localBin : "npx", hasLocalBin ? cliArgs : ["neuroskill", ...cliArgs], {
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
