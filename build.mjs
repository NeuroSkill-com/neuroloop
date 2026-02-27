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
import { chmod } from "node:fs/promises";

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
