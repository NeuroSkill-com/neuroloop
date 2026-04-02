import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const NEUROLOOP_DIR = join(SRC_DIR, "..");
const SKILLS_DIR = join(NEUROLOOP_DIR, "skills");
const SKILLS_REPO_URL = "https://github.com/NeuroSkill-com/skills.git";

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

function hasLocalSkillsContent(): boolean {
	if (!existsSync(SKILLS_DIR)) return false;
	try {
		for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (existsSync(join(SKILLS_DIR, entry.name, "SKILL.md"))) return true;
		}
		if (existsSync(join(SKILLS_DIR, "skills"))) {
			for (const entry of readdirSync(join(SKILLS_DIR, "skills"), { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				if (existsSync(join(SKILLS_DIR, "skills", entry.name, "SKILL.md"))) return true;
			}
		}
	} catch {
		return false;
	}
	return false;
}

function cloneSkillsRepo(): SkillsSyncResult {
	try {
		git(["clone", "--depth", "1", SKILLS_REPO_URL, SKILLS_DIR], NEUROLOOP_DIR);
		const after = maybeRev(SKILLS_DIR);
		return {
			ok: true,
			updated: true,
			skipped: false,
			after,
			message: `Skills were missing locally; cloned from GitHub${after ? ` (${after.slice(0, 7)})` : ""}.`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			updated: false,
			skipped: false,
			message: "Failed to clone missing skills from GitHub.",
			error: message,
		};
	}
}

export async function syncSkillsFromGitHub(opts: { force?: boolean } = {}): Promise<SkillsSyncResult> {
	const force = opts.force ?? false;

	const hasGitCheckout = existsSync(join(NEUROLOOP_DIR, ".git"));
	const hasSkills = hasLocalSkillsContent();

	// First thing: if skills are missing, fetch them immediately.
	if (!hasSkills) {
		if (existsSync(SKILLS_DIR) && existsSync(join(SKILLS_DIR, ".git"))) {
			// Existing standalone clone: refresh it instead of recloning.
			try {
				const before = maybeRev(SKILLS_DIR);
				git(["fetch", "--all", "--prune"], SKILLS_DIR);
				git(["reset", "--hard", "origin/HEAD"], SKILLS_DIR);
				const after = maybeRev(SKILLS_DIR);
				return {
					ok: true,
					updated: before !== after,
					skipped: false,
					before,
					after,
					message: "Skills were missing locally; refreshed standalone skills clone from GitHub.",
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					updated: false,
					skipped: false,
					message: "Failed to refresh standalone skills clone.",
					error: message,
				};
			}
		}
		return cloneSkillsRepo();
	}

	if (!hasGitCheckout) {
		return {
			ok: true,
			updated: false,
			skipped: true,
			message: "Using local bundled skills (no git checkout).",
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
