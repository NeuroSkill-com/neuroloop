/**
 * render-scheduler.ts — Event-driven render batching.
 *
 * Replaces the blunt 30s setInterval with a smarter approach:
 * - EXG data changes → debounced 16ms render (60fps cap)
 * - "ago" text updates → 30s interval (only when no EXG events firing)
 * - Force render on significant state changes (connect/disconnect)
 */

import type { TUI } from "@mariozechner/pi-tui";

export interface RenderScheduler {
	/** Request a render due to data change (debounced at 16ms). */
	requestDataRender(): void;
	/** Request a render due to significant state change (immediate). */
	requestImmediateRender(): void;
	/** Start the background "ago" refresh timer. */
	start(): void;
	/** Stop all timers and clean up. */
	stop(): void;
}

export function createRenderScheduler(tui: TUI): RenderScheduler {
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let agoTimer: ReturnType<typeof setInterval> | null = null;
	let lastDataRender = 0;

	function requestDataRender() {
		const now = Date.now();
		const elapsed = now - lastDataRender;

		// If enough time has passed, render immediately
		if (elapsed >= 16) {
			lastDataRender = now;
			if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
			tui.requestRender();
			return;
		}

		// Otherwise debounce to next frame boundary
		if (!debounceTimer) {
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				lastDataRender = Date.now();
				tui.requestRender();
			}, 16 - elapsed);
		}
	}

	function requestImmediateRender() {
		if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
		lastDataRender = Date.now();
		tui.requestRender();
	}

	function start() {
		// "ago" text refresh — 30s is fine since it's only for staleness display
		if (!agoTimer) {
			agoTimer = setInterval(() => tui.requestRender(), 30_000);
		}
	}

	function stop() {
		if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
		if (agoTimer) { clearInterval(agoTimer); agoTimer = null; }
	}

	return { requestDataRender, requestImmediateRender, start, stop };
}
