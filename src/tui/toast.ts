/**
 * toast.ts — Smart toast notifications for notable EXG brain state events.
 *
 * Monitors incoming EXG metrics and fires toasts when thresholds are crossed.
 * Uses cooldowns to avoid notification spam.
 */

export interface ExgSnapshot {
	focus?:          number;
	cognitive_load?: number;
	relaxation?:     number;
	engagement?:     number;
	drowsiness?:     number;
	mood?:           number;
	hr?:             number;
}

type NotifyFn = (msg: string, level?: "info" | "warning" | "error") => void;

interface AlertRule {
	id: string;
	label: string;
	field: keyof ExgSnapshot;
	/** Threshold value (0-1 for scores, bpm for hr). */
	threshold: number;
	/** "above" = alert when value >= threshold, "below" = alert when value <= threshold. */
	direction: "above" | "below";
	level: "info" | "warning" | "error";
	/** Minimum seconds between repeated alerts for this rule. */
	cooldownSec: number;
	/** Format the notification message. */
	message: (val: number) => string;
}

const RULES: AlertRule[] = [
	{
		id: "focus-spike",
		label: "Focus spike",
		field: "focus",
		threshold: 0.85,
		direction: "above",
		level: "info",
		cooldownSec: 120,
		message: (v) => `Focus spike detected (${(v * 100).toFixed(0)}%) — you're in the zone`,
	},
	{
		id: "focus-drop",
		label: "Focus drop",
		field: "focus",
		threshold: 0.20,
		direction: "below",
		level: "warning",
		cooldownSec: 180,
		message: (v) => `Focus dropped to ${(v * 100).toFixed(0)}% — consider a break?`,
	},
	{
		id: "drowsiness-high",
		label: "Drowsiness alert",
		field: "drowsiness",
		threshold: 0.70,
		direction: "above",
		level: "warning",
		cooldownSec: 300,
		message: (v) => `Drowsiness elevated (${(v * 100).toFixed(0)}%) — time for a stretch`,
	},
	{
		id: "relaxation-deep",
		label: "Deep relaxation",
		field: "relaxation",
		threshold: 0.85,
		direction: "above",
		level: "info",
		cooldownSec: 120,
		message: (v) => `Deep relaxation detected (${(v * 100).toFixed(0)}%)`,
	},
	{
		id: "hr-high",
		label: "Heart rate elevated",
		field: "hr",
		threshold: 100,
		direction: "above",
		level: "warning",
		cooldownSec: 300,
		message: (v) => `Heart rate elevated (${Math.round(v)} bpm) — take a breath`,
	},
	{
		id: "hr-low",
		label: "Heart rate low",
		field: "hr",
		threshold: 50,
		direction: "below",
		level: "warning",
		cooldownSec: 300,
		message: (v) => `Heart rate low (${Math.round(v)} bpm)`,
	},
	{
		id: "engagement-high",
		label: "High engagement",
		field: "engagement",
		threshold: 0.85,
		direction: "above",
		level: "info",
		cooldownSec: 180,
		message: (v) => `High engagement (${(v * 100).toFixed(0)}%) — great flow state`,
	},
	{
		id: "cogload-high",
		label: "Cognitive overload",
		field: "cognitive_load",
		threshold: 0.80,
		direction: "above",
		level: "warning",
		cooldownSec: 240,
		message: (v) => `Cognitive load high (${(v * 100).toFixed(0)}%) — try simplifying`,
	},
];

// Cooldown tracking: rule id → last fired timestamp (ms)
const lastFired = new Map<string, number>();

/** Whether smart toasts are enabled (user can toggle). */
let enabled = true;

export function setSmartToastsEnabled(on: boolean): void { enabled = on; }
export function isSmartToastsEnabled(): boolean { return enabled; }

/**
 * Evaluate EXG metrics against alert rules and fire any matching toasts.
 * Call this each time new metrics arrive.
 */
export function evaluateToasts(metrics: ExgSnapshot, notify: NotifyFn): void {
	if (!enabled) return;
	const now = Date.now();

	for (const rule of RULES) {
		const val = metrics[rule.field];
		if (val == null) continue;

		const triggered = rule.direction === "above"
			? val >= rule.threshold
			: val <= rule.threshold;

		if (!triggered) continue;

		const last = lastFired.get(rule.id) ?? 0;
		if (now - last < rule.cooldownSec * 1000) continue;

		lastFired.set(rule.id, now);
		notify(rule.message(val), rule.level);
	}
}

/** Reset all cooldowns (e.g. on reconnect). */
export function resetToastCooldowns(): void {
	lastFired.clear();
}
