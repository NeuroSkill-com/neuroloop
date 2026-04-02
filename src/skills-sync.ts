import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const BUNDLED_SKILLS_DIR = join(SRC_DIR, "..", "skills");
const AGENT_SKILLS_DIR = join(homedir(), ".neuroloop", "skills");
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

export interface SkillsSyncProgress {
	stage: string;
	percent: number;
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

function hasSkillsContent(root: string): boolean {
	if (!existsSync(root)) return false;
	if (existsSync(join(root, "SKILL.md"))) return true;

	const containers = [root, join(root, "skills")];
	for (const container of containers) {
		if (!existsSync(container)) continue;
		try {
			for (const entry of readdirSync(container, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				if (existsSync(join(container, entry.name, "SKILL.md"))) return true;
			}
		} catch {
			// Ignore unreadable dirs.
		}
	}
	return false;
}

function formatErr(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function getAgentSkillsDir(): string {
	return AGENT_SKILLS_DIR;
}

export async function syncSkillsFromGitHub(
	opts: { force?: boolean; onProgress?: (progress: SkillsSyncProgress) => void } = {},
): Promise<SkillsSyncResult> {
	const force = opts.force ?? false;
	const onProgress = opts.onProgress;
	const report = (stage: string, percent: number) => onProgress?.({ stage, percent });
	const parentDir = dirname(AGENT_SKILLS_DIR);
	mkdirSync(parentDir, { recursive: true });
	report("Preparing skills sync", 5);

	try {
		const hasGitClone = existsSync(join(AGENT_SKILLS_DIR, ".git"));

		if (hasGitClone) {
			report("Fetching latest skills", 20);
			const before = maybeRev(AGENT_SKILLS_DIR);
			git(["fetch", "--all", "--prune"], AGENT_SKILLS_DIR);
			report("Applying latest skills", 70);
			git(["reset", "--hard", "origin/HEAD"], AGENT_SKILLS_DIR);
			const after = maybeRev(AGENT_SKILLS_DIR);
			const updated = !!after && before !== after;
			report("Finalizing skills sync", 95);
			report("Skills sync complete", 100);
			return {
				ok: true,
				updated,
				skipped: false,
				before,
				after,
				message: updated
					? `Skills cache updated in ${AGENT_SKILLS_DIR} (${before?.slice(0, 7) ?? "none"} → ${after.slice(0, 7)}).`
					: `Skills cache is already up to date in ${AGENT_SKILLS_DIR}.`,
			};
		}

		if (!force && hasSkillsContent(AGENT_SKILLS_DIR)) {
			report("Using local skills cache", 100);
			return {
				ok: true,
				updated: false,
				skipped: true,
				message: `Using existing local skills cache from ${AGENT_SKILLS_DIR}.`,
			};
		}

		report("Downloading skills repository", 20);
		git(["clone", "--depth", "1", SKILLS_REPO_URL, AGENT_SKILLS_DIR], parentDir);
		report("Finalizing downloaded skills", 90);
		const after = maybeRev(AGENT_SKILLS_DIR);
		report("Skills sync complete", 100);
		return {
			ok: true,
			updated: true,
			skipped: false,
			after,
			message: `Skills downloaded to ${AGENT_SKILLS_DIR}${after ? ` (${after.slice(0, 7)})` : ""}.`,
		};
	} catch (error) {
		const syncError = formatErr(error);
		report("Skills sync failed", 100);
		if (hasSkillsContent(BUNDLED_SKILLS_DIR)) {
			return {
				ok: true,
				updated: false,
				skipped: true,
				message: `Failed to refresh ${AGENT_SKILLS_DIR}; using bundled package skills.`,
				error: syncError,
			};
		}

		return {
			ok: false,
			updated: false,
			skipped: false,
			message: "Failed to sync skills and no local fallback is available.",
			error: syncError,
		};
	}
}
