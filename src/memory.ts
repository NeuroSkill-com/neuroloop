/**
 * memory.ts — persistent agent memory backed by ~/.neuroskill/memory.md
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const MEMORY_PATH = join(homedir(), ".neuroskill", "memory.md");

/** Read the memory file. Returns undefined if it doesn't exist. */
export function readMemory(path = MEMORY_PATH): string | undefined {
	if (!existsSync(path)) return undefined;
	return readFileSync(path, "utf-8").trim() || undefined;
}

/** Maximum memory file size (512 KB). Prevents unbounded growth. */
const MAX_MEMORY_BYTES = 512 * 1024;

/** Write or append to the memory file, creating parent dirs as needed. */
export function writeMemory(content: string, mode: "overwrite" | "append", path = MEMORY_PATH): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

	if (mode === "append") {
		const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
		const sep = existing && !existing.endsWith("\n") ? "\n" : "";
		const combined = existing + sep + content;
		if (Buffer.byteLength(combined, "utf-8") > MAX_MEMORY_BYTES) {
			throw new Error(`Memory file would exceed ${MAX_MEMORY_BYTES / 1024} KB limit. Use mode "overwrite" to replace, or trim old entries first.`);
		}
		writeFileSync(path, combined, { encoding: "utf-8", mode: 0o600 });
	} else {
		const trimmed = Buffer.byteLength(content, "utf-8") > MAX_MEMORY_BYTES
			? content.slice(0, MAX_MEMORY_BYTES)
			: content;
		writeFileSync(path, trimmed, { encoding: "utf-8", mode: 0o600 });
	}
}
