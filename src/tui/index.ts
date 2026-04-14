/**
 * tui/index.ts — Barrel export for all TUI modules.
 */

export {
	type NeuroTheme,
	BUILTIN_THEMES,
	DEFAULT_SYMBOLS,
	getActiveTheme,
	setActiveTheme,
	initTheme,
	wrapTheme,
	symbols,
	loadThemeId,
	saveThemeId,
} from "./themes.ts";

export {
	evaluateToasts,
	resetToastCooldowns,
	setSmartToastsEnabled,
	isSmartToastsEnabled,
	type ExgSnapshot,
} from "./toast.ts";

export {
	createCommandPalette,
	type PaletteCommand,
} from "./command-palette.ts";

export {
	createRenderScheduler,
	type RenderScheduler,
} from "./render-scheduler.ts";

export {
	createExgPanel,
	pushHistory,
	getHistory,
	clearHistory,
	type ExgPanel,
	type ExgHistoryEntry,
} from "./overlay-panel.ts";

export {
	createOverlayManager,
	type OverlayManager,
	type ManagedOverlay,
} from "./overlay-manager.ts";

export {
	renderLogo,
	renderTagline,
} from "./logo.ts";

export {
	createLlmPanel,
	type LlmPanel,
	type LlmModelEntry,
	type LlmServerStatus,
	type LlmPanelCallbacks,
} from "./llm-panel.ts";
