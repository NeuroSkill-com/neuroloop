/**
 * neuroskill/context.ts — contextual EXG data selection.
 *
 * Reads domain signals from the user's prompt and decides which neuroskill
 * commands to run. All tasks fire in parallel; failures are silently skipped.
 * The base `status` snapshot is always injected by neuroloop.ts — everything
 * here is additive.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runNeuroSkill } from "./run.ts";
import { detectSignals } from "./signals.ts";

const PROTOCOLS_SKILL_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	"..", "..", "skills", "neuroskill-protocols", "SKILL.md",
);

interface TaskDef {
	label: string;
	args: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare cache
//
// `neuroskill compare` takes ~60 s to compute. It must never block a response.
// Strategy:
//   • On first request, fire it in the background and return nothing this turn.
//   • On subsequent requests, return the cached result if it is still fresh.
//   • The cache is refreshed in the background whenever it expires and compare
//     is relevant again.
// ─────────────────────────────────────────────────────────────────────────────

const COMPARE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const compareCache: {
	text?: string;
	builtAt?: number;
	pending?: Promise<void>;
} = {};

/** Return the cached compare text if it is still fresh, otherwise undefined. */
function getFreshCompare(): string | undefined {
	if (!compareCache.text || !compareCache.builtAt) return undefined;
	if (Date.now() - compareCache.builtAt > COMPARE_CACHE_TTL_MS) return undefined;
	return compareCache.text;
}

/**
 * Kick off a background compare run if one is not already in flight and the
 * cache is stale. Safe to call at any time; never awaited by the caller.
 * Exported so callers (e.g. session_start) can pre-warm at startup.
 */
export function warmCompareInBackground(): void {
	if (compareCache.pending) return; // already running
	if (getFreshCompare()) return; // cache still fresh

	compareCache.pending = runNeuroSkill(["compare"])
		.then((r) => {
			if (r.ok && r.text) {
				compareCache.text = r.text;
				compareCache.builtAt = Date.now();
			}
		})
		.catch(() => {
			/* swallow — will retry on next trigger */
		})
		.finally(() => {
			compareCache.pending = undefined;
		});
}

/**
 * Decide which additional neuroskill commands to run based on the user's prompt,
 * then return labelled text blocks for each.
 */
