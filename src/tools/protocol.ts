/**
 * tools/protocol.ts — run_protocol tool.
 *
 * Executes a multi-step guided protocol (breathing exercise, progressive muscle
 * relaxation, grounding, recovery reset, somatic scan, etc.) step by step with:
 *   • OS notifications at every step transition
 *   • Per-step timing (sleep that respects the AbortSignal)
 *   • EXG labelling at every step (always on — the protocol IS the labelling run)
 *   • Streamed progress via onUpdate so the UI shows live step output
 *
 * STEP GRANULARITY CONTRACT (enforced by description — see below):
 *   Every physical action must be preceded by a 0-duration announcement step
 *   so the user reads what is coming before the timer starts. Counting steps
 *   (breath holds, inhale counts, etc.) are broken into one step per count or
 *   one step per phase, not bundled into a single long duration.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { runNeuroSkill } from "../neuroskill/run.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Cancellable sleep — rejects cleanly if the AbortSignal fires mid-wait. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException("Aborted", "AbortError"));
			return;
		}
		const id = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(id);
				reject(new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

/** Send an OS notification via neuroskill. Non-fatal if neuroskill is unavailable. */
async function notify(title: string, body?: string): Promise<void> {
	await runNeuroSkill(["notify", title, ...(body ? [body] : [])]);
}

