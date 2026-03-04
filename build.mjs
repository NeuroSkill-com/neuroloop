/**
 * build.mjs — esbuild config for the `neuroloop` npm binary.
 *
 * Bundles all TypeScript source under src/ into a single dist/neuroloop.js.
 * Runtime deps (pi-coding-agent, pi-tui, typebox) are marked external so
 * they're resolved from node_modules at runtime, not inlined.
 *
 * Usage:
 *   node build.mjs          # production build
 *   node build.mjs --watch  # rebuild on change
 */

import { build } from "esbuild";
import { chmod, rm, copyFile, mkdir, readdir, stat, lstat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

/** Packages that must stay external (native addons, large runtime deps). */
const external = [
	"@mariozechner/pi-coding-agent",
	"@mariozechner/pi-tui",
	"@mariozechner/pi-ai",
	"@mariozechner/pi-agent-core",
	"@mariozechner/clipboard",
	"@mariozechner/clipboard-darwin-arm64",
	"@mariozechner/clipboard-darwin-universal",
	"@sinclair/typebox",
	// Node built-ins are always external in platform:node mode, but list
	// them explicitly to be safe.
	"node:*",
];

// ---------------------------------------------------------------------------
// pi-pkg asset sync
//
// pi-pkg/ acts as the PI_PACKAGE_DIR for the published package — it holds:
//   - package.json  (piConfig: name, configDir for neuroloop)
//   - dist/         (pi-coding-agent built assets: themes, export-html, …)
//   - docs/         (pi documentation)
//   - examples/     (pi examples)
//   - README.md / CHANGELOG.md
//
// In the local dev workspace these are symlinks into node_modules/. Symlinks
// that point outside the package root are NOT followed by `npm publish`, so
// the installed package ends up with missing files (→ crash on dark.json).
//
// This function replaces each symlink (or stale directory) with a real copy
// from the installed @mariozechner/pi-coding-agent package.
// ---------------------------------------------------------------------------

async function copyRecursive(src, dest) {
	const s = await stat(src);
	if (s.isDirectory()) {
		await mkdir(dest, { recursive: true });
		for (const entry of await readdir(src)) {
			await copyRecursive(join(src, entry), join(dest, entry));
		}
	} else {
		await copyFile(src, dest);
	}
}

async function setupPiPkg() {
	const piCodingAgentDir = join(__dirname, "node_modules", "@mariozechner", "pi-coding-agent");
	const piPkgDir = join(__dirname, "pi-pkg");

	if (!existsSync(piCodingAgentDir)) {
		console.warn("⚠️  @mariozechner/pi-coding-agent not found in node_modules — skipping pi-pkg sync");
		return;
	}

	// Entries to sync: [relativePathInPiCodingAgent, relativePathInPiPkg]
	const entries = [
		["dist", "dist"],
		["docs", "docs"],
		["examples", "examples"],
		["README.md", "README.md"],
		["CHANGELOG.md", "CHANGELOG.md"],
	];

	for (const [srcRel, destRel] of entries) {
		const src = join(piCodingAgentDir, srcRel);
		const dest = join(piPkgDir, destRel);

		if (!existsSync(src)) {
			console.warn(`⚠️  pi-coding-agent/${srcRel} not found — skipping`);
			continue;
		}

		// If dest is a symlink or already exists, remove it first so we can
		// replace it with a real copy (lstat sees the symlink itself, not target).
		try {
			const lstatResult = await lstat(dest);
			if (lstatResult.isSymbolicLink() || lstatResult.isDirectory()) {
				await rm(dest, { recursive: true, force: true });
			} else {
				await rm(dest, { force: true });
			}
		} catch {
			// dest doesn't exist yet — that's fine.
		}

		await copyRecursive(src, dest);
		console.log(`✓ pi-pkg/${destRel} synced from pi-coding-agent`);
	}
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

if (!watch) {
	// Sync pi-pkg assets before the esbuild step so that prepublishOnly
	// produces a fully self-contained package.
	await setupPiPkg();
}

const ctx = await build({
	entryPoints: ["src/main.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	outfile: "dist/neuroloop.js",
	external,
	// Inject shebang so the file is directly executable.
	banner: { js: "#!/usr/bin/env node" },
	// Keep import.meta.url working correctly (needed for __dirname equivalent).
	sourcemap: true,
	// TypeScript paths use .ts extensions — esbuild handles this natively.
	// No tsconfig.json override needed (esbuild reads it automatically).
	logLevel: "info",
	...(watch
		? {
				watch: {
					onRebuild(error) {
						if (error) console.error("watch build failed:", error);
						else console.log("rebuild ok →", new Date().toLocaleTimeString());
					},
				},
		  }
		: {}),
});

if (!watch) {
	// Make the output executable (chmod +x).
	await chmod("dist/neuroloop.js", 0o755);
	console.log("✓ dist/neuroloop.js built and marked executable");
	await ctx.dispose?.();
}