export async function selectContextualData(prompt: string): Promise<string[]> {
	const lp = prompt.toLowerCase();
	const s = detectSignals(lp);

	// ── Protocol skill — load on-demand when protocol intent is detected ────
	const extras: string[] = [];

	if (s.protocols && existsSync(PROTOCOLS_SKILL_PATH)) {
		try {
			const skillContent = readFileSync(PROTOCOLS_SKILL_PATH, "utf8");
			extras.push(`## 🧘 Protocol Repertoire\n${skillContent}`);
		} catch {
			// Non-fatal — skill file unreadable, continue without it.
		}
	}

	// ── Queue helpers ────────────────────────────────────────────────────────
	const queue: TaskDef[] = [];

	const enqueue = (label: string, ...args: string[]) =>
		queue.push({ label, args });

	const searchLabels = (label: string, query: string, k = "5") =>
		enqueue(label, "search-labels", query, "--k", k);

	// ─────────────────────────────────────────────────────────────────────────
	// 1. SLEEP
	// ─────────────────────────────────────────────────────────────────────────
	if (s.sleep) {
		enqueue("Sleep Staging (last 24 h)", "sleep");
		searchLabels(
			"Past Sleep Labels",
			"sleep tired rest deep sleep rem restoration drowsy",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 3. DETAILED SESSION METRICS
	//    Triggered by any domain that benefits from full HRV, stress_index,
	//    mood, FAA, cognitive_load, rmssd, and the 50+ other session fields.
	// ─────────────────────────────────────────────────────────────────────────
	if (
		s.session ||
		s.sport ||
		s.learning ||
		s.social ||
		s.dating ||
		s.family ||
		s.creative ||
		s.leadership ||
		s.recovery ||
		s.morning ||
		s.evening ||
		s.nutrition ||
		s.therapy ||
		s.goals ||
		s.performance ||
		s.confidence ||
		s.anger ||
		s.grief ||
		s.loneliness ||
		s.addiction
	) {
		enqueue("Current Session Metrics", "session", "0");
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 4. TRENDS & COMPARISON
	//
	// `neuroskill compare` takes ~60 s. Never awaited directly — we serve the
	// cached result when available and warm the cache in the background.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.compare || s.goals) {
		const cached = getFreshCompare();
		if (cached) {
			// Cache is warm — inject immediately as a pre-built text block.
			queue.push({ label: "Session Comparison (last 2) — cached", args: [] });
		} else {
			// Cache is cold — kick off background build, skip this turn.
			warmCompareInBackground();
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 5. SESSION HISTORY
	// ─────────────────────────────────────────────────────────────────────────
	if (s.sessions) {
		enqueue("Session History", "sessions");
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 6. FOCUS & PRODUCTIVITY
	// ─────────────────────────────────────────────────────────────────────────
	if (s.focus) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Focus & Deep Work Labels",
			"deep focus work productivity flow state concentration locked in",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 7. STRESS & BURNOUT
	// ─────────────────────────────────────────────────────────────────────────
	if (s.stress) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Stress & Overwhelm Labels",
			"stress overwhelmed burnout pressure tense nervous anxious overloaded",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 8. MEDITATION & MINDFULNESS
	// ─────────────────────────────────────────────────────────────────────────
	if (s.meditation) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Meditation & Relaxation Labels",
			"meditation mindfulness calm relaxation breathing peace stillness grounded",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 10. SOCIAL & NETWORKING
	// ─────────────────────────────────────────────────────────────────────────
	if (s.social) {
		searchLabels(
			"Past Social Interaction Labels",
			"social meeting people conversation team collaboration networking friends",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 11. DATING & ROMANCE
	// ─────────────────────────────────────────────────────────────────────────
	if (s.dating) {
		searchLabels(
			"Past Romantic & Dating Labels",
			"romantic partner relationship date connection love intimacy attraction",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 12. FAMILY & PARENTING
	// ─────────────────────────────────────────────────────────────────────────
	if (s.family) {
		searchLabels(
			"Past Family & Home Labels",
			"family children parenting home household spouse caregiving kids parent",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 13. SPORTS & EXERCISE
	// ─────────────────────────────────────────────────────────────────────────
	if (s.sport) {
		searchLabels(
			"Past Exercise & Sport Labels",
			"exercise workout training sport running gym fitness athletic cardio strength",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 14. LEARNING & EDUCATION
	// ─────────────────────────────────────────────────────────────────────────
	if (s.learning) {
		searchLabels(
			"Past Study & Learning Labels",
			"studying learning exam memorize reading concentration retention academic",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 15. CREATIVITY
	// ─────────────────────────────────────────────────────────────────────────
	if (s.creative) {
		searchLabels(
			"Past Creative Work Labels",
			"creative art music writing design inspiration ideas innovation brainstorm",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 16. LEADERSHIP & MANAGEMENT
	// ─────────────────────────────────────────────────────────────────────────
	if (s.leadership) {
		searchLabels(
			"Past Leadership & Management Labels",
			"leadership management decision making strategy team leading executive",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 17. RECOVERY & REST DAYS
	// ─────────────────────────────────────────────────────────────────────────
	if (s.recovery) {
		searchLabels(
			"Past Recovery & Rest Labels",
			"recovery rest restoration recharge refresh downtime rejuvenate unwind",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 18. MORNING ROUTINE
	// ─────────────────────────────────────────────────────────────────────────
	if (s.morning) {
		searchLabels(
			"Past Morning Routine Labels",
			"morning routine wake up coffee start of day fresh clarity rested",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 19. EVENING & WIND-DOWN
	// ─────────────────────────────────────────────────────────────────────────
	if (s.evening) {
		searchLabels(
			"Past Evening & Wind-down Labels",
			"evening wind down end of day night routine relax calm bedtime",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 20. NUTRITION & EATING
	// ─────────────────────────────────────────────────────────────────────────
	if (s.nutrition) {
		searchLabels(
			"Past Nutrition & Eating Labels",
			"food eating meal nutrition caffeine coffee tea fasting glucose brain fuel",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 22. THERAPY & SELF-REFLECTION
	// ─────────────────────────────────────────────────────────────────────────
	if (s.therapy) {
		searchLabels(
			"Past Therapy & Reflection Labels",
			"therapy reflection introspection emotional processing journaling self-aware",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 23. TRAVEL & JET LAG
	// ─────────────────────────────────────────────────────────────────────────
	if (s.travel) {
		enqueue("Sleep Staging (last 24 h)", "sleep"); // circadian disruption shows in sleep data
		searchLabels(
			"Past Travel Labels",
			"travel jetlag timezone circadian rhythm body clock adjustment",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 24. GOALS & HABIT TRACKING
	// ─────────────────────────────────────────────────────────────────────────
	if (s.goals) {
		searchLabels(
			"Past Goal & Habit Labels",
			"goal habit routine intention achievement milestone streak self-improvement",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 26. ANGER & EMOTIONAL DYSREGULATION
	// ─────────────────────────────────────────────────────────────────────────
	if (s.anger) {
		searchLabels(
			"Past Anger & Frustration Labels",
			"anger frustrated irritable rage outburst tense reactive triggered emotional",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 27. GRIEF & LOSS
	// ─────────────────────────────────────────────────────────────────────────
	if (s.grief) {
		searchLabels(
			"Past Grief & Loss Labels",
			"grief loss sad mourning bereavement sorrow heartbreak pain emotional",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 28. LONELINESS & ISOLATION
	// ─────────────────────────────────────────────────────────────────────────
	if (s.loneliness) {
		searchLabels(
			"Past Loneliness & Isolation Labels",
			"lonely isolation alone disconnected withdrawn left out excluded belonging",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 29. ADDICTION & CRAVINGS
	// ─────────────────────────────────────────────────────────────────────────
	if (s.addiction) {
		searchLabels(
			"Past Craving & Compulsion Labels",
			"craving urge compulsion addiction impulse scroll distraction temptation",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 30. CONFIDENCE & SELF-ESTEEM
	// ─────────────────────────────────────────────────────────────────────────
	if (s.confidence) {
		searchLabels(
			"Past Confidence & Self-Esteem Labels",
			"confident self-esteem doubt insecure imposter capable proud accomplished",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 31. HRV & CARDIAC / AUTONOMIC
	//     Session gives hr, rmssd, sdnn, pnn50, lf_hf_ratio, stress_index,
	//     respiratory_rate, spo2.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.hrv) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past HRV & Cardiac Labels",
			"heart rate HRV palpitation breathing chest autonomic cardiac coherence calm vagal",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 32. SOMATIC & EMBODIMENT
	//     Session gives stillness, hr, stress.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.somatic) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Somatic & Body Sensation Labels",
			"somatic body sensation tension embodied grounded interoception gut feeling physical",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 33. CONSCIOUSNESS & ALTERED STATES
	//     LZC complexity, wakefulness index, and consciousness metrics.
	//     Session gives FAA, engagement, and coherence.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.consciousness) {
		enqueue("Current Session Metrics", "session", "0"); // engagement, coherence, FAA
		searchLabels(
			"Past Consciousness & Awareness Labels",
			"consciousness awareness presence awakening ego dissolution lucid witness observer altered state",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 32. PHILOSOPHY & INQUIRY
	//     Cognitive load and clarity metrics ground philosophical thought.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.philosophy) {
		enqueue("Current Session Metrics", "session", "0"); // clarity, engagement, cognitive load
		searchLabels(
			"Past Philosophy & Inquiry Labels",
			"philosophy meaning purpose wisdom truth inquiry virtue contemplation stoic existential",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 33. EXISTENTIAL STATES
	//     Consciousness metrics + depression / anxiety indices are relevant.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.existential) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Existential & Mortality Labels",
			"death mortality meaning existence purpose void impermanence legacy soul finitude",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 34. DEPTH OF FEELING / INNER LIFE
	//     Pull full session and neuro to understand the felt quality of the moment.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.depth) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Deep Feeling & Inner Life Labels",
			"profound depth inner life soul contemplation moving stirred vast silence inward",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 35. MORALS & ETHICS
	//     Stress index and FAA reflect moral distress and emotional conflict.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.morals) {
		enqueue("Current Session Metrics", "session", "0"); // stress, emotional valence
		searchLabels(
			"Past Moral & Ethical Labels",
			"ethics morals integrity conscience guilt shame regret duty right wrong dilemma values justice",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 36. SYMBIOSIS & INTERCONNECTEDNESS
	//     Coherence and engagement reflect felt unity; neuro gives richer picture.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.symbiosis) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Symbiosis & Connection Labels",
			"symbiosis interconnected oneness unity interdependence harmony nature collective ecosystem belonging",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 37. AWE & WONDER
	//     Consciousness metrics and coherence are highest during peak awe.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.awe) {
		enqueue("Current Session Metrics", "session", "0"); // engagement, FAA
		searchLabels(
			"Past Awe & Wonder Labels",
			"awe wonder transcendence sublime sacred peak experience cosmic majestic beauty spiritual gratitude overwhelmed",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 38. IDENTITY & SELF-DISCOVERY
	//     FAA and self-referential processing show up in session + neuro.
	// ─────────────────────────────────────────────────────────────────────────
	if (s.identity) {
		enqueue("Current Session Metrics", "session", "0");
		searchLabels(
			"Past Identity & Self-Discovery Labels",
			"identity authentic self-concept who am I true self mask persona values-alignment self-expression discovery",
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Deduplicate by argument signature.
	// Then cap search-labels at MAX_LABEL_SEARCHES to bound parallel I/O when
	// many domains fire simultaneously (otherwise 10+ searches can stack up).
	// ─────────────────────────────────────────────────────────────────────────
	const MAX_LABEL_SEARCHES = 5;

	const seen = new Set<string>();
	let labelSearchCount = 0;
	const unique = queue.filter(({ args }) => {
		// Deduplicate identical command+args combinations.
		const key = args.join("\0");
		if (seen.has(key)) return false;
		seen.add(key);

		// Cap semantic label searches to keep response latency bounded.
		if (args[0] === "search-labels") {
			if (labelSearchCount >= MAX_LABEL_SEARCHES) return false;
			labelSearchCount++;
		}

		return true;
	});

	const results = await Promise.all(
		unique.map(({ label, args }) => {
			// Zero-args sentinel: cached compare text injected directly.
			if (args.length === 0) {
				const text = getFreshCompare();
				return text ? `### ${label}\n${text}` : null;
			}
			return runNeuroSkill(args).then((r) => (r.ok && r.text ? `### ${label}\n${r.text}` : null));
		}),
	);

	return [...extras, ...results.filter((r): r is string => r !== null)];
}
