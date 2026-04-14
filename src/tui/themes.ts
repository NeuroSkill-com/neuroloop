/**
 * themes.ts — Switchable theme presets for NeuroLoop TUI.
 *
 * The pi-coding-agent Theme interface provides fg(color, text), bold(), dim().
 * We layer on top of that with "NeuroTheme" presets that remap the semantic
 * color names (accent, success, warning, error, etc.) to different palettes,
 * plus custom symbols and chrome.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// NeuroTheme definition
// ---------------------------------------------------------------------------

export interface NeuroTheme {
	id: string;
	name: string;
	description: string;
	/** Override ANSI color functions keyed by ThemeColor name. */
	colors: Partial<Record<string, (text: string) => string>>;
	/** Custom symbols (optional overrides). */
	symbols?: Partial<typeof DEFAULT_SYMBOLS>;
}

export const DEFAULT_SYMBOLS = {
	logo:         "◆",
	connected:    "●",
	connecting:   "⠋",
	offline:      "○",
	device:       "⎈",
	heart:        "♥",
	label:        "⬡",
	exgOnline:    "◉",
	exgOffline:   "◌",
	separator:    "─",
	barFilled:    "█",
	barEmpty:     "░",
	bandDelta:    "δ",
	bandTheta:    "θ",
	bandAlpha:    "α",
	bandBeta:     "β",
	bandGamma:    "γ",
};

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const esc = (code: string) => (text: string) => `\x1b[${code}m${text}\x1b[0m`;

const rgb = (r: number, g: number, b: number) =>
	(text: string) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;

// ---------------------------------------------------------------------------
// Built-in theme presets
// ---------------------------------------------------------------------------

export const BUILTIN_THEMES: NeuroTheme[] = [
	{
		id: "neuro-dark",
		name: "Neuro Dark",
		description: "Default dark theme with blue accents",
		colors: {},  // uses framework defaults
	},
	{
		id: "neuro-light",
		name: "Neuro Light",
		description: "Light-friendly with muted tones",
		colors: {
			accent:     rgb(30, 90, 180),
			success:    rgb(30, 140, 60),
			warning:    rgb(180, 120, 0),
			error:      rgb(180, 40, 40),
			dim:        rgb(120, 120, 120),
			muted:      rgb(100, 100, 100),
			syntaxType: rgb(0, 130, 130),
		},
	},
	{
		id: "calm",
		name: "Calm",
		description: "Soft greens and blues for relaxed sessions",
		colors: {
			accent:     rgb(100, 180, 200),
			success:    rgb(120, 200, 140),
			warning:    rgb(220, 200, 100),
			error:      rgb(200, 120, 120),
			dim:        rgb(80, 100, 100),
			muted:      rgb(60, 80, 80),
			syntaxType: rgb(140, 200, 180),
		},
		symbols: { logo: "◇", separator: "╌" },
	},
	{
		id: "focus",
		name: "Focus",
		description: "High-contrast amber on dark for deep work",
		colors: {
			accent:     rgb(255, 180, 0),
			success:    rgb(0, 220, 100),
			warning:    rgb(255, 200, 50),
			error:      rgb(255, 60, 60),
			dim:        rgb(100, 80, 50),
			muted:      rgb(80, 60, 40),
			syntaxType: rgb(200, 150, 50),
		},
		symbols: { logo: "◈" },
	},
	{
		id: "matrix",
		name: "Matrix",
		description: "Green phosphor terminal aesthetic",
		colors: {
			accent:     rgb(0, 255, 65),
			success:    rgb(0, 200, 50),
			warning:    rgb(0, 180, 40),
			error:      rgb(200, 0, 0),
			dim:        rgb(0, 80, 20),
			muted:      rgb(0, 60, 15),
			syntaxType: rgb(0, 220, 55),
		},
		symbols: { logo: "◆", separator: "·" },
	},
	{
		id: "dracula",
		name: "Dracula",
		description: "Popular dark theme with purple accents",
		colors: {
			accent:     rgb(189, 147, 249),  // purple
			success:    rgb(80, 250, 123),   // green
			warning:    rgb(255, 184, 108),  // orange
			error:      rgb(255, 85, 85),    // red
			dim:        rgb(98, 114, 164),   // comment
			muted:      rgb(68, 71, 90),     // current line
			syntaxType: rgb(139, 233, 253),  // cyan
		},
	},
	{
		id: "catppuccin",
		name: "Catppuccin",
		description: "Warm pastel tones",
		colors: {
			accent:     rgb(137, 180, 250),  // blue
			success:    rgb(166, 227, 161),  // green
			warning:    rgb(249, 226, 175),  // yellow
			error:      rgb(243, 139, 168),  // red
			dim:        rgb(147, 153, 178),  // overlay1
			muted:      rgb(108, 112, 134),  // overlay0
			syntaxType: rgb(148, 226, 213),  // teal
		},
	},
];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const THEME_STATE_PATH = join(homedir(), ".neuroloop", "theme.json");

export function loadThemeId(): string {
	try {
		if (existsSync(THEME_STATE_PATH)) {
			const data = JSON.parse(readFileSync(THEME_STATE_PATH, "utf8")) as { id?: string };
			if (data.id && BUILTIN_THEMES.some(t => t.id === data.id)) return data.id;
		}
	} catch { /* ignore */ }
	return "neuro-dark";
}

export function saveThemeId(id: string): void {
	const dir = join(homedir(), ".neuroloop");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(THEME_STATE_PATH, JSON.stringify({ id }), "utf8");
}

// ---------------------------------------------------------------------------
// Theme wrapper — intercepts fg() calls with preset overrides
// ---------------------------------------------------------------------------

let activeTheme: NeuroTheme = BUILTIN_THEMES[0];

export function getActiveTheme(): NeuroTheme {
	return activeTheme;
}

export function setActiveTheme(id: string): NeuroTheme | null {
	const found = BUILTIN_THEMES.find(t => t.id === id);
	if (!found) return null;
	activeTheme = found;
	saveThemeId(id);
	return found;
}

export function initTheme(): void {
	const id = loadThemeId();
	const found = BUILTIN_THEMES.find(t => t.id === id);
	if (found) activeTheme = found;
}

/**
 * Wrap the framework Theme to apply NeuroTheme color overrides.
 * Uses a Proxy so all other Theme methods/properties pass through unchanged.
 */
export function wrapTheme(base: Theme): Theme {
	if (activeTheme.id === "neuro-dark" && !Object.keys(activeTheme.colors).length) {
		return base; // no overrides needed for default theme
	}
	return new Proxy(base, {
		get(target, prop, receiver) {
			if (prop === "fg") {
				return (color: ThemeColor, text: string) => {
					const override = activeTheme.colors[color];
					if (override) return override(text);
					return target.fg(color, text);
				};
			}
			return Reflect.get(target, prop, receiver);
		},
	});
}

/** Get the symbol set for the active theme. */
export function symbols(): typeof DEFAULT_SYMBOLS {
	return { ...DEFAULT_SYMBOLS, ...activeTheme.symbols };
}
