import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const NEUROLOOP_DIR = join(SRC_DIR, "..");
const SKILLS_DIR = join(NEUROLOOP_DIR, "skills");

export interface SkillsSyncResult {
	ok: boolean;
	updated: boolean;
	skipped: boolean;
	before?: string;
	after?: string;
	message: string;
	error?: string;
}

function git(args: string[], cwd: string): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function maybeRev(cwd: string): string | undefined {
	try {
		return git(["rev-parse", "HEAD"], cwd);
	} catch {
		return undefined;
	}
}

export async function syncSkillsFromGitHub(opts: { force?: boolean } = {}): Promise<SkillsSyncResult> {
	const force = opts.force ?? false;

	if (!existsSync(join(NEUROLOOP_DIR, ".git"))) {
		return {
			ok: true,
			updated: false,
			skipped: true,
			message: "Git checkout not found; skipping skills sync.",
		};
	}

	if (!existsSync(SKILLS_DIR)) {
		return {
			ok: true,
			updated: false,
			skipped: true,
			message: "skills/ directory not found; skipping skills sync.",
		};
	}

	try {
		// Ensure the submodule exists locally.
		git(["submodule", "update", "--init", "--", "skills"], NEUROLOOP_DIR);

		const before = maybeRev(SKILLS_DIR);
		const args = ["submodule", "update", "--init", "--remote"];
		if (force) args.push("--force");
		args.push("--", "skills");
		git(args, NEUROLOOP_DIR);
		const after = maybeRev(SKILLS_DIR);

		const updated = !!after && before !== after;
		return {
			ok: true,
			updated,
			skipped: false,
			before,
			after,
			message: updated
				? `Skills updated from GitHub (${before?.slice(0, 7) ?? "none"} → ${after.slice(0, 7)}).`
				: "No new skills update yet; waiting for the next GitHub update.",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			updated: false,
			skipped: false,
			message: "Failed to sync skills from GitHub.",
			error: message,
		};
	}
}
