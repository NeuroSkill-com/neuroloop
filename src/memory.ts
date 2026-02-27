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

/** Write or append to the memory file, creating parent dirs as needed. */
export function writeMemory(content: string, mode: "overwrite" | "append", path = MEMORY_PATH): void {
	mkdirSync(dirname(path), { recursive: true });

	if (mode === "append") {
		const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
		const sep = existing && !existing.endsWith("\n") ? "\n" : "";
		writeFileSync(path, existing + sep + content, "utf-8");
	} else {
		writeFileSync(path, content, "utf-8");
	}
}
