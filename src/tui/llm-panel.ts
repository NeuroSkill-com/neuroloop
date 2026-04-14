/**
 * llm-panel.ts — Interactive LLM manager overlay panel.
 *
 * Shows server status, model catalog with download progress, and actions.
 * Toggle with /llm (no args). Download progress updates live in the footer;
 * the popup shows a snapshot at open time for action selection.
 */

import { Container, Text, SelectList } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { TUI, Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmModelEntry {
	filename: string;
	state: string;
	sizeGb?: number;
	quant?: string;
	paramsB?: string;
	familyName?: string;
	recommended?: boolean;
	isMmproj?: boolean;
	progress?: number;
}

export interface LlmServerStatus {
	status: string;
	modelName?: string;
	nCtx?: number;
	supportsVision?: boolean;
}

export interface LlmPanelCallbacks {
	fetchCatalog(): Promise<{ entries: LlmModelEntry[]; activeModel: string; activeMmproj: string } | null>;
	fetchStatus(): Promise<LlmServerStatus | null>;
	onAction(action: string, filename?: string): void;
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const HOTPINK = "\x1b[38;2;255;20;147m";
const RST = "\x1b[0m";
const BORDER_COLOR = "\x1b[38;2;140;100;180m";
const BG = "\x1b[48;2;25;20;35m";
const INVERSE = "\x1b[7m";
const BOLD_ON = "\x1b[1m";

const BD = { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" };

/**
 * Bordered panel that wraps a child component with double-line borders.
 */
class BorderedPanel implements Component {
	private child: Component;
	private title: string;
	private titleWidth: number;
	private hints: string;
	private paddingX: number;

	constructor(child: Component, opts: {
		title: string; titleWidth: number; hints: string; paddingX?: number;
	}) {
		this.child = child;
		this.title = opts.title;
		this.titleWidth = opts.titleWidth;
		this.hints = opts.hints;
		this.paddingX = opts.paddingX ?? 1;
	}

	invalidate() { this.child.invalidate?.(); }
	handleInput(data: string) { this.child.handleInput?.(data); }

	render(width: number): string[] {
		const innerW = Math.max(10, width - 2 - this.paddingX * 2);
		const totalInner = width - 2;
		const childLines = this.child.render(innerW);
		const pad = " ".repeat(this.paddingX);
		const lines: string[] = [];
		const b = (s: string) => BORDER_COLOR + s + RST;
		const bg = (content: string, contentW: number) => {
			const rp = Math.max(0, totalInner - contentW);
			return BG + content + " ".repeat(rp) + RST;
		};

		// Top border with title
		const titleSeg = ` ${this.title} `;
		const afterTitle = Math.max(0, totalInner - 2 - this.titleWidth - 2 - visibleWidth(this.hints) - 1);
		lines.push(truncateToWidth(
			b(BD.tl + BD.h.repeat(2)) + BG + titleSeg + RST +
			b(BD.h.repeat(afterTitle)) + this.hints + " " + b(BD.tr),
			width,
		));

		// Top padding
		lines.push(b(BD.v) + bg("", 0) + b(BD.v));

		// Child content
		for (const cl of childLines) {
			const line = pad + cl;
			lines.push(b(BD.v) + bg(line, visibleWidth(line)) + b(BD.v));
		}

		// Bottom padding + border
		lines.push(b(BD.v) + bg("", 0) + b(BD.v));
		lines.push(b(BD.bl + BD.h.repeat(totalInner) + BD.br));

		return lines;
	}
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface LlmPanel {
	show(): void;
	hide(): void;
	toggle(): void;
	isVisible(): boolean;
	dispose(): void;
}

export function createLlmPanel(
	tui: TUI,
	theme: Theme,
	callbacks: LlmPanelCallbacks,
): LlmPanel {
	let overlayHandle: ReturnType<typeof tui.showOverlay> | null = null;
	let visible = false;

	async function buildAndShow() {
		if (visible) { hide(); return; }

		const [catalog, status] = await Promise.all([
			callbacks.fetchCatalog(),
			callbacks.fetchStatus(),
		]);

		const items: Array<{ value: string; label: string; description: string }> = [];

		// Server status
		const statusIcon = status?.status === "running" ? theme.fg("success", "●")
			: status?.status === "loading" ? theme.fg("warning", "◐")
			: theme.fg("dim", "○");
		const statusText = status?.status ?? "unknown";
		const modelText = status?.modelName ? theme.fg("accent", ` ${status.modelName}`) : "";
		const ctxText = status?.nCtx ? theme.fg("dim", ` · ${status.nCtx} ctx`) : "";
		const visionText = status?.supportsVision ? theme.fg("dim", " · vision") : "";

		items.push({
			value: "__status__",
			label: ` ${statusIcon} Server: ${theme.bold(statusText)}${modelText}${ctxText}${visionText}`,
			description: "",
		});

		if (status?.status === "running") {
			items.push({ value: "action:stop", label: `   ${theme.fg("error", "⏹")} Stop server`, description: "" });
		} else {
			items.push({ value: "action:start", label: `   ${theme.fg("success", "▶")} Start server`, description: "" });
		}

		items.push({ value: "__sep0__", label: " ", description: "" });

		if (catalog) {
			const models = catalog.entries.filter(e => !e.isMmproj);
			const downloaded = models.filter(m => m.state === "downloaded");
			const downloading = models.filter(m => m.state === "downloading" || m.state === "paused");
			const available = models.filter(m => m.state !== "downloaded" && m.state !== "downloading" && m.state !== "paused");

			if (downloaded.length) {
				items.push({
					value: "__hdr_downloaded__",
					label: ` ${theme.bold("Downloaded")} ${theme.fg("dim", `(${downloaded.length})`)}`,
					description: "",
				});
				for (const m of downloaded) {
					const isActive = m.filename === catalog.activeModel;
					const marker = isActive ? theme.fg("success", " ▶ ") : "   ";
					const name = isActive ? theme.fg("accent", m.filename) : m.filename;
					const parts = [m.quant, m.paramsB ? `${m.paramsB}B` : "", m.sizeGb ? `${m.sizeGb.toFixed(1)} GB` : ""].filter(Boolean);
					const info = parts.length ? theme.fg("dim", "  " + parts.join(" · ")) : "";
					const rec = m.recommended ? theme.fg("warning", " ⭐") : "";
					items.push({ value: `select:${m.filename}`, label: `${marker}${name}${rec}${info}`, description: "" });
				}
			}

			if (downloading.length) {
				items.push({ value: "__sep1__", label: " ", description: "" });
				items.push({
					value: "__hdr_downloading__",
					label: ` ${theme.bold("Downloading")} ${theme.fg("dim", `(${downloading.length})`)}  ${theme.fg("dim", "— live progress in footer ↓")}`,
					description: "",
				});
				for (const m of downloading) {
					const icon = m.state === "paused"
						? theme.fg("warning", " ⏸ ")
						: theme.fg("accent", " ⬇ ");
					// Progress is already 0–100 from the live poll merge
					const pct = Math.max(0, Math.min(100, Math.round(m.progress ?? 0)));
					const barW = 20;
					const filled = Math.round((pct / 100) * barW);
					const empty = Math.max(0, barW - filled);
					const bar = HOTPINK + "█".repeat(filled) + RST
						+ "\x1b[90m" + "░".repeat(empty) + RST;
					const pctStr = HOTPINK + `${String(pct).padStart(3)}%` + RST;
					const stateHint = m.state === "paused" ? theme.fg("warning", " paused") : "";
					// Put bar IN the label so it's never hidden by selection
					items.push({
						value: `download:${m.filename}`,
						label: `${icon}${m.filename}  ${bar} ${pctStr}${stateHint}`,
						description: "",
					});
				}
			}

			if (available.length) {
				items.push({ value: "__sep2__", label: " ", description: "" });
				items.push({
					value: "__hdr_available__",
					label: ` ${theme.bold("Available")} ${theme.fg("dim", `(${available.length})`)}`,
					description: "",
				});
				for (const m of available) {
					const parts = [m.quant, m.paramsB ? `${m.paramsB}B` : "", m.sizeGb ? `${m.sizeGb.toFixed(1)} GB` : ""].filter(Boolean);
					const info = parts.length ? theme.fg("dim", "  " + parts.join(" · ")) : "";
					const rec = m.recommended ? theme.fg("warning", " ⭐") : "";
					const family = m.familyName ? theme.fg("muted", `${m.familyName} `) : "";
					items.push({
						value: `download-start:${m.filename}`,
						label: `   ${theme.fg("dim", "○")} ${family}${m.filename}${rec}${info}`,
						description: "",
					});
				}
			}
		} else {
			items.push({
				value: "__empty__",
				label: `   ${theme.fg("dim", "catalog unavailable — is the daemon running?")}`,
				description: "",
			});
		}

		items.push({ value: "__sep3__", label: " ", description: "" });
		items.push({ value: "action:connect", label: `   ${theme.fg("accent", "⚡")} Connect Skill LLM  ${theme.fg("dim", "local/remote/auto")}`, description: "" });
		items.push({ value: "action:fit",     label: `   ${theme.fg("accent", "📐")} Check model fit  ${theme.fg("dim", "RAM/VRAM")}`, description: "" });
		items.push({ value: "action:route",   label: `   ${theme.fg("accent", "🧭")} Show LLM route  ${theme.fg("dim", "active + fallbacks")}`, description: "" });

		// Build SelectList
		const list = new SelectList(items, 22, {
			selectedPrefix: (t: string) => INVERSE + BOLD_ON + HOTPINK + t + RST,
			selectedText:   (t: string) => INVERSE + BOLD_ON + t + RST,
			description:    (t: string) => t,
			scrollInfo:     (t: string) => theme.fg("muted", t),
			noMatch:        (t: string) => theme.fg("dim", t),
		});

		list.onSelect = (item) => {
			const val = item.value;
			if (val.startsWith("__")) return;

			if (val.startsWith("action:")) { hide(); callbacks.onAction(val.slice(7)); return; }
			if (val.startsWith("select:")) { hide(); callbacks.onAction("select", val.slice(7)); return; }
			if (val.startsWith("download-start:")) { hide(); callbacks.onAction("download", val.slice(15)); return; }
			if (val.startsWith("download:")) {
				const fname = val.slice(9);
				const entry = catalog?.entries.find(e => e.filename === fname);
				if (entry?.state === "paused") { hide(); callbacks.onAction("resume", fname); }
				else if (entry?.state === "downloading") { hide(); callbacks.onAction("pause", fname); }
				return;
			}
		};
		list.onCancel = () => hide();

		// Bordered panel wrapper
		const titleStr = theme.fg("accent", "🤖") + " " + theme.bold("LLM Manager");
		const titleW = visibleWidth("🤖 LLM Manager");
		const hintsStr = theme.fg("muted", "esc") + theme.fg("dim", " close · ")
			+ theme.fg("muted", "↑↓") + theme.fg("dim", " navigate · ")
			+ theme.fg("muted", "enter") + theme.fg("dim", " select");

		const panel = new BorderedPanel(list, {
			title: titleStr, titleWidth: titleW, hints: hintsStr, paddingX: 1,
		});

		overlayHandle = tui.showOverlay(panel, {
			width: "75%",
			minWidth: 55,
			maxHeight: "75%",
			anchor: "center",
		});

		tui.setFocus(panel);
		visible = true;
	}

	function show() { buildAndShow(); }

	function hide() {
		if (overlayHandle) {
			overlayHandle.hide();
			overlayHandle = null;
		}
		visible = false;
	}

	function toggle() { if (visible) hide(); else show(); }
	function dispose() { hide(); }

	return { show, hide, toggle, isVisible: () => visible, dispose };
}
