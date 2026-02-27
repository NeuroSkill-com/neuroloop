/**
 * neuroskill/run.ts — low-level neuroskill process executor.
 *
 * Invokes the neuroskill binary (compiled dist or npx fallback) and returns
 * parsed JSON or raw text. All other modules import from here.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Max ms to wait for a single neuroskill call before giving up. */
export const NEUROSKILL_TIMEOUT_MS = 10_000;

export interface NeuroSkillResult<T = unknown> {
	ok: boolean;
	/** Parsed JSON — present when the command was called with --json and output is valid JSON. */
	data?: T;
	/** Raw stdout — always set on success. */
	text?: string;
	error?: string;
}

/**
 * Run a neuroskill command and return its output.
 * Stderr (mDNS discovery, transport info) is always ignored.
 * Returns parsed JSON when --json was passed, otherwise raw human-readable text.
 */
export async function runNeuroSkill<T = unknown>(args: string[]): Promise<NeuroSkillResult<T>> {
	try {
		const { stdout } = await execFileAsync("npx", ["neuroskill", ...args], {
			timeout: NEUROSKILL_TIMEOUT_MS,
			env: { ...process.env },
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
