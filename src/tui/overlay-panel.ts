/**
 * overlay-panel.ts — Collapsible EXG sidebar overlay panel.
 *
 * Toggle with Ctrl+E. Shows real-time EXG metrics, score sparklines,
 * and band power distribution in a right-anchored overlay panel.
 */

import { Container, Text } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import { symbols } from "./themes.ts";

// ---------------------------------------------------------------------------
// Sparkline helpers
// ---------------------------------------------------------------------------

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

function sparkline(values: number[], width = 20): string {
	if (!values.length) return "";
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	const recent = values.slice(-width);
	return recent.map(v => {
		const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
		return SPARK_CHARS[idx];
	}).join("");
}

// ---------------------------------------------------------------------------
// Score history ring buffer
// ---------------------------------------------------------------------------

const HISTORY_SIZE = 60;  // keep last 60 data points

export interface ExgHistoryEntry {
	focus?:          number;
	cognitive_load?: number;
	relaxation?:     number;
	engagement?:     number;
	drowsiness?:     number;
	mood?:           number;
	hr?:             number;
	bands?: {
		rel_delta?: number;
		rel_theta?: number;
		rel_alpha?: number;
		rel_beta?:  number;
		rel_gamma?: number;
	};
	ts: number;
}

const history: ExgHistoryEntry[] = [];

export function pushHistory(entry: ExgHistoryEntry): void {
	history.push(entry);
	if (history.length > HISTORY_SIZE) history.shift();
}

export function getHistory(): readonly ExgHistoryEntry[] {
	return history;
}

