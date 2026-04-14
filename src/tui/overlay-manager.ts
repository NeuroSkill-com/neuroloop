/**
 * overlay-manager.ts — Centralized overlay/popup management.
 *
 * Handles stacking order, keyboard dismissal (Esc), and ensures only one
 * modal overlay is active at a time while allowing non-modal overlays
 * (like the EXG sidebar) to coexist.
 */

import type { TUI } from "@mariozechner/pi-tui";
import { matchesKey, Key } from "@mariozechner/pi-tui";

export interface ManagedOverlay {
	id: string;
	/** Whether this overlay captures keyboard focus (modal). */
	modal: boolean;
	show(): void;
	hide(): void;
	isVisible(): boolean;
}

export interface OverlayManager {
	/** Register an overlay for management. */
	register(overlay: ManagedOverlay): void;
	/** Unregister an overlay. */
	unregister(id: string): void;
	/** Show an overlay by id. If modal, hides other modals first. */
	show(id: string): void;
	/** Hide an overlay by id. */
	hide(id: string): void;
	/** Toggle an overlay by id. */
	toggle(id: string): void;
	/** Hide the topmost visible modal overlay (called on Esc). */
	dismissTopModal(): boolean;
	/** Check if any modal overlay is visible. */
	hasModalVisible(): boolean;
	/** Get a registered overlay by id. */
	get(id: string): ManagedOverlay | undefined;
	/** Install the global Esc key handler. Returns cleanup function. */
	installKeyHandler(tui: TUI): () => void;
	/** Dispose all overlays. */
	dispose(): void;
}

export function createOverlayManager(): OverlayManager {
	const overlays = new Map<string, ManagedOverlay>();
	// Track show order for stacking
	const showOrder: string[] = [];

	function register(overlay: ManagedOverlay) {
		overlays.set(overlay.id, overlay);
	}

	function unregister(id: string) {
		const o = overlays.get(id);
		if (o?.isVisible()) o.hide();
		overlays.delete(id);
		const idx = showOrder.indexOf(id);
		if (idx >= 0) showOrder.splice(idx, 1);
	}

	function show(id: string) {
		const o = overlays.get(id);
		if (!o) return;

		// If modal, hide other modals first
		if (o.modal) {
			for (const other of overlays.values()) {
				if (other.id !== id && other.modal && other.isVisible()) {
					other.hide();
					const idx = showOrder.indexOf(other.id);
					if (idx >= 0) showOrder.splice(idx, 1);
				}
			}
		}

		o.show();
		// Move to top of show order
		const idx = showOrder.indexOf(id);
		if (idx >= 0) showOrder.splice(idx, 1);
		showOrder.push(id);
	}

	function hide(id: string) {
		const o = overlays.get(id);
		if (o?.isVisible()) o.hide();
		const idx = showOrder.indexOf(id);
		if (idx >= 0) showOrder.splice(idx, 1);
	}

	function toggle(id: string) {
		const o = overlays.get(id);
		if (!o) return;
		if (o.isVisible()) hide(id); else show(id);
	}

	function dismissTopModal(): boolean {
		// Walk showOrder in reverse to find topmost visible modal
		for (let i = showOrder.length - 1; i >= 0; i--) {
			const o = overlays.get(showOrder[i]);
			if (o?.modal && o.isVisible()) {
				hide(o.id);
				return true;
			}
		}
		return false;
	}

	function hasModalVisible(): boolean {
		for (const o of overlays.values()) {
			if (o.modal && o.isVisible()) return true;
		}
		return false;
	}

	function get(id: string) {
		return overlays.get(id);
	}

	function installKeyHandler(tui: TUI): () => void {
		const listener = (data: string) => {
			if (matchesKey(data, Key.escape)) {
				if (dismissTopModal()) {
					return { consume: true };
				}
			}
			return undefined;
		};
		tui.addInputListener(listener);
		return () => tui.removeInputListener(listener);
	}

	function dispose() {
		for (const o of overlays.values()) {
			if (o.isVisible()) o.hide();
		}
		overlays.clear();
		showOrder.length = 0;
	}

	return {
		register, unregister, show, hide, toggle,
		dismissTopModal, hasModalVisible, get,
		installKeyHandler, dispose,
	};
}
