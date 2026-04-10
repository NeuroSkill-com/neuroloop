/**
 * compression.ts — Token compression utilities for NeuroLoop.
 * 
 * Provides two modes:
 *   - standard: Light compression (removes filler, keeps grammar).
 *   - strong: Heavy compression (caveman-style, drops articles, fragments).
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompressionMode = "standard" | "strong" | "off";

interface CompressionSettings {
  mode: CompressionMode;
}

// ---------------------------------------------------------------------------
// Settings Management
// ---------------------------------------------------------------------------

const AGENT_DIR = join(homedir(), ".neuroloop");
const COMPRESSION_SETTINGS_PATH = join(AGENT_DIR, "compression.json");

/** Load compression settings from disk. */
export function loadCompressionSettings(): CompressionSettings {
  try {
    if (existsSync(COMPRESSION_SETTINGS_PATH)) {
      const raw = readFileSync(COMPRESSION_SETTINGS_PATH, "utf8");
      const settings = JSON.parse(raw) as CompressionSettings;
      if (settings.mode === "standard" || settings.mode === "strong" || settings.mode === "off") {
        return settings;
      }
    }
  } catch {
    // Fall through to default
  }
  return { mode: "standard" }; // Default: standard compression
}

/** Save compression settings to disk. */
export function saveCompressionSettings(settings: CompressionSettings): void {
  try {
    if (!existsSync(AGENT_DIR)) {
      mkdirSync(AGENT_DIR, { recursive: true, mode: 0o700 });
    }
    writeFileSync(
      COMPRESSION_SETTINGS_PATH,
      JSON.stringify(settings, null, 2),
      { encoding: "utf8", mode: 0o600 }
    );
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Compression Logic
// ---------------------------------------------------------------------------

/** Standard compression: Remove filler words, keep grammar intact. */
function compressStandard(text: string): string {
  // Remove common filler phrases
  const fillers = [
    /I think /gi,
    /I believe /gi,
    /In my opinion,? /gi,
    /It seems that /gi,
    /It appears that /gi,
    /I would recommend /gi,
    /I suggest /gi,
    /I'd like to /gi,
    /I'm going to /gi,
    /I'll /gi,
    /I can /gi,
    /I will /gi,
    /I am /gi,
    /I have /gi,
    /I've /gi,
    /I'm /gi,
    /I'd /gi,
    /I'll /gi,
    /I'm going to /gi,
    /I'm going to /gi,
    /I'm going to /gi,
    /I'm going to /gi,
  ];
  
  let result = text;
  for (const filler of fillers) {
    result = result.replace(filler, "");
  }
  
  // Trim whitespace
  return result.trim();
}

/** Strong compression: Caveman-style, drops articles, fragments. */
function compressStrong(text: string): string {
  // Step 1: Apply standard compression first
  let result = compressStandard(text);
  
  // Step 2: Drop articles (a, an, the)
  result = result.replace(/\b(a|an|the)\s+/gi, "");
  
  // Step 3: Drop auxiliary verbs (is, are, was, were, have, has, had, am)
  result = result.replace(/\b(is|are|was|were|have|has|had|am)\s+/gi, "");
  
  // Step 4: Drop pronouns (I, you, we, they, he, she, it, my, your, our, their, his, her, its)
  result = result.replace(/\b(I|you|we|they|he|she|it|my|your|our|their|his|her|its)\s+/gi, "");
  
  // Step 5: Drop conjunctions (and, but, or, so, then)
  result = result.replace(/\b(and|but|or|so|then)\s+/gi, ", ");
  
  // Step 6: Drop prepositions (in, on, at, to, for, with, from, by, about)
  result = result.replace(/\b(in|on|at|to|for|with|from|by|about)\s+/gi, "");
  
  // Step 7: Drop modal verbs (can, could, would, should, may, might, must)
  result = result.replace(/\b(can|could|would|should|may|might|must)\s+/gi, "");
  
  // Step 8: Drop relative pronouns (that, which, who, whom, whose)
  result = result.replace(/\b(that|which|who|whom|whose)\s+/gi, "");
  
  // Step 9: Drop adverbs (really, very, quite, rather, too, so, just)
  result = result.replace(/\b(really|very|quite|rather|too|so|just)\s+/gi, "");
  
  // Step 10: Trim and clean up
  result = result.replace(/\s+/g, " ").trim();
  
  // Step 11: Add ellipsis if it ends abruptly
  if (!/[.!?]$/.test(result)) {
    result += "…";
  }
  
  // Step 12: Replace common phrases with symbols
  result = result.replace(/→/g, "→");
  result = result.replace(/because/g, "⇒");
  result = result.replace(/so/g, "⇒");
  
  return result;
}

/** Apply compression based on mode. */
export function compressText(text: string, mode: CompressionMode): string {
  switch (mode) {
    case "standard":
      return compressStandard(text);
    case "strong":
      return compressStrong(text);
    case "off":
    default:
      return text;
  }
}

/** Get a human-readable name for the compression mode. */
export function getCompressionModeName(mode: CompressionMode): string {
  switch (mode) {
    case "standard": return "Standard";
    case "strong": return "Strong";
    case "off": return "Off";
  }
}
