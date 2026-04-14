/**
 * logo.ts — NeuroLoop ASCII art logo for TUI header.
 *
 * Rendered in pink/magenta at startup, inspired by OpenCode's approach:
 * centered block-letter art with color accents and a small ™ top-right.
 */

import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// ASCII art — "NeuroLoop" in block letters with ™ top-right
// ---------------------------------------------------------------------------

// "NeuroLoop" — N and L are tall (5-row) block capitals,
// lowercase e u r o / o o p are short (3-row), sitting on the baseline.
// Top 2 rows only have N and L; lowercase starts on row 3.
// All lines padded to same visible width.
// "NeuroLoop" — N and L are tall 6-row block capitals,
// lowercase e,u,r,o / o,o,p are short 3-row, sitting on the baseline.
// All lines are exactly 62 chars wide.
// "NeuroLoop" — all letters in bold ██ block style, pink. ™ top-right.
const LOGO_ART_RAW = [
	"███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗ ██╗     ██████╗  ██████╗ ██████╗",
	"████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗██║    ██╔═══██╗██╔═══██╗██╔══██╗",
	"██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║██║    ██║   ██║██║   ██║██████╔╝",
	"██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██║    ██║   ██║██║   ██║██╔═══╝",
	"██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝██████╗╚██████╔╝╚██████╔╝██║",
	"╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝",
];

// Compact version for narrow terminals
const LOGO_COMPACT_RAW = [
	"█╗  █╗                    █╗              ",
	"██╗ █║┌─┐┬ ┬┬─┐┌─┐      █║  ┌─┐┌─┐┌─┐  ",
	"█╔██║ ├┤ │ │├┬┘│ │      █║  │ ││ │├─┘  ",
	"█║╚█║ └─┘└─┘┴└─└─┘      █████└─┘└─┘┴    ",
	"╚╝ ╚╝                    ╚════╝           ",
];

// Minimal single-line for very narrow terminals
const LOGO_MINI = "◆ NeuroLoop™";

/** Pad all lines to the same width and put ™ at top-right corner. */
function padArt(raw: string[]): string[] {
	const maxW = Math.max(...raw.map(l => [...l].length));
	// +1 for the ™ character on line 0
	const targetW = maxW + 1;
	const padded = raw.map(l => l + " ".repeat(Math.max(0, targetW - [...l].length)));
	// Place ™ as last char of first line
	padded[0] = padded[0].slice(0, -1) + "™";
	return padded;
}

const LOGO_ART = padArt(LOGO_ART_RAW);
const LOGO_COMPACT = padArt(LOGO_COMPACT_RAW);

// Pink/magenta ANSI color
const pink = (text: string) => `\x1b[38;2;255;105;180m${text}\x1b[0m`;
const magenta = (text: string) => `\x1b[38;2;200;80;200m${text}\x1b[0m`;
const hotpink = (text: string) => `\x1b[38;2;255;20;147m${text}\x1b[0m`;
const dimPink = (text: string) => `\x1b[38;2;180;80;130m${text}\x1b[0m`;

const FULL_ART_WIDTH = visibleWidth(LOGO_ART[0]);
const COMPACT_ART_WIDTH = visibleWidth(LOGO_COMPACT[0]);

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render the NeuroLoop ASCII art logo, centered within the given width.
 * The ™ on the first line is rendered in a dimmer pink for subtlety.
 * Picks full/compact/mini based on available terminal width.
 */
export function renderLogo(width: number, theme: Theme): string[] {
	const lines: string[] = [];

	if (width >= FULL_ART_WIDTH + 4) {
		for (let i = 0; i < LOGO_ART.length; i++) {
			const row = LOGO_ART[i];
			const pad = Math.max(0, Math.floor((width - FULL_ART_WIDTH) / 2));
			if (i === 0) {
				// First line has ™ at the end — render it dimmer
				const tmIdx = row.lastIndexOf("™");
				const body = row.slice(0, tmIdx);
				lines.push(truncateToWidth(" ".repeat(pad) + hotpink(body) + dimPink("™"), width));
			} else {
				lines.push(truncateToWidth(" ".repeat(pad) + hotpink(row), width));
			}
		}
	} else if (width >= COMPACT_ART_WIDTH + 4) {
		for (let i = 0; i < LOGO_COMPACT.length; i++) {
			const row = LOGO_COMPACT[i];
			const pad = Math.max(0, Math.floor((width - COMPACT_ART_WIDTH) / 2));
			if (i === 0) {
				const body = row.slice(0, -1);
				lines.push(truncateToWidth(" ".repeat(pad) + pink(body) + dimPink("™"), width));
			} else {
				lines.push(truncateToWidth(" ".repeat(pad) + pink(row), width));
			}
		}
	} else {
		const pad = Math.max(0, Math.floor((width - visibleWidth(LOGO_MINI)) / 2));
		lines.push(truncateToWidth(" ".repeat(pad) + hotpink("◆ NeuroLoop") + dimPink("™"), width));
	}

	return lines;
}

/**
 * Render a subtle tagline beneath the logo.
 */
export function renderTagline(width: number, theme: Theme, version: string): string {
	const tag = `v${version}`;
	const text = magenta("brain-aware coding") + theme.fg("dim", `  ${tag}`);
	const textWidth = visibleWidth("brain-aware coding") + visibleWidth(`  ${tag}`);
	const pad = Math.max(0, Math.floor((width - textWidth) / 2));
	return truncateToWidth(" ".repeat(pad) + text, width);
}