export function clearHistory(): void {
	history.length = 0;
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

interface ExgPanelState {
	getMetrics: () => ExgHistoryEntry | null;
	getOnline: () => boolean;
	getDeviceName: () => string | null;
}

export interface ExgPanel {
	show(): void;
	hide(): void;
	toggle(): void;
	isVisible(): boolean;
	/** Call when metrics update to refresh panel content. */
	refresh(): void;
	dispose(): void;
}

export function createExgPanel(
	tui: TUI,
	theme: Theme,
	state: ExgPanelState,
): ExgPanel {
	let overlayHandle: ReturnType<typeof tui.showOverlay> | null = null;
	let visible = false;
	let panelText: InstanceType<typeof Text> | null = null;

	function renderContent(width: number): string[] {
		const lines: string[] = [];
		const s = symbols();
		const w = width - 4; // padding

		// Header
		lines.push(theme.fg("accent", ` ${s.logo} EXG Monitor`));
		lines.push(theme.fg("dim", " " + s.separator.repeat(Math.max(0, w))));

		if (!state.getOnline()) {
			lines.push("");
			lines.push(theme.fg("dim", "  " + s.exgOffline + " Device offline"));
			lines.push(theme.fg("dim", "  /connect to reconnect"));
			return lines;
		}

		const m = state.getMetrics();
		if (!m) {
			lines.push(theme.fg("dim", "  Waiting for data..."));
			return lines;
		}

		// Device
		const dev = state.getDeviceName();
		if (dev) {
			lines.push(theme.fg("dim", `  ${s.device} `) + theme.fg("accent", dev));
		}

		lines.push("");

		// Scores with sparklines
		const scoreRow = (label: string, field: keyof ExgHistoryEntry, color: ThemeColor, pct = true) => {
			const val = m[field] as number | undefined;
			if (val == null) return;
			const hist = history.map(h => (h[field] as number) ?? 0);
			const spark = theme.fg(color, sparkline(hist, Math.min(20, w - 18)));
			const valStr = pct ? `${(val * 100).toFixed(0)}%` : String(Math.round(val));
			lines.push(truncateToWidth(
				`  ${theme.fg("dim", label.padEnd(10))} ${theme.fg(color, valStr.padStart(4))} ${spark}`,
				width,
			));
		};

		scoreRow("Focus",     "focus",          "success");
		scoreRow("Cog.Load",  "cognitive_load", "warning");
		scoreRow("Relax",     "relaxation",     "success");
		scoreRow("Engage",    "engagement",     "accent");
		scoreRow("Drowsy",    "drowsiness",     "error");
		scoreRow("Mood",      "mood",           "success");
		if (m.hr != null) {
			scoreRow("Heart",   "hr",             "error", false);
		}

		lines.push("");
		lines.push(theme.fg("dim", " " + s.separator.repeat(Math.max(0, w))));
		lines.push(theme.fg("accent", "  Bands"));

		// Band bars
		const b = m.bands ?? {};
		const vals = [b.rel_delta, b.rel_theta, b.rel_alpha, b.rel_beta, b.rel_gamma];
		const scale = Math.max(...vals.map(v => v ?? 0), 1e-9);
		const barW = Math.max(5, Math.min(15, w - 14));

		const bandRow = (sym: string, label: string, val: number | undefined, color: ThemeColor) => {
			if (val == null) return;
			const filled = Math.min(barW, Math.round((val / scale) * barW));
			const empty = Math.max(0, barW - filled);
			const bar = theme.fg(color, s.barFilled.repeat(filled)) + theme.fg("dim", s.barEmpty.repeat(empty));
			const pct = `${Math.round(val * 100)}%`.padStart(4);
			lines.push(truncateToWidth(`  ${theme.fg("dim", sym)} ${bar} ${theme.fg(color, pct)}`, width));
		};

		bandRow(s.bandDelta, "delta", b.rel_delta, "accent");
		bandRow(s.bandTheta, "theta", b.rel_theta, "warning");
		bandRow(s.bandAlpha, "alpha", b.rel_alpha, "success");
		bandRow(s.bandBeta,  "beta",  b.rel_beta,  "error");
		bandRow(s.bandGamma, "gamma", b.rel_gamma, "syntaxType");

		// Trend summary
		if (history.length >= 5) {
			lines.push("");
			lines.push(theme.fg("dim", " " + s.separator.repeat(Math.max(0, w))));
			lines.push(theme.fg("accent", "  Trends") + theme.fg("dim", ` (${history.length} samples)`));

			const trend = (field: keyof ExgHistoryEntry, label: string) => {
				const vals = history.map(h => (h[field] as number) ?? 0).filter(v => v > 0);
				if (vals.length < 3) return;
				const recent = vals.slice(-5);
				const earlier = vals.slice(-10, -5);
				if (!earlier.length || !recent.length) return;
				const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
				const avgEarlier = earlier.reduce((a, b) => a + b, 0) / earlier.length;
				const delta = avgRecent - avgEarlier;
				const arrow = delta > 0.05 ? theme.fg("success", "↑") : delta < -0.05 ? theme.fg("error", "↓") : theme.fg("dim", "→");
				lines.push(`  ${theme.fg("dim", label.padEnd(10))} ${arrow}`);
			};

			trend("focus", "Focus");
			trend("relaxation", "Relax");
			trend("engagement", "Engage");
		}

		lines.push("");
		lines.push(theme.fg("muted", "  ctrl+e close  /exg details"));

		return lines;
	}

	function buildPanel() {
		panelText = new Text();
		panelText.setText(""); // will be updated by refresh()

		const container = new Container();
		container.addChild(panelText);

		overlayHandle = tui.showOverlay(container, {
			width: "30%",
			minWidth: 32,
			maxHeight: "80%",
			anchor: "right-center",
			offsetX: -1,
			nonCapturing: true,
		});
		visible = true;
		refresh();
	}

	function refresh() {
		if (!visible || !panelText) return;
		// The Text component takes a string; we join rendered lines with \n.
		// But since it goes through render(), we use a custom component instead.
		// For simplicity with Text, we just setText with newline-joined content.
		const width = 38;  // approximate panel width
		const content = renderContent(width);
		panelText.setText(content.join("\n"));
		tui.requestRender();
	}

	function show() {
		if (visible) return;
		buildPanel();
	}

	function hide() {
		if (overlayHandle) {
			overlayHandle.hide();
			overlayHandle = null;
		}
		panelText = null;
		visible = false;
	}

	function toggle() {
		if (visible) hide(); else show();
	}

	function dispose() {
		hide();
		clearHistory();
	}

	return { show, hide, toggle, isVisible: () => visible, refresh, dispose };
}