/** Create an EXG label via neuroskill. Non-fatal if neuroskill is unavailable. */
async function label(text: string, context?: string): Promise<void> {
	await runNeuroSkill(["label", text, ...(context ? ["--context", context] : [])]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const StepSchema = Type.Object({
	name: Type.String({
		description:
			"Short step name shown as the notification title. " +
			"For announcement steps use a ▶ prefix (e.g. '▶ Coming up: Slow exhale'). " +
			"For action steps use a plain verb (e.g. 'Exhale slowly…').",
	}),
	instruction: Type.String({
		description:
			"Full instruction shown as the notification body and in the chat. " +
			"For announcement steps: describe what is about to happen so the user can prepare. " +
			"For action steps: tell the user exactly what to do right now.",
	}),
	duration_secs: Type.Number({
		description:
			"How long to hold this step before auto-advancing, in seconds. " +
			"Use 0 for announcement steps (just show, then immediately move on). " +
			"Use the actual physical duration for action steps (e.g. 4 for a 4-count inhale).",
	}),
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool
// ─────────────────────────────────────────────────────────────────────────────

export const runProtocolTool = {
	name: "run_protocol",
	label: "Run Guided Protocol",
	description: `Execute a multi-step guided protocol step by step with OS notifications, per-step timing, and EXG labelling at every step.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN TO CALL THIS TOOL — read before using:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Only call this after the user has explicitly agreed to do the protocol.
  Describe the exercise and ask first; run_protocol is the execution step, not the proposal.
• Never call this more than once per turn, and never chain two protocols back-to-back.
• Do not re-run the same modality type that has already run this session unless the user
  explicitly asks to repeat it.
• If the user seems uncertain, reluctant, or mid-conversation, offer — don't execute.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE PROTOCOL CATEGORIES (choose the best fit for the EXG):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Attention & Focus
  • Theta-Beta Neurofeedback Anchor — high tbr / low focus / high adhd_index
  • Focus Reset — scattered engagement, high cognitive_load mid-session
  • Cognitive Load Offload — cognitive_load > 0.7, end of deep work block
  • Working Memory Primer — low pac_theta_gamma, pre-task warm-up
  • Pre-Performance Activation — low engagement before a challenge/presentation
  • Creativity Unlock — high beta, low rel_alpha, creative block

Stress & Autonomic Regulation
  • Box Breathing (4-4-4-4) — high bar / high anxiety_index / low relaxation
  • Extended Exhale (4-7-8) — acute stress spike, high lf_hf_ratio
  • Cardiac Coherence (~6 breaths/min) — low rmssd (<30 ms) / high stress_index
  • Physiological Sigh — rapid overwhelm onset (1–3 cycles only)

Emotional Regulation & Mood
  • FAA Rebalancing — negative faa / high depression_index / low mood
  • Mood Activation — depression_index > 40, flat mood, low engagement
  • Loving-Kindness (Metta) — loneliness, shame, grief, or low faa
  • Emotional Discharge — high bipolar_index, extreme FAA swings, agitation

Relaxation & Alpha Promotion
  • Alpha Induction (open focus) — high bar, post-stress, low relaxation
  • Open Monitoring — low lzc (<40) / low integration / mental narrowing
  • Relaxation Scan — high cortical arousal, headache_index > 30

Sleep & Circadian
  • Sleep Onset Wind-Down — insomnia_index > 50, drowsy end-of-day
  • Ultradian Reset (20-min rest) — mid-afternoon slump / post-90-min focus block
  • Wake Reset / Alertness Boost — narcolepsy_index > 40 / wakefulness < 30

Body & Somatic
  • Progressive Muscle Relaxation — physical tension, insomnia_index high, high beta
  • Somatic Body Scan — low integration, dissociation, trauma processing
  • Grounding (5-4-3-2-1) — anxiety, panic onset, dissociation
  • Tension Release Exercise — chronic stress, high stress_index, stored tension

Consciousness & Integration
  • Coherence Building — low coherence (<0.4) / low integration
  • Flow State Induction — focus 0.5–0.7 and engagement rising
  • Complexity Expansion (LZC boost) — low lzc / cognitive rigidity

Energy & Alertness
  • Kapalabhati Energiser — low engagement / sluggish cognition / low wakefulness
  • 4-Count Energising Breath — post-lunch dip / low engagement

Headache & Migraine
  • Cortical Quieting — headache_index > 30 / migraine_index > 20
  • Alpha-Reset for Headache — headache_index rising / cortical hyperexcitability

Energy & Alertness (extended)
  • Wim Hof Breathwork — near-zero engagement / full system reset (⚠ not for epilepsy_risk > 30)
  • Cold Exposure Micro-Protocol — autonomic torpor / low wakefulness / low bar

Hemispheric Balance & Breathing
  • Nadi Shodhana (Alternate Nostril) — FAA asymmetry (|faa| > 0.1) / low coherence
  • Buteyko CO2 Retraining — chronic anxiety / habitual over-breathing / high lf_hf_ratio

Deep Relaxation (Somatic)
  • Autogenic Training — chronic tension / high stress_index / difficulty releasing
  • Havening Touch — acute emotional distress spike / high anxiety_index / trauma activation
  • Somatic Shaking — post-adrenaline / stored tension after stress spike

Recovery & Rest
  • NSDR / Yoga Nidra — post-deep-work / high cognitive_load / mid-day restoration
  • Power Nap Guidance — wakefulness < 30 / narcolepsy_index > 40 / extreme drowsiness

Deep Meditation
  • Alpha-Theta Drift — low lzc + drowsiness / trauma integration / deep creativity
  • Mantra / Single-Point Focus — high rel_theta + low focus / monkey-mind / chatter
  • Gamma Entrainment (40 Hz) — schizophrenia_index > 30 / low integration / low rel_gamma

Emotional Processing (extended)
  • Gratitude Cascade — depression_index > 35 / low mood / low faa (positive memory activation)
  • Peak State Anchor — focus > 0.75 + mood > 0.7 simultaneously — NLP state installation
  • Freeze Response Completion — very low engagement (<0.2) + elevated anxiety_index
  • Cognitive Defusion (ACT) — anxious rumination / stuck thought loops / high anxiety_index

Autonomic & Vagal
  • Vagal Toning (Humming / Gargling) — low rmssd (<25 ms) / low HRV / high stress_index

Cognitive Performance & Motivation (extended)
  • WOOP / Mental Contrasting — low motivation / pre-challenge engagement dip
  • Cognitive Defragging — high spectral_centroid + cognitive_load + context-switching
  • Dual-N-Back Warm-Up — low pac_theta_gamma / low sample_entropy (rigid neural patterns)
  • Novel Stimulation Burst — dementia_index > 30 / low apf (<9 Hz) / cortical slowing

Motor & Embodiment
  • Motor Cortex Activation — high mu_suppression / high stillness after long static sitting
  • Desk Yoga Sequence — stillness > 0.9 sustained / low engagement / low mood

Neck & Cervical Relief
  • Neck Release Sequence — headache_index elevated / stillness > 0.85 / neck tension
  • Cervical Decompression — forward-head posture / chronic neck compression
  • Upper Trap & Shoulder Release — high stress_index + reported shoulder/neck tightness

Eye Exercises & Visual Recovery
  • 20-20-20 Vision Reset — any long screen session / high spectral_centroid (quick)
  • Full Eye Exercise Sequence — eye fatigue / >90 min screen time / visual tension
  • Palming & Blink Recovery — dry eyes / eye burning / migraine_index elevated (quick)

Morning Routines
  • Gentle Morning Wake-Up — low wakefulness (<50) at day start / mild grogginess
  • Energising Morning Activation — very low wakefulness (<35) / flat mood / low engagement
  • Morning Clarity Ritual — low focus at day start / cognitive_load carryover
  • Mindful Morning Transition — low integration / emotional residue from sleep

Workout & Gym
  • Pre-Workout Neural Primer — before training / low engagement or low wakefulness
  • Pre-Workout Focus Lock — before skill/strength session / needs calm precision
  • Intra-Workout Recovery Micro-Set — between sets / hr elevated / high stress_index
  • Post-Workout Cool-Down & Integration — after training / hr still elevated
  • Post-Workout Recovery Reset — after intense session / high stress_index + fatigue
  • Mind-Muscle Connection Primer — low mu_suppression / pre-technique training

Hydration & Water Breaks (keep short and direct)
  • Hydration Reminder — long session / hr elevated / dry-mouth mention
  • Mindful Water Break — high cognitive_load / post-stress spike
  • Hydration + Eye Reset — long screen block / high spectral_centroid

Bathroom & Movement Breaks (keep short and practical)
  • Bathroom Break Prompt — high stillness / long unbroken session / restlessness
  • Break + Reset on Return — after any break to re-anchor focus
  • Movement Snack — stillness > 0.9 for >45 min / low engagement

Emotions — Extended Repertoire
  • Anger & Frustration Processing — high stress_index + high bar + agitation
  • Grief & Loss Holding — low mood + low engagement + depression_index > 35
  • Shame & Self-Compassion Break — negative faa + self-criticism / distinct from Metta
  • Anxiety Surfing — high anxiety_index + urge to escape / ride the wave
  • Fear Processing — anxiety_index high + freeze pattern (low engagement)
  • Envy & Comparison Alchemy — post-social-media low mood + negative faa
  • Excitement Regulation — very high engagement + high hr (arousal too hot)
  • Emotional Inventory (Check-In) — unknown/mixed state / session opening
  • Awe & Wonder Induction — low lzc + contracted attention + existential flatness
  • Joy Amplification — mood > 0.7 + positive faa / savour and anchor a good state
  • Loneliness & Connection — low mood + isolation expressed by user
  • Resentment Release — persistently negative faa + held grievance
  • Emotional Boundaries Reset — post-difficult conversation + high stress_index

Music Protocols
  • Mood-Match & Lift (ISO Principle) — low mood / depression_index > 30 / emotional inertia
  • Focus Music Protocol — high cognitive_load / low focus / distraction-prone session
  • Energising Activation Playlist — low wakefulness / post-lunch dip / low engagement
  • Stress Discharge Playlist — high stress_index + charge needing cathartic outlet
  • Sleep Music Wind-Down — insomnia_index > 40 / pre-sleep / high beta at bedtime
  • Binaural Beat Entrainment — target alpha / theta / gamma before cognitive work
  • Music-Breath Synchronisation — cardiac coherence variant using music BPM as pacer
  • Active Listening (Deep Listening) — low lzc / creative block / low integration
  • Rhythm Grounding — anxiety / dissociation / freeze / high anxiety_index
  • Singing / Vocal Toning — low rmssd / high stress / vagal activation + joy
  • Emotional Release with Music — grief / anger / unprocessed emotion needing discharge

Social Media & Digital Addiction
  • Pre-Scroll Intention Check — before opening any social media app (quick, 1 min)
  • Craving Surf (Urge Surfing) — compulsive urge to check phone / dopamine craving spike
  • Post-Scroll Brain Reset — after unintended long scroll; low focus / low lzc / mood crash
  • Comparison Detox — post-social-media low mood + negative faa comparison trigger
  • Dopamine Palette Reset — habitual checking / low baseline engagement / depleted dopamine
  • Notification Detox — high context-switching / low focus / attention fragmented
  • Mindful Social Media Session — intentional capped use with purpose and timer
  • FOMO Defusion — anxiety about missing out / high anxiety_index / compulsive checking
  • Digital Sunset Protocol — insomnia_index elevated / pre-sleep screen use
  • Attention Restoration Walk — post-scroll / low lzc / attention depleted (go outside, no phone)
  • Values Reconnection — persistent comparison spiral / low mood / inadequacy after scrolling
  • Screen Time Reflection — end-of-day usage review without judgment

Dietary Protocols
  Mindful Eating & Awareness
  • Pre-Meal Pause — any meal / stress before eating / autopilot eating (60 seconds)
  • Mindful Meal Protocol — rushed eating / high cognitive_load before meal / overeating
  • Intuitive Eating Check-In — emotional eating / stress eating / binge urges
  • Eating Speed Reset — frequent post-meal drowsiness / bloating / overeating pattern

  Energy & Cognitive Performance Nutrition
  • Post-Meal Energy Crash Protocol — drowsiness spike post-meal / wakefulness drop / narcolepsy_index mid-afternoon
  • Blood Sugar Stability Guide — low focus trending across session / energy crashes between meals
  • Caffeine Timing Protocol — afternoon focus crash / anxiety_index elevated / coffee timing question
  • Pre-Focus Block Nutrition — before a planned deep work session / what to eat question
  • Cognitive Nutrition Briefing — general brain performance nutrition question

  Mood & Mental Health Nutrition
  • Mood-Food Connection — depression_index > 35 / persistently low mood / gut-brain axis
  • Stress Eating Awareness — high stress_index + food craving spike / emotional eating
  • Anti-Inflammatory Eating Guide — headache_index > 25 / chronic stress / cognitive fog
  • Gut-Brain Axis Reset — anxiety_index > 40 persisting / low mood / high lf_hf_ratio

  Sleep & Evening Nutrition
  • Evening Eating Protocol — insomnia_index > 40 / late eating habit / poor sleep quality
  • Post-Workout Nutrition Window — after training / recovery focus / hr still elevated

  Fasting & Meal Timing
  • Intermittent Fasting Support — user in fasting window / hunger / focus complaints during fast
  • Breaking the Fast Mindfully — first meal of the day / end of fasting window
  • Time-Restricted Eating Reflection — user exploring IF / meal timing curiosity

  Cravings & Compulsive Eating
  • Sugar Craving Surf — intense craving for sweet/processed food / stress-driven urge
  • Alcohol Awareness Protocol — high stress_index evening / insomnia_index elevated / user mentions drinking
  • Ultra-Processed Food (UPF) Reset — persistent low mood / anxiety_index high / mostly packaged diet

═══════════════════════════════════════════════════════════════
MANDATORY STEP STRUCTURE — follow this exactly:
═══════════════════════════════════════════════════════════════

1. ALWAYS precede every timed action with a 0-duration announcement step.
   The user needs to read what is coming BEFORE the timer starts.
   Example for one breath cycle:
     { name: "▶ Coming up: Slow inhale", instruction: "Get ready — breathe in through your nose for 4 counts.", duration_secs: 0 }
     { name: "Inhale…",                  instruction: "Breathe in… 1… 2… 3… 4",                               duration_secs: 4 }
     { name: "▶ Coming up: Hold",        instruction: "Hold your breath for 4 counts.",                        duration_secs: 0 }
     { name: "Hold…",                    instruction: "Hold… 1… 2… 3… 4",                                      duration_secs: 4 }
     { name: "▶ Coming up: Slow exhale", instruction: "Exhale through your mouth for 6 counts.",               duration_secs: 0 }
     { name: "Exhale…",                  instruction: "Breathe out… 1… 2… 3… 4… 5… 6",                        duration_secs: 6 }

2. BREAK every physical phase into its own step. Do not bundle multiple
   actions into one long duration. Users cannot count or track time on their own —
   the step timer is the only guide they have.

3. For repeated cycles (e.g. "4 rounds of box breathing") EXPAND the repetitions
   as individual steps in the array — do not ask the LLM to loop. Each cycle
   gets its own announcement + action steps.

4. For body-scan or progressive-muscle-relaxation sequences, one step per body
   region. Announce the region at 0s, then hold the tense/release pair timed.

5. Use short, imperative language in step names (visible in the notification title).
   Put the count rhythm or cue text in the instruction (visible in the body).

6. EXG labelling is always on — every step creates a timestamped brain-state record.
   This is intentional: the protocol IS the labelling run.

═══════════════════════════════════════════════════════════════
DURATION GUIDELINES:
  Breath inhale:        3–5 s      Breath hold:          2–4 s
  Breath exhale:        4–8 s      Muscle tense:         5 s
  Muscle release/relax: 8–10 s     Body-scan region:    10–15 s
  Transition announce:  0 s        Opening/closing:      3–5 s
═══════════════════════════════════════════════════════════════`,

	parameters: Type.Object({
		title: Type.String({
			description: "Protocol name shown in notification titles (e.g. 'Recovery Reset').",
		}),
		intro: Type.Optional(
			Type.String({
				description: "Opening message sent as the first notification body.",
			}),
		),
		steps: Type.Array(StepSchema, {
			description:
				"Ordered list of steps. Must follow the mandatory structure above: " +
				"every timed action is preceded by a 0-duration announcement step.",
		}),
	}),

	execute: async (_id, params:any, signal, onUpdate, _ctx) => {
		const { title, intro, steps } = params;
		const log: string[] = [];

		/** Append a line to the running log and push the full log to onUpdate. */
		const emit = (line: string) => {
			log.push(line);
			onUpdate?.({
				content: [{ type: "text" as const, text: log.join("\n") }],
				details: {},
			});
		};

		// ── Protocol start ─────────────────────────────────────────────────
		const stepWord = steps.length === 1 ? "step" : "steps";
		emit(`▶ **${title}** — ${steps.length} ${stepWord}`);

		await notify(
			title,
			intro ?? `${steps.length}-step protocol starting. Follow the notifications.`,
		);
		await label(
			`protocol start: ${title}`,
			`Starting protocol "${title}" (${steps.length} ${stepWord}).${intro ? " " + intro : ""}`,
		);

		// ── Steps ──────────────────────────────────────────────────────────
		let completedSteps = 0;

		for (let i = 0; i < steps.length; i++) {
			if (signal?.aborted) break;

			const step = steps[i];
			const num = `${i + 1}/${steps.length}`;
			const isAnnouncement = step.duration_secs === 0;
			const durationNote = step.duration_secs > 0 ? ` — ${step.duration_secs}s` : "";

			emit(`\nStep ${num}: **${step.name}**${durationNote}\n${step.instruction}`);

			await notify(`${step.name}${durationNote}`, step.instruction);

			// Label every step — the protocol is the EXG record.
			await label(
				`${isAnnouncement ? "announce" : "step"} ${i + 1}: ${step.name.replace(/^[▶►] /, "").slice(0, 40).toLowerCase()}`,
				`Protocol "${title}", step ${num}. ${step.instruction}`,
			);

			if (step.duration_secs > 0 && !signal?.aborted) {
				try {
					await sleep(step.duration_secs * 1000, signal);
				} catch {
					break; // aborted mid-step
				}
			}

			completedSteps++;
		}

		// ── Protocol end ───────────────────────────────────────────────────
		const aborted = signal?.aborted ?? false;

		if (!aborted) {
			await notify(`${title} complete ✓`, "Well done. Take a moment to notice how you feel.");
			await label(
				`protocol complete: ${title}`,
				`Finished protocol "${title}" — all ${steps.length} ${stepWord} completed.`,
			);
			emit(`\n✓ **${title} complete.** Take a moment to notice how you feel.`);
		} else {
			emit(`\n⚠ Protocol cancelled after ${completedSteps}/${steps.length} ${stepWord}.`);
		}

		return {
			content: [{ type: "text" as const, text: log.join("\n") }],
			details: { title, total_steps: steps.length, completed_steps: completedSteps, aborted },
		};
	},
} satisfies ToolDefinition;
