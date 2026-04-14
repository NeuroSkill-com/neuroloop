/**
 * command-palette.ts — Fuzzy-searchable command palette overlay.
 *
 * Opens with Ctrl+K (configurable). Lists all registered /commands
 * with descriptions, supports fuzzy filtering via pi-tui's SelectList.
 */

import { Container, Text } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import { SelectList } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

export interface PaletteCommand {
	name: string;
	description: string;
	/** Optional handler to run directly (otherwise inserts the command text). */
	action?: () => void | Promise<void>;
}

interface PaletteOverlay {
	show(): void;
	hide(): void;
	isVisible(): boolean;
	updateCommands(commands: PaletteCommand[]): void;
	dispose(): void;
}

/**
 * Create the command palette overlay. Attaches to the TUI but starts hidden.
 */
export function createCommandPalette(
	tui: TUI,
	theme: Theme,
	opts: {
		commands: PaletteCommand[];
		onSelect: (cmd: PaletteCommand) => void;
	},
): PaletteOverlay {
	let commands = opts.commands;
	let overlayHandle: ReturnType<typeof tui.showOverlay> | null = null;
	let visible = false;

	function buildOverlay() {
		const items = commands.map(cmd => ({
			value: cmd.name,
			label: `/${cmd.name}`,
			description: cmd.description,
		}));

		const header = new Text();
		header.setText(theme.fg("accent", " Commands") + theme.fg("dim", "  (type to filter, esc to close)"));

		const list = new SelectList(items, 20, {
			selectedPrefix: (t: string) => theme.fg("accent", t),
			selectedText:   (t: string) => theme.fg("accent", t),
			description:    (t: string) => theme.fg("dim", t),
			scrollInfo:     (t: string) => theme.fg("muted", t),
			noMatch:        (t: string) => theme.fg("dim", t),
		});

		list.onSelect = (item) => {
			const cmd = commands.find(c => c.name === item.value);
			hide();
			if (cmd) opts.onSelect(cmd);
		};
		list.onCancel = () => hide();

		const container = new Container();
		container.addChild(header);
		container.addChild(list);

		overlayHandle = tui.showOverlay(container, {
			width: "60%",
			minWidth: 40,
			maxHeight: "50%",
			anchor: "top-center",
			offsetY: 3,
		});

		tui.setFocus(list);
		visible = true;
	}

	function show() {
		if (visible) { hide(); return; }  // toggle behavior
		buildOverlay();
	}

	function hide() {
		if (overlayHandle) {
			overlayHandle.hide();
			overlayHandle = null;
		}
		visible = false;
	}

	function updateCommands(cmds: PaletteCommand[]) {
		commands = cmds;
	}

	function dispose() {
		hide();
	}

	return { show, hide, isVisible: () => visible, updateCommands, dispose };
}
