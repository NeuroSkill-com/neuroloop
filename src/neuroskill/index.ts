/**
 * neuroskill/index.ts — public barrel for the neuroskill module.
 *
 * Consumers (neuroloop.ts, tests) import from here; the internal split
 * between run / signals / context is an implementation detail.
 */

export type { NeuroSkillResult } from "./run.ts";
export { NEUROSKILL_TIMEOUT_MS, runNeuroSkill } from "./run.ts";

export type { Signals } from "./signals.ts";
export { any, detectSignals } from "./signals.ts";

export { selectContextualData, warmCompareInBackground } from "./context.ts";
