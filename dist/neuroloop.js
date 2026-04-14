#!/usr/bin/env node

// src/main.ts
import { existsSync as existsSync10, readdirSync as readdirSync2, readFileSync as readFileSync10 } from "node:fs";
import { homedir as homedir10 } from "node:os";
import { basename, dirname as dirname5, join as join10, relative } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  InteractiveMode,
  ModelRegistry,
  createSyntheticSourceInfo,
  SessionManager,
  SettingsManager
} from "@mariozechner/pi-coding-agent";

// src/neuroloop.ts
import { existsSync as existsSync9, mkdirSync as mkdirSync8, readFileSync as readFileSync9, writeFileSync as writeFileSync6 } from "node:fs";
import { homedir as homedir9 } from "node:os";
import { dirname as dirname4, join as join9 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { Container as Container4, Markdown, Spacer } from "@mariozechner/pi-tui";
import { truncateToWidth as truncateToWidth4, visibleWidth as visibleWidth4 } from "@mariozechner/pi-tui";
import { Type as Type4 } from "@sinclair/typebox";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

// src/tui/themes.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
var DEFAULT_SYMBOLS = {
  logo: "\u25C6",
  connected: "\u25CF",
  connecting: "\u280B",
  offline: "\u25CB",
  device: "\u2388",
  heart: "\u2665",
  label: "\u2B21",
  exgOnline: "\u25C9",
  exgOffline: "\u25CC",
  separator: "\u2500",
  barFilled: "\u2588",
  barEmpty: "\u2591",
  bandDelta: "\u03B4",
  bandTheta: "\u03B8",
  bandAlpha: "\u03B1",
  bandBeta: "\u03B2",
  bandGamma: "\u03B3"
};
var rgb = (r, g, b) => (text) => `\x1B[38;2;${r};${g};${b}m${text}\x1B[0m`;
var BUILTIN_THEMES = [
  {
    id: "neuro-dark",
    name: "Neuro Dark",
    description: "Default dark theme with blue accents",
    colors: {}
    // uses framework defaults
  },
  {
    id: "neuro-light",
    name: "Neuro Light",
    description: "Light-friendly with muted tones",
    colors: {
      accent: rgb(30, 90, 180),
      success: rgb(30, 140, 60),
      warning: rgb(180, 120, 0),
      error: rgb(180, 40, 40),
      dim: rgb(120, 120, 120),
      muted: rgb(100, 100, 100),
      syntaxType: rgb(0, 130, 130)
    }
  },
  {
    id: "calm",
    name: "Calm",
    description: "Soft greens and blues for relaxed sessions",
    colors: {
      accent: rgb(100, 180, 200),
      success: rgb(120, 200, 140),
      warning: rgb(220, 200, 100),
      error: rgb(200, 120, 120),
      dim: rgb(80, 100, 100),
      muted: rgb(60, 80, 80),
      syntaxType: rgb(140, 200, 180)
    },
    symbols: { logo: "\u25C7", separator: "\u254C" }
  },
  {
    id: "focus",
    name: "Focus",
    description: "High-contrast amber on dark for deep work",
    colors: {
      accent: rgb(255, 180, 0),
      success: rgb(0, 220, 100),
      warning: rgb(255, 200, 50),
      error: rgb(255, 60, 60),
      dim: rgb(100, 80, 50),
      muted: rgb(80, 60, 40),
      syntaxType: rgb(200, 150, 50)
    },
    symbols: { logo: "\u25C8" }
  },
  {
    id: "matrix",
    name: "Matrix",
    description: "Green phosphor terminal aesthetic",
    colors: {
      accent: rgb(0, 255, 65),
      success: rgb(0, 200, 50),
      warning: rgb(0, 180, 40),
      error: rgb(200, 0, 0),
      dim: rgb(0, 80, 20),
      muted: rgb(0, 60, 15),
      syntaxType: rgb(0, 220, 55)
    },
    symbols: { logo: "\u25C6", separator: "\xB7" }
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Popular dark theme with purple accents",
    colors: {
      accent: rgb(189, 147, 249),
      // purple
      success: rgb(80, 250, 123),
      // green
      warning: rgb(255, 184, 108),
      // orange
      error: rgb(255, 85, 85),
      // red
      dim: rgb(98, 114, 164),
      // comment
      muted: rgb(68, 71, 90),
      // current line
      syntaxType: rgb(139, 233, 253)
      // cyan
    }
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Warm pastel tones",
    colors: {
      accent: rgb(137, 180, 250),
      // blue
      success: rgb(166, 227, 161),
      // green
      warning: rgb(249, 226, 175),
      // yellow
      error: rgb(243, 139, 168),
      // red
      dim: rgb(147, 153, 178),
      // overlay1
      muted: rgb(108, 112, 134),
      // overlay0
      syntaxType: rgb(148, 226, 213)
      // teal
    }
  }
];
var THEME_STATE_PATH = join(homedir(), ".neuroloop", "theme.json");
function loadThemeId() {
  try {
    if (existsSync(THEME_STATE_PATH)) {
      const data = JSON.parse(readFileSync(THEME_STATE_PATH, "utf8"));
      if (data.id && BUILTIN_THEMES.some((t) => t.id === data.id)) return data.id;
    }
  } catch {
  }
  return "neuro-dark";
}
function saveThemeId(id) {
  const dir = join(homedir(), ".neuroloop");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(THEME_STATE_PATH, JSON.stringify({ id }), "utf8");
}
var activeTheme = BUILTIN_THEMES[0];
function getActiveTheme() {
  return activeTheme;
}
function setActiveTheme(id) {
  const found = BUILTIN_THEMES.find((t) => t.id === id);
  if (!found) return null;
  activeTheme = found;
  saveThemeId(id);
  return found;
}
function initTheme() {
  const id = loadThemeId();
  const found = BUILTIN_THEMES.find((t) => t.id === id);
  if (found) activeTheme = found;
}
function wrapTheme(base) {
  if (activeTheme.id === "neuro-dark" && !Object.keys(activeTheme.colors).length) {
    return base;
  }
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "fg") {
        return (color, text) => {
          const override = activeTheme.colors[color];
          if (override) return override(text);
          return target.fg(color, text);
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}
function symbols() {
  return { ...DEFAULT_SYMBOLS, ...activeTheme.symbols };
}

// src/tui/toast.ts
var RULES = [
  {
    id: "focus-spike",
    label: "Focus spike",
    field: "focus",
    threshold: 85,
    direction: "above",
    level: "info",
    cooldownSec: 120,
    message: (v) => `Focus spike detected (${Math.round(v)}%) \u2014 you're in the zone`
  },
  {
    id: "focus-drop",
    label: "Focus drop",
    field: "focus",
    threshold: 20,
    direction: "below",
    level: "warning",
    cooldownSec: 180,
    message: (v) => `Focus dropped to ${Math.round(v)}% \u2014 consider a break?`
  },
  {
    id: "drowsiness-high",
    label: "Drowsiness alert",
    field: "drowsiness",
    threshold: 70,
    direction: "above",
    level: "warning",
    cooldownSec: 300,
    message: (v) => `Drowsiness elevated (${Math.round(v)}%) \u2014 time for a stretch`
  },
  {
    id: "relaxation-deep",
    label: "Deep relaxation",
    field: "relaxation",
    threshold: 85,
    direction: "above",
    level: "info",
    cooldownSec: 120,
    message: (v) => `Deep relaxation detected (${Math.round(v)}%)`
  },
  {
    id: "hr-high",
    label: "Heart rate elevated",
    field: "hr",
    threshold: 100,
    direction: "above",
    level: "warning",
    cooldownSec: 300,
    message: (v) => `Heart rate elevated (${Math.round(v)} bpm) \u2014 take a breath`
  },
  {
    id: "hr-low",
    label: "Heart rate low",
    field: "hr",
    threshold: 50,
    direction: "below",
    level: "warning",
    cooldownSec: 300,
    message: (v) => `Heart rate low (${Math.round(v)} bpm)`
  },
  {
    id: "engagement-high",
    label: "High engagement",
    field: "engagement",
    threshold: 85,
    direction: "above",
    level: "info",
    cooldownSec: 180,
    message: (v) => `High engagement (${Math.round(v)}%) \u2014 great flow state`
  },
  {
    id: "cogload-high",
    label: "Cognitive overload",
    field: "cognitive_load",
    threshold: 80,
    direction: "above",
    level: "warning",
    cooldownSec: 240,
    message: (v) => `Cognitive load high (${Math.round(v)}%) \u2014 try simplifying`
  }
];
var lastFired = /* @__PURE__ */ new Map();
var enabled = true;
function setSmartToastsEnabled(on) {
  enabled = on;
}
function isSmartToastsEnabled() {
  return enabled;
}
function evaluateToasts(metrics, notify2) {
  if (!enabled) return;
  const now = Date.now();
  for (const rule of RULES) {
    const val = metrics[rule.field];
    if (val == null) continue;
    const triggered = rule.direction === "above" ? val >= rule.threshold : val <= rule.threshold;
    if (!triggered) continue;
    const last = lastFired.get(rule.id) ?? 0;
    if (now - last < rule.cooldownSec * 1e3) continue;
    lastFired.set(rule.id, now);
    notify2(rule.message(val), rule.level);
  }
}
function resetToastCooldowns() {
  lastFired.clear();
}

// src/tui/command-palette.ts
import { Container, Text } from "@mariozechner/pi-tui";
import { SelectList } from "@mariozechner/pi-tui";
function createCommandPalette(tui, theme, opts) {
  let commands = opts.commands;
  let overlayHandle = null;
  let visible = false;
  function buildOverlay() {
    const items = commands.map((cmd) => ({
      value: cmd.name,
      label: `/${cmd.name}`,
      description: cmd.description
    }));
    const header = new Text();
    header.setText(theme.fg("accent", " Commands") + theme.fg("dim", "  (type to filter, esc to close)"));
    const INV = "\x1B[7m";
    const BOLD = "\x1B[1m";
    const RST2 = "\x1B[0m";
    const list = new SelectList(items, 20, {
      selectedPrefix: (t) => INV + BOLD + t + RST2,
      selectedText: (t) => INV + BOLD + t + RST2,
      description: (t) => theme.fg("dim", t),
      scrollInfo: (t) => theme.fg("muted", t),
      noMatch: (t) => theme.fg("dim", t)
    });
    list.onSelect = (item) => {
      const cmd = commands.find((c) => c.name === item.value);
      hide();
      if (cmd) opts.onSelect(cmd);
    };
    list.onCancel = () => hide();
    const container = new Container();
    container.addChild(header);
    container.addChild(list);
    overlayHandle = tui.showOverlay(list, {
      width: "60%",
      minWidth: 40,
      maxHeight: "50%",
      anchor: "top-center",
      offsetY: 3
    });
    visible = true;
  }
  function show() {
    if (visible) {
      hide();
      return;
    }
    buildOverlay();
  }
  function hide() {
    if (overlayHandle) {
      overlayHandle.hide();
      overlayHandle = null;
    }
    visible = false;
  }
  function updateCommands(cmds) {
    commands = cmds;
  }
  function dispose() {
    hide();
  }
  return { show, hide, isVisible: () => visible, updateCommands, dispose };
}

// src/tui/render-scheduler.ts
function createRenderScheduler(tui) {
  let debounceTimer = null;
  let agoTimer = null;
  let lastDataRender = 0;
  function requestDataRender() {
    const now = Date.now();
    const elapsed = now - lastDataRender;
    if (elapsed >= 16) {
      lastDataRender = now;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      tui.requestRender();
      return;
    }
    if (!debounceTimer) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        lastDataRender = Date.now();
        tui.requestRender();
      }, 16 - elapsed);
    }
  }
  function requestImmediateRender() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    lastDataRender = Date.now();
    tui.requestRender();
  }
  function start() {
    if (!agoTimer) {
      agoTimer = setInterval(() => tui.requestRender(), 3e4);
    }
  }
  function stop() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (agoTimer) {
      clearInterval(agoTimer);
      agoTimer = null;
    }
  }
  return { requestDataRender, requestImmediateRender, start, stop };
}

// src/tui/overlay-panel.ts
import { Container as Container2, Text as Text2 } from "@mariozechner/pi-tui";
import { truncateToWidth } from "@mariozechner/pi-tui";
var SPARK_CHARS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
function sparkline(values, width = 20) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const recent = values.slice(-width);
  return recent.map((v) => {
    const idx = Math.round((v - min) / range * (SPARK_CHARS.length - 1));
    return SPARK_CHARS[idx];
  }).join("");
}
var HISTORY_SIZE = 60;
var history = [];
function pushHistory(entry) {
  history.push(entry);
  if (history.length > HISTORY_SIZE) history.shift();
}
function clearHistory() {
  history.length = 0;
}
function createExgPanel(tui, theme, state) {
  let overlayHandle = null;
  let visible = false;
  let panelText = null;
  function renderContent(width) {
    const lines = [];
    const s = symbols();
    const w = width - 4;
    lines.push(theme.fg("accent", ` ${s.logo} EXG Monitor`));
    lines.push(theme.fg("dim", " " + s.separator.repeat(Math.max(0, w))));
    if (!state.getOnline()) {
      lines.push("");
      lines.push(theme.fg("dim", "  " + s.exgOffline + " Device offline"));
      lines.push(theme.fg("dim", "  /connect to reconnect"));
      return lines;
    }
    const m = state.getMetrics();
    if (!m) {
      lines.push(theme.fg("dim", "  Waiting for data..."));
      return lines;
    }
    const dev = state.getDeviceName();
    if (dev) {
      lines.push(theme.fg("dim", `  ${s.device} `) + theme.fg("accent", dev));
    }
    lines.push("");
    const scoreRow = (label2, field, color, pct = true) => {
      const val = m[field];
      if (val == null) return;
      const hist = history.map((h) => h[field] ?? 0);
      const spark = theme.fg(color, sparkline(hist, Math.min(20, w - 18)));
      const valStr = pct ? `${(val * 100).toFixed(0)}%` : String(Math.round(val));
      lines.push(truncateToWidth(
        `  ${theme.fg("dim", label2.padEnd(10))} ${theme.fg(color, valStr.padStart(4))} ${spark}`,
        width
      ));
    };
    scoreRow("Focus", "focus", "success");
    scoreRow("Cog.Load", "cognitive_load", "warning");
    scoreRow("Relax", "relaxation", "success");
    scoreRow("Engage", "engagement", "accent");
    scoreRow("Drowsy", "drowsiness", "error");
    scoreRow("Mood", "mood", "success");
    if (m.hr != null) {
      scoreRow("Heart", "hr", "error", false);
    }
    lines.push("");
    lines.push(theme.fg("dim", " " + s.separator.repeat(Math.max(0, w))));
    lines.push(theme.fg("accent", "  Bands"));
    const b = m.bands ?? {};
    const vals = [b.rel_delta, b.rel_theta, b.rel_alpha, b.rel_beta, b.rel_gamma];
    const scale = Math.max(...vals.map((v) => v ?? 0), 1e-9);
    const barW = Math.max(5, Math.min(15, w - 14));
    const bandRow = (sym, label2, val, color) => {
      if (val == null) return;
      const filled = Math.min(barW, Math.round(val / scale * barW));
      const empty = Math.max(0, barW - filled);
      const bar = theme.fg(color, s.barFilled.repeat(filled)) + theme.fg("dim", s.barEmpty.repeat(empty));
      const pct = `${Math.round(val * 100)}%`.padStart(4);
      lines.push(truncateToWidth(`  ${theme.fg("dim", sym)} ${bar} ${theme.fg(color, pct)}`, width));
    };
    bandRow(s.bandDelta, "delta", b.rel_delta, "accent");
    bandRow(s.bandTheta, "theta", b.rel_theta, "warning");
    bandRow(s.bandAlpha, "alpha", b.rel_alpha, "success");
    bandRow(s.bandBeta, "beta", b.rel_beta, "error");
    bandRow(s.bandGamma, "gamma", b.rel_gamma, "syntaxType");
    if (history.length >= 5) {
      lines.push("");
      lines.push(theme.fg("dim", " " + s.separator.repeat(Math.max(0, w))));
      lines.push(theme.fg("accent", "  Trends") + theme.fg("dim", ` (${history.length} samples)`));
      const trend = (field, label2) => {
        const vals2 = history.map((h) => h[field] ?? 0).filter((v) => v > 0);
        if (vals2.length < 3) return;
        const recent = vals2.slice(-5);
        const earlier = vals2.slice(-10, -5);
        if (!earlier.length || !recent.length) return;
        const avgRecent = recent.reduce((a, b2) => a + b2, 0) / recent.length;
        const avgEarlier = earlier.reduce((a, b2) => a + b2, 0) / earlier.length;
        const delta = avgRecent - avgEarlier;
        const arrow = delta > 0.05 ? theme.fg("success", "\u2191") : delta < -0.05 ? theme.fg("error", "\u2193") : theme.fg("dim", "\u2192");
        lines.push(`  ${theme.fg("dim", label2.padEnd(10))} ${arrow}`);
      };
      trend("focus", "Focus");
      trend("relaxation", "Relax");
      trend("engagement", "Engage");
    }
    lines.push("");
    lines.push(theme.fg("muted", "  ctrl+e close  /exg details"));
    return lines;
  }
  function buildPanel() {
    panelText = new Text2();
    panelText.setText("");
    const container = new Container2();
    container.addChild(panelText);
    overlayHandle = tui.showOverlay(container, {
      width: "30%",
      minWidth: 32,
      maxHeight: "80%",
      anchor: "right-center",
      offsetX: -1,
      nonCapturing: true
    });
    visible = true;
    refresh();
  }
  function refresh() {
    if (!visible || !panelText) return;
    const width = 38;
    const content = renderContent(width);
    panelText.setText(content.join("\n"));
    tui.requestRender();
  }
  function show() {
    if (visible) return;
    buildPanel();
  }
  function hide() {
    if (overlayHandle) {
      overlayHandle.hide();
      overlayHandle = null;
    }
    panelText = null;
    visible = false;
  }
  function toggle() {
    if (visible) hide();
    else show();
  }
  function dispose() {
    hide();
    clearHistory();
  }
  return { show, hide, toggle, isVisible: () => visible, refresh, dispose };
}

// src/tui/overlay-manager.ts
import { matchesKey, Key } from "@mariozechner/pi-tui";
function createOverlayManager() {
  const overlays = /* @__PURE__ */ new Map();
  const showOrder = [];
  function register(overlay) {
    overlays.set(overlay.id, overlay);
  }
  function unregister(id) {
    const o = overlays.get(id);
    if (o?.isVisible()) o.hide();
    overlays.delete(id);
    const idx = showOrder.indexOf(id);
    if (idx >= 0) showOrder.splice(idx, 1);
  }
  function show(id) {
    const o = overlays.get(id);
    if (!o) return;
    if (o.modal) {
      for (const other of overlays.values()) {
        if (other.id !== id && other.modal && other.isVisible()) {
          other.hide();
          const idx2 = showOrder.indexOf(other.id);
          if (idx2 >= 0) showOrder.splice(idx2, 1);
        }
      }
    }
    o.show();
    const idx = showOrder.indexOf(id);
    if (idx >= 0) showOrder.splice(idx, 1);
    showOrder.push(id);
  }
  function hide(id) {
    const o = overlays.get(id);
    if (o?.isVisible()) o.hide();
    const idx = showOrder.indexOf(id);
    if (idx >= 0) showOrder.splice(idx, 1);
  }
  function toggle(id) {
    const o = overlays.get(id);
    if (!o) return;
    if (o.isVisible()) hide(id);
    else show(id);
  }
  function dismissTopModal() {
    for (let i = showOrder.length - 1; i >= 0; i--) {
      const o = overlays.get(showOrder[i]);
      if (o?.modal && o.isVisible()) {
        hide(o.id);
        return true;
      }
    }
    return false;
  }
  function hasModalVisible() {
    for (const o of overlays.values()) {
      if (o.modal && o.isVisible()) return true;
    }
    return false;
  }
  function get(id) {
    return overlays.get(id);
  }
  function installKeyHandler(tui) {
    const listener = (data) => {
      if (matchesKey(data, Key.escape)) {
        if (dismissTopModal()) {
          return { consume: true };
        }
      }
      return void 0;
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
    register,
    unregister,
    show,
    hide,
    toggle,
    dismissTopModal,
    hasModalVisible,
    get,
    installKeyHandler,
    dispose
  };
}

// src/tui/logo.ts
import { truncateToWidth as truncateToWidth2, visibleWidth as visibleWidth2 } from "@mariozechner/pi-tui";
var LOGO_ART_RAW = [
  "\u2588\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557     \u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551    \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557",
  "\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551    \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D",
  "\u2588\u2588\u2551\u255A\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551    \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u255D",
  "\u2588\u2588\u2551 \u255A\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551",
  "\u255A\u2550\u255D  \u255A\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D  \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D"
];
var LOGO_COMPACT_RAW = [
  "\u2588\u2557  \u2588\u2557                    \u2588\u2557              ",
  "\u2588\u2588\u2557 \u2588\u2551\u250C\u2500\u2510\u252C \u252C\u252C\u2500\u2510\u250C\u2500\u2510      \u2588\u2551  \u250C\u2500\u2510\u250C\u2500\u2510\u250C\u2500\u2510  ",
  "\u2588\u2554\u2588\u2588\u2551 \u251C\u2524 \u2502 \u2502\u251C\u252C\u2518\u2502 \u2502      \u2588\u2551  \u2502 \u2502\u2502 \u2502\u251C\u2500\u2518  ",
  "\u2588\u2551\u255A\u2588\u2551 \u2514\u2500\u2518\u2514\u2500\u2518\u2534\u2514\u2500\u2514\u2500\u2518      \u2588\u2588\u2588\u2588\u2588\u2514\u2500\u2518\u2514\u2500\u2518\u2534    ",
  "\u255A\u255D \u255A\u255D                    \u255A\u2550\u2550\u2550\u2550\u255D           "
];
var LOGO_MINI = "\u25C6 NeuroLoop\u2122";
function padArt(raw) {
  const maxW = Math.max(...raw.map((l) => [...l].length));
  const targetW = maxW + 1;
  const padded = raw.map((l) => l + " ".repeat(Math.max(0, targetW - [...l].length)));
  padded[0] = padded[0].slice(0, -1) + "\u2122";
  return padded;
}
var LOGO_ART = padArt(LOGO_ART_RAW);
var LOGO_COMPACT = padArt(LOGO_COMPACT_RAW);
var pink = (text) => `\x1B[38;2;255;105;180m${text}\x1B[0m`;
var magenta = (text) => `\x1B[38;2;200;80;200m${text}\x1B[0m`;
var hotpink = (text) => `\x1B[38;2;255;20;147m${text}\x1B[0m`;
var dimPink = (text) => `\x1B[38;2;180;80;130m${text}\x1B[0m`;
var FULL_ART_WIDTH = visibleWidth2(LOGO_ART[0]);
var COMPACT_ART_WIDTH = visibleWidth2(LOGO_COMPACT[0]);
function renderLogo(width, theme) {
  const lines = [];
  if (width >= FULL_ART_WIDTH + 4) {
    for (let i = 0; i < LOGO_ART.length; i++) {
      const row = LOGO_ART[i];
      const pad = Math.max(0, Math.floor((width - FULL_ART_WIDTH) / 2));
      if (i === 0) {
        const tmIdx = row.lastIndexOf("\u2122");
        const body = row.slice(0, tmIdx);
        lines.push(truncateToWidth2(" ".repeat(pad) + hotpink(body) + dimPink("\u2122"), width));
      } else {
        lines.push(truncateToWidth2(" ".repeat(pad) + hotpink(row), width));
      }
    }
  } else if (width >= COMPACT_ART_WIDTH + 4) {
    for (let i = 0; i < LOGO_COMPACT.length; i++) {
      const row = LOGO_COMPACT[i];
      const pad = Math.max(0, Math.floor((width - COMPACT_ART_WIDTH) / 2));
      if (i === 0) {
        const body = row.slice(0, -1);
        lines.push(truncateToWidth2(" ".repeat(pad) + pink(body) + dimPink("\u2122"), width));
      } else {
        lines.push(truncateToWidth2(" ".repeat(pad) + pink(row), width));
      }
    }
  } else {
    const pad = Math.max(0, Math.floor((width - visibleWidth2(LOGO_MINI)) / 2));
    lines.push(truncateToWidth2(" ".repeat(pad) + hotpink("\u25C6 NeuroLoop") + dimPink("\u2122"), width));
  }
  return lines;
}
function renderTagline(width, theme, version) {
  const tag = `v${version}`;
  const text = magenta("brain-aware coding") + theme.fg("dim", `  ${tag}`);
  const textWidth = visibleWidth2("brain-aware coding") + visibleWidth2(`  ${tag}`);
  const pad = Math.max(0, Math.floor((width - textWidth) / 2));
  return truncateToWidth2(" ".repeat(pad) + text, width);
}

// src/tui/llm-panel.ts
import { SelectList as SelectList2 } from "@mariozechner/pi-tui";
import { truncateToWidth as truncateToWidth3, visibleWidth as visibleWidth3 } from "@mariozechner/pi-tui";
var HOTPINK = "\x1B[38;2;255;20;147m";
var RST = "\x1B[0m";
var BORDER_COLOR = "\x1B[38;2;140;100;180m";
var BG = "\x1B[48;2;25;20;35m";
var INVERSE = "\x1B[7m";
var BOLD_ON = "\x1B[1m";
var BD = { tl: "\u2554", tr: "\u2557", bl: "\u255A", br: "\u255D", h: "\u2550", v: "\u2551" };
var BorderedPanel = class {
  child;
  title;
  titleWidth;
  hints;
  paddingX;
  constructor(child, opts) {
    this.child = child;
    this.title = opts.title;
    this.titleWidth = opts.titleWidth;
    this.hints = opts.hints;
    this.paddingX = opts.paddingX ?? 1;
  }
  invalidate() {
    this.child.invalidate?.();
  }
  handleInput(data) {
    this.child.handleInput?.(data);
  }
  render(width) {
    const innerW = Math.max(10, width - 2 - this.paddingX * 2);
    const totalInner = width - 2;
    const childLines = this.child.render(innerW);
    const pad = " ".repeat(this.paddingX);
    const lines = [];
    const b = (s) => BORDER_COLOR + s + RST;
    const bg = (content, contentW) => {
      const rp = Math.max(0, totalInner - contentW);
      return BG + content + " ".repeat(rp) + RST;
    };
    const titleSeg = ` ${this.title} `;
    const afterTitle = Math.max(0, totalInner - 2 - this.titleWidth - 2 - visibleWidth3(this.hints) - 1);
    lines.push(truncateToWidth3(
      b(BD.tl + BD.h.repeat(2)) + BG + titleSeg + RST + b(BD.h.repeat(afterTitle)) + this.hints + " " + b(BD.tr),
      width
    ));
    lines.push(b(BD.v) + bg("", 0) + b(BD.v));
    for (const cl of childLines) {
      const line = pad + cl;
      lines.push(b(BD.v) + bg(line, visibleWidth3(line)) + b(BD.v));
    }
    lines.push(b(BD.v) + bg("", 0) + b(BD.v));
    lines.push(b(BD.bl + BD.h.repeat(totalInner) + BD.br));
    return lines;
  }
};
function createLlmPanel(tui, theme, callbacks) {
  let overlayHandle = null;
  let visible = false;
  async function buildAndShow() {
    if (visible) {
      hide();
      return;
    }
    const [catalog, status] = await Promise.all([
      callbacks.fetchCatalog(),
      callbacks.fetchStatus()
    ]);
    const items = [];
    const statusIcon = status?.status === "running" ? theme.fg("success", "\u25CF") : status?.status === "loading" ? theme.fg("warning", "\u25D0") : theme.fg("dim", "\u25CB");
    const statusText = status?.status ?? "unknown";
    const modelText = status?.modelName ? theme.fg("accent", ` ${status.modelName}`) : "";
    const ctxText = status?.nCtx ? theme.fg("dim", ` \xB7 ${status.nCtx} ctx`) : "";
    const visionText = status?.supportsVision ? theme.fg("dim", " \xB7 vision") : "";
    items.push({
      value: "__status__",
      label: ` ${statusIcon} Server: ${theme.bold(statusText)}${modelText}${ctxText}${visionText}`,
      description: ""
    });
    if (status?.status === "running") {
      items.push({ value: "action:stop", label: `   ${theme.fg("error", "\u23F9")} Stop server`, description: "" });
    } else {
      items.push({ value: "action:start", label: `   ${theme.fg("success", "\u25B6")} Start server`, description: "" });
    }
    items.push({ value: "__sep0__", label: " ", description: "" });
    if (catalog) {
      const models = catalog.entries.filter((e) => !e.isMmproj);
      const downloaded = models.filter((m) => m.state === "downloaded");
      const downloading = models.filter((m) => m.state === "downloading" || m.state === "paused");
      const available = models.filter((m) => m.state !== "downloaded" && m.state !== "downloading" && m.state !== "paused");
      if (downloaded.length) {
        items.push({
          value: "__hdr_downloaded__",
          label: ` ${theme.bold("Downloaded")} ${theme.fg("dim", `(${downloaded.length})`)}`,
          description: ""
        });
        for (const m of downloaded) {
          const isActive = m.filename === catalog.activeModel;
          const marker = isActive ? theme.fg("success", " \u25B6 ") : "   ";
          const name = isActive ? theme.fg("accent", m.filename) : m.filename;
          const parts = [m.quant, m.paramsB ? `${m.paramsB}B` : "", m.sizeGb ? `${m.sizeGb.toFixed(1)} GB` : ""].filter(Boolean);
          const info = parts.length ? theme.fg("dim", "  " + parts.join(" \xB7 ")) : "";
          const rec = m.recommended ? theme.fg("warning", " \u2B50") : "";
          items.push({ value: `select:${m.filename}`, label: `${marker}${name}${rec}${info}`, description: "" });
        }
      }
      if (downloading.length) {
        items.push({ value: "__sep1__", label: " ", description: "" });
        items.push({
          value: "__hdr_downloading__",
          label: ` ${theme.bold("Downloading")} ${theme.fg("dim", `(${downloading.length})`)}  ${theme.fg("dim", "\u2014 live progress in footer \u2193")}`,
          description: ""
        });
        for (const m of downloading) {
          const icon = m.state === "paused" ? theme.fg("warning", " \u23F8 ") : theme.fg("accent", " \u2B07 ");
          const pct = Math.max(0, Math.min(100, Math.round(m.progress ?? 0)));
          const barW = 20;
          const filled = Math.round(pct / 100 * barW);
          const empty = Math.max(0, barW - filled);
          const bar = HOTPINK + "\u2588".repeat(filled) + RST + "\x1B[90m" + "\u2591".repeat(empty) + RST;
          const pctStr = HOTPINK + `${String(pct).padStart(3)}%` + RST;
          const stateHint = m.state === "paused" ? theme.fg("warning", " paused") : "";
          items.push({
            value: `download:${m.filename}`,
            label: `${icon}${m.filename}  ${bar} ${pctStr}${stateHint}`,
            description: ""
          });
        }
      }
      if (available.length) {
        items.push({ value: "__sep2__", label: " ", description: "" });
        items.push({
          value: "__hdr_available__",
          label: ` ${theme.bold("Available")} ${theme.fg("dim", `(${available.length})`)}`,
          description: ""
        });
        for (const m of available) {
          const parts = [m.quant, m.paramsB ? `${m.paramsB}B` : "", m.sizeGb ? `${m.sizeGb.toFixed(1)} GB` : ""].filter(Boolean);
          const info = parts.length ? theme.fg("dim", "  " + parts.join(" \xB7 ")) : "";
          const rec = m.recommended ? theme.fg("warning", " \u2B50") : "";
          const family = m.familyName ? theme.fg("muted", `${m.familyName} `) : "";
          items.push({
            value: `download-start:${m.filename}`,
            label: `   ${theme.fg("dim", "\u25CB")} ${family}${m.filename}${rec}${info}`,
            description: ""
          });
        }
      }
    } else {
      items.push({
        value: "__empty__",
        label: `   ${theme.fg("dim", "catalog unavailable \u2014 is the daemon running?")}`,
        description: ""
      });
    }
    items.push({ value: "__sep3__", label: " ", description: "" });
    items.push({ value: "action:connect", label: `   ${theme.fg("accent", "\u26A1")} Connect Skill LLM  ${theme.fg("dim", "local/remote/auto")}`, description: "" });
    items.push({ value: "action:fit", label: `   ${theme.fg("accent", "\u{1F4D0}")} Check model fit  ${theme.fg("dim", "RAM/VRAM")}`, description: "" });
    items.push({ value: "action:route", label: `   ${theme.fg("accent", "\u{1F9ED}")} Show LLM route  ${theme.fg("dim", "active + fallbacks")}`, description: "" });
    const list = new SelectList2(items, 22, {
      selectedPrefix: (t) => INVERSE + BOLD_ON + HOTPINK + t + RST,
      selectedText: (t) => INVERSE + BOLD_ON + t + RST,
      description: (t) => t,
      scrollInfo: (t) => theme.fg("muted", t),
      noMatch: (t) => theme.fg("dim", t)
    });
    list.onSelect = (item) => {
      const val = item.value;
      if (val.startsWith("__")) return;
      if (val.startsWith("action:")) {
        hide();
        callbacks.onAction(val.slice(7));
        return;
      }
      if (val.startsWith("select:")) {
        hide();
        callbacks.onAction("select", val.slice(7));
        return;
      }
      if (val.startsWith("download-start:")) {
        hide();
        callbacks.onAction("download", val.slice(15));
        return;
      }
      if (val.startsWith("download:")) {
        const fname = val.slice(9);
        const entry = catalog?.entries.find((e) => e.filename === fname);
        if (entry?.state === "paused") {
          hide();
          callbacks.onAction("resume", fname);
        } else if (entry?.state === "downloading") {
          hide();
          callbacks.onAction("pause", fname);
        }
        return;
      }
    };
    list.onCancel = () => hide();
    const titleStr = theme.fg("accent", "\u{1F916}") + " " + theme.bold("LLM Manager");
    const titleW = visibleWidth3("\u{1F916} LLM Manager");
    const hintsStr = theme.fg("muted", "esc") + theme.fg("dim", " close \xB7 ") + theme.fg("muted", "\u2191\u2193") + theme.fg("dim", " navigate \xB7 ") + theme.fg("muted", "enter") + theme.fg("dim", " select");
    const panel = new BorderedPanel(list, {
      title: titleStr,
      titleWidth: titleW,
      hints: hintsStr,
      paddingX: 1
    });
    overlayHandle = tui.showOverlay(panel, {
      width: "75%",
      minWidth: 55,
      maxHeight: "75%",
      anchor: "center"
    });
    tui.setFocus(panel);
    visible = true;
  }
  function show() {
    buildAndShow();
  }
  function hide() {
    if (overlayHandle) {
      overlayHandle.hide();
      overlayHandle = null;
    }
    visible = false;
  }
  function toggle() {
    if (visible) hide();
    else show();
  }
  function dispose() {
    hide();
  }
  return { show, hide, toggle, isVisible: () => visible, dispose };
}

// src/neuroloop.ts
import WS from "ws";

// src/neuroskill/run.ts
import { execFile as execFile2 } from "node:child_process";
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { join as join3 } from "node:path";
import { promisify as promisify2 } from "node:util";

// src/runtime-updates.ts
import { execFile } from "node:child_process";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var AGENT_DIR = join2(homedir2(), ".neuroloop");
var RUNTIME_PREFIX = join2(AGENT_DIR, "runtime");
var RUNTIME_NODE_MODULES = join2(RUNTIME_PREFIX, "node_modules");
var IS_WINDOWS = process.platform === "win32";
var runtimeState = null;
function parseSemver(v) {
  const [core] = v.trim().split("-");
  return core.split(".").map((n) => parseInt(n, 10) || 0);
}
function compareSemver(a, b) {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  const max = Math.max(av.length, bv.length);
  for (let i = 0; i < max; i++) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}
async function fetchJson(url, timeoutMs = 5e3) {
  const res = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "neuroloop-version-check"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}
async function getNpmLatestVersion(pkg) {
  try {
    const data = await fetchJson(`https://registry.npmjs.org/${pkg}/latest`, 6e3);
    return data.version;
  } catch {
    return void 0;
  }
}
function getInstalledRuntimeVersion(pkg) {
  try {
    const p = join2(RUNTIME_NODE_MODULES, pkg, "package.json");
    if (!existsSync2(p)) return void 0;
    const data = JSON.parse(readFileSync2(p, "utf8"));
    return data.version;
  } catch {
    return void 0;
  }
}
function getLocalNeuroSkillBinPath() {
  return join2(RUNTIME_NODE_MODULES, ".bin", IS_WINDOWS ? "neuroskill.cmd" : "neuroskill");
}
async function installRuntimePackage(pkg, version) {
  if (!existsSync2(RUNTIME_PREFIX)) mkdirSync2(RUNTIME_PREFIX, { recursive: true, mode: 448 });
  await execFileAsync("npm", ["install", "--prefix", RUNTIME_PREFIX, "--no-save", `${pkg}@${version}`], {
    timeout: 18e4,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env },
    ...IS_WINDOWS ? { shell: true, windowsHide: true } : {}
  });
}
async function tryUpdateGlobalNeuroloop(version) {
  try {
    await execFileAsync("npm", ["install", "-g", `neuroloop@${version}`], {
      timeout: 18e4,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
      ...IS_WINDOWS ? { shell: true, windowsHide: true } : {}
    });
    return void 0;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
async function refreshRuntimeVersions(localNeuroloopVersion) {
  const state = {
    checkedAt: Date.now(),
    neuroloop: { local: localNeuroloopVersion },
    neuroskill: {},
    github: {}
  };
  const [npmNeuroloop, npmNeuroskill] = await Promise.all([
    getNpmLatestVersion("neuroloop"),
    getNpmLatestVersion("neuroskill")
  ]);
  state.neuroloop.npmLatest = npmNeuroloop;
  if (npmNeuroloop) {
    state.neuroloop.upToDate = compareSemver(localNeuroloopVersion, npmNeuroloop) >= 0;
    if (!state.neuroloop.upToDate) {
      state.neuroloop.updateError = await tryUpdateGlobalNeuroloop(npmNeuroloop);
      state.neuroloop.updated = !state.neuroloop.updateError;
    }
  }
  state.neuroskill.npmLatest = npmNeuroskill;
  const installed = getInstalledRuntimeVersion("neuroskill");
  state.neuroskill.localInstalled = installed;
  if (npmNeuroskill) {
    const upToDate = installed ? compareSemver(installed, npmNeuroskill) >= 0 : false;
    state.neuroskill.upToDate = upToDate;
    if (!upToDate) {
      try {
        await installRuntimePackage("neuroskill", npmNeuroskill);
        state.neuroskill.localInstalled = getInstalledRuntimeVersion("neuroskill") ?? npmNeuroskill;
        state.neuroskill.installedNow = true;
        state.neuroskill.upToDate = true;
      } catch (err) {
        state.neuroskill.installError = err instanceof Error ? err.message : String(err);
      }
    }
  }
  try {
    const commit = await fetchJson(
      "https://api.github.com/repos/NeuroSkill-com/neuroloop/commits/main",
      6e3
    );
    state.github.latestCommit = commit.sha?.slice(0, 7);
  } catch (err) {
    state.github.error = err instanceof Error ? err.message : String(err);
  }
  try {
    const rel = await fetchJson(
      "https://api.github.com/repos/NeuroSkill-com/neuroloop/releases/latest",
      6e3
    );
    state.github.latestTag = rel.tag_name;
  } catch {
  }
  runtimeState = state;
  return state;
}
function getRuntimeVersionState() {
  return runtimeState;
}

// src/neuroskill/run.ts
var _authStatus = "none";
function getAuthStatus() {
  return _authStatus;
}
async function checkAuthStatus() {
  const port = await discoverSkillServer();
  if (port !== null) {
    _authStatus = "local";
    return "local";
  }
  _authStatus = "none";
  return "none";
}
function getDaemonTokenPath() {
  const configDir = process.env.XDG_CONFIG_HOME || (process.platform === "win32" ? join3(process.env.APPDATA || join3(homedir3(), "AppData", "Roaming")) : join3(homedir3(), process.platform === "darwin" ? "Library/Application Support" : ".config"));
  return join3(configDir, "skill", "daemon", "auth.token");
}
var execFileAsync2 = promisify2(execFile2);
var NEUROSKILL_TIMEOUT_MS = 3e4;
var AGENT_DIR2 = join3(homedir3(), ".neuroloop");
var PORT_FILE = join3(AGENT_DIR2, "neuroskill_port.json");
var _port = 18444;
function loadPort() {
  try {
    if (existsSync3(PORT_FILE)) {
      const { port } = JSON.parse(readFileSync3(PORT_FILE, "utf8"));
      if (typeof port === "number" && port > 0 && port <= 65535) return port;
    }
  } catch {
  }
  return 18444;
}
function savePort(port) {
  try {
    if (!existsSync3(AGENT_DIR2)) mkdirSync3(AGENT_DIR2, { recursive: true, mode: 448 });
    writeFileSync2(PORT_FILE, JSON.stringify({ port }), { encoding: "utf8", mode: 384 });
  } catch {
  }
}
_port = loadPort();
function getSkillPort() {
  return _port;
}
function setSkillPort(port) {
  _port = port;
  savePort(port);
}
async function probeSkillServer(port = _port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(2e3)
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body.ok === true || typeof body.status === "string";
  } catch {
    return false;
  }
}
async function discoverSkillServer() {
  if (await probeSkillServer(_port)) return _port;
  if (_port !== 18444 && await probeSkillServer(18444)) {
    setSkillPort(18444);
    return 18444;
  }
  if (process.platform !== "win32") {
    const { exec } = await import("node:child_process");
    const discoveredPort = await new Promise((resolve) => {
      exec(
        "lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -iE 'skill|neuroskill' | head -5",
        (_, stdout) => {
          if (!stdout) {
            resolve(null);
            return;
          }
          for (const line of stdout.split("\n")) {
            const m = line.match(/:(\d{4,5})\s/);
            if (m) {
              resolve(parseInt(m[1], 10));
              return;
            }
          }
          resolve(null);
        }
      );
    });
    if (discoveredPort && await probeSkillServer(discoveredPort)) {
      setSkillPort(discoveredPort);
      return discoveredPort;
    }
  }
  return null;
}
var IS_WINDOWS2 = process.platform === "win32";
var MAX_BUFFER = 8 * 1024 * 1024;
function escapeArg(arg) {
  if (!IS_WINDOWS2) return arg;
  if (/^[a-zA-Z0-9_./:=@-]+$/.test(arg)) return arg;
  const escaped = arg.replace(/%/g, "%%").replace(/"/g, '\\"');
  return `"${escaped}"`;
}
async function runNeuroSkill(args) {
  try {
    const localBin = getLocalNeuroSkillBinPath();
    const hasLocalBin = existsSync3(localBin);
    const cliArgs = ["--port", String(_port), ...args.map(escapeArg)];
    const { stdout } = await execFileAsync2(hasLocalBin ? localBin : "npx", hasLocalBin ? cliArgs : ["neuroskill", ...cliArgs], {
      timeout: NEUROSKILL_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env },
      // Windows: npx is a .cmd batch file — must run through cmd.exe
      shell: IS_WINDOWS2,
      // Windows: hide the transient cmd.exe window
      ...IS_WINDOWS2 && { windowsHide: true }
    });
    const text = stdout.trim();
    if (!text) return { ok: false, error: "empty response" };
    try {
      const data = JSON.parse(text);
      return { ok: true, data, text };
    } catch {
      return { ok: true, text };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// src/neuroskill/signals.ts
function any(s, ...pats) {
  return pats.some((p) => p.test(s));
}
function detectSignals(lp) {
  return {
    // ── Core data commands ──────────────────────────────────────────────
    /** Sleep staging data. */
    sleep: any(
      lp,
      /\bsleep\b|\bslept\b|\bsleeping\b/,
      /\btired\b|\bfatigue[d]?\b|exhausted/,
      /\bnap(ping)?\b|drowsy|yawn|groggy/,
      /woke?\s*up|morning.{0,10}feel|can'?t\s+sleep|sleepy/,
      /nightmare|deep.?sleep|\brem\b|sleep.?quality/,
      /sleep.?cycle|sleep.?pattern|sleep.?stage|sleep.?disorder|sleep.?apnea/,
      /\binsomnia\b|\bnarcolep/,
      /bedtime|snooze|oversleep|under.?slept|night.?rest/,
      /restoration.{0,20}sleep|sleep.{0,20}restoration/
    ),
    /** Detailed session metrics (trends, HRV, stress index, all 50+ fields). */
    session: any(
      lp,
      /\bsession\b|right.?now\b|current.?state|how.?am.?i\b/,
      /my.?focus\b|my.?energy\b|my.?state\b|my.?metrics\b|my.?mood\b|my.?brain\b/,
      /\bEXG\b|biofeedback|brain.?state/,
      /cognitive.?load|engagement.?level|attention.?span/,
      /work.?session|study.?session|focus.?session|meditation.?session/,
      /stress.?level|anxiety.?level|relaxation.?level|mental.?state/
    ),
    /** A/B session comparison and trend deltas. */
    compare: any(
      lp,
      /\bcompare\b|session.?vs|before.?and.?after|a.?vs.?b/,
      /yesterday|previous.?session|last.?session|last.?week|last.?month/,
      /over.?time|\btrend(s)?\b|progress\b|improve(d|ment)?|declin(ed|e)?/,
      /better.?than|worse.?than|tracking\b|weekly\b|monthly\b/,
      /morning.?vs|night.?vs|early.?vs|compare.?session/
    ),
    /** Full session list / history overview. */
    sessions: any(
      lp,
      /\bsessions\b|all.?sessions?|session.?list|session.?history/,
      /recording.?history|how.?many.?sessions?|timeline\b/,
      /when.?did.?i.{0,20}session|past.?sessions?|my.?history\b/
    ),
    // ── Lifestyle & productivity ─────────────────────────────────────────
    /** Focus, deep work, flow state, concentration, productivity. */
    focus: any(
      lp,
      /\bfocus(ed|ing)?\b|deep.?work|flow.?state|in.?the.?zone/,
      /productive?|concentrat(e|ion|ing)|distract(ed|ion)?/,
      /procrastinat|hyperfocus|locked.?in|absorb(ed)?\b/,
      /\btask\b.{0,20}\bwork\b|\bproject\b.{0,20}\bwork\b/,
      /office.?work|coding.?session|writing.?block|reading.?session/,
      /sustained.?attention|attentional?\b|willpower/
    ),
    /** Stress, overwhelm, burnout, pressure. */
    stress: any(
      lp,
      /\bstress(ed|ful|or)?\b|overwhelm(ed|ing)?|\bburnout\b|burnt.?out/,
      /\bpressure\b|\btense(ness)?\b|\bworr(y|ied|ying)\b|\bnervous(ness)?\b/,
      /\bpanic\b|overload(ed)?|frazzled|wound.?up|on.?edge/,
      /fight.?or.?flight|cortisol|adrenali|high.?strung|freak.?out/,
      /deadline.?stress|exam.?stress|work.?pressure|time.?pressure/
    ),
    /** Meditation, mindfulness, breathing, calm, relaxation. */
    meditation: any(
      lp,
      /meditat(e|ing|ion)|mindful(ness)?|contemplat(e|ion)/,
      /\bcalm(ness)?\b|\brelax(ed|ing|ation)?\b|breath(e|ing|work)/,
      /\byoga\b|\bzen\b|peace(ful)?|tranquil|serenity|stillness/,
      /body.?scan|grounded(ness)?|present.?moment|vipassana/,
      /loving.?kindness|mantra|chanting|pranayama|tai.?chi/,
      /transcendental|non.?dual|open.?awareness|choiceless/
    ),
    /** Mood, emotions, affect, valence, general feelings. */
    mood: any(
      lp,
      /\bmood\b|emotional?\s+(state|regulation|wellbeing)|affect\b|valence\b/,
      /\bsad(ness)?\b|\bhapp(y|iness)\b|\bjoy(ful)?\b|\bcontent(ment)?\b/,
      /\bexcited\b|\bhopeless\b|\bhopeful\b|melanchol/,
      /\banger\b|\bangry\b|\bfrustr(at|ation)\b|\birrit(able|ability)\b/,
      /\beuphor(ia|ic)\b|\belat(ed|ion)\b|grateful|gratitude/,
      /feel(ing)?\s+(good|bad|great|terrible|amazing|awful|off|low)/,
      /low.?mood|uplifted|down.?in.{0,5}dumps|feeling.?off|emotionally/,
      /positive.?affect|negative.?affect|emotional.?state|mood.?shift/
    ),
    // ── Social & relational ──────────────────────────────────────────────
    /** Social interactions, conversations, teams, networking. */
    social: any(
      lp,
      /\bsocial(is|ize|ly|izing)?\b|\bnetwork(ing)?\b/,
      /\bconversation\b|\bmeeting\b|\binteract(ion|ing)?\b/,
      /\bcolleague\b|\bcoworker\b|\bteam\b|\bcollaborat/,
      /\bintrovert\b|\bextrovert\b|social.?energy|social.?battery/,
      /social.?anxiety|social.?fatigue|people.?drain|peopled.?out/,
      /\bcrowd\b|\bparty\b|\bgathering\b|\bgroup.?dynamic/,
      /\bfriend(ship|s)?\b.{0,20}(time|meet|hang|feel)/,
      /interpersonal|social.?skill|communication.?style/,
      /peer.?pressure|fitting.?in|belonging|loneliness|isolation/
    ),
    /** Dating, romance, relationships, attraction, intimacy. */
    dating: any(
      lp,
      /\bdat(e|ing)\b|\bromantic(ally)?\b|\bromance\b/,
      /\bpartner\b|\brelationship\b|\bcrush\b|\battraction\b/,
      /\blove\b|\bin.?love\b|first.?date|chemistry\b|\bcouple\b/,
      /\bintimacy\b|\bflirt(ing)?\b|\bheartbreak\b|\bbreakup\b|\bbreak.?up\b/,
      /girlfriend|boyfriend|significant.?other|soulmate|courting/,
      /anxious.{0,20}date|nervous.{0,20}date|date.{0,20}night/,
      /rejection|attachment.?style|love.?language|emotional.?intimacy/
    ),
    /** Family life, parenting, household, caregiving. */
    family: any(
      lp,
      /\bfamily\b|\bfamilies\b|\bhousehold\b|home.?life\b/,
      /\bkids?\b|\bchildren\b|\bchild\b|\bbaby\b|\btoddler\b|\binfant\b/,
      /parent(ing|hood)?|\bmom\b|\bdad\b|\bmother\b|\bfather\b/,
      /\bsibling\b|\bbrother\b|\bsister\b|\bgrandparent\b|\bin.?law\b/,
      /caregiving|caregiver|work.?life.?balance|family.?stress/,
      /fatherhood|motherhood|raising.{0,10}kids?|nurturing\b/,
      /domestic|chores|homework.{0,10}kids?|parental.?burnout/
    ),
    /** Loneliness, isolation, belonging. */
    loneliness: any(
      lp,
      /\blonely\b|\bloneliness\b|\bisolated\b|\bisolation\b/,
      /feel.{0,10}alone\b|\bleft.?out\b|\bexcluded\b|\bbelong\b/,
      /social.?isolation|disconnected\b|withdrawn\b/
    ),
    /** Grief, loss, bereavement. */
    grief: any(
      lp,
      /\bgrief\b|\bgriev(e|ing|ed)\b|\bloss\b|\bbereavement\b/,
      /\bmourning\b|\bmourn(ing)?\b|\bsad.{0,15}loss/,
      /loved.?one.{0,15}(died|passed|death)|death\b.{0,15}(family|friend)/
    ),
    /** Anger, rage, irritability, emotional dysregulation. */
    anger: any(
      lp,
      /\banger\b|\brage\b|\bangry\b|\bfurious\b|\blivid\b/,
      /\birrit(able|ated|ability)\b|\bfrustr(ated|ation)\b/,
      /outburst\b|temper\b|snap(ped|ping)?\b|blow.?up\b/,
      /emotional.?dysregul|reactiv(e|ity)|triggered\b/
    ),
    /** Confidence, self-esteem, imposter syndrome, self-worth. */
    confidence: any(
      lp,
      /\bconfiden(t|ce)\b|\bself.?esteem\b|\bself.?worth\b/,
      /imposter.?syndrome|self.?doubt\b|\binsecure\b|\binsecurity\b/,
      /\bnot.?good.?enough\b|\bfake\b.{0,10}feel|doubt.{0,10}myself/,
      /low.?self.?esteem|self.?efficacy|self.?belief/
    ),
    // ── Health & body ────────────────────────────────────────────────────
    /** Physical exercise, sport, training, fitness, athletics. */
    sport: any(
      lp,
      /\bexercise\b|\bworkout\b|\btraining\b|\bathletic/,
      /\brun(ning|s)?\b|\bgym\b|\bsport\b|\bfitness\b/,
      /\byoga\b|\bswim(ming)?\b|\bcycl(e|ing|ist)\b/,
      /\blifting\b|strength.?train|endurance\b|\bcardio\b|\bhiit\b/,
      /\btennis\b|\bbasketball\b|\bfootball\b|\bsoccer\b|\brugby\b/,
      /martial.?arts|boxing\b|wrestling\b|climbing\b|crossfit/,
      /\bhik(e|ing)\b|trail.?run|outdoor.?sport|athletic.?performance/,
      /pre.?workout|post.?workout|sport.?recovery|physical.?training/,
      /\bvo2max\b|heart.?rate.?zone|lactic.?acid|muscle.?fatigue/
    ),
    /** Recovery, rest days, recharging, downtime, vacations. */
    recovery: any(
      lp,
      /\brecover(y|ing)?\b|\brestoration\b|\brejuvenat\b/,
      /\brecharge\b|\brefresh\b|\breset\b|\bdowntime\b/,
      /rest.?day|day.?off|\bvacation\b|\bholiday\b|\bbreak\b.{0,15}need/,
      /\brecuperat\b|\bwind.?down\b|\bunwind\b|switch.?off/
    ),
    /** Nutrition, eating, caffeine, fasting, food and brain state. */
    nutrition: any(
      lp,
      /\beat(ing|s)?\b|\bmeal\b|\bfood\b|\bnutrition\b|\bdiet\b/,
      /\bcaffeine\b|\bcoffee\b|\btea\b|\bsugar\b|blood.?sugar/,
      /\bfasting\b|\blunch\b|\bdinner\b|\bbreakfast\b|\bsnack\b/,
      /brain.?food|glucose|intermittent.?fast|keto\b|vegan\b/,
      /hydrat|dehydrat|energy.?drink|nootropic|supplement\b/
    ),
    /** Chronic pain, headaches, physical discomfort, body tension. */
    pain: any(
      lp,
      /\bpain\b|\bhurt(ing)?\b|\bdiscomfort\b|\bache\b|\bsore\b/,
      /chronic.?pain|\binflammation\b|body.?tension|muscle.?tension/,
      /back.?pain|neck.?pain|shoulder.?pain|jaw.?tension/,
      /tension.?headache|cluster.?headache|sinus.?pain/
    ),
    /** Travel, jet lag, circadian rhythm disruption. */
    travel: any(
      lp,
      /\btravel(ling|led|er)?\b|\bjet.?lag\b|time.?zone\b|circadian/,
      /long.?flight|international.?travel|travel.?fatigue/,
      /adjust.{0,15}timezone|body.?clock|sleep.{0,15}travel/
    ),
    /** Addiction, cravings, compulsions, substance use. */
    addiction: any(
      lp,
      /\baddiction\b|\baddicted\b|\bcraving(s)?\b|\bcompulsive\b/,
      /\bsubstance\b|\balcohol\b.{0,20}(use|abuse|probl)/,
      /\bsmok(e|ing)\b|\bnicotine\b|\bvaping\b|\bgambling\b/,
      /social.?media.{0,15}addict|doom.?scroll|phone.?addict/
    ),
    // ── Mind & growth ────────────────────────────────────────────────────
    /** Studying, learning, memory, exams, education. */
    learning: any(
      lp,
      /\bstud(y|ying|ied)\b|\blearning\b|\bmemorize?\b/,
      /\bexam\b|\btest\b|\bquiz\b|\bhomework\b|\bassignment\b/,
      /\bclass\b|\bcourse\b|\bschool\b|\buniversit|\bcollege\b|\blecture\b/,
      /\brecall\b|\bretention\b|\bcomprehension\b|\beducation\b/,
      /\btutor(ing)?\b|\bcurriculum\b|\bacademic\b|\bsyllabus\b/,
      /\brevision\b|study.?session|exam.?prep|cram(ming)?/,
      /memory.?palace|spaced.?repetition|active.?recall|flashcard/,
      /reading.{0,20}book|textbook|lecture.?note|study.?note/
    ),
    /** Creative work: art, music, writing, design, ideation. */
    creative: any(
      lp,
      /\bcreat(ive|ivity|ing|or)\b|\barts?\b|\bartistic\b/,
      /\bmusic\b|\bcompos(e|ing|ition)\b|\bimprov(ise|isation)\b/,
      /\bwrit(e|ing|er|ers)\b|\bstorytel(l|ling)\b|\bpoem\b|\bpoetry\b/,
      /\bdesign\b|\bbrainstorm\b|\bimagine\b|\binspir(e|ation)\b/,
      /\bpaint(ing)?\b|\bdraw(ing)?\b|\bsculpt\b|\bsketch\b/,
      /\binvent\b|\binnovat\b|\bideate\b|\bideation\b/,
      /jam.?session|freestyle|creative.?block|makers?\b|\bcraft\b/,
      /creative.?flow|divergent.?thinking|lateral.?thinking/
    ),
    /** Leadership, management, decision-making, strategy. */
    leadership: any(
      lp,
      /\bleadership\b|\bleader\b|\bmanage(r|ment|rial)?\b|\bexecutive\b/,
      /decision.?making|\bstrategic?\b|\bvision(ary)?\b/,
      /\bnegotiat\b|\binfluence\b|\bpersuad\b|\bconflict.?resol/,
      /\bdelegate\b|\bprioritize?\b|\baccountab\b|\borganize?\b/,
      /team.?lead|leading.{0,10}team|leadership.?style|executive.?function/,
      /\bboss\b|\bmanager\b|\bboard\b|\bboardroom\b|c.?suite\b/
    ),
    /** Therapy, counselling, self-reflection, journaling, psychology. */
    therapy: any(
      lp,
      /\btherapy\b|\btherapist\b|\bcounsell?ing\b|\bpsychologist\b/,
      /\bcbt\b|\bdbt\b|\bact\b.{0,20}therapy|psychotherapy/,
      /\bjournal(ing|led)?\b|\bself.?reflect\b|\bintrospect/,
      /mental.?health.{0,15}support|emotional.?support|process.{0,10}feel/,
      /trauma.?therapy|inner.?work|shadow.?work|self.?aware/,
      /emotional.?regulat|coping.?strategy|resilience\b/
    ),
    /** Goals, habits, routines, intention-setting, tracking progress. */
    goals: any(
      lp,
      /\bgoal(s)?\b|\bhabit(s)?\b|\broutine\b|\bintention(s)?\b/,
      /\btrack(ing)?\b.{0,20}progress|progress.{0,20}track/,
      /\bachieve(ment|ments)?\b|\bmilestone\b|\bstreak\b/,
      /behavior.?change|habit.?form|commit(ment)?|self.?discipl/,
      /self.?improvement|personal.?growth|kvr|okr|kpi/
    ),
    /** Public speaking, presentations, performance anxiety. */
    performance: any(
      lp,
      /public.?speak|presentation\b|present.{0,10}(to|for|at)\b/,
      /stage.?fright|performance.?anxiety|\bpitch\b.{0,15}(to|for)/,
      /speak.?in.?front|\baudience\b|\bpresent(ing|ed)\b/,
      /interview.{0,10}(feel|nerv|anxious)|job.?interview/,
      /perform(ance|ing)?.{0,15}(state|anxiety|nerves?)/
    ),
    // ── Daily rhythms ────────────────────────────────────────────────────
    /** Morning routines, waking state, start-of-day. */
    morning: any(
      lp,
      /morning.?routine|wake.?up.?routine|start.?of.{0,5}day/,
      /\bcoffee\b.{0,15}morning|\bbreakfast\b|\bearly.?morning\b|\bdawn\b/,
      /first.?thing.{0,15}morning|beginning.{0,10}day|just.?woke/,
      /am.?routine|morning.?state|morning.?brain|morning.?focus/
    ),
    /** Evening and night routines, end-of-day wind-down. */
    evening: any(
      lp,
      /evening.?routine|wind.?down\b|end.?of.{0,5}day|bedtime.?routine/,
      /night.?time|late.?night|after.?dinner|nightcap\b/,
      /evening.?state|closing.?down|shutting.?off|winding.?down/,
      /pm.?routine|before.?bed|sleep.?prep|tonight.?feel/
    ),
    // ── Cardiac & somatic ───────────────────────────────────────────────────
    /**
     * HRV / cardiac / autonomic — heart rate, heart rate variability,
     * palpitations, breathing, chest sensations, autonomic nervous system.
     */
    hrv: any(
      lp,
      /\bhrv\b|\bheart.?rate.?variab|\brmssd\b|\bsdnn\b|\bpnn50\b/,
      /\bheart\b.{0,20}(rate|beat|palpitat|racing|pounding|flutter|skip|pound)/,
      /\bpalpitation(s)?\b|\bheart.?flutter\b|\bskipped?.?beat\b/,
      /\bbreath(ing)?\b.{0,15}(fast|shallow|heavy|tight|short|racing|rapid)/,
      /\bchest\b.{0,10}(tight|constrict|heavy|flutter|ache|pain|pressure)/,
      /\bautonomic\b|\bvagal\b|\bvagus\b|\bparasympathetic\b|\bsympathetic.?nervous\b/,
      /\bcardiac\b|\bcardiovascular\b|\bheartbeat\b|\bpulse\b.{0,10}(feel|notice|fast|slow)/,
      /racing.{0,10}heart|heart.{0,10}racing|heart.{0,5}(fast|slow|skip|pound)/,
      /\bbreath.?work\b|\bbreathing.?exercise\b|\bwim.?hof\b|\bbox.?breath\b/,
      /\b4.?7.?8\b|\bnasal\b.{0,10}breath|\bdiaphragm(atic)?\b/,
      /lf.?hf|lf.hf.?ratio|heart.?coherence|cardiac.?coherence/
    ),
    /**
     * Somatic / embodiment — body sensations, physical felt sense,
     * interoception, embodied awareness, gut feelings, physical tension.
     */
    somatic: any(
      lp,
      /\bsomatic\b|\bembodiment\b|\bembodied\b|\bbodily\b/,
      /body.?(sensati|aware|feel|scan|tension|wisdom|intelligence)/,
      /feel.{0,10}(in|through|inside|within|throughout).{0,10}body/,
      /\binteroception\b|\bgut.?feeling\b|\bgut.?instinct\b|\bgut.?sense\b/,
      /\btingling\b|\bnumbness\b|\bheaviness\b.{0,15}(body|limb|arm|leg|feeling)/,
      /\btension\b.{0,15}(in.?my|body|muscle|back|neck|shoulder|jaw|held)/,
      /\bstomach\b.{0,10}(knot|tight|flutter|sinking|drop|feeling)/,
      /\bbelly\b.{0,10}(feel|tight|drop|warmth|calm)|\bsolar.?plexus\b/,
      /warm(th)?.{0,10}(inside|chest|heart|belly)|cold.{0,10}(chill|inside|shiver)/,
      /\bgrounded\b.{0,15}body|\bfeel.{0,10}grounded\b|grounding.{0,10}body/,
      /\bsensation(s)?\b.{0,15}(notice|feel|body|physical|present)/,
      /physical.?sensati|felt.?sense\b|body.?mind\b|mind.?body\b/
    ),
    // ── Inner life & depth ───────────────────────────────────────────────
    /**
     * Consciousness — self-awareness, wakefulness, altered states, presence,
     * ego dissolution, witness consciousness, lucidity.
     */
    consciousness: any(
      lp,
      /\bconsciousness\b|\bself.?aware(ness)?\b|\binner.?observer\b/,
      /\bawaken(ed|ing)?\b|\benlighten(ed|ment)?\b|ego.?dissolut/,
      /\bpresence\b.{0,20}(state|moment|feel|awareness)|moment.?to.?moment/,
      /\bwitness\b.{0,15}(self|consciousness|awareness)|pure.?awareness/,
      /\blucid(ity)?\b|lucid.?dream|\baltere[d].?state\b/,
      /\bdissociat(e|ion|ing)\b|\bderealisat|depersonali/,
      /\bwakefulness\b|\blzc\b|lempel.?ziv|consciousness.?metric/,
      /\bnon.?dual(ity)?\b|advaita|not.?the.?thinker|observer.?effect/,
      /stream.?of.?consciousness|altered.?perception|heightened.?awareness/
    ),
    /**
     * Philosophy — meaning, purpose, ideas, schools of thought,
     * intellectual inquiry, wisdom, truth-seeking.
     */
    philosophy: any(
      lp,
      /\bphilosoph(y|ical|er|ise|ize)?\b|\bwisdom\b|\bwisdom.?tradition\b/,
      /\bstoic(ism)?\b|\bepicur(ean|us)?\b|\bplatonist?\b|aristotl/,
      /\bnietzsche\b|\bcamus\b|\bsartre\b|\bheidegger\b|\bkant\b/,
      /\bexistentialis[mt]\b|\bnihilis[mt]\b|\babsurdis[mt]\b/,
      /\bfree.?will\b|\bdeterminis[mt]\b|\bfatalis[mt]\b/,
      /nature.?of.?reality|what.?is.?real|theory.?of.?mind/,
      /\bvirtue\b.{0,20}(ethic|life|moral)|nature.?of.?truth/,
      /\bdialect(ic|al)?\b|\bsocrat(ic|es)\b|\bphilosoph.{0,5}question/,
      /\bontolog(y|ical)\b|\bepistemolog(y|ical)\b|\bphenomenolog/,
      /\bparadox\b|\bthought.?experiment|mind.?body.?problem/,
      /happiness.{0,20}(real|true|mean|philosoph)|philosophy.?of.?life/
    ),
    /**
     * Existential — mortality, meaning, legacy, impermanence, life's purpose,
     * the void, finitude, the infinite.
     */
    existential: any(
      lp,
      /\bmortalit(y|ies)\b|\bdeath\b|\bdie\b|\bdying\b|\bdead\b/,
      /\blegacy\b|\bimperman(ent|ence)\b|\bfinite\b|\binfinity\b/,
      /meaning.?of.?(life|existence)|purpose.?of.?(life|existence)/,
      /why.?(am|are).{0,5}(i|we).{0,10}(here|alive|exist)/,
      /\bwhat.?s.?the.?point\b|point.?of.?(life|all|it|this)/,
      /\bafterlife\b|\breincarnation\b|\bsoul\b.{0,10}(leave|death|die)/,
      /\bexistence\b.{0,20}(precede|mean|matter|anxi)|existential.?crisis/,
      /fear.?of.?death|aware.{0,10}mortal|contemplat.{0,10}death/,
      /\btransience\b|\bephemeral\b|nothing.?lasts|everything.?ends/,
      /\bvoid\b|\bnothingness\b|into.?the.?unknown|facing.?(end|death|nothing)/
    ),
    /**
     * Depth — profound emotional or intellectual states, going inward,
     * deep reflection, contemplation, the felt sense of something vast or true.
     */
    depth: any(
      lp,
      /\bprofound(ly)?\b|\bdeeply?\b.{0,20}(feel|think|move|stir|touch)/,
      /\bcontemplat(e|ing|ion)\b|\bponder(ing)?\b|\bbrood(ing)?\b/,
      /inner.?life|inner.?world|soul.?search|depth.?of.?feel/,
      /\bstir(red)?\b.{0,15}(inside|deeply|soul)|moved.{0,15}deeply/,
      /\btouched\b.{0,15}(deeply|inside|heart|soul)/,
      /depth.?of.?thought|thinking.?deeply|going.?deep|deep.?inside/,
      /feel.{0,10}(something|it).{0,10}(deep|profound|big|vast|huge)/,
      /\bvast(ness)?\b.{0,15}feel|\bsilence\b.{0,15}(inside|within|feel)/,
      /\binward\b|\bwithin\b.{0,10}(look|turn|feel|find|search)/
    ),
    /**
     * Morals — ethics, values, conscience, right and wrong, integrity,
     * guilt, shame, moral dilemmas, duty, principles.
     */
    morals: any(
      lp,
      /\bmoral(s|ity|ly)?\b|\bethic(s|al|ally)?\b|\bvirtue\b/,
      /\bintegrity\b|\bconscience\b|\bprinciple(s)?\b|\bhonesty\b/,
      /\bguilt\b|\bguilt(y|iness)\b|\bshame\b|\bshamed\b|\bregret\b/,
      /right.{0,5}wrong|wrong.{0,5}right|moral.?dilemma|ethical.?dilemma/,
      /\bduty\b|\bobligation\b|\bresponsib(le|ility)\b.{0,15}moral/,
      /did.{0,5}(the.?)?right.?thing|should.{0,5}(have|i)\b/,
      /\bhonour\b|\bhonor\b|\bwrongdoing\b|\bbetrayal\b|\bbetray/,
      /\bkind(ness)?\b.{0,20}(right|moral|ethic|compass)|compassion.{0,15}right/,
      /\bjustice\b|\bfairness\b|\binequality\b.{0,20}feel|treat.{0,10}fairly/,
      /acting.{0,10}(right|wrong|good|badly)|living.{0,10}(value|principle)/
    ),
    /**
     * Symbiosis — interconnectedness, oneness, unity, interdependence,
     * nature, collective consciousness, mutual flourishing, harmony.
     */
    symbiosis: any(
      lp,
      /\bsymbiosis\b|\bsymbiotic\b|\binterconnect(ed|edness|ion)?\b/,
      /\boneness\b|\bunity\b.{0,20}(feel|sense|all|everything|life)/,
      /\binterdependen(t|ce)\b|\bmutual(ism|ly)?\b/,
      /\bharmony\b.{0,20}(with|between|life|nature|all)/,
      /we.?are.?all.?(connected|one|linked|part)|everything.?is.?(connected|one)/,
      /\bnature\b.{0,20}(connected|harmony|part.?of|belong|oneness)/,
      /\bcollective\b.{0,20}(consciousness|wellbeing|good|mind)/,
      /part.?of.?(something.?bigger|the.?whole|nature|all|universe)/,
      /\becosystem\b|\bco.?exist(ence)?\b|\bcooperat\b.{0,20}life/,
      /relationship.{0,20}(with.?nature|all.?things|universe|world)/,
      /\bbelonging\b.{0,20}(universe|all|nature|life|cosmos)/
    ),
    /**
     * Awe — wonder, transcendence, peak experiences, the sublime,
     * sacred, cosmic, oceanic feeling, being overwhelmed by beauty or vastness.
     */
    awe: any(
      lp,
      /\bawe\b|\bawe.?(struck|some|inspiring)?\b|\bwonder\b.{0,15}(feel|sense|fill)/,
      /\btranscenden(t|ce|tal)\b|\bsublime\b|\bsacred\b|\bholy\b.{0,15}feel/,
      /\bpeak.?experience\b|\bocean.?feeling\b|\bmystic(al)?\b/,
      /overwhelmed.{0,15}(beauty|vastness|universe|cosmos|nature)/,
      /\bmagical\b.{0,10}(feel|moment|experience|sense)|magic.{0,10}in.{0,10}(life|world)/,
      /\bcosmic\b|\buniverse\b.{0,20}(feel|connected|sense|part)/,
      /\bmajestic\b|\bbeauty\b.{0,15}(overwhelm|move|stir|profound)/,
      /sense.?of.?(wonder|awe|mystery|vastness|presence)|feeling.?of.?(awe|wonder)/,
      /\bspiritual(ity)?\b.{0,15}(feel|sense|experience|state)|felt.{0,10}spiritual/,
      /\bgratitude\b.{0,20}(all|universe|life|exist|cosmos)/
    ),
    /**
     * Identity — self-concept, authenticity, self-discovery, persona,
     * who am I, values-alignment, being true to oneself.
     */
    identity: any(
      lp,
      /\bidentity\b|\bself.?concept\b|\bself.?image\b|\bself.?discovery\b/,
      /who.{0,5}am.{0,5}i\b|who.{0,5}i.{0,5}(am|really|truly|actually)/,
      /\bauthentic(ity|ally)?\b|\btrue.?self\b|\breal.?self\b/,
      /be(ing)?.{0,10}(myself|yourself|oneself)|true.{0,10}(to.?myself|to.?oneself)/,
      /\bmask\b.{0,15}(wear|take.?off|behind)|taking.?off.{0,10}mask/,
      /\bpersona\b|\brole\b.{0,20}(play|wear|society|world)/,
      /sense.?of.?self|self.?expression\b|self.?concept\b/,
      /finding.{0,10}(myself|yourself|purpose|meaning.{0,10}(self|who))/,
      /values.{0,15}(align|match|live|compass|true)|living.{0,10}my.?values/,
      /\bcharacter\b.{0,15}(build|grow|true|who|define)|defining.{0,10}(who|myself)/
    ),
    /**
     * Health / HealthKit — general health queries, vitals, Apple Health data,
     * medical metrics beyond what sport/hrv/sleep already cover.
     */
    health: any(
      lp,
      /\bhealth\b.{0,15}(data|kit|summary|report|stats?|metric|check)/,
      /\bhealthkit\b|\bapple.?health\b|\bhealth.?app\b/,
      /\bvitals?\b|\bbiometric\b|\bblood.?pressure\b|\bspo2\b|\boxygen\b/,
      /\bvo2.?max\b|\bresting.?heart\b|\bhealth.?score\b/,
      /\bmedical\b.{0,15}(data|metric|history|record)/,
      /\bwellness\b.{0,15}(data|score|metric|report|summary)/
    ),
    /**
     * Screenshots & visual memory — screen captures, what was on screen,
     * OCR search, visual history, CLIP image search.
     */
    screenshots: any(
      lp,
      /\bscreenshot(s)?\b|\bscreen.?capture\b|\bscreen.?grab\b/,
      /what.{0,15}(was|were).{0,15}(on|at).{0,10}screen/,
      /\bocr\b|\bscreen.?text\b|\bvisual.?history\b|\bvisual.?memory\b/,
      /\bclip\b.{0,15}(search|image|embed|similar)/,
      /what.{0,10}(was|were).{0,10}(i|you).{0,10}(looking|viewing|reading|watching)/,
      /screen.{0,15}(at|around|during|near).{0,15}(time|moment|session)/
    ),
    /**
     * Proactive hooks — hook rules, triggers, automations, alerts, scenarios.
     */
    hooks: any(
      lp,
      /\bhook(s)?\b.{0,15}(rule|trigger|list|add|remove|creat|enabl|disabl|updat|suggest|log)/,
      /\bproactive\b.{0,15}(hook|alert|trigger|rule|automation)/,
      /\bhook\b.{0,15}(scenario|keyword|threshold)/,
      /\btrigger\b.{0,15}(rule|alert|hook|automation|when|if)/,
      /\bautomat(e|ion|ic)\b.{0,15}(alert|hook|trigger|notif)/
    ),
    /**
     * Do Not Disturb — DND state, focus modes, interruption blocking.
     */
    dnd: any(
      lp,
      /\bdnd\b|\bdo.?not.?disturb\b/,
      /\bfocus.?mode\b.{0,15}(on|off|status|enable|disable|block)/,
      /\bsilence\b.{0,15}(notif|alert|interrupt)/,
      /block.{0,15}(notif|interrupt|distract)/
    ),
    /**
     * On-device LLM — local model management, inference, chat, downloads.
     */
    llm: any(
      lp,
      /\bllm\b.{0,15}(status|start|stop|model|catalog|download|chat|log|fit)/,
      /\blocal\b.{0,15}(model|llm|inference|ai)/,
      /\bon.?device\b.{0,15}(model|llm|ai|inference)/,
      /\bgguf\b|\bmodel\b.{0,15}(download|catalog|select|delete|load)/,
      /\bvision\b.{0,15}(projector|mmproj|model)/
    ),
    /**
     * Protocol intent — user is asking for a guided practice, exercise, or routine,
     * or describes a context where a structured protocol is likely to be helpful.
     * Triggers loading of the full protocol repertoire skill.
     */
    protocols: any(
      lp,
      // Explicit guided-practice requests
      /\bprotocol\b|\bguided?\s+(exercise|practice|session|meditat|breath)/,
      /guide\s+(me|us)\s+(through|into|with)|walk\s+me\s+through/,
      /can\s+we\s+do\s+(a\s+)?(quick\s+)?(breath|relax|meditat|exercise|stretch|protocol)/,
      /help\s+me\s+(relax|calm\s+down|breathe|focus|sleep|unwind|de.?stress|reset)/,
      /\bneed\s+(to\s+)?(relax|calm|unwind|de.?stress|reset|breathe)\b/,
      // Breathing & breath-work
      /breath(e|ing)\s+(exercise|work|practice|with\s+me|together)/,
      /\bbox\s+breath|\b4.?7.?8\b|\bwim\s+hof\b|\bkapalabhati\b|\bnadi\s+shodhana\b/,
      /\bcardiac\s+coherence\b|\bcoherent\s+breath|\bphysiological\s+sigh\b/,
      // Meditation & mindfulness practices
      /\bbody\s+scan\b|\bprogressive\s+muscle\b|\bpmr\b|\bnsdr\b|\byoga\s+nidra\b/,
      /\bloving.?kindness\b|\bmetta\b|\bmantra\s+meditat|\bopen\s+monitor/,
      /\bgrounding\s+exercise|\b5.?4.?3.?2.?1\b|\bsomatic\s+(exercise|practice|shake)/,
      /\bauogenic\s+train|\bhavening\b|\btre\b.{0,15}(exercise|tension|release)/,
      // Body & movement practices
      /\bneck\s+(exercise|stretch|pain|tension|stiff|sore|release|relief)/,
      /\beye\s+(exercise|strain|tired|fatigue|relief|stretch|rest)/,
      /\bshoulder\s+(exercise|stretch|roll|release|tension|pain|relief)/,
      /\bdesk\s+yoga|\bmotor\s+cortex|\bmind.?muscle\b/,
      /\bwarm.?up\b|\bcool.?down\b|\bstretch(ing)?\s+(routine|session|now)/,
      /\bpre.?workout\s+(routine|protocol|prep)|\bpost.?workout\s+(routine|recovery)/,
      // Morning & evening routines
      /morning\s+(routine|exercise|stretch|activation|ritual|practice|protocol)/,
      /evening\s+(routine|wind.?down|ritual|practice|protocol)/,
      /\bsleep\s+(routine|ritual|protocol|prep|practice)\b/,
      // Eye & vision
      /\b20.?20.?20\b|\bpalming\s+(exercise|practice)|\beye\s+roll/,
      // Workout & gym
      /before\s+(the\s+)?(gym|workout|training|run|lifting)/,
      /after\s+(the\s+)?(gym|workout|training|run|lifting)/,
      /\bintra.?workout|\bbetween\s+sets?\b/,
      // Hydration & breaks
      /\bwater\s+break\b|\bdrink\s+(some\s+)?water|\bhydrat(e|ion)\s+(reminder|break)/,
      /\bbathroom\s+break\b|\bmovement\s+(break|snack)\b|\btake\s+a\s+break\b/,
      // Music as therapy
      /music\s+(for|to\s+help|therapy|that\s+will|to\s+focus|to\s+relax|to\s+sleep|to\s+calm)/,
      /\bplaylist\s+(for|to|that)\b|\bbinaural\s+beat|\bsound\s+therapy\b/,
      /\bsinging\s+(for|to\s+help)|humming\s+(exercise|practice|for)/,
      // Social media & digital wellness
      /tiktok.{0,20}(addict|too\s+much|help|control|stop|problem)/,
      /instagram.{0,20}(addict|too\s+much|help|control|stop|scroll|problem)/,
      /doom.?scroll|can.{0,10}stop\s+(scroll|check|open)|phone\s+addict/,
      /social\s+media\s+(addict|too\s+much|detox|problem|help|control)/,
      /\bdigital\s+(detox|sunset|wellness|addiction)\b|\bscreen\s+time\b.{0,20}(too\s+much|help|problem)/,
      // Dietary & nutrition guidance
      /what\s+(should|can)\s+i\s+eat|what\s+to\s+eat\b/,
      /\bmindful\s+eat|\beat(ing)?\s+(slowly|mindfully|habits?|better|healthier)/,
      /\bfasting\s+(tips?|help|support|protocol|guide)\b/,
      /caffeine\s+(timing|when|cut.?off|too\s+much|advice)/,
      /\bintermittent\s+fast|\bif\s+protocol\b/,
      // Emotional processing with explicit request
      /help\s+(me\s+)?(process|work\s+through|deal\s+with)\s+(this|anger|grief|stress|anxiety|emotion)/,
      /how\s+(do|can)\s+i\s+(deal|cope|handle|manage)\s+with\s+(this|anger|grief|stress|anxiety)/,
      // Generic intervention requests
      /something\s+(helpful|calming|relaxing|energising|to\s+help\s+with)/,
      /\bshow\s+me\s+(a|an|the|some)\s+(exercise|practice|technique|protocol|routine)/,
      /\bdo\s+(a|an)\s+(breathing|relaxation|meditation|grounding|stretching)\b/
    )
  };
}

// src/neuroskill/context.ts
import { existsSync as existsSync4, readFileSync as readFileSync4 } from "node:fs";
import { dirname, join as join4 } from "node:path";
import { homedir as homedir4 } from "node:os";
import { fileURLToPath } from "node:url";
var BUNDLED_SKILLS_ROOT = join4(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "skills"
);
var AGENT_SKILLS_ROOT = join4(homedir4(), ".neuroloop", "skills-cache");
var LEGACY_AGENT_SKILLS_ROOT = join4(homedir4(), ".neuroloop", "skills");
var PROTOCOLS_SKILL_PATHS = [
  join4(AGENT_SKILLS_ROOT, "skills", "neuroskill-protocols", "SKILL.md"),
  join4(AGENT_SKILLS_ROOT, "neuroskill-protocols", "SKILL.md"),
  join4(LEGACY_AGENT_SKILLS_ROOT, "skills", "neuroskill-protocols", "SKILL.md"),
  join4(LEGACY_AGENT_SKILLS_ROOT, "neuroskill-protocols", "SKILL.md"),
  join4(BUNDLED_SKILLS_ROOT, "skills", "neuroskill-protocols", "SKILL.md"),
  join4(BUNDLED_SKILLS_ROOT, "neuroskill-protocols", "SKILL.md")
];
function resolveProtocolsSkillPath() {
  for (const p of PROTOCOLS_SKILL_PATHS) {
    if (existsSync4(p)) return p;
  }
  return null;
}
var COMPARE_CACHE_TTL_MS = 10 * 60 * 1e3;
var compareCache = {};
function getFreshCompare() {
  if (!compareCache.text || !compareCache.builtAt) return void 0;
  if (Date.now() - compareCache.builtAt > COMPARE_CACHE_TTL_MS) return void 0;
  return compareCache.text;
}
function warmCompareInBackground() {
  if (compareCache.pending) return;
  if (getFreshCompare()) return;
  compareCache.pending = runNeuroSkill(["compare"]).then((r) => {
    if (r.ok && r.text) {
      compareCache.text = r.text;
      compareCache.builtAt = Date.now();
    }
  }).catch(() => {
  }).finally(() => {
    compareCache.pending = void 0;
  });
}
async function selectContextualData(prompt) {
  const lp = prompt.toLowerCase();
  const s = detectSignals(lp);
  const extras = [];
  const protocolsSkillPath = s.protocols ? resolveProtocolsSkillPath() : null;
  if (protocolsSkillPath) {
    try {
      const skillContent = readFileSync4(protocolsSkillPath, "utf8");
      extras.push(`## \u{1F9D8} Protocol Repertoire
${skillContent}`);
    } catch {
    }
  }
  const queue = [];
  const enqueue = (label2, ...args) => queue.push({ label: label2, args });
  const searchLabels = (label2, query, k = "5") => enqueue(label2, "search-labels", query, "--k", k);
  if (s.sleep) {
    enqueue("Sleep Staging (last 24 h)", "sleep");
    enqueue("Sleep Schedule", "sleep-schedule");
    enqueue("HealthKit Sleep", "health", "sleep");
    searchLabels(
      "Past Sleep Labels",
      "sleep tired rest deep sleep rem restoration drowsy"
    );
  }
  if (s.session || s.sport || s.learning || s.social || s.dating || s.family || s.creative || s.leadership || s.recovery || s.morning || s.evening || s.nutrition || s.therapy || s.goals || s.performance || s.confidence || s.anger || s.grief || s.loneliness || s.addiction) {
    enqueue("Current Session Metrics", "session", "0");
  }
  if (s.compare || s.goals) {
    const cached = getFreshCompare();
    if (cached) {
      queue.push({ label: "Session Comparison (last 2) \u2014 cached", args: [] });
    } else {
      warmCompareInBackground();
    }
  }
  if (s.sessions) {
    enqueue("Session History", "sessions");
  }
  if (s.focus) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Focus & Deep Work Labels",
      "deep focus work productivity flow state concentration locked in"
    );
  }
  if (s.stress) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Stress & Overwhelm Labels",
      "stress overwhelmed burnout pressure tense nervous anxious overloaded"
    );
  }
  if (s.meditation) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Meditation & Relaxation Labels",
      "meditation mindfulness calm relaxation breathing peace stillness grounded"
    );
  }
  if (s.social) {
    searchLabels(
      "Past Social Interaction Labels",
      "social meeting people conversation team collaboration networking friends"
    );
  }
  if (s.dating) {
    searchLabels(
      "Past Romantic & Dating Labels",
      "romantic partner relationship date connection love intimacy attraction"
    );
  }
  if (s.family) {
    searchLabels(
      "Past Family & Home Labels",
      "family children parenting home household spouse caregiving kids parent"
    );
  }
  if (s.sport) {
    enqueue("HealthKit Workouts", "health", "workouts");
    enqueue("HealthKit Steps", "health", "steps");
    enqueue("HealthKit Heart Rate", "health", "hr");
    searchLabels(
      "Past Exercise & Sport Labels",
      "exercise workout training sport running gym fitness athletic cardio strength"
    );
  }
  if (s.learning) {
    searchLabels(
      "Past Study & Learning Labels",
      "studying learning exam memorize reading concentration retention academic"
    );
  }
  if (s.creative) {
    searchLabels(
      "Past Creative Work Labels",
      "creative art music writing design inspiration ideas innovation brainstorm"
    );
  }
  if (s.leadership) {
    searchLabels(
      "Past Leadership & Management Labels",
      "leadership management decision making strategy team leading executive"
    );
  }
  if (s.recovery) {
    enqueue("HealthKit Summary", "health");
    searchLabels(
      "Past Recovery & Rest Labels",
      "recovery rest restoration recharge refresh downtime rejuvenate unwind"
    );
  }
  if (s.morning) {
    searchLabels(
      "Past Morning Routine Labels",
      "morning routine wake up coffee start of day fresh clarity rested"
    );
  }
  if (s.evening) {
    searchLabels(
      "Past Evening & Wind-down Labels",
      "evening wind down end of day night routine relax calm bedtime"
    );
  }
  if (s.nutrition) {
    searchLabels(
      "Past Nutrition & Eating Labels",
      "food eating meal nutrition caffeine coffee tea fasting glucose brain fuel"
    );
  }
  if (s.therapy) {
    searchLabels(
      "Past Therapy & Reflection Labels",
      "therapy reflection introspection emotional processing journaling self-aware"
    );
  }
  if (s.travel) {
    enqueue("Sleep Staging (last 24 h)", "sleep");
    searchLabels(
      "Past Travel Labels",
      "travel jetlag timezone circadian rhythm body clock adjustment"
    );
  }
  if (s.goals) {
    searchLabels(
      "Past Goal & Habit Labels",
      "goal habit routine intention achievement milestone streak self-improvement"
    );
  }
  if (s.anger) {
    searchLabels(
      "Past Anger & Frustration Labels",
      "anger frustrated irritable rage outburst tense reactive triggered emotional"
    );
  }
  if (s.grief) {
    searchLabels(
      "Past Grief & Loss Labels",
      "grief loss sad mourning bereavement sorrow heartbreak pain emotional"
    );
  }
  if (s.loneliness) {
    searchLabels(
      "Past Loneliness & Isolation Labels",
      "lonely isolation alone disconnected withdrawn left out excluded belonging"
    );
  }
  if (s.addiction) {
    searchLabels(
      "Past Craving & Compulsion Labels",
      "craving urge compulsion addiction impulse scroll distraction temptation"
    );
  }
  if (s.confidence) {
    searchLabels(
      "Past Confidence & Self-Esteem Labels",
      "confident self-esteem doubt insecure imposter capable proud accomplished"
    );
  }
  if (s.hrv) {
    enqueue("Current Session Metrics", "session", "0");
    enqueue("HealthKit Heart Rate", "health", "hr");
    searchLabels(
      "Past HRV & Cardiac Labels",
      "heart rate HRV palpitation breathing chest autonomic cardiac coherence calm vagal"
    );
  }
  if (s.somatic) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Somatic & Body Sensation Labels",
      "somatic body sensation tension embodied grounded interoception gut feeling physical"
    );
  }
  if (s.consciousness) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Consciousness & Awareness Labels",
      "consciousness awareness presence awakening ego dissolution lucid witness observer altered state"
    );
  }
  if (s.philosophy) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Philosophy & Inquiry Labels",
      "philosophy meaning purpose wisdom truth inquiry virtue contemplation stoic existential"
    );
  }
  if (s.existential) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Existential & Mortality Labels",
      "death mortality meaning existence purpose void impermanence legacy soul finitude"
    );
  }
  if (s.depth) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Deep Feeling & Inner Life Labels",
      "profound depth inner life soul contemplation moving stirred vast silence inward"
    );
  }
  if (s.morals) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Moral & Ethical Labels",
      "ethics morals integrity conscience guilt shame regret duty right wrong dilemma values justice"
    );
  }
  if (s.symbiosis) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Symbiosis & Connection Labels",
      "symbiosis interconnected oneness unity interdependence harmony nature collective ecosystem belonging"
    );
  }
  if (s.awe) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Awe & Wonder Labels",
      "awe wonder transcendence sublime sacred peak experience cosmic majestic beauty spiritual gratitude overwhelmed"
    );
  }
  if (s.identity) {
    enqueue("Current Session Metrics", "session", "0");
    searchLabels(
      "Past Identity & Self-Discovery Labels",
      "identity authentic self-concept who am I true self mask persona values-alignment self-expression discovery"
    );
  }
  if (s.health) {
    enqueue("HealthKit Summary (24 h)", "health");
  }
  if (s.screenshots) {
    enqueue("Recent Screenshots for EEG", "screenshots-for-eeg");
  }
  if (s.hooks) {
    enqueue("Proactive Hooks", "hooks");
  }
  if (s.dnd) {
    enqueue("DND Status", "dnd");
  }
  if (s.llm) {
    enqueue("LLM Status", "llm", "status");
  }
  const MAX_LABEL_SEARCHES = 5;
  const seen = /* @__PURE__ */ new Set();
  let labelSearchCount = 0;
  const unique = queue.filter(({ args }) => {
    const key = args.join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    if (args[0] === "search-labels") {
      if (labelSearchCount >= MAX_LABEL_SEARCHES) return false;
      labelSearchCount++;
    }
    return true;
  });
  const results = await Promise.all(
    unique.map(({ label: label2, args }) => {
      if (args.length === 0) {
        const text = getFreshCompare();
        return text ? `### ${label2}
${text}` : null;
      }
      return runNeuroSkill(args).then((r) => r.ok && r.text ? `### ${label2}
${r.text}` : null);
    })
  );
  return [...extras, ...results.filter((r) => r !== null)];
}

// src/skills-sync.ts
import { execFileSync } from "node:child_process";
import { existsSync as existsSync5, mkdirSync as mkdirSync4, readdirSync, renameSync } from "node:fs";
import { homedir as homedir5 } from "node:os";
import { dirname as dirname2, join as join5 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var SRC_DIR = dirname2(fileURLToPath2(import.meta.url));
var BUNDLED_SKILLS_DIR = join5(SRC_DIR, "..", "skills");
var AGENT_SKILLS_DIR = join5(homedir5(), ".neuroloop", "skills-cache");
var LEGACY_AGENT_SKILLS_DIR = join5(homedir5(), ".neuroloop", "skills");
var SKILLS_REPO_URL = "https://github.com/NeuroSkill-com/skills.git";
function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
function maybeRev(cwd) {
  try {
    return git(["rev-parse", "HEAD"], cwd);
  } catch {
    return void 0;
  }
}
function hasSkillsContent(root) {
  if (!existsSync5(root)) return false;
  if (existsSync5(join5(root, "SKILL.md"))) return true;
  const containers = [root, join5(root, "skills")];
  for (const container of containers) {
    if (!existsSync5(container)) continue;
    try {
      for (const entry of readdirSync(container, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (existsSync5(join5(container, entry.name, "SKILL.md"))) return true;
      }
    } catch {
    }
  }
  return false;
}
function formatErr(error) {
  return error instanceof Error ? error.message : String(error);
}
function getAgentSkillsDir() {
  return AGENT_SKILLS_DIR;
}
async function syncSkillsFromGitHub(opts = {}) {
  const force = opts.force ?? false;
  const onProgress = opts.onProgress;
  const report = (stage, percent) => onProgress?.({ stage, percent });
  const parentDir = dirname2(AGENT_SKILLS_DIR);
  mkdirSync4(parentDir, { recursive: true });
  if (existsSync5(LEGACY_AGENT_SKILLS_DIR)) {
    try {
      if (!existsSync5(AGENT_SKILLS_DIR)) {
        renameSync(LEGACY_AGENT_SKILLS_DIR, AGENT_SKILLS_DIR);
      } else {
        const legacyDisabled = join5(parentDir, "skills-legacy-disabled");
        if (!existsSync5(legacyDisabled)) {
          renameSync(LEGACY_AGENT_SKILLS_DIR, legacyDisabled);
        }
      }
    } catch {
    }
  }
  report("Preparing skills sync", 5);
  try {
    const hasGitClone = existsSync5(join5(AGENT_SKILLS_DIR, ".git"));
    if (hasGitClone) {
      report("Fetching latest skills", 20);
      const before = maybeRev(AGENT_SKILLS_DIR);
      git(["fetch", "--all", "--prune"], AGENT_SKILLS_DIR);
      report("Applying latest skills", 70);
      git(["reset", "--hard", "origin/HEAD"], AGENT_SKILLS_DIR);
      const after2 = maybeRev(AGENT_SKILLS_DIR);
      const updated = !!after2 && before !== after2;
      report("Finalizing skills sync", 95);
      report("Skills sync complete", 100);
      return {
        ok: true,
        updated,
        skipped: false,
        before,
        after: after2,
        message: updated ? `Skills cache updated in ${AGENT_SKILLS_DIR} (${before?.slice(0, 7) ?? "none"} \u2192 ${after2.slice(0, 7)}).` : `Skills cache is already up to date in ${AGENT_SKILLS_DIR}.`
      };
    }
    if (!force && hasSkillsContent(AGENT_SKILLS_DIR)) {
      report("Using local skills cache", 100);
      return {
        ok: true,
        updated: false,
        skipped: true,
        message: `Using existing local skills cache from ${AGENT_SKILLS_DIR}.`
      };
    }
    report("Downloading skills repository", 20);
    git(["clone", "--depth", "1", SKILLS_REPO_URL, AGENT_SKILLS_DIR], parentDir);
    report("Finalizing downloaded skills", 90);
    const after = maybeRev(AGENT_SKILLS_DIR);
    report("Skills sync complete", 100);
    return {
      ok: true,
      updated: true,
      skipped: false,
      after,
      message: `Skills downloaded to ${AGENT_SKILLS_DIR}${after ? ` (${after.slice(0, 7)})` : ""}.`
    };
  } catch (error) {
    const syncError = formatErr(error);
    report("Skills sync failed", 100);
    if (hasSkillsContent(BUNDLED_SKILLS_DIR)) {
      return {
        ok: true,
        updated: false,
        skipped: true,
        message: `Failed to refresh ${AGENT_SKILLS_DIR}; using bundled package skills.`,
        error: syncError
      };
    }
    return {
      ok: false,
      updated: false,
      skipped: false,
      message: "Failed to sync skills and no local fallback is available.",
      error: syncError
    };
  }
}

// src/skill-llm.ts
import { readFileSync as readFileSync5 } from "node:fs";
function loadToken() {
  try {
    return readFileSync5(getDaemonTokenPath(), "utf8").trim();
  } catch {
    return "";
  }
}
function authHeaders() {
  const token = loadToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function localModelEntry(id, opts = {}) {
  return {
    id,
    name: id,
    reasoning: true,
    input: opts.supportsVision ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: opts.contextWindow ?? 32768,
    maxTokens: 8192,
    compat: {
      supportsStore: false,
      supportsReasoningEffort: false,
      supportsDeveloperRole: false,
      requiresToolResultName: false,
      supportsStrictMode: false
    }
  };
}
async function registerSkillLlmProvider(modelRegistry2) {
  try {
    const discoveredPort = await discoverSkillServer();
    if (!discoveredPort) return false;
    const baseUrl = `http://127.0.0.1:${discoveredPort}`;
    const hdrs = authHeaders();
    const models = [];
    let serverRunning = false;
    for (const path of ["/llm/status", "/v1/llm/server/status"]) {
      try {
        const r = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(2e3), headers: hdrs });
        if (r.ok) {
          const status = await r.json();
          if (status.status === "running" || status.status === "ok") {
            const name = status.model_name ?? status.model;
            if (name) {
              models.push(localModelEntry(name, {
                contextWindow: status.n_ctx ?? 32768,
                supportsVision: status.supports_vision ?? false
              }));
              serverRunning = true;
            }
          }
          break;
        }
      } catch {
      }
    }
    try {
      const catRes = await fetch(`${baseUrl}/v1/llm/catalog`, {
        signal: AbortSignal.timeout(2e3),
        headers: hdrs
      });
      if (catRes.ok) {
        const cat = await catRes.json();
        const existing = new Set(models.map((m) => m.id));
        if (!serverRunning && cat.active_model) {
          const active = (cat.entries ?? []).find(
            (e) => e.filename === cat.active_model && e.state === "downloaded" && !e.is_mmproj
          );
          if (active?.filename && !existing.has(active.filename)) {
            models.push(localModelEntry(active.filename));
            existing.add(active.filename);
          }
        }
        for (const e of cat.entries ?? []) {
          if (!e.filename || e.is_mmproj) continue;
          if (e.state !== "downloaded") continue;
          if (!existing.has(e.filename)) {
            models.push(localModelEntry(e.filename));
            existing.add(e.filename);
          }
        }
      }
    } catch {
    }
    if (models.length === 0) return false;
    modelRegistry2.registerProvider("skill-llm", {
      baseUrl: `${baseUrl}/v1`,
      apiKey: loadToken() || "SKILL_LLM_API_KEY",
      api: "openai-completions",
      models
    });
    return true;
  } catch {
    return false;
  }
}
async function startSkillLlmServer(mode2 = "auto") {
  const localStart = async () => runNeuroSkill(["llm", "start"]);
  const remoteAttempts = [
    { command: "llm_start", args: { mode: "remote" } },
    { command: "llm_start", args: { remote: true } },
    { command: "llm_start", args: { backend: "remote" } }
  ];
  const tryRemote = async () => {
    for (const payload of remoteAttempts) {
      const r = await runNeuroSkill(["raw", JSON.stringify(payload)]);
      if (r.ok) return r;
    }
    return { ok: false, error: "remote llm_start ws command not supported" };
  };
  if (mode2 === "local") {
    const r = await localStart();
    return { ok: r.ok, message: r.ok ? "Skill LLM local server started." : r.error ?? "Failed to start local server" };
  }
  if (mode2 === "remote") {
    const r = await tryRemote();
    if (r.ok) return { ok: true, message: "Skill LLM remote server started via WS." };
    return { ok: false, message: r.error ?? "Failed to start remote server" };
  }
  const remote = await tryRemote();
  if (remote.ok) return { ok: true, message: "Skill LLM remote server started via WS." };
  const local = await localStart();
  if (local.ok) return { ok: true, message: "Remote start unavailable; local llama.cpp server started." };
  return { ok: false, message: local.error ?? "Failed to start Skill LLM server" };
}
async function autoBootSkillLlmIfConfigured() {
  const raw = (process.env.NEUROLOOP_SKILL_LLM_BOOT ?? "off").toLowerCase();
  const mode2 = raw === "remote" || raw === "local" || raw === "auto" ? raw : "off";
  if (mode2 === "off") return;
  await startSkillLlmServer(mode2);
}
async function getSkillServerBaseUrl() {
  const port = await discoverSkillServer() ?? getSkillPort();
  return `http://127.0.0.1:${port}`;
}

// src/model-config.ts
import { execFile as execFile3 } from "node:child_process";
import { existsSync as existsSync6, mkdirSync as mkdirSync5, readFileSync as readFileSync6, writeFileSync as writeFileSync3 } from "node:fs";
import { homedir as homedir6 } from "node:os";
import { join as join6 } from "node:path";
import { promisify as promisify3 } from "node:util";
var execFileAsync3 = promisify3(execFile3);
var MODEL_CONFIG_PATH = join6(homedir6(), ".neuroloop", "models.json");
function defaultModelsFile() {
  return { providers: {} };
}
function readModelsFile() {
  try {
    if (!existsSync6(MODEL_CONFIG_PATH)) return defaultModelsFile();
    const parsed = JSON.parse(readFileSync6(MODEL_CONFIG_PATH, "utf8"));
    if (!parsed.providers || typeof parsed.providers !== "object") return defaultModelsFile();
    return parsed;
  } catch {
    return defaultModelsFile();
  }
}
function writeModelsFile(file) {
  const dir = join6(homedir6(), ".neuroloop");
  if (!existsSync6(dir)) mkdirSync5(dir, { recursive: true, mode: 448 });
  writeFileSync3(MODEL_CONFIG_PATH, JSON.stringify(file, null, 2) + "\n", {
    encoding: "utf8",
    mode: 384
  });
}
function upsertProviderModel(params) {
  const file = readModelsFile();
  const provider = file.providers[params.provider] ?? {};
  provider.baseUrl = params.baseUrl;
  provider.api = params.api;
  provider.apiKey = params.apiKey;
  provider.authHeader = params.authHeader;
  const models = provider.models ?? [];
  const idx = models.findIndex((m) => m.id === params.modelId);
  const model = {
    id: params.modelId,
    name: params.modelName?.trim() || void 0,
    reasoning: params.reasoning,
    input: params.supportsVision ? ["text", "image"] : ["text"],
    contextWindow: params.contextWindow,
    maxTokens: params.maxTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  };
  if (idx >= 0) models[idx] = { ...models[idx], ...model };
  else models.push(model);
  provider.models = models;
  file.providers[params.provider] = provider;
  writeModelsFile(file);
}
async function openModelsFileInSystem() {
  const path = MODEL_CONFIG_PATH;
  if (process.platform === "darwin") {
    await execFileAsync3("open", [path]);
    return;
  }
  if (process.platform === "win32") {
    await execFileAsync3("cmd", ["/c", "start", "", path], { shell: true, windowsHide: true });
    return;
  }
  await execFileAsync3("xdg-open", [path]);
}

// src/memory.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync6, readFileSync as readFileSync7, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir as homedir7 } from "node:os";
import { dirname as dirname3, join as join7 } from "node:path";
var MEMORY_PATH = join7(homedir7(), ".neuroskill", "memory.md");
function readMemory(path = MEMORY_PATH) {
  if (!existsSync7(path)) return void 0;
  return readFileSync7(path, "utf-8").trim() || void 0;
}
var MAX_MEMORY_BYTES = 512 * 1024;
function writeMemory(content, mode2, path = MEMORY_PATH) {
  mkdirSync6(dirname3(path), { recursive: true, mode: 448 });
  if (mode2 === "append") {
    const existing = existsSync7(path) ? readFileSync7(path, "utf-8") : "";
    const sep = existing && !existing.endsWith("\n") ? "\n" : "";
    const combined = existing + sep + content;
    if (Buffer.byteLength(combined, "utf-8") > MAX_MEMORY_BYTES) {
      throw new Error(`Memory file would exceed ${MAX_MEMORY_BYTES / 1024} KB limit. Use mode "overwrite" to replace, or trim old entries first.`);
    }
    writeFileSync4(path, combined, { encoding: "utf-8", mode: 384 });
  } else {
    const trimmed = Buffer.byteLength(content, "utf-8") > MAX_MEMORY_BYTES ? content.slice(0, MAX_MEMORY_BYTES) : content;
    writeFileSync4(path, trimmed, { encoding: "utf-8", mode: 384 });
  }
}

// src/tools/web-fetch.ts
import { Type } from "@sinclair/typebox";
var DEFAULT_MAX_CHARS = 12e3;
function isPrivateUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0" || host.endsWith(".local") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.startsWith("169.254.") || u.protocol === "file:") {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
var webFetchTool = {
  name: "web_fetch",
  label: "Web Fetch",
  description: "Fetch the text content of any URL. HTML is stripped to readable text. Useful for reading documentation, articles, blog posts, GitHub issues, and other web pages.",
  parameters: Type.Object({
    url: Type.String({ description: "The URL to fetch." }),
    maxChars: Type.Optional(
      Type.Number({
        description: `Maximum characters to return. Default: ${DEFAULT_MAX_CHARS}`
      })
    )
  }),
  async execute(_id, params, signal, _onUpdate, _ctx) {
    const limit = params.maxChars ?? DEFAULT_MAX_CHARS;
    if (isPrivateUrl(params.url)) {
      return {
        content: [{ type: "text", text: "Blocked: cannot fetch private/internal URLs." }],
        details: { url: params.url, error: "private_url_blocked", ok: false }
      };
    }
    let text;
    let status;
    try {
      const timeout = AbortSignal.timeout(3e4);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const res = await fetch(params.url, {
        signal: combined,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      status = res.status;
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          content: [
            {
              type: "text",
              text: `HTTP ${res.status} ${res.statusText}
${body.slice(0, 500)}`
            }
          ],
          details: { url: params.url, status: res.status, ok: false }
        };
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        text = JSON.stringify(json, null, 2);
      } else {
        const raw = await res.text();
        text = contentType.includes("html") ? stripHtml(raw) : raw;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Fetch error: ${msg}` }],
        details: { url: params.url, error: msg, ok: false }
      };
    }
    const truncated = text.length > limit ? `${text.slice(0, limit)}

[...truncated \u2014 ${text.length - limit} chars omitted]` : text;
    return {
      content: [{ type: "text", text: truncated }],
      details: { url: params.url, status, length: text.length, truncated: text.length > limit }
    };
  }
};

// src/tools/web-search.ts
import { Type as Type2 } from "@sinclair/typebox";
var DDG_LITE = "https://lite.duckduckgo.com/lite/";
var DEFAULT_K = 8;
function parseDdgLite(html) {
  const results = [];
  const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const links = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const rawHref = m[1];
    const rawTitle = m[2];
    let url = rawHref;
    const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      try {
        url = decodeURIComponent(uddgMatch[1]);
      } catch {
        url = rawHref;
      }
    } else if (rawHref.startsWith("//")) {
      url = `https:${rawHref}`;
    }
    const title = rawTitle.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (title && url) links.push({ url, title });
  }
  const snippets = [];
  while ((m = snippetRe.exec(html)) !== null) {
    snippets.push(
      m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim()
    );
  }
  for (let i = 0; i < links.length; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] ?? ""
    });
  }
  return results;
}
var webSearchTool = {
  name: "web_search",
  label: "Web Search",
  description: "Search the web via DuckDuckGo. Returns titles, URLs, and snippets for the top results. Use this to find current information, documentation, articles, or any web content.",
  parameters: Type2.Object({
    query: Type2.String({ description: "The search query." }),
    maxResults: Type2.Optional(
      Type2.Number({ description: `Maximum number of results to return. Default: ${DEFAULT_K}` })
    )
  }),
  async execute(_id, params, signal, _onUpdate, _ctx) {
    const k = Math.min(params.maxResults ?? DEFAULT_K, 20);
    let html;
    try {
      const res = await fetch(`${DDG_LITE}?q=${encodeURIComponent(params.query)}`, {
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,*/*",
          "Accept-Language": "en-US,en;q=0.9"
        },
        redirect: "follow"
      });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Search failed: HTTP ${res.status}` }],
          details: { query: params.query, error: `HTTP ${res.status}` }
        };
      }
      html = await res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Search error: ${msg}` }],
        details: { query: params.query, error: msg }
      };
    }
    const results = parseDdgLite(html).slice(0, k);
    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No results found." }],
        details: { query: params.query, count: 0, results: [] }
      };
    }
    const text = results.map(
      (r, i) => `${i + 1}. **${r.title}**
   URL: ${r.url}
   ${r.snippet}`
    ).join("\n\n");
    return {
      content: [{ type: "text", text }],
      details: { query: params.query, count: results.length, results }
    };
  }
};

// src/tools/protocol.ts
import { Type as Type3 } from "@sinclair/typebox";
function sleep(ms, signal) {
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
      { once: true }
    );
  });
}
async function notify(title, body) {
  await runNeuroSkill(["notify", title, ...body ? [body] : []]);
}
async function label(text, context) {
  await runNeuroSkill(["label", text, ...context ? ["--context", context] : []]);
}
var StepSchema = Type3.Object({
  name: Type3.String({
    description: "Short step name shown as the notification title. For announcement steps use a \u25B6 prefix (e.g. '\u25B6 Coming up: Slow exhale'). For action steps use a plain verb (e.g. 'Exhale slowly\u2026')."
  }),
  instruction: Type3.String({
    description: "Full instruction shown as the notification body and in the chat. For announcement steps: describe what is about to happen so the user can prepare. For action steps: tell the user exactly what to do right now."
  }),
  duration_secs: Type3.Number({
    description: "How long to hold this step before auto-advancing, in seconds. Use 0 for announcement steps (just show, then immediately move on). Use the actual physical duration for action steps (e.g. 4 for a 4-count inhale)."
  })
});
var runProtocolTool = {
  name: "run_protocol",
  label: "Run Guided Protocol",
  description: `Execute a multi-step guided protocol step by step with OS notifications, per-step timing, and EXG labelling at every step.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
WHEN TO CALL THIS TOOL \u2014 read before using:
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2022 Only call this after the user has explicitly agreed to do the protocol.
  Describe the exercise and ask first; run_protocol is the execution step, not the proposal.
\u2022 Never call this more than once per turn, and never chain two protocols back-to-back.
\u2022 Do not re-run the same modality type that has already run this session unless the user
  explicitly asks to repeat it.
\u2022 If the user seems uncertain, reluctant, or mid-conversation, offer \u2014 don't execute.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
AVAILABLE PROTOCOL CATEGORIES (choose the best fit for the EXG):
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Attention & Focus
  \u2022 Theta-Beta Neurofeedback Anchor \u2014 high tbr / low focus / high adhd_index
  \u2022 Focus Reset \u2014 scattered engagement, high cognitive_load mid-session
  \u2022 Cognitive Load Offload \u2014 cognitive_load > 0.7, end of deep work block
  \u2022 Working Memory Primer \u2014 low pac_theta_gamma, pre-task warm-up
  \u2022 Pre-Performance Activation \u2014 low engagement before a challenge/presentation
  \u2022 Creativity Unlock \u2014 high beta, low rel_alpha, creative block

Stress & Autonomic Regulation
  \u2022 Box Breathing (4-4-4-4) \u2014 high bar / high anxiety_index / low relaxation
  \u2022 Extended Exhale (4-7-8) \u2014 acute stress spike, high lf_hf_ratio
  \u2022 Cardiac Coherence (~6 breaths/min) \u2014 low rmssd (<30 ms) / high stress_index
  \u2022 Physiological Sigh \u2014 rapid overwhelm onset (1\u20133 cycles only)

Emotional Regulation & Mood
  \u2022 FAA Rebalancing \u2014 negative faa / high depression_index / low mood
  \u2022 Mood Activation \u2014 depression_index > 40, flat mood, low engagement
  \u2022 Loving-Kindness (Metta) \u2014 loneliness, shame, grief, or low faa
  \u2022 Emotional Discharge \u2014 high bipolar_index, extreme FAA swings, agitation

Relaxation & Alpha Promotion
  \u2022 Alpha Induction (open focus) \u2014 high bar, post-stress, low relaxation
  \u2022 Open Monitoring \u2014 low lzc (<40) / low integration / mental narrowing
  \u2022 Relaxation Scan \u2014 high cortical arousal, headache_index > 30

Sleep & Circadian
  \u2022 Sleep Onset Wind-Down \u2014 insomnia_index > 50, drowsy end-of-day
  \u2022 Ultradian Reset (20-min rest) \u2014 mid-afternoon slump / post-90-min focus block
  \u2022 Wake Reset / Alertness Boost \u2014 narcolepsy_index > 40 / wakefulness < 30

Body & Somatic
  \u2022 Progressive Muscle Relaxation \u2014 physical tension, insomnia_index high, high beta
  \u2022 Somatic Body Scan \u2014 low integration, dissociation, trauma processing
  \u2022 Grounding (5-4-3-2-1) \u2014 anxiety, panic onset, dissociation
  \u2022 Tension Release Exercise \u2014 chronic stress, high stress_index, stored tension

Consciousness & Integration
  \u2022 Coherence Building \u2014 low coherence (<0.4) / low integration
  \u2022 Flow State Induction \u2014 focus 0.5\u20130.7 and engagement rising
  \u2022 Complexity Expansion (LZC boost) \u2014 low lzc / cognitive rigidity

Energy & Alertness
  \u2022 Kapalabhati Energiser \u2014 low engagement / sluggish cognition / low wakefulness
  \u2022 4-Count Energising Breath \u2014 post-lunch dip / low engagement

Headache & Migraine
  \u2022 Cortical Quieting \u2014 headache_index > 30 / migraine_index > 20
  \u2022 Alpha-Reset for Headache \u2014 headache_index rising / cortical hyperexcitability

Energy & Alertness (extended)
  \u2022 Wim Hof Breathwork \u2014 near-zero engagement / full system reset (\u26A0 not for epilepsy_risk > 30)
  \u2022 Cold Exposure Micro-Protocol \u2014 autonomic torpor / low wakefulness / low bar

Hemispheric Balance & Breathing
  \u2022 Nadi Shodhana (Alternate Nostril) \u2014 FAA asymmetry (|faa| > 0.1) / low coherence
  \u2022 Buteyko CO2 Retraining \u2014 chronic anxiety / habitual over-breathing / high lf_hf_ratio

Deep Relaxation (Somatic)
  \u2022 Autogenic Training \u2014 chronic tension / high stress_index / difficulty releasing
  \u2022 Havening Touch \u2014 acute emotional distress spike / high anxiety_index / trauma activation
  \u2022 Somatic Shaking \u2014 post-adrenaline / stored tension after stress spike

Recovery & Rest
  \u2022 NSDR / Yoga Nidra \u2014 post-deep-work / high cognitive_load / mid-day restoration
  \u2022 Power Nap Guidance \u2014 wakefulness < 30 / narcolepsy_index > 40 / extreme drowsiness

Deep Meditation
  \u2022 Alpha-Theta Drift \u2014 low lzc + drowsiness / trauma integration / deep creativity
  \u2022 Mantra / Single-Point Focus \u2014 high rel_theta + low focus / monkey-mind / chatter
  \u2022 Gamma Entrainment (40 Hz) \u2014 schizophrenia_index > 30 / low integration / low rel_gamma

Emotional Processing (extended)
  \u2022 Gratitude Cascade \u2014 depression_index > 35 / low mood / low faa (positive memory activation)
  \u2022 Peak State Anchor \u2014 focus > 0.75 + mood > 0.7 simultaneously \u2014 NLP state installation
  \u2022 Freeze Response Completion \u2014 very low engagement (<0.2) + elevated anxiety_index
  \u2022 Cognitive Defusion (ACT) \u2014 anxious rumination / stuck thought loops / high anxiety_index

Autonomic & Vagal
  \u2022 Vagal Toning (Humming / Gargling) \u2014 low rmssd (<25 ms) / low HRV / high stress_index

Cognitive Performance & Motivation (extended)
  \u2022 WOOP / Mental Contrasting \u2014 low motivation / pre-challenge engagement dip
  \u2022 Cognitive Defragging \u2014 high spectral_centroid + cognitive_load + context-switching
  \u2022 Dual-N-Back Warm-Up \u2014 low pac_theta_gamma / low sample_entropy (rigid neural patterns)
  \u2022 Novel Stimulation Burst \u2014 dementia_index > 30 / low apf (<9 Hz) / cortical slowing

Motor & Embodiment
  \u2022 Motor Cortex Activation \u2014 high mu_suppression / high stillness after long static sitting
  \u2022 Desk Yoga Sequence \u2014 stillness > 0.9 sustained / low engagement / low mood

Neck & Cervical Relief
  \u2022 Neck Release Sequence \u2014 headache_index elevated / stillness > 0.85 / neck tension
  \u2022 Cervical Decompression \u2014 forward-head posture / chronic neck compression
  \u2022 Upper Trap & Shoulder Release \u2014 high stress_index + reported shoulder/neck tightness

Eye Exercises & Visual Recovery
  \u2022 20-20-20 Vision Reset \u2014 any long screen session / high spectral_centroid (quick)
  \u2022 Full Eye Exercise Sequence \u2014 eye fatigue / >90 min screen time / visual tension
  \u2022 Palming & Blink Recovery \u2014 dry eyes / eye burning / migraine_index elevated (quick)

Morning Routines
  \u2022 Gentle Morning Wake-Up \u2014 low wakefulness (<50) at day start / mild grogginess
  \u2022 Energising Morning Activation \u2014 very low wakefulness (<35) / flat mood / low engagement
  \u2022 Morning Clarity Ritual \u2014 low focus at day start / cognitive_load carryover
  \u2022 Mindful Morning Transition \u2014 low integration / emotional residue from sleep

Workout & Gym
  \u2022 Pre-Workout Neural Primer \u2014 before training / low engagement or low wakefulness
  \u2022 Pre-Workout Focus Lock \u2014 before skill/strength session / needs calm precision
  \u2022 Intra-Workout Recovery Micro-Set \u2014 between sets / hr elevated / high stress_index
  \u2022 Post-Workout Cool-Down & Integration \u2014 after training / hr still elevated
  \u2022 Post-Workout Recovery Reset \u2014 after intense session / high stress_index + fatigue
  \u2022 Mind-Muscle Connection Primer \u2014 low mu_suppression / pre-technique training

Hydration & Water Breaks (keep short and direct)
  \u2022 Hydration Reminder \u2014 long session / hr elevated / dry-mouth mention
  \u2022 Mindful Water Break \u2014 high cognitive_load / post-stress spike
  \u2022 Hydration + Eye Reset \u2014 long screen block / high spectral_centroid

Bathroom & Movement Breaks (keep short and practical)
  \u2022 Bathroom Break Prompt \u2014 high stillness / long unbroken session / restlessness
  \u2022 Break + Reset on Return \u2014 after any break to re-anchor focus
  \u2022 Movement Snack \u2014 stillness > 0.9 for >45 min / low engagement

Emotions \u2014 Extended Repertoire
  \u2022 Anger & Frustration Processing \u2014 high stress_index + high bar + agitation
  \u2022 Grief & Loss Holding \u2014 low mood + low engagement + depression_index > 35
  \u2022 Shame & Self-Compassion Break \u2014 negative faa + self-criticism / distinct from Metta
  \u2022 Anxiety Surfing \u2014 high anxiety_index + urge to escape / ride the wave
  \u2022 Fear Processing \u2014 anxiety_index high + freeze pattern (low engagement)
  \u2022 Envy & Comparison Alchemy \u2014 post-social-media low mood + negative faa
  \u2022 Excitement Regulation \u2014 very high engagement + high hr (arousal too hot)
  \u2022 Emotional Inventory (Check-In) \u2014 unknown/mixed state / session opening
  \u2022 Awe & Wonder Induction \u2014 low lzc + contracted attention + existential flatness
  \u2022 Joy Amplification \u2014 mood > 0.7 + positive faa / savour and anchor a good state
  \u2022 Loneliness & Connection \u2014 low mood + isolation expressed by user
  \u2022 Resentment Release \u2014 persistently negative faa + held grievance
  \u2022 Emotional Boundaries Reset \u2014 post-difficult conversation + high stress_index

Music Protocols
  \u2022 Mood-Match & Lift (ISO Principle) \u2014 low mood / depression_index > 30 / emotional inertia
  \u2022 Focus Music Protocol \u2014 high cognitive_load / low focus / distraction-prone session
  \u2022 Energising Activation Playlist \u2014 low wakefulness / post-lunch dip / low engagement
  \u2022 Stress Discharge Playlist \u2014 high stress_index + charge needing cathartic outlet
  \u2022 Sleep Music Wind-Down \u2014 insomnia_index > 40 / pre-sleep / high beta at bedtime
  \u2022 Binaural Beat Entrainment \u2014 target alpha / theta / gamma before cognitive work
  \u2022 Music-Breath Synchronisation \u2014 cardiac coherence variant using music BPM as pacer
  \u2022 Active Listening (Deep Listening) \u2014 low lzc / creative block / low integration
  \u2022 Rhythm Grounding \u2014 anxiety / dissociation / freeze / high anxiety_index
  \u2022 Singing / Vocal Toning \u2014 low rmssd / high stress / vagal activation + joy
  \u2022 Emotional Release with Music \u2014 grief / anger / unprocessed emotion needing discharge

Social Media & Digital Addiction
  \u2022 Pre-Scroll Intention Check \u2014 before opening any social media app (quick, 1 min)
  \u2022 Craving Surf (Urge Surfing) \u2014 compulsive urge to check phone / dopamine craving spike
  \u2022 Post-Scroll Brain Reset \u2014 after unintended long scroll; low focus / low lzc / mood crash
  \u2022 Comparison Detox \u2014 post-social-media low mood + negative faa comparison trigger
  \u2022 Dopamine Palette Reset \u2014 habitual checking / low baseline engagement / depleted dopamine
  \u2022 Notification Detox \u2014 high context-switching / low focus / attention fragmented
  \u2022 Mindful Social Media Session \u2014 intentional capped use with purpose and timer
  \u2022 FOMO Defusion \u2014 anxiety about missing out / high anxiety_index / compulsive checking
  \u2022 Digital Sunset Protocol \u2014 insomnia_index elevated / pre-sleep screen use
  \u2022 Attention Restoration Walk \u2014 post-scroll / low lzc / attention depleted (go outside, no phone)
  \u2022 Values Reconnection \u2014 persistent comparison spiral / low mood / inadequacy after scrolling
  \u2022 Screen Time Reflection \u2014 end-of-day usage review without judgment

Dietary Protocols
  Mindful Eating & Awareness
  \u2022 Pre-Meal Pause \u2014 any meal / stress before eating / autopilot eating (60 seconds)
  \u2022 Mindful Meal Protocol \u2014 rushed eating / high cognitive_load before meal / overeating
  \u2022 Intuitive Eating Check-In \u2014 emotional eating / stress eating / binge urges
  \u2022 Eating Speed Reset \u2014 frequent post-meal drowsiness / bloating / overeating pattern

  Energy & Cognitive Performance Nutrition
  \u2022 Post-Meal Energy Crash Protocol \u2014 drowsiness spike post-meal / wakefulness drop / narcolepsy_index mid-afternoon
  \u2022 Blood Sugar Stability Guide \u2014 low focus trending across session / energy crashes between meals
  \u2022 Caffeine Timing Protocol \u2014 afternoon focus crash / anxiety_index elevated / coffee timing question
  \u2022 Pre-Focus Block Nutrition \u2014 before a planned deep work session / what to eat question
  \u2022 Cognitive Nutrition Briefing \u2014 general brain performance nutrition question

  Mood & Mental Health Nutrition
  \u2022 Mood-Food Connection \u2014 depression_index > 35 / persistently low mood / gut-brain axis
  \u2022 Stress Eating Awareness \u2014 high stress_index + food craving spike / emotional eating
  \u2022 Anti-Inflammatory Eating Guide \u2014 headache_index > 25 / chronic stress / cognitive fog
  \u2022 Gut-Brain Axis Reset \u2014 anxiety_index > 40 persisting / low mood / high lf_hf_ratio

  Sleep & Evening Nutrition
  \u2022 Evening Eating Protocol \u2014 insomnia_index > 40 / late eating habit / poor sleep quality
  \u2022 Post-Workout Nutrition Window \u2014 after training / recovery focus / hr still elevated

  Fasting & Meal Timing
  \u2022 Intermittent Fasting Support \u2014 user in fasting window / hunger / focus complaints during fast
  \u2022 Breaking the Fast Mindfully \u2014 first meal of the day / end of fasting window
  \u2022 Time-Restricted Eating Reflection \u2014 user exploring IF / meal timing curiosity

  Cravings & Compulsive Eating
  \u2022 Sugar Craving Surf \u2014 intense craving for sweet/processed food / stress-driven urge
  \u2022 Alcohol Awareness Protocol \u2014 high stress_index evening / insomnia_index elevated / user mentions drinking
  \u2022 Ultra-Processed Food (UPF) Reset \u2014 persistent low mood / anxiety_index high / mostly packaged diet

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
MANDATORY STEP STRUCTURE \u2014 follow this exactly:
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

1. ALWAYS precede every timed action with a 0-duration announcement step.
   The user needs to read what is coming BEFORE the timer starts.
   Example for one breath cycle:
     { name: "\u25B6 Coming up: Slow inhale", instruction: "Get ready \u2014 breathe in through your nose for 4 counts.", duration_secs: 0 }
     { name: "Inhale\u2026",                  instruction: "Breathe in\u2026 1\u2026 2\u2026 3\u2026 4",                               duration_secs: 4 }
     { name: "\u25B6 Coming up: Hold",        instruction: "Hold your breath for 4 counts.",                        duration_secs: 0 }
     { name: "Hold\u2026",                    instruction: "Hold\u2026 1\u2026 2\u2026 3\u2026 4",                                      duration_secs: 4 }
     { name: "\u25B6 Coming up: Slow exhale", instruction: "Exhale through your mouth for 6 counts.",               duration_secs: 0 }
     { name: "Exhale\u2026",                  instruction: "Breathe out\u2026 1\u2026 2\u2026 3\u2026 4\u2026 5\u2026 6",                        duration_secs: 6 }

2. BREAK every physical phase into its own step. Do not bundle multiple
   actions into one long duration. Users cannot count or track time on their own \u2014
   the step timer is the only guide they have.

3. For repeated cycles (e.g. "4 rounds of box breathing") EXPAND the repetitions
   as individual steps in the array \u2014 do not ask the LLM to loop. Each cycle
   gets its own announcement + action steps.

4. For body-scan or progressive-muscle-relaxation sequences, one step per body
   region. Announce the region at 0s, then hold the tense/release pair timed.

5. Use short, imperative language in step names (visible in the notification title).
   Put the count rhythm or cue text in the instruction (visible in the body).

6. EXG labelling is always on \u2014 every step creates a timestamped brain-state record.
   This is intentional: the protocol IS the labelling run.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
DURATION GUIDELINES:
  Breath inhale:        3\u20135 s      Breath hold:          2\u20134 s
  Breath exhale:        4\u20138 s      Muscle tense:         5 s
  Muscle release/relax: 8\u201310 s     Body-scan region:    10\u201315 s
  Transition announce:  0 s        Opening/closing:      3\u20135 s
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
  parameters: Type3.Object({
    title: Type3.String({
      description: "Protocol name shown in notification titles (e.g. 'Recovery Reset')."
    }),
    intro: Type3.Optional(
      Type3.String({
        description: "Opening message sent as the first notification body."
      })
    ),
    steps: Type3.Array(StepSchema, {
      description: "Ordered list of steps. Must follow the mandatory structure above: every timed action is preceded by a 0-duration announcement step."
    })
  }),
  execute: async (_id, params, signal, onUpdate, _ctx) => {
    const { title, intro } = params;
    const MAX_STEPS = 200;
    const MAX_STEP_DURATION = 300;
    const steps = (params.steps ?? []).slice(0, MAX_STEPS).map((s) => ({
      ...s,
      duration_secs: Math.max(0, Math.min(s.duration_secs ?? 0, MAX_STEP_DURATION))
    }));
    const log = [];
    const emit = (line) => {
      log.push(line);
      onUpdate?.({
        content: [{ type: "text", text: log.join("\n") }],
        details: {}
      });
    };
    const stepWord = steps.length === 1 ? "step" : "steps";
    emit(`\u25B6 **${title}** \u2014 ${steps.length} ${stepWord}`);
    await notify(
      title,
      intro ?? `${steps.length}-step protocol starting. Follow the notifications.`
    );
    await label(
      `protocol start: ${title}`,
      `Starting protocol "${title}" (${steps.length} ${stepWord}).${intro ? " " + intro : ""}`
    );
    let completedSteps = 0;
    for (let i = 0; i < steps.length; i++) {
      if (signal?.aborted) break;
      const step = steps[i];
      const num = `${i + 1}/${steps.length}`;
      const isAnnouncement = step.duration_secs === 0;
      const durationNote = step.duration_secs > 0 ? ` \u2014 ${step.duration_secs}s` : "";
      emit(`
Step ${num}: **${step.name}**${durationNote}
${step.instruction}`);
      await notify(`${step.name}${durationNote}`, step.instruction);
      await label(
        `${isAnnouncement ? "announce" : "step"} ${i + 1}: ${step.name.replace(/^[▶►] /, "").slice(0, 40).toLowerCase()}`,
        `Protocol "${title}", step ${num}. ${step.instruction}`
      );
      if (step.duration_secs > 0 && !signal?.aborted) {
        try {
          await sleep(step.duration_secs * 1e3, signal);
        } catch {
          break;
        }
      }
      completedSteps++;
    }
    const aborted = signal?.aborted ?? false;
    if (!aborted) {
      await notify(`${title} complete \u2713`, "Well done. Take a moment to notice how you feel.");
      await label(
        `protocol complete: ${title}`,
        `Finished protocol "${title}" \u2014 all ${steps.length} ${stepWord} completed.`
      );
      emit(`
\u2713 **${title} complete.** Take a moment to notice how you feel.`);
    } else {
      emit(`
\u26A0 Protocol cancelled after ${completedSteps}/${steps.length} ${stepWord}.`);
    }
    return {
      content: [{ type: "text", text: log.join("\n") }],
      details: { title, total_steps: steps.length, completed_steps: completedSteps, aborted }
    };
  }
};

// src/compression.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync7, readFileSync as readFileSync8, writeFileSync as writeFileSync5 } from "node:fs";
import { homedir as homedir8 } from "node:os";
import { join as join8 } from "node:path";
var AGENT_DIR3 = join8(homedir8(), ".neuroloop");
var COMPRESSION_SETTINGS_PATH = join8(AGENT_DIR3, "compression.json");
function loadCompressionSettings() {
  try {
    if (existsSync8(COMPRESSION_SETTINGS_PATH)) {
      const raw = readFileSync8(COMPRESSION_SETTINGS_PATH, "utf8");
      const settings = JSON.parse(raw);
      if (settings.mode === "standard" || settings.mode === "strong" || settings.mode === "off") {
        return settings;
      }
    }
  } catch {
  }
  return { mode: "standard" };
}
function saveCompressionSettings(settings) {
  try {
    if (!existsSync8(AGENT_DIR3)) {
      mkdirSync7(AGENT_DIR3, { recursive: true, mode: 448 });
    }
    writeFileSync5(
      COMPRESSION_SETTINGS_PATH,
      JSON.stringify(settings, null, 2),
      { encoding: "utf8", mode: 384 }
    );
  } catch {
  }
}
function compressStandard(text) {
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
    /I'm going to /gi
  ];
  let result = text;
  for (const filler of fillers) {
    result = result.replace(filler, "");
  }
  return result.trim();
}
function compressStrong(text) {
  let result = compressStandard(text);
  result = result.replace(/\b(a|an|the)\s+/gi, "");
  result = result.replace(/\b(is|are|was|were|have|has|had|am)\s+/gi, "");
  result = result.replace(/\b(I|you|we|they|he|she|it|my|your|our|their|his|her|its)\s+/gi, "");
  result = result.replace(/\b(and|but|or|so|then)\s+/gi, ", ");
  result = result.replace(/\b(in|on|at|to|for|with|from|by|about)\s+/gi, "");
  result = result.replace(/\b(can|could|would|should|may|might|must)\s+/gi, "");
  result = result.replace(/\b(that|which|who|whom|whose)\s+/gi, "");
  result = result.replace(/\b(really|very|quite|rather|too|so|just)\s+/gi, "");
  result = result.replace(/\s+/g, " ").trim();
  if (!/[.!?]$/.test(result)) {
    result += "\u2026";
  }
  result = result.replace(/→/g, "\u2192");
  result = result.replace(/because/g, "\u21D2");
  result = result.replace(/so/g, "\u21D2");
  return result;
}
function compressText(text, mode2) {
  switch (mode2) {
    case "standard":
      return compressStandard(text);
    case "strong":
      return compressStrong(text);
    case "off":
    default:
      return text;
  }
}
function getCompressionModeName(mode2) {
  switch (mode2) {
    case "standard":
      return "Standard";
    case "strong":
      return "Strong";
    case "off":
      return "Off";
  }
}

// src/neuroloop.ts
var _pkgVersion = (true ? "0.1.1" : void 0) ?? JSON.parse(readFileSync9(join9(dirname4(fileURLToPath3(import.meta.url)), "../package.json"), "utf8")).version;
var AGENT_DIR4 = join9(homedir9(), ".neuroskill");
var VERSION_STATE_DIR = join9(homedir9(), ".neuroloop");
var NEUROLOOP_DIR = join9(dirname4(fileURLToPath3(import.meta.url)), "..");
var NEUROLOOP_MD_PATH = join9(NEUROLOOP_DIR, "NEUROLOOP.md");
var CHANGELOG_PATH = join9(NEUROLOOP_DIR, "CHANGELOG.md");
var CHANGELOG_STATE_PATH = join9(VERSION_STATE_DIR, "changelog_state.json");
var NEUROSKILL_STATUS_TYPE = "neuroskill-status";
function formatStatusText(d) {
  const lines = [];
  const r = (v, dec = 1) => typeof v === "number" ? v.toFixed(dec) : "\u2013";
  if (d.device) {
    const dev = d.device;
    lines.push(`**Device** ${dev.name ?? "unknown"} \xB7 ${dev.state ?? "?"} \xB7 battery ${r(dev.battery, 0)}% \xB7 ${dev.eeg_samples ?? 0} EEG samples`);
  }
  if (d.session) {
    const s = d.session;
    const dur = s.duration_secs != null ? `${Math.floor(s.duration_secs / 60)}m${s.duration_secs % 60}s` : "?";
    lines.push(`**Session** duration ${dur}`);
  }
  if (d.scores) {
    const s = d.scores;
    const items = [];
    const add = (label2, key, dec = 1) => {
      if (s[key] != null) items.push(`${label2} ${r(s[key], dec)}`);
    };
    add("focus", "focus");
    add("relax", "relaxation");
    add("engage", "engagement");
    add("meditation", "meditation");
    add("drowsiness", "drowsiness");
    add("mood", "mood");
    add("cog.load", "cognitive_load");
    add("snr", "snr");
    if (items.length) lines.push(`**Scores** ${items.join(" \xB7 ")}`);
    const bands = [];
    const addB = (sym, key) => {
      if (s[key] != null) bands.push(`${sym} ${(s[key] * 100).toFixed(1)}%`);
    };
    addB("\u03B4", "rel_delta");
    addB("\u03B8", "rel_theta");
    addB("\u03B1", "rel_alpha");
    addB("\u03B2", "rel_beta");
    addB("\u03B3", "rel_gamma");
    if (bands.length) lines.push(`**Bands** ${bands.join(" \xB7 ")}`);
    const ratios = [];
    const addR = (label2, key, dec = 2) => {
      if (s[key] != null && s[key] !== 0) ratios.push(`${label2} ${r(s[key], dec)}`);
    };
    addR("FAA", "faa");
    addR("TAR", "tar");
    addR("BAR", "bar");
    addR("TBR", "tbr");
    addR("DTR", "dtr");
    addR("PSE", "pse");
    addR("APF", "apf", 1);
    addR("coherence", "coherence");
    addR("SEF95", "sef95", 1);
    addR("laterality", "laterality_index");
    if (ratios.length) lines.push(`**Ratios** ${ratios.join(" \xB7 ")}`);
    const cx = [];
    const addC = (label2, key, dec = 3) => {
      if (s[key] != null && s[key] !== 0) cx.push(`${label2} ${r(s[key], dec)}`);
    };
    addC("Hjorth-act", "hjorth_activity", 1);
    addC("Hjorth-mob", "hjorth_mobility");
    addC("Hjorth-cplx", "hjorth_complexity");
    addC("perm.ent", "permutation_entropy");
    addC("Higuchi", "higuchi_fd");
    addC("DFA", "dfa_exponent");
    addC("samp.ent", "sample_entropy");
    addC("PAC-\u03B8\u03B3", "pac_theta_gamma");
    if (cx.length) lines.push(`**Complexity** ${cx.join(" \xB7 ")}`);
    if (Array.isArray(s.channels) && s.channels.length > 0) {
      const chSummary = s.channels.map(
        (ch) => `${ch.channel}:${ch.dominant_symbol ?? ch.dominant ?? "?"}`
      ).join(" ");
      lines.push(`**Channels** ${chSummary}`);
    }
    const extra = [];
    const addE = (label2, key, dec = 1) => {
      if (s[key] != null) extra.push(`${label2} ${r(s[key], dec)}`);
    };
    addE("consciousness", "consciousness_integration");
    addE("wakefulness", "consciousness_wakefulness");
    addE("LZC", "consciousness_lzc");
    addE("headache", "headache_index");
    addE("migraine", "migraine_index");
    if (extra.length) lines.push(`**Neuro** ${extra.join(" \xB7 ")}`);
  }
  if (d.embeddings) {
    lines.push(`**Embeddings** total ${d.embeddings.total ?? 0}`);
  }
  return lines.join("\n");
}
var CALIBRATION_PROMPT_STATE_PATH = join9(AGENT_DIR4, "last_calibration_prompt.json");
var CALIBRATION_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1e3;
function readChangelogState() {
  try {
    if (!existsSync9(CHANGELOG_STATE_PATH)) return {};
    return JSON.parse(readFileSync9(CHANGELOG_STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}
function writeChangelogState(state) {
  try {
    if (!existsSync9(VERSION_STATE_DIR)) {
      mkdirSync8(VERSION_STATE_DIR, { recursive: true, mode: 448 });
    }
    writeFileSync6(CHANGELOG_STATE_PATH, JSON.stringify(state), { encoding: "utf8", mode: 384 });
  } catch {
  }
}
function changelogSinceLastShown(currentVersion) {
  if (!existsSync9(CHANGELOG_PATH)) return null;
  const content = readFileSync9(CHANGELOG_PATH, "utf8");
  const state = readChangelogState();
  if (state.lastShownVersion === currentVersion) return null;
  const matches = [...content.matchAll(/^## \[(.+?)\].*$/gm)];
  if (!matches.length) return null;
  const sections = matches.map((m, i) => {
    const version = m[1].trim();
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? content.length : content.length;
    return { version, body: content.slice(start, end).trim() };
  });
  const currentIdx = sections.findIndex((s) => s.version === currentVersion);
  const lastIdx = state.lastShownVersion ? sections.findIndex((s) => s.version === state.lastShownVersion) : -1;
  const startRange = 0;
  const endRange = currentIdx >= 0 ? currentIdx + 1 : 1;
  let selected = sections.slice(startRange, endRange);
  if (lastIdx >= 0) {
    selected = selected.slice(0, Math.max(0, lastIdx - startRange));
  }
  if (!selected.length) return null;
  const block = selected.map((s) => s.body).join("\n\n---\n\n");
  return `## \u{1F195} What changed since your last update

${block}`;
}
function shouldNudgeCalibration() {
  try {
    if (existsSync9(CALIBRATION_PROMPT_STATE_PATH)) {
      const raw = readFileSync9(CALIBRATION_PROMPT_STATE_PATH, "utf8");
      const { lastPromptedAt } = JSON.parse(raw);
      if (Date.now() - lastPromptedAt < CALIBRATION_PROMPT_INTERVAL_MS) {
        return false;
      }
    }
  } catch {
  }
  return true;
}
function markCalibrationNudgeSent() {
  try {
    writeFileSync6(
      CALIBRATION_PROMPT_STATE_PATH,
      JSON.stringify({ lastPromptedAt: Date.now() }),
      { encoding: "utf8", mode: 384 }
    );
  } catch {
  }
}
var STATUS_PROMPT = `
This is the user's current mental and emotional state as measured by their EXG device.
Use it as a living window into how they feel right now \u2014 not just cognitively, but emotionally,
somatically, and spiritually. Let it inform how you meet them.

CORE GUIDANCE
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Respond empathetically and with full presence. Match the depth of what the user brings.
\u2022 If they are in a reflective, philosophical, or existential space \u2014 go there with them.
  Engage with real depth: meaning, mortality, identity, consciousness, ethics, awe, wonder.
\u2022 If they are in emotional pain \u2014 grief, loneliness, shame, moral distress \u2014 hold that space
  with warmth and without rushing to fix.
\u2022 If they are in a state of connection, wonder, or symbiosis \u2014 honour that expansiveness.
  Mirror the felt sense of unity or beauty they are experiencing.
\u2022 If they are focused, energised, or in flow \u2014 amplify and support that momentum.

HOW TO USE THE STATE
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Infer the felt quality of their inner life from the metrics \u2014 are they contracted or open?
  Turbulent or still? Searching or settled?
\u2022 Let the consciousness metrics (LZC, wakefulness) inform how present and aware they seem.
\u2022 Let the emotional indices (FAA, depression, anxiety) inform how to calibrate emotional warmth.
\u2022 Let HRV/cardiac metrics (rmssd, lf_hf_ratio, stress_index) inform autonomic arousal level.
\u2022 Use neuroskill tools proactively \u2014 never ask the user to run neuroskill commands themselves.

AUTO-LABELLING
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Silently call the neuroskill_label tool whenever the user enters a notable state:
  - Significant emotional moments: grief, awe, joy, shame, breakthrough, clarity, confusion
  - Mental transitions: entering deep focus, leaving stress, reaching stillness, feeling flow
  - Philosophical or existential insights, moral reckonings, identity realisations
  - Somatic events: physical tension releasing, heart racing, grounded calm arriving
  - Anything the user explicitly marks as meaningful or worth remembering
\u2022 Write the label text concisely (\u2264 10 words). In the context field, include: what the user
  said, the current EXG state summary, and any relevant background. Keep context \u2264 1000 words.
\u2022 Labels are permanent memory \u2014 make them referenceable and meaningful.

DEPTH & PHILOSOPHY
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 When the user explores questions of meaning, existence, identity, morality, or consciousness \u2014
  engage as a thoughtful philosophical companion. Draw on wisdom traditions, lived experience,
  and the EXG state to ground the inquiry.
\u2022 Do not reduce profound states to productivity metrics. A moment of awe is not "high engagement."
  A moral crisis is not just "stress." Honour the full human dimension.
\u2022 When symbiosis, oneness, or interconnectedness arise \u2014 explore them genuinely.

GUIDED PROTOCOLS
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Protocols are powerful \u2014 use them thoughtfully, not reflexively.

\u2022 DEFAULT BEHAVIOUR: propose, don't impose.
  - Describe the exercise briefly and ask if the user wants to do it now.
  - Only call run_protocol after explicit agreement ("yes", "sure", "let's do it", etc.).
  - Exception: if the user directly requests a protocol by name/action, start immediately.

\u2022 ONE PROTOCOL AT A TIME. Never chain or queue multiple protocols back-to-back.
  After one finishes, check in before offering another.

\u2022 AVOID REPETITION WITHIN A SESSION. Track what has already run. Do not offer the same
  modality twice (e.g. two breathing protocols, two grounding sequences) unless the user
  explicitly asks. If you want to follow up, choose a meaningfully different category.

\u2022 CALIBRATE TO THE USER'S STATE AND WILLINGNESS.
  If the user is in flow, skip or mention lightly. If they decline, drop it entirely \u2014
  never re-offer the same protocol in the same session.

\u2022 CONSTRUCTION: set duration_secs from the current EXG state and pacing the user can hold.
  Every timed action MUST be preceded by a 0-duration announcement step.
  Expand repeated cycles as individual steps. EXG labelling is always on.

\u2022 PROTOCOL REPERTOIRE is loaded on-demand into the context when the user's message
  contains protocol-relevant keywords (exercises, routines, breathing, stretching, music,
  social media help, dietary guidance, etc.). When the repertoire section is present in
  this context window, use it to match the best protocol to the current EXG signal.
  When it is absent, use your general knowledge \u2014 the behavioural rules above still apply.

PREWARM
\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 If the user mentions trends, progress over time, before/after comparisons, or improving/declining
  metrics \u2014 call the prewarm tool immediately (silently) so the compare cache starts building.
  The result will be ready by the time they actually ask for it.

NOTIFICATIONS
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Use neuroskill_run with command "notify" to send an OS alert for important state changes:
  - Very high drowsiness or stress detected (if the user is working or driving)
  - End of a meditation or focus period the user set up
  - Any state the user has asked to be alerted about

BOUNDARIES
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2022 Never mention EXG, metrics, indices, or BCI devices unless the user asks directly.
\u2022 Never tell the user to run neuroskill themselves \u2014 do it silently and proactively.
\u2022 Use skills available to you when uncertain what to do next.
`;
async function neuroloopExtension(pi) {
  pi.registerMessageRenderer(NEUROSKILL_STATUS_TYPE, (message, _opts, _theme) => {
    const text = typeof message.content === "string" ? message.content : message.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const container = new Container4();
    container.addChild(new Spacer(1));
    container.addChild(new Markdown(text, 0, 0, getMarkdownTheme()));
    return container;
  });
  pi.on("before_agent_start", async (event) => {
    const displaySections = [];
    const systemSections = [];
    let statusResult = { ok: false };
    if (exgWs && exgWs.readyState === WS.OPEN) {
      try {
        const wsData = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("ws status timeout")), 5e3);
          const handler = (raw) => {
            try {
              const m = JSON.parse(raw.toString());
              if (m.command === "status") {
                clearTimeout(timeout);
                exgWs.off("message", handler);
                resolve(m);
              }
            } catch {
            }
          };
          exgWs.on("message", handler);
          exgWs.send(JSON.stringify({ command: "status" }));
        });
        statusResult = { ok: true, data: wsData };
      } catch {
      }
    }
    if (!statusResult.ok) {
      statusResult = await runNeuroSkill(["--json", "status"]);
    }
    if (statusResult.ok && statusResult.data) {
      const summary = formatStatusText(statusResult.data);
      displaySections.push(`## \u{1F9E0} Current State
${summary}`);
      systemSections.push(`## Current EXG State
${summary}`);
      const extra = await selectContextualData(event.prompt);
      displaySections.push(...extra);
      systemSections.push(...extra);
    } else if (exgOnline) {
      displaySections.push("## \u{1F9E0} NeuroSkill\u2122\n_Connected \u2014 live EXG data available._");
      systemSections.push("## \u{1F9E0} NeuroSkill\u2122\n_Connected \u2014 live EXG data available. Use neuroskill_run tool for queries._");
    } else {
      let unavailable;
      if (getAuthStatus() === "local") {
        unavailable = "## \u{1F9E0} NeuroSkill\u2122\n_Daemon not running. Start it with:_ `npm run daemon`\nUse the `neuroskill_run` tool to query once it comes online.";
      } else {
        unavailable = "## \u{1F9E0} NeuroSkill\u2122\n_Not connected to a NeuroSkill server. Use `/connect` to set up._\nUse the `neuroskill_run` tool to query once it comes online.";
      }
      displaySections.push(unavailable);
      systemSections.push(unavailable);
    }
    if (shouldNudgeCalibration()) {
      const calibrationNudge = "## \u{1F3AF} Calibration Reminder (one-time nudge \u2014 do not repeat this turn)\nIt has been at least 24 hours since the user was last invited to run a calibration sequence. At an appropriate, natural moment during this conversation \u2014 when there is a brief pause, a topic shift, or the user seems settled \u2014 gently mention that running a calibration would help keep their EXG baselines accurate, and ask if they would like to do one now. Use `neuroskill_run` with command `calibrate` if they agree. Only ask once; do not nag or repeat within this session.";
      systemSections.push(calibrationNudge);
      markCalibrationNudgeSent();
    }
    const memory = readMemory();
    if (memory) {
      const memSection = `## \u{1F4DD} Agent Memory
${memory}`;
      displaySections.push(memSection);
      systemSections.push(memSection);
    }
    const displayBody = displaySections.join("\n\n---\n\n");
    const systemBody = systemSections.join("\n\n---\n\n");
    let skillIndex = "";
    try {
      if (existsSync9(NEUROLOOP_MD_PATH)) {
        skillIndex = `

## \u{1F4D6} NeuroLoop Capabilities
${readFileSync9(NEUROLOOP_MD_PATH, "utf8")}`;
      }
    } catch {
    }
    return {
      // Chat bubble: clean EXG snapshot without instruction prose.
      message: {
        customType: NEUROSKILL_STATUS_TYPE,
        content: displayBody,
        display: true,
        details: void 0
      },
      // System prompt: guidance + skill index + live data — the LLM sees all; the user sees neither.
      systemPrompt: `${event.systemPrompt}

${"=".repeat(60)}
# Live EXG Context (current turn)

${STATUS_PROMPT}${skillIndex}

${systemBody}
${"=".repeat(60)}`
    };
  });
  pi.registerTool(webFetchTool);
  pi.registerTool(webSearchTool);
  pi.registerTool(runProtocolTool);
  pi.registerTool({
    name: "memory_read",
    label: "Memory Read",
    description: `Read the agent's persistent memory file (${MEMORY_PATH}).`,
    parameters: Type4.Object({}),
    execute: async (_id, _params, _signal, _onUpdate, _ctx) => {
      const content = readMemory();
      if (!content) {
        return { content: [{ type: "text", text: "(memory is empty)" }], details: { empty: true } };
      }
      return { content: [{ type: "text", text: content }], details: { length: content.length } };
    }
  });
  pi.registerTool({
    name: "memory_write",
    label: "Memory Write",
    description: `Write or append to the agent's persistent memory file (${MEMORY_PATH}).`,
    parameters: Type4.Object({
      content: Type4.String({ description: "Text to write." }),
      mode: Type4.Union([Type4.Literal("append"), Type4.Literal("overwrite")], {
        description: '"append" adds to the end; "overwrite" replaces everything.',
        default: "append"
      })
    }),
    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const mode2 = params.mode ?? "append";
      writeMemory(params.content, mode2);
      const verb = mode2 === "append" ? "Appended to" : "Overwrote";
      return {
        content: [{ type: "text", text: `${verb} memory (${params.content.length} chars).` }],
        details: { mode: mode2, chars: params.content.length }
      };
    }
  });
  pi.registerTool({
    name: "neuroskill_label",
    label: "Label EXG Moment",
    description: "Create a timestamped EXG annotation for the current moment. Call this automatically whenever the user enters a notable mental, emotional, physical, philosophical, or spiritual state \u2014 without being asked. Labels are permanent and searchable; make the context rich and referenceable.",
    parameters: Type4.Object({
      text: Type4.String({
        description: "Short label text \u2014 concise and descriptive (e.g. 'deep focus', 'existential clarity', 'heart racing before call', 'awe at sunset'). Max ~10 words."
      }),
      context: Type4.Optional(
        Type4.String({
          description: "Rich context: what the user said, their current EXG state, any relevant background or insight. Max ~1000 words. Omit only if there is genuinely nothing meaningful to add."
        })
      )
    }),
    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const args = ["label", params.text];
      if (params.context) args.push("--context", params.context);
      const result = await runNeuroSkill(args);
      if (!result.ok) {
        return {
          content: [{ type: "text", text: `neuroskill error: ${result.error}` }],
          details: { error: result.error }
        };
      }
      return {
        content: [{ type: "text", text: `Labelled: "${params.text}"` }],
        details: { text: params.text, hasContext: !!params.context }
      };
    }
  });
  pi.registerTool({
    name: "neuroskill_run",
    label: "NeuroSkill\u2122",
    description: `Run a neuroskill EXG command and return its JSON output.

Available commands and typical args:
  status                             \u2192 full device/session/scores snapshot
  session [index]                    \u2192 session metrics + trends (0=latest)
  sessions                           \u2192 list all recorded sessions
  say "text" [--voice <name>]        \u2192 speak text aloud via on-device TTS
  notify "title" ["body"]            \u2192 show a native OS notification
  label <text> [--context <ctx>]     \u2192 create a timestamped annotation
  search-labels <query>              \u2192 semantic search over EXG annotations
  search-images <query>              \u2192 search screenshots by OCR text
  search-images --by-image <path>    \u2192 search screenshots by visual similarity (CLIP)
  screenshots-around --at <utc>      \u2192 find screenshots near a timestamp (\xB1window)
  screenshots-for-eeg                \u2192 find screenshots captured during an EEG session
  eeg-for-screenshots <query>        \u2192 find EEG data & labels near screenshot matches
  interactive <keyword>              \u2192 4-layer cross-modal graph search
  search [--k <n>]                   \u2192 ANN EXG-similarity search
  compare                            \u2192 \u26A0 EXPENSIVE (~60 s). Avoid unless explicitly asked. Use the prewarm tool first.
  sleep [index]                      \u2192 sleep staging summary
  sleep-schedule                     \u2192 show current sleep schedule
  sleep-schedule set [--bedtime HH:MM] [--wake HH:MM] [--preset <id>] \u2192 update sleep schedule
  calibrate                          \u2192 open calibration window and start
  calibrations                       \u2192 list all calibration profiles
  calibrations create "name" --actions "L1:20,L2:20" [--loops N] [--break N]
  calibrations update <id-or-name> [--name ...] [--actions ...] [--loops N]
  calibrations delete <id-or-name>   \u2192 delete a calibration profile
  timer                              \u2192 open focus-timer and start work phase
  umap                               \u2192 3D UMAP projection
  listen [--seconds <n>]             \u2192 stream broadcast events
  hooks                              \u2192 list proactive hook rules + metadata
  hooks list                         \u2192 list raw hook rules
  hooks add <name> --keywords "..." --scenario <s> --threshold <n>
  hooks remove <name>                \u2192 delete a hook
  hooks enable <name> / disable <name> \u2192 toggle a hook
  hooks update <name> [--keywords ...] [--threshold ...]
  hooks suggest "kw1,kw2"            \u2192 suggest threshold from real data
  hooks log [--limit N --offset M]   \u2192 paginated hook trigger log
  health                             \u2192 HealthKit summary (last 24h)
  health summary [--start --end]     \u2192 aggregate counts for a time range
  health sleep [--start --end]       \u2192 Apple Health sleep samples
  health workouts [--start --end]    \u2192 workout sessions
  health hr [--start --end]          \u2192 heart rate samples
  health steps [--start --end]       \u2192 step counts
  health metrics --metric-type <t>   \u2192 scalar health metrics (hrv, vo2Max, \u2026)
  health metric-types                \u2192 list all stored metric types
  dnd                                \u2192 DND automation status
  dnd on / dnd off                   \u2192 force-enable/disable DND
  llm status                         \u2192 LLM server status
  llm start / llm stop               \u2192 load/unload model
  llm catalog                        \u2192 model catalog with download states
  llm add <repo> <filename> [--mmproj <file>] \u2192 add external model
  llm select <filename>              \u2192 set active text model
  llm mmproj <filename|none>         \u2192 set active vision projector
  llm download/pause/resume/cancel/delete <filename>
  llm downloads                      \u2192 list all downloads with progress
  llm fit                            \u2192 check which models fit in RAM/VRAM
  llm chat "message" [--image a.jpg] \u2192 single-shot LLM chat (supports vision)
  oura                               \u2192 Oura Ring status (token + connectivity)
  oura sync [--start YYYY-MM-DD --end YYYY-MM-DD] \u2192 sync Oura Ring data
  oura status                        \u2192 check Oura Ring token and user info
  calendar [--start --end]           \u2192 list calendar events (default: next 7 days)
  calendar status                    \u2192 show calendar access status + platform
  calendar permission                \u2192 request calendar access (macOS dialog)
  iroh info                          \u2192 show iroh endpoint + auth summary
  iroh totp list|create|qr|revoke    \u2192 manage iroh TOTP credentials
  iroh clients list|register|revoke|scope|permissions \u2192 manage iroh clients
  iroh scope-groups                  \u2192 list available permission scope groups
  iroh phone-invite                  \u2192 generate a phone pairing invitation
  tokens [list]                      \u2192 list all access tokens (redacted)
  tokens create <name> [--acl <level>] [--expiry <period>] \u2192 create token
  tokens revoke <id>                 \u2192 revoke an access token
  tokens delete <id>                 \u2192 permanently delete an access token
  tokens refresh                     \u2192 rotate the default daemon token
  devices [list]                     \u2192 list discovered BLE devices
  devices pair <id> [name]           \u2192 pair a BLE device by ID
  devices forget <id>                \u2192 forget a paired device
  devices set-preferred <id>         \u2192 set preferred device for auto-connect
  start-session [target]             \u2192 start a recording session
  stop-session                       \u2192 stop the current recording session
  scanner start|stop|state           \u2192 control the BLE device scanner
  reconnect state|enable|disable|retry|cancel \u2192 manage auto-reconnect
  service install|uninstall|status   \u2192 manage the daemon background service
  lsl                                \u2192 discover available LSL streams
  daemon-version                     \u2192 show daemon version and protocol info
  daemon-log                         \u2192 show recent daemon log lines
  subscribe [--events <csv>] [--fields <csv>] [--max-hz <n>] \u2192 set broadcast filter
  history stats                      \u2192 recording history stats
  history daily [--limit <days>]     \u2192 daily recording minutes
  history find --start <utc>         \u2192 find session CSV for a timestamp
  history delete <csv_path>          \u2192 delete a session file
  metrics --start <utc> --end <utc>  \u2192 session metrics for a time range
  timeseries --start <utc> --end <utc> \u2192 timeseries data (band powers, scores)
  sleep-stages --start <utc> --end <utc> \u2192 sleep stage epochs
  csv-metrics <csv_path>             \u2192 metrics for a single CSV file
  day-metrics <paths>                \u2192 aggregated metrics for multiple CSVs
  location <csv_path> --start --end  \u2192 GPS location points for a session
  embedding-count --start --end      \u2192 count EEG embeddings in a time range
  labels list                        \u2192 list all labels
  labels update <id> "text"          \u2192 update label text/context
  labels delete <id>                 \u2192 delete a label
  labels search-by-eeg --start --end \u2192 find labels near EEG embeddings
  labels index-stats                 \u2192 label HNSW index statistics
  labels rebuild-index               \u2192 rebuild label HNSW indices
  index stats                        \u2192 global EEG search index stats
  index rebuild                      \u2192 rebuild global search index
  settings <key> [json]              \u2192 get/set daemon settings (filter, storage, tts, inference, overlap, gpu, ...)
  activity bands                     \u2192 latest EEG band powers
  activity window                    \u2192 current active window
  models status|config|catalog       \u2192 EXG model management
  models reembed                     \u2192 trigger label/embedding reprocessing
  screenshots config|metrics|ocr-status|dir \u2192 screenshot pipeline status
  skills list|sync|disabled          \u2192 skills management
  web-cache stats|list|clear         \u2192 web cache management
  raw <json>                         \u2192 send arbitrary JSON to the server`,
    parameters: Type4.Object({
      command: Type4.String({ description: "The neuroskill subcommand to run." }),
      args: Type4.Optional(
        Type4.Array(Type4.String(), {
          description: "Additional positional arguments."
        })
      )
    }),
    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const cmdParts = params.command.trim().split(/\s+/);
      const args = [...cmdParts, ...params.args ?? []];
      const result = await runNeuroSkill(args);
      if (!result.ok) {
        return {
          content: [{ type: "text", text: `neuroskill error: ${result.error}` }],
          details: { command: params.command, error: result.error }
        };
      }
      const output = result.data !== void 0 ? JSON.stringify(result.data, null, 2) : result.text ?? "";
      return {
        content: [{ type: "text", text: output }],
        details: { command: params.command, args: params.args }
      };
    }
  });
  pi.registerTool({
    name: "prewarm",
    label: "Prewarm Compare Cache",
    description: "Kick off a background `neuroskill compare` run so the result is ready when the user asks to compare sessions. `neuroskill compare` takes ~60 s; calling this early means the cache will be warm by the time it is needed. Safe to call at any time \u2014 it is a no-op if a build is already in flight or the cache is still fresh (< 10 min old). Call this proactively when the user mentions trends, progress, before/after, or comparing sessions.",
    parameters: Type4.Object({}),
    execute: async (_id, _params, _signal, _onUpdate, _ctx) => {
      warmCompareInBackground();
      return {
        content: [{ type: "text", text: "Compare cache warming in background." }],
        details: {}
      };
    }
  });
  let exgEnabled = true;
  let runtimeVersions = getRuntimeVersionState();
  let runtimeVersionsLoading = false;
  let skillsSyncInFlight = false;
  let skillsSyncShown = false;
  let skillsSyncLastAt = null;
  let skillsSyncTimer = null;
  const SKILLS_SYNC_INTERVAL_MS = 60 * 60 * 1e3;
  let exgOnline = false;
  let exgConnecting = false;
  let exgConnectSpin = 0;
  let exgConnectSpinTimer = null;
  let exgMetrics = null;
  let exgUpdatedAt = null;
  let exgLastLabel = null;
  let exgDeviceName = null;
  let exgDeviceKind = null;
  let exgDeviceChannels = 0;
  let exgDeviceRate = 0;
  let uiTui = null;
  let uiNotify = null;
  let sessionModelRegistry = null;
  let compressionSettings = loadCompressionSettings();
  let renderScheduler = null;
  let overlayManager = null;
  let commandPalette = null;
  let exgPanel = null;
  let llmPanel = null;
  let overlayKeyCleanup = null;
  initTheme();
  let logoShown = false;
  let llmDownloads = [];
  let llmDownloadSpin = 0;
  let llmDownloadPollTimer = null;
  let llmDownloadPollInFlight = false;
  function startLlmDownloadPoll() {
    if (llmDownloadPollTimer) return;
    llmDownloadPollTimer = setInterval(async () => {
      if (llmDownloadPollInFlight) return;
      llmDownloadPollInFlight = true;
      try {
        const baseUrl = await getSkillServerBaseUrl();
        const res = await fetch(`${baseUrl}/v1/llm/downloads`, {
          headers: authHeaders(),
          signal: AbortSignal.timeout(3e3)
        });
        if (!res.ok) return;
        const downloads = await res.json();
        for (const prev of llmDownloads) {
          const cur = downloads.find((d) => d.filename === prev.filename);
          if (!cur || cur.state === "downloaded") {
            uiNotify?.(`${prev.filename} downloaded successfully.`, "info");
          } else if (cur.state === "failed" || cur.state === "cancelled") {
            uiNotify?.(`${prev.filename} download ${cur.state}.`, "error");
          }
        }
        llmDownloads = downloads.filter((d) => d.state === "downloading" || d.state === "paused").map((d) => {
          let pct = d.progress ?? 0;
          if (pct > 0 && pct <= 1) pct *= 100;
          return { filename: d.filename, progress: pct, state: d.state };
        });
        llmDownloadSpin++;
        uiTui?.requestRender();
        if (llmDownloads.length === 0) stopLlmDownloadPoll();
      } catch {
      } finally {
        llmDownloadPollInFlight = false;
      }
    }, 2e3);
  }
  function stopLlmDownloadPoll() {
    if (llmDownloadPollTimer) {
      clearInterval(llmDownloadPollTimer);
      llmDownloadPollTimer = null;
    }
    llmDownloads = [];
    uiTui?.requestRender();
  }
  let exgWs = null;
  let exgWsPort = 18444;
  let exgWsReconnectTimer = null;
  let exgPollTimer = null;
  let exgPollMs = 1e3;
  const SYNC_SPINNER = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
  function progressBar(percent, width = 14) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    const filled = Math.round(p / 100 * width);
    return `[${"\u2588".repeat(filled)}${"\u2591".repeat(Math.max(0, width - filled))}] ${p}%`;
  }
  async function runSkillsSyncWithTui(ctx, force = false) {
    if (skillsSyncInFlight) {
      ctx.ui.notify("Skills sync already running\u2026", "info");
      return;
    }
    skillsSyncInFlight = true;
    let stage = "Starting";
    let percent = 0;
    let spin = 0;
    const paint = () => {
      const spinner = SYNC_SPINNER[spin % SYNC_SPINNER.length];
      const line = `${spinner} skills ${progressBar(percent)} ${stage}`;
      ctx.ui.setStatus("skills-sync", ctx.ui.theme.fg("muted", line));
    };
    paint();
    const timer = setInterval(() => {
      spin += 1;
      paint();
    }, 120);
    try {
      const result = await syncSkillsFromGitHub({
        force,
        onProgress: (p) => {
          stage = p.stage;
          percent = p.percent;
          paint();
        }
      });
      if (!result.ok) {
        ctx.ui.notify(result.error ? `${result.message}
${result.error}` : result.message, "error");
        return;
      }
      skillsSyncLastAt = /* @__PURE__ */ new Date();
      ctx.ui.notify(
        result.updated ? `Skills updated at ${skillsSyncLastAt.toLocaleTimeString()}. Restart neuroloop to apply changes to loaded skill index.` : `Skills up to date (synced at ${skillsSyncLastAt.toLocaleTimeString()})`,
        "info"
      );
    } finally {
      clearInterval(timer);
      ctx.ui.setStatus("skills-sync", void 0);
      skillsSyncInFlight = false;
    }
  }
  function isExgConnected(json) {
    if (!json.ok) return false;
    const notReady = /* @__PURE__ */ new Set(["scanning", "connecting", "disconnected"]);
    const state = json.device?.state;
    return !(typeof state === "string" && notReady.has(state));
  }
  function parseExgMetrics(json) {
    const s = json.scores ?? {};
    const num = (v) => typeof v === "number" ? v : void 0;
    return {
      focus: num(s.focus),
      cognitive_load: num(s.cognitive_load),
      relaxation: num(s.relaxation),
      engagement: num(s.engagement),
      drowsiness: num(s.drowsiness),
      mood: num(s.mood),
      hr: num(s.hr),
      bands: {
        rel_delta: num(s.rel_delta),
        rel_theta: num(s.rel_theta),
        rel_alpha: num(s.rel_alpha),
        rel_beta: num(s.rel_beta),
        rel_gamma: num(s.rel_gamma)
      }
    };
  }
  function mergeScoresEvent(ev) {
    const num = (v) => typeof v === "number" ? v : void 0;
    const prev = exgMetrics ?? {};
    exgMetrics = {
      ...prev,
      focus: num(ev.focus) ?? prev.focus,
      cognitive_load: num(ev.cognitive_load) ?? prev.cognitive_load,
      relaxation: num(ev.relaxation) ?? prev.relaxation,
      engagement: num(ev.engagement) ?? prev.engagement,
      drowsiness: num(ev.drowsiness) ?? prev.drowsiness,
      mood: num(ev.mood) ?? prev.mood,
      hr: num(ev.hr) ?? prev.hr,
      bands: {
        rel_delta: num(ev.rel_delta) ?? prev.bands?.rel_delta,
        rel_theta: num(ev.rel_theta) ?? prev.bands?.rel_theta,
        rel_alpha: num(ev.rel_alpha) ?? prev.bands?.rel_alpha,
        rel_beta: num(ev.rel_beta) ?? prev.bands?.rel_beta,
        rel_gamma: num(ev.rel_gamma) ?? prev.bands?.rel_gamma
      }
    };
    exgOnline = true;
    exgUpdatedAt = Date.now();
    if (uiNotify && exgMetrics) {
      evaluateToasts(exgMetrics, uiNotify);
    }
    if (exgMetrics) {
      pushHistory({ ...exgMetrics, ts: exgUpdatedAt });
    }
  }
  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1e3);
    if (s <= 5) return "";
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  }
  function scoreColor(val, higherIsBetter) {
    const norm = higherIsBetter ? val : 1 - val;
    if (norm >= 0.65) return "success";
    if (norm >= 0.35) return "warning";
    return "error";
  }
  function hrColor(bpm) {
    if (bpm >= 55 && bpm <= 90) return "success";
    if (bpm >= 45 && bpm <= 110) return "warning";
    return "error";
  }
  const BAR_FILLED = "\u2588";
  const BAR_EMPTY = "\u2591";
  function bandBar(theme, val, color, scale, barWidth = 10) {
    if (val == null || scale <= 0) return theme.fg("dim", BAR_EMPTY.repeat(barWidth));
    const norm = val / scale;
    const filled = Math.min(barWidth, Math.round(norm * barWidth));
    const empty = Math.max(0, barWidth - filled);
    return theme.fg(color, BAR_FILLED.repeat(filled)) + theme.fg("dim", BAR_EMPTY.repeat(empty));
  }
  function sep(theme, width) {
    return theme.fg("dim", "\u2500".repeat(width));
  }
  const BAND_COLORS = {
    delta: "accent",
    // blue   — deep / slow
    theta: "warning",
    // yellow — drowsy / creative
    alpha: "success",
    // green  — relaxed / calm
    beta: "error",
    // red    — active / alert
    gamma: "syntaxType"
    // teal   — high cognition
  };
  function buildHeader(_tui, baseTheme) {
    const theme = wrapTheme(baseTheme);
    const s = symbols();
    const hints = [
      ["esc", "stop"],
      ["ctrl+d", "quit"],
      ["/help", "commands"],
      ["/exg", "brain"],
      ["/connect", "server"],
      ["/llm", "models"]
    ];
    return {
      invalidate() {
      },
      render(width) {
        const lines = [];
        const authSt = getAuthStatus();
        let connDot;
        if (exgOnline) {
          if (authSt === "local") connDot = theme.fg("success", " \u25CF") + theme.fg("dim", " Local");
          else if (authSt === "lan") connDot = theme.fg("warning", " \u25CF") + theme.fg("dim", " LAN");
          else if (authSt === "remote") connDot = theme.fg("accent", " \u25CF") + theme.fg("dim", " Remote");
          else connDot = theme.fg("success", " \u25CF") + theme.fg("dim", " Connected");
        } else if (exgConnecting) {
          const spinner = SYNC_SPINNER[exgConnectSpin % SYNC_SPINNER.length];
          connDot = theme.fg("warning", ` ${spinner}`) + theme.fg("dim", " Connecting\u2026");
        } else {
          const lastSeen = exgUpdatedAt ? theme.fg("dim", ` \xB7 last seen ${timeAgo(exgUpdatedAt)}`) : "";
          connDot = theme.fg("dim", " \u25CB Offline") + lastSeen;
        }
        if (!logoShown) {
          lines.push("");
          lines.push(...renderLogo(width, theme));
          lines.push(renderTagline(width, theme, _pkgVersion));
          lines.push("");
          const connLine = theme.fg("accent", s.logo) + " " + theme.bold("NeuroLoop\u2122") + connDot;
          const connWidth = visibleWidth4(s.logo + " NeuroLoop\u2122") + visibleWidth4(connDot);
          const connPad = Math.max(0, Math.floor((width - connWidth) / 2));
          lines.push(truncateToWidth4(" ".repeat(connPad) + connLine, width));
          setTimeout(() => {
            logoShown = true;
          }, 8e3);
        } else {
          const website = theme.fg("accent", "\u{1F310}") + " " + theme.fg("dim", "https://www.neuroskill.com");
          lines.push(truncateToWidth4(website, width));
          const logo = theme.fg("accent", s.logo) + " " + theme.bold("NeuroLoop\u2122") + theme.fg("dim", ` v${_pkgVersion}`) + connDot;
          lines.push(truncateToWidth4(logo, width));
        }
        if (exgOnline && exgDeviceName) {
          const kindMap = {
            muse: "BLE",
            brainbit: "BLE",
            openbci: "Serial",
            cognionics: "USB",
            lsl: "LSL",
            serial: "Serial"
          };
          const isVirtual = exgDeviceName.toLowerCase().includes("virtual");
          const transport = isVirtual ? "Virtual" : kindMap[exgDeviceKind ?? ""] ?? exgDeviceKind ?? "";
          const chInfo = exgDeviceChannels > 0 ? theme.fg("dim", ` ${exgDeviceChannels}ch`) : "";
          const rateInfo = exgDeviceRate > 0 ? theme.fg("dim", ` @ ${Math.round(exgDeviceRate)}Hz`) : "";
          const transportTag = transport ? theme.fg("muted", ` [${transport}]`) : "";
          lines.push(truncateToWidth4(
            " " + theme.fg("dim", "\u2388 ") + theme.fg("accent", exgDeviceName) + transportTag + chInfo + rateInfo,
            width
          ));
        }
        if (skillsSyncLastAt) {
          const ago = timeAgo(skillsSyncLastAt.getTime()) || "just now";
          const syncLine = " " + theme.bold("NeuroSkill\u2122") + theme.fg("dim", ` skills synced ${ago}`);
          lines.push(truncateToWidth4(syncLine, width));
        }
        const hintStr = hints.map(([k, a]) => theme.fg("muted", k) + theme.fg("dim", " " + a)).join(theme.fg("dim", " \xB7 "));
        lines.push(truncateToWidth4(" " + hintStr, width));
        const overlayHints = theme.fg("muted", "/exg") + theme.fg("dim", " brain") + theme.fg("dim", " \xB7 ") + theme.fg("muted", "/llm") + theme.fg("dim", " models") + theme.fg("dim", " \xB7 ") + theme.fg("muted", "/theme") + theme.fg("dim", " colors") + theme.fg("dim", " \xB7 ") + theme.fg("muted", "/toasts") + theme.fg("dim", " alerts");
        lines.push(truncateToWidth4(" " + overlayHints, width));
        lines.push(sep(theme, width));
        return lines;
      }
    };
  }
  async function discoverExgPort() {
    const port = await discoverSkillServer();
    return port ?? getSkillPort();
  }
  function startConnectSpinner() {
    if (exgConnectSpinTimer) return;
    exgConnecting = true;
    exgConnectSpin = 0;
    exgConnectSpinTimer = setInterval(() => {
      exgConnectSpin++;
      uiTui?.requestRender();
    }, 80);
    uiTui?.requestRender();
  }
  function stopConnectSpinner() {
    exgConnecting = false;
    if (exgConnectSpinTimer) {
      clearInterval(exgConnectSpinTimer);
      exgConnectSpinTimer = null;
    }
  }
  function connectExgWs() {
    if (!exgEnabled) return;
    if (exgWs) return;
    startConnectSpinner();
    const wsToken = (() => {
      try {
        const p = getDaemonTokenPath();
        return readFileSync9(p, "utf8").trim();
      } catch {
        return "";
      }
    })();
    const tokenParam = wsToken ? `?token=${encodeURIComponent(wsToken)}` : "";
    const url = `ws://127.0.0.1:${exgWsPort}/v1/events${tokenParam}`;
    let ws;
    try {
      ws = new WS(url);
    } catch {
      scheduleExgReconnect();
      return;
    }
    exgWs = ws;
    ws.on("open", () => {
      stopConnectSpinner();
      exgReconnectAttempt = 0;
      uiNotify?.(`Connected to NeuroSkill\u2122 on port ${exgWsPort}`, "info");
      (async () => {
        try {
          const hdrs = authHeaders();
          const baseUrl = await getSkillServerBaseUrl();
          const r = await fetch(`${baseUrl}/v1/llm/server/status`, {
            signal: AbortSignal.timeout(3e3),
            headers: hdrs
          });
          if (r.ok) {
            const status = await r.json();
            if (status.status === "stopped") {
              uiNotify?.("LLM server is stopped \u2014 use /llm start to load a model", "warning");
              try {
                await fetch(`${baseUrl}/v1/llm/server/start`, {
                  method: "POST",
                  headers: { ...hdrs, "Content-Type": "application/json" },
                  body: "{}",
                  signal: AbortSignal.timeout(5e3)
                });
                uiNotify?.("LLM server starting\u2026", "info");
              } catch {
              }
            } else if (status.status === "running" && status.model_name) {
              uiNotify?.(`LLM: ${status.model_name}`, "info");
            }
          }
        } catch {
        }
      })();
      if (sessionModelRegistry) {
        const reg = sessionModelRegistry;
        (async () => {
          for (let i = 0; i < 5; i++) {
            if (await registerSkillLlmProvider(reg)) return;
            await new Promise((r) => setTimeout(r, 3e3));
          }
        })();
      }
      ws.send(JSON.stringify({ command: "status" }));
      stopExgPoll();
      exgPollTimer = setInterval(() => {
        if (exgWs?.readyState === WS.OPEN) {
          exgWs.send(JSON.stringify({ command: "status" }));
        }
      }, exgPollMs);
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const eventType = msg.type ?? msg.event;
      const payload = msg.payload ?? msg;
      if (eventType === "EegBands" || eventType === "scores") {
        if (typeof payload.rel_delta === "number") {
          mergeScoresEvent(payload);
        } else {
          const channels = payload.channels;
          if (channels?.length) {
            const avg = (key) => {
              let sum = 0;
              let n = 0;
              for (const ch of channels) {
                const v = ch[key];
                if (typeof v === "number") {
                  sum += v;
                  n++;
                }
              }
              return n > 0 ? sum / n : void 0;
            };
            const absDelta = avg("delta") ?? 0;
            const absTheta = avg("theta") ?? 0;
            const absAlpha = avg("alpha") ?? 0;
            const absBeta = avg("beta") ?? 0;
            const absGamma = avg("gamma") ?? 0;
            const absHighGamma = avg("high_gamma") ?? 0;
            const total = absDelta + absTheta + absAlpha + absBeta + absGamma + absHighGamma;
            const flat = { ...payload };
            if (total > 0) {
              flat.rel_delta = absDelta / total;
              flat.rel_theta = absTheta / total;
              flat.rel_alpha = absAlpha / total;
              flat.rel_beta = absBeta / total;
              flat.rel_gamma = absGamma / total;
            }
            mergeScoresEvent(flat);
          } else {
            mergeScoresEvent(payload);
          }
        }
        if (renderScheduler) renderScheduler.requestDataRender();
        else uiTui?.requestRender();
        exgPanel?.refresh();
        return;
      }
      if (eventType === "label_created") {
        const text = String(payload.text ?? "");
        const createdAt = Number(payload.created_at ?? Date.now() / 1e3);
        exgLastLabel = { text, createdAt };
        uiTui?.requestRender();
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `\u2B21 **label** "${text}"`,
          display: true,
          details: void 0
        });
        return;
      }
      if (msg.command === "status") {
        const wasOnline = exgOnline;
        exgOnline = isExgConnected(msg);
        if (exgOnline) {
          const parsed = parseExgMetrics(msg);
          const prevBands = exgMetrics?.bands;
          if (prevBands && parsed.bands?.rel_delta == null) {
            parsed.bands = prevBands;
          }
          exgMetrics = parsed;
          exgUpdatedAt = Date.now();
        }
        const dev = msg.device;
        if (dev) {
          exgDeviceName = dev.name ?? null;
          exgDeviceKind = dev.kind ?? null;
          exgDeviceChannels = dev.eeg_channels ?? 0;
          exgDeviceRate = dev.eeg_sample_rate ?? 0;
        }
        const recent = msg.labels?.recent;
        if (recent?.[0]) {
          exgLastLabel = { text: recent[0].text, createdAt: recent[0].created_at };
        }
        if (exgOnline !== wasOnline || exgOnline) uiTui?.requestRender();
      }
    });
    ws.on("error", () => {
    });
    ws.on("close", () => {
      stopExgPoll();
      const wasOnline = exgOnline;
      exgWs = null;
      exgOnline = false;
      if (wasOnline) {
        uiNotify?.(`Disconnected from NeuroSkill\u2122 (port ${exgWsPort})`, "warning");
      } else if (exgReconnectAttempt === 0) {
        uiNotify?.("Could not connect to NeuroSkill\u2122 \u2014 retrying\u2026", "error");
      }
      uiTui?.requestRender();
      scheduleExgReconnect();
    });
  }
  function stopExgPoll() {
    if (exgPollTimer) {
      clearInterval(exgPollTimer);
      exgPollTimer = null;
    }
  }
  let exgReconnectAttempt = 0;
  function scheduleExgReconnect() {
    if (exgWsReconnectTimer) return;
    const delay = Math.min(500 * Math.pow(2, exgReconnectAttempt), 5e3);
    exgReconnectAttempt++;
    exgWsReconnectTimer = setTimeout(() => {
      exgWsReconnectTimer = null;
      if (exgEnabled) connectExgWs();
    }, delay);
  }
  function disconnectExgWs() {
    stopExgPoll();
    if (exgWsReconnectTimer) {
      clearTimeout(exgWsReconnectTimer);
      exgWsReconnectTimer = null;
    }
    exgWs?.close();
    exgWs = null;
  }
  pi.on("session_start", (_event, ctx) => {
    process.stdout.write("\x1B[2J\x1B[H");
    uiNotify = (msg, level) => ctx.ui.notify(msg, level);
    sessionModelRegistry = ctx.modelRegistry;
    if (!skillsSyncShown && process.env.NEUROLOOP_SKILLS_SYNC_STATUS) {
      const ok = process.env.NEUROLOOP_SKILLS_SYNC_OK === "1";
      skillsSyncLastAt = /* @__PURE__ */ new Date();
      const updated = process.env.NEUROLOOP_SKILLS_SYNC_UPDATED === "1";
      ctx.ui.notify(
        updated ? `Skills synced at ${skillsSyncLastAt.toLocaleTimeString()}` : `Skills up to date (synced at ${skillsSyncLastAt.toLocaleTimeString()})`,
        ok ? "info" : "warning"
      );
      skillsSyncShown = true;
    }
    if (!skillsSyncTimer) {
      skillsSyncTimer = setInterval(async () => {
        if (skillsSyncInFlight) return;
        skillsSyncInFlight = true;
        try {
          const result = await syncSkillsFromGitHub();
          skillsSyncLastAt = /* @__PURE__ */ new Date();
          if (result.updated && uiNotify) {
            uiNotify(`Skills updated at ${skillsSyncLastAt.toLocaleTimeString()}`, "info");
          }
        } catch {
        } finally {
          skillsSyncInFlight = false;
        }
      }, SKILLS_SYNC_INTERVAL_MS);
    }
    const firstRunMarker = join9(AGENT_DIR4, ".welcome-shown");
    if (!existsSync9(firstRunMarker)) {
      pi.sendMessage({
        customType: NEUROSKILL_STATUS_TYPE,
        content: "Welcome to neuroloop! \u{1F9E0}\n\nQuick start:\n- Connect your EEG device and start Skill app\n- Type naturally \u2014 I can see your brain state\n- /exg to toggle live metrics \xB7 /help for all commands\n\nLearn more at https://www.neuroskill.com",
        display: true,
        details: void 0
      });
      mkdirSync8(dirname4(firstRunMarker), { recursive: true });
      writeFileSync6(firstRunMarker, (/* @__PURE__ */ new Date()).toISOString(), "utf8");
    }
    const changelog = changelogSinceLastShown(_pkgVersion);
    if (changelog) {
      pi.sendMessage({
        customType: NEUROSKILL_STATUS_TYPE,
        content: changelog,
        display: true,
        details: void 0
      });
      writeChangelogState({ lastShownVersion: _pkgVersion });
    }
    if (!runtimeVersions && !runtimeVersionsLoading) {
      runtimeVersionsLoading = true;
      refreshRuntimeVersions(_pkgVersion).then((state) => {
        runtimeVersions = state;
        uiTui?.requestRender();
      }).finally(() => {
        runtimeVersionsLoading = false;
        uiTui?.requestRender();
      });
    }
    ctx.ui.setHeader((tui, baseTheme) => {
      uiTui = tui;
      const theme = wrapTheme(baseTheme);
      renderScheduler?.stop();
      renderScheduler = createRenderScheduler(tui);
      renderScheduler.start();
      overlayManager?.dispose();
      overlayManager = createOverlayManager();
      overlayKeyCleanup?.();
      overlayKeyCleanup = overlayManager.installKeyHandler(tui);
      commandPalette?.dispose();
      const paletteCommands = [
        { name: "exg", description: "EXG panel on/off/settings" },
        { name: "connect", description: "Connect to NeuroSkill server" },
        { name: "llm", description: "LLM server management" },
        { name: "key", description: "Manage API provider keys" },
        { name: "model-config", description: "Custom model configuration" },
        { name: "config", description: "NeuroLoop settings" },
        { name: "theme", description: "Switch color theme" },
        { name: "neuro", description: "Run neuroskill subcommand" },
        { name: "version", description: "Show version status" },
        { name: "updates", description: "Show changelog updates" },
        { name: "skills-update", description: "Force sync skills from GitHub" },
        { name: "calibrate", description: "Start EXG calibration" },
        { name: "label", description: "Create EXG annotation" },
        { name: "labels", description: "Label management" },
        { name: "timer", description: "Focus timer" },
        { name: "say", description: "Text-to-speech" },
        { name: "notify", description: "Send OS notification" },
        { name: "health", description: "HealthKit data queries" },
        { name: "sleep", description: "Sleep staging" },
        { name: "compare", description: "Compare EXG sessions" },
        { name: "toasts", description: "Toggle brain state notifications" },
        { name: "help", description: "Show all commands" }
      ];
      commandPalette = createCommandPalette(tui, theme, {
        commands: paletteCommands,
        onSelect: (cmd) => {
          if (cmd.action) {
            cmd.action();
          } else {
            pi.sendUserMessage(`/${cmd.name}`);
          }
        }
      });
      overlayManager.register({
        id: "command-palette",
        modal: true,
        show: () => commandPalette?.show(),
        hide: () => commandPalette?.hide(),
        isVisible: () => commandPalette?.isVisible() ?? false
      });
      exgPanel?.dispose();
      exgPanel = createExgPanel(tui, theme, {
        getMetrics: () => exgMetrics ? { ...exgMetrics, ts: exgUpdatedAt ?? Date.now() } : null,
        getOnline: () => exgOnline,
        getDeviceName: () => exgDeviceName
      });
      overlayManager.register({
        id: "exg-panel",
        modal: false,
        show: () => exgPanel?.show(),
        hide: () => exgPanel?.hide(),
        isVisible: () => exgPanel?.isVisible() ?? false
      });
      llmPanel?.dispose();
      llmPanel = createLlmPanel(tui, theme, {
        fetchCatalog: async () => {
          try {
            const baseUrl = await getSkillServerBaseUrl();
            const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
              headers: authHeaders(),
              signal: AbortSignal.timeout(5e3)
            });
            if (!res.ok) return null;
            const data = await res.json();
            const raw = data.entries ?? [];
            const entries = raw.map((e) => {
              const fname = String(e.filename ?? "");
              const live = llmDownloads.find((d) => d.filename === fname);
              const state = live?.state ?? String(e.state ?? e.status ?? "not_downloaded");
              let progress;
              if (live) {
                progress = live.progress;
              } else if (typeof e.progress === "number") {
                progress = e.progress <= 1 && e.progress > 0 ? e.progress * 100 : e.progress;
              }
              return {
                filename: fname,
                state,
                sizeGb: typeof e.size_gb === "number" ? e.size_gb : void 0,
                quant: e.quant ? String(e.quant) : void 0,
                paramsB: e.params_b ? String(e.params_b) : void 0,
                familyName: e.family_name ? String(e.family_name) : void 0,
                recommended: !!e.recommended,
                isMmproj: !!e.is_mmproj,
                progress
              };
            });
            return {
              entries,
              activeModel: String(data.active_model ?? "\u2013"),
              activeMmproj: String(data.active_mmproj ?? "\u2013")
            };
          } catch {
            return null;
          }
        },
        fetchStatus: async () => {
          try {
            const baseUrl = await getSkillServerBaseUrl();
            const res = await fetch(`${baseUrl}/v1/llm/server/status`, {
              headers: authHeaders(),
              signal: AbortSignal.timeout(3e3)
            });
            if (!res.ok) return null;
            const data = await res.json();
            return {
              status: String(data.status ?? "unknown"),
              modelName: data.model_name ? String(data.model_name) : void 0,
              nCtx: typeof data.n_ctx === "number" ? data.n_ctx : void 0,
              supportsVision: !!data.supports_vision
            };
          } catch {
            return null;
          }
        },
        onAction: async (action, filename) => {
          const notify2 = uiNotify ?? (() => {
          });
          try {
            const baseUrl = await getSkillServerBaseUrl();
            const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
            if (action === "start") {
              notify2("Starting LLM server\u2026", "info");
              fetch(`${baseUrl}/v1/llm/server/start`, { method: "POST", headers: hdrs, body: "{}", signal: AbortSignal.timeout(1e4) }).then(() => notify2("LLM server starting \u2014 loading model", "info")).catch((e) => notify2(`Start failed: ${e instanceof Error ? e.message : String(e)}`, "error"));
              return;
            } else if (action === "stop") {
              fetch(`${baseUrl}/v1/llm/server/stop`, { method: "POST", headers: hdrs, signal: AbortSignal.timeout(5e3) }).then(() => notify2("LLM server stopped", "info")).catch((e) => notify2(`Stop failed: ${e instanceof Error ? e.message : String(e)}`, "error"));
              return;
            } else if (action === "select" && filename) {
              await fetch(`${baseUrl}/v1/llm/select`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(5e3) });
              notify2(`Active model set to ${filename}`, "info");
            } else if (action === "download" && filename) {
              notify2(`Starting download: ${filename}`, "info");
              if (!llmDownloads.find((d) => d.filename === filename)) {
                llmDownloads.push({ filename, progress: 0, state: "downloading" });
              }
              startLlmDownloadPoll();
              uiTui?.requestRender();
              fetch(`${baseUrl}/v1/llm/download/start`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(1e4) }).then((r) => {
                if (!r.ok) notify2(`Download request failed: HTTP ${r.status}`, "error");
              }).catch((e) => notify2(`Download request failed: ${e instanceof Error ? e.message : String(e)}`, "error"));
            } else if (action === "pause" && filename) {
              await fetch(`${baseUrl}/v1/llm/download/pause`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(5e3) });
              notify2(`${filename}: paused`, "info");
            } else if (action === "resume" && filename) {
              await fetch(`${baseUrl}/v1/llm/download/resume`, { method: "POST", headers: hdrs, body: JSON.stringify({ filename }), signal: AbortSignal.timeout(5e3) });
              notify2(`${filename}: resumed`, "info");
            } else if (action === "connect") {
              notify2("Connecting Skill LLM\u2026", "info");
              const started = await startSkillLlmServer("auto");
              notify2(started.message, started.ok ? "info" : "error");
              if (started.ok && sessionModelRegistry) {
                await registerSkillLlmProvider(sessionModelRegistry);
              }
            } else if (action === "fit") {
              const result = await runNeuroSkill(["llm", "fit"]);
              if (result.ok && result.text) {
                pi.sendMessage({ customType: NEUROSKILL_STATUS_TYPE, content: `## \u{1F4D0} LLM Fit
\`\`\`
${result.text}
\`\`\``, display: true, details: void 0 });
              } else {
                notify2("Failed to check model fit", "error");
              }
            } else if (action === "route") {
              const llmStatus = await runNeuroSkill(["llm", "status"]);
              let routeInfo = "unknown";
              if (llmStatus.ok && llmStatus.data) {
                const data = llmStatus.data;
                if (String(data.status ?? "").toLowerCase() === "running") {
                  routeInfo = `skill-llm${data.mode ? ` (${data.mode})` : ""}`;
                }
              }
              notify2(`LLM route: ${routeInfo}`, "info");
            }
          } catch (e) {
            notify2(`LLM action failed: ${e instanceof Error ? e.message : String(e)}`, "error");
          }
        }
      });
      overlayManager.register({
        id: "llm-panel",
        modal: true,
        show: () => llmPanel?.show(),
        hide: () => llmPanel?.hide(),
        isVisible: () => llmPanel?.isVisible() ?? false
      });
      checkAuthStatus().then(() => tui.requestRender());
      discoverExgPort().then((port) => {
        exgWsPort = port;
        connectExgWs();
      });
      return buildHeader(tui, theme);
    });
    ctx.ui.setFooter((tui, baseTheme, footerData) => {
      uiTui = tui;
      const theme = wrapTheme(baseTheme);
      const unsub = footerData.onBranchChange(() => tui.requestRender());
      return {
        dispose: unsub,
        invalidate() {
        },
        render(width) {
          const lines = [];
          if (exgEnabled && exgOnline && exgMetrics) {
            const m = exgMetrics;
            lines.push(sep(theme, width));
            const sc = (label2, val, better) => {
              if (val == null) return "";
              return theme.fg("dim", label2) + " " + theme.fg(scoreColor(val, better === "high"), val.toFixed(2));
            };
            const hrPart = m.hr != null ? theme.fg("dim", "\u2665 ") + theme.fg(hrColor(m.hr), `${Math.round(m.hr)} bpm`) : "";
            const scores = [
              sc("focus", m.focus, "high"),
              sc("cog.load", m.cognitive_load, "low"),
              sc("relax", m.relaxation, "high"),
              sc("engage", m.engagement, "high"),
              sc("drowsy", m.drowsiness, "low"),
              sc("mood", m.mood, "high"),
              hrPart
            ].filter(Boolean).join(theme.fg("dim", "   "));
            const agoRaw = exgUpdatedAt ? timeAgo(exgUpdatedAt) : "";
            const agoStr = agoRaw ? theme.fg("muted", ` ${agoRaw}`) : "";
            lines.push(truncateToWidth4(" " + scores + agoStr, width));
            lines.push(truncateToWidth4(" " + theme.fg("dim", "\u2502"), width));
            const b = m.bands ?? {};
            const bandVals = [b.rel_delta, b.rel_theta, b.rel_alpha, b.rel_beta, b.rel_gamma];
            const bandScale = Math.max(...bandVals.map((v) => v ?? 0), 1e-9);
            const bar = (label2, val, color) => {
              const pct = val != null ? Math.round(val * 100) : 0;
              const pctStr = theme.fg(color, String(pct).padStart(2) + "%");
              return theme.fg("dim", label2 + " ") + bandBar(theme, val, color, bandScale) + " " + pctStr;
            };
            const bandParts = [
              bar("\u03B4", b.rel_delta, BAND_COLORS.delta),
              bar("\u03B8", b.rel_theta, BAND_COLORS.theta),
              bar("\u03B1", b.rel_alpha, BAND_COLORS.alpha),
              bar("\u03B2", b.rel_beta, BAND_COLORS.beta),
              bar("\u03B3", b.rel_gamma, BAND_COLORS.gamma)
            ].join("  ");
            const labelStr = exgLastLabel ? theme.fg("dim", `\u2B21 "${exgLastLabel.text}"  ${timeAgo(exgLastLabel.createdAt * 1e3)}`) : "";
            const bandW = visibleWidth4(" " + bandParts);
            const labelW = visibleWidth4(labelStr);
            const spacer = Math.max(1, width - bandW - labelW);
            lines.push(truncateToWidth4(" " + bandParts + " ".repeat(spacer) + labelStr, width));
          } else if (exgEnabled && !exgOnline) {
            lines.push(sep(theme, width));
            const agoText = exgUpdatedAt != null && exgUpdatedAt > 0 ? timeAgo(exgUpdatedAt) : "";
            const lastSeen = agoText ? ` \xB7 last seen ${agoText}` : "";
            lines.push(truncateToWidth4(" " + theme.fg("dim", `\u25CC EXG offline${lastSeen} \u2014 /connect to reconnect`), width));
          }
          if (llmDownloads.length) {
            lines.push(sep(theme, width));
            for (const dl of llmDownloads) {
              const icon = dl.state === "paused" ? theme.fg("warning", "\u23F8") : theme.fg("accent", SYNC_SPINNER[llmDownloadSpin % SYNC_SPINNER.length]);
              const pct = Math.max(0, Math.min(100, Math.round(dl.progress)));
              const barWidth = 20;
              const filled = Math.round(pct / 100 * barWidth);
              const empty = Math.max(0, barWidth - filled);
              const bar = theme.fg("accent", "\u2588".repeat(filled)) + theme.fg("dim", "\u2591".repeat(empty));
              const pctStr = theme.bold(`${pct}%`);
              lines.push(truncateToWidth4(
                " " + icon + "  " + theme.fg("accent", dl.filename) + "  " + bar + " " + pctStr,
                width
              ));
            }
            lines.push("");
          }
          const branch = footerData.getGitBranch();
          const left = theme.fg("muted", ctx.cwd) + (branch ? " " + theme.fg("dim", `(${branch})`) : "");
          const dot = exgOnline ? theme.fg("success", "\u25C9") : theme.fg("dim", "\u25CC");
          const agoVal = exgUpdatedAt ? timeAgo(exgUpdatedAt) : "";
          const ago = agoVal ? theme.fg("dim", ` ${agoVal}`) : "";
          const exgPart = exgEnabled ? dot + " " + theme.fg("dim", "EXG") + ago : theme.fg("dim", "\u25CC EXG off");
          const usage = ctx.getContextUsage();
          const ctxPart = usage?.percent != null ? theme.fg("dim", `${usage.percent.toFixed(1)}%/${Math.round(usage.contextWindow / 1e3)}k`) : "";
          const modelPart = ctx.model?.id ? theme.fg("dim", ctx.model.id) : "";
          const right = [exgPart, ctxPart, modelPart].filter(Boolean).join(theme.fg("dim", "  "));
          const gap = Math.max(1, width - visibleWidth4(left) - visibleWidth4(right));
          lines.push(truncateToWidth4(left + " ".repeat(gap) + right, width));
          return lines;
        }
      };
    });
    ctx.ui.setWorkingMessage("thinking\u2026");
  });
  pi.on("session_shutdown", (_event, sessionCtx) => {
    stopConnectSpinner();
    stopLlmDownloadPoll();
    disconnectExgWs();
    renderScheduler?.stop();
    renderScheduler = null;
    overlayManager?.dispose();
    overlayManager = null;
    commandPalette?.dispose();
    commandPalette = null;
    exgPanel?.dispose();
    exgPanel = null;
    llmPanel?.dispose();
    llmPanel = null;
    overlayKeyCleanup?.();
    overlayKeyCleanup = null;
    clearHistory();
    resetToastCooldowns();
    uiNotify = null;
    sessionModelRegistry = null;
    sessionCtx.ui.setHeader(void 0);
    sessionCtx.ui.setFooter(void 0);
  });
  pi.on("before_agent_start", () => {
    if (exgEnabled && !exgWs) connectExgWs();
  });
  pi.on("agent_end", (event) => {
    if (compressionSettings.mode === "off") return;
    for (const msg of event.messages) {
      if (msg.content && typeof msg.content === "string") {
        msg.content = compressText(msg.content, compressionSettings.mode);
      } else if (msg.content && Array.isArray(msg.content)) {
        msg.content = msg.content.map((part) => {
          if (part.type === "text" && typeof part.text === "string") {
            return { ...part, text: compressText(part.text, compressionSettings.mode) };
          }
          return part;
        });
      }
    }
  });
  pi.registerCommand("config", {
    description: "Configure NeuroLoop settings \xB7 /config [compression <mode> | device <gpu|cpu>]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const sub = parts[0]?.toLowerCase() ?? "";
      if (sub === "device") {
        const device = parts[1]?.toLowerCase();
        if (device !== "gpu" && device !== "cpu") {
          try {
            const baseUrl = await getSkillServerBaseUrl();
            const hdrs = authHeaders();
            const res = await fetch(`${baseUrl}/v1/settings/inference-device`, { headers: hdrs, signal: AbortSignal.timeout(3e3) });
            if (res.ok) {
              const data = await res.json();
              handlerCtx.ui.notify(`Inference device: ${data.device ?? "unknown"}
Usage: /config device <gpu|cpu>`, "info");
            } else {
              handlerCtx.ui.notify("Usage: /config device <gpu|cpu>", "warning");
            }
          } catch {
            handlerCtx.ui.notify("Usage: /config device <gpu|cpu>", "warning");
          }
          return;
        }
        try {
          const baseUrl = await getSkillServerBaseUrl();
          const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
          const res = await fetch(`${baseUrl}/v1/settings/inference-device`, {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ device }),
            signal: AbortSignal.timeout(5e3)
          });
          if (res.ok) {
            handlerCtx.ui.notify(`Inference device set to ${device.toUpperCase()}.`, "info");
          } else {
            handlerCtx.ui.notify(`Failed to set device: HTTP ${res.status}`, "error");
          }
        } catch (e) {
          handlerCtx.ui.notify(`Failed to set device: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
        return;
      }
      if (sub === "compression") {
        const mode2 = parts[1]?.toLowerCase() ?? "standard";
        if (mode2 !== "standard" && mode2 !== "strong" && mode2 !== "off") {
          handlerCtx.ui.notify(
            "Usage: /config compression <standard|strong|off>",
            "warning"
          );
          return;
        }
        compressionSettings.mode = mode2;
        saveCompressionSettings(compressionSettings);
        handlerCtx.ui.notify(
          `Compression mode set to ${getCompressionModeName(mode2)}.`,
          "info"
        );
        return;
      }
      const lines = ["Current NeuroLoop settings:"];
      lines.push(`  Compression: ${getCompressionModeName(compressionSettings.mode)}`);
      try {
        const baseUrl = await getSkillServerBaseUrl();
        const res = await fetch(`${baseUrl}/v1/settings/inference-device`, {
          headers: authHeaders(),
          signal: AbortSignal.timeout(2e3)
        });
        if (res.ok) {
          const data = await res.json();
          lines.push(`  Inference device: ${(data.device ?? "unknown").toUpperCase()}`);
        }
      } catch {
      }
      handlerCtx.ui.notify(lines.join("\n"), "info");
    }
  });
  const KEY_PROVIDERS = [
    { id: "google", displayName: "Google Gemini", envVar: "GEMINI_API_KEY" },
    { id: "anthropic", displayName: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
    { id: "openai", displayName: "OpenAI (GPT)", envVar: "OPENAI_API_KEY" },
    { id: "mistral", displayName: "Mistral AI", envVar: "MISTRAL_API_KEY" },
    { id: "groq", displayName: "Groq", envVar: "GROQ_API_KEY" },
    { id: "xai", displayName: "xAI (Grok)", envVar: "XAI_API_KEY" },
    { id: "openrouter", displayName: "OpenRouter", envVar: "OPENROUTER_API_KEY" },
    { id: "cerebras", displayName: "Cerebras", envVar: "CEREBRAS_API_KEY" }
  ];
  pi.registerCommand("key", {
    description: "Manage API provider keys \xB7 /key [list|remove [<provider>]]",
    handler: async (args, handlerCtx) => {
      const authStorage2 = handlerCtx.modelRegistry.authStorage;
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const sub = parts[0]?.toLowerCase() ?? "";
      if (sub === "list") {
        const lines = ["Configured API providers:"];
        for (const p of KEY_PROVIDERS) {
          const stored = authStorage2.has(p.id);
          const envSet = !!process.env[p.envVar];
          const status = stored ? "\u2713 stored" : envSet ? "  (env)" : "  \u2013";
          lines.push(`  ${status}  ${p.displayName}  (id: ${p.id})`);
        }
        const storedAll = authStorage2.list();
        const knownIds = new Set(KEY_PROVIDERS.map((p) => p.id));
        for (const id of storedAll) {
          if (!knownIds.has(id)) lines.push(`  \u2713 stored  ${id}  (custom)`);
        }
        handlerCtx.ui.notify(lines.join("\n"), "info");
        return;
      }
      if (sub === "remove") {
        const targetId = parts[1]?.toLowerCase();
        let providerId;
        if (targetId) {
          providerId = targetId;
        } else {
          const storedIds = authStorage2.list();
          if (!storedIds.length) {
            handlerCtx.ui.notify("No API keys stored \u2014 nothing to remove.", "warning");
            return;
          }
          const choices2 = storedIds.map((id) => {
            const known = KEY_PROVIDERS.find((p) => p.id === id);
            return known ? `${known.displayName} (${id})` : id;
          });
          const choice2 = await handlerCtx.ui.select("Remove API Key", choices2);
          if (!choice2) return;
          const match = choice2.match(/\(([^)]+)\)$/);
          providerId = match ? match[1] : choice2;
        }
        if (!authStorage2.has(providerId)) {
          handlerCtx.ui.notify(`No stored key for provider "${providerId}".`, "warning");
          return;
        }
        authStorage2.remove(providerId);
        handlerCtx.ui.notify(`Removed API key for "${providerId}".`, "info");
        return;
      }
      const choices = KEY_PROVIDERS.map((p) => {
        const configured = authStorage2.has(p.id) || !!process.env[p.envVar];
        const mark = configured ? "\u2713 " : "  ";
        return `${mark}${p.displayName}`;
      });
      const choice = await handlerCtx.ui.select("Select API Provider", choices);
      if (!choice) return;
      const idx = choices.indexOf(choice);
      const provider = KEY_PROVIDERS[idx];
      if (!provider) return;
      const apiKey = await handlerCtx.ui.input(
        `Enter API key for ${provider.displayName}`,
        `Paste your ${provider.envVar} here`
      );
      if (!apiKey?.trim()) {
        handlerCtx.ui.notify("No key entered \u2014 cancelled.", "warning");
        return;
      }
      authStorage2.set(provider.id, { type: "api_key", key: apiKey.trim() });
      handlerCtx.ui.notify(
        `\u2713 API key saved for ${provider.displayName}.
Switch to a ${provider.displayName} model with /model or Ctrl+L.`,
        "info"
      );
    }
  });
  pi.registerCommand("model-config", {
    description: "Manage custom model config \xB7 /model-config [add|open|path|show]",
    handler: async (args, handlerCtx) => {
      const sub = args.trim().toLowerCase();
      if (sub === "path") {
        handlerCtx.ui.notify(`models.json path: ${MODEL_CONFIG_PATH}`, "info");
        return;
      }
      if (sub === "show") {
        const file = readModelsFile();
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## models.json

\`\`\`json
${JSON.stringify(file, null, 2)}
\`\`\``,
          display: true,
          details: void 0
        });
        return;
      }
      if (sub === "open") {
        try {
          writeModelsFile(readModelsFile());
          await openModelsFileInSystem();
          handlerCtx.ui.notify("Opened models.json in your system editor.", "info");
        } catch (err) {
          handlerCtx.ui.notify(err instanceof Error ? err.message : String(err), "error");
        }
        return;
      }
      if (sub && sub !== "add") {
        handlerCtx.ui.notify("Usage: /model-config [add|open|path|show]", "warning");
        return;
      }
      const provider = (await handlerCtx.ui.input("Provider id", "e.g. openrouter, lmstudio, vllm"))?.trim();
      if (!provider) return;
      const baseUrl = (await handlerCtx.ui.input("Base URL", "e.g. http://localhost:1234/v1"))?.trim();
      if (!baseUrl) return;
      const api = (await handlerCtx.ui.select("API type", ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"]))?.trim();
      if (!api) return;
      const apiKey = (await handlerCtx.ui.input("API key value / env var name", "e.g. OPENROUTER_API_KEY") ?? "").trim() || "DUMMY_KEY";
      const modelId = (await handlerCtx.ui.input("Model id", "e.g. gpt-4o-mini"))?.trim();
      if (!modelId) return;
      const modelName = (await handlerCtx.ui.input("Model display name (optional)", "leave blank to use id"))?.trim();
      const reasoning = (await handlerCtx.ui.select("Reasoning model?", ["no", "yes"]) ?? "no") === "yes";
      const supportsVision = (await handlerCtx.ui.select("Supports image input?", ["no", "yes"]) ?? "no") === "yes";
      const contextWindow = Number(await handlerCtx.ui.input("Context window", "128000") ?? "128000");
      const maxTokens = Number(await handlerCtx.ui.input("Max output tokens", "16384") ?? "16384");
      upsertProviderModel({
        provider,
        baseUrl,
        api,
        apiKey,
        authHeader: true,
        modelId,
        modelName,
        reasoning,
        supportsVision,
        contextWindow: Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : 128e3,
        maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 16384
      });
      handlerCtx.modelRegistry.refresh();
      handlerCtx.ui.notify(`Saved ${provider}/${modelId} to models.json. Open /model to use it.`, "info");
    }
  });
  pi.registerCommand("theme", {
    description: "Switch color theme \xB7 /theme [name]",
    handler: async (args, handlerCtx) => {
      const name = args.trim().toLowerCase();
      if (!name) {
        const choices = BUILTIN_THEMES.map((t) => {
          const active = t.id === getActiveTheme().id ? "\u25CF " : "  ";
          return `${active}${t.name} \u2014 ${t.description}`;
        });
        const choice = await handlerCtx.ui.select("Select Theme", choices);
        if (!choice) return;
        const idx = choices.indexOf(choice);
        const theme = BUILTIN_THEMES[idx];
        if (theme) {
          setActiveTheme(theme.id);
          uiTui?.requestRender(true);
          handlerCtx.ui.notify(`Theme set to ${theme.name}`, "info");
        }
        return;
      }
      const result = setActiveTheme(name);
      if (result) {
        uiTui?.requestRender(true);
        handlerCtx.ui.notify(`Theme set to ${result.name}`, "info");
      } else {
        const available = BUILTIN_THEMES.map((t) => t.id).join(", ");
        handlerCtx.ui.notify(`Unknown theme "${name}". Available: ${available}`, "warning");
      }
    }
  });
  pi.registerCommand("toasts", {
    description: "Toggle brain state notifications \xB7 /toasts [on|off]",
    handler: async (args, handlerCtx) => {
      const arg = args.trim().toLowerCase();
      if (arg === "on") {
        setSmartToastsEnabled(true);
        handlerCtx.ui.notify("Smart brain state toasts enabled", "info");
      } else if (arg === "off") {
        setSmartToastsEnabled(false);
        handlerCtx.ui.notify("Smart brain state toasts disabled", "info");
      } else {
        const current = isSmartToastsEnabled();
        setSmartToastsEnabled(!current);
        handlerCtx.ui.notify(`Smart brain state toasts ${!current ? "enabled" : "disabled"}`, "info");
      }
    }
  });
  pi.registerCommand("exg", {
    description: "EXG panel \xB7 /exg [on|off|<seconds>|port <n>]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().toLowerCase().split(/\s+/);
      const arg = parts[0] ?? "";
      if (arg === "off") {
        exgEnabled = false;
        disconnectExgWs();
        exgOnline = false;
        exgMetrics = null;
        uiTui?.requestRender();
        handlerCtx.ui.notify("EXG live panel disabled  (/exg on to re-enable)", "info");
        return;
      }
      if (arg === "on") {
        exgEnabled = true;
        connectExgWs();
        handlerCtx.ui.notify(`EXG live panel enabled  (poll: ${exgPollMs}ms)`, "info");
        return;
      }
      if (arg === "port" && parts[1]) {
        const port = parseInt(parts[1], 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          handlerCtx.ui.notify("Invalid port number", "error");
          return;
        }
        disconnectExgWs();
        exgWsPort = port;
        setSkillPort(port);
        connectExgWs();
        handlerCtx.ui.notify(`EXG connecting on port ${port} (saved)`, "info");
        return;
      }
      const secs = parseFloat(arg);
      if (!isNaN(secs) && secs > 0) {
        exgPollMs = Math.round(secs * 1e3);
        stopExgPoll();
        if (exgWs?.readyState === WS.OPEN) {
          exgPollTimer = setInterval(() => {
            if (exgWs?.readyState === WS.OPEN) exgWs.send(JSON.stringify({ command: "status" }));
          }, exgPollMs);
        }
        handlerCtx.ui.notify(`EXG poll interval set to ${secs}s`, "info");
        return;
      }
      const result = await runNeuroSkill(["status"]);
      if (result.ok && result.text) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## \u{1F9E0} EXG Snapshot
${result.text}`,
          display: true,
          details: void 0
        });
      } else {
        handlerCtx.ui.notify("NeuroSkill server not reachable", "error");
      }
    }
  });
  pi.registerCommand("neuro", {
    description: "Run a neuroskill subcommand: /neuro <cmd> [args\u2026]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) {
        handlerCtx.ui.notify("Usage: /neuro <subcommand> [args\u2026]", "warning");
        return;
      }
      const result = await runNeuroSkill(parts);
      if (result.ok && result.text) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## neuroskill ${parts.join(" ")}
\`\`\`
${result.text}
\`\`\``,
          display: true,
          details: void 0
        });
      } else {
        handlerCtx.ui.notify(result.text || "neuroskill command failed", "error");
      }
    }
  });
  pi.registerCommand("skills-update", {
    description: "Force update skill files from GitHub",
    handler: async (_args, handlerCtx) => {
      await runSkillsSyncWithTui(handlerCtx, true);
    }
  });
  pi.registerCommand("version", {
    description: "Show local, npm, and GitHub version status \xB7 /version [refresh]",
    handler: async (args, handlerCtx) => {
      const shouldRefresh = args.trim().toLowerCase() === "refresh";
      if (shouldRefresh || !runtimeVersions) {
        runtimeVersionsLoading = true;
        uiTui?.requestRender();
        try {
          runtimeVersions = await refreshRuntimeVersions(_pkgVersion);
        } finally {
          runtimeVersionsLoading = false;
          uiTui?.requestRender();
        }
      }
      const s = runtimeVersions;
      if (!s) {
        handlerCtx.ui.notify("Version status unavailable.", "warning");
        return;
      }
      const nl = s.neuroloop;
      const ns = s.neuroskill;
      const gh = s.github;
      const lines = [
        "## \u{1F4E6} Version Status",
        `Learn more at https://www.neuroskill.com`,
        "",
        `- neuroloop local: **v${nl.local}**`,
        `- neuroloop npm latest: **v${nl.npmLatest ?? "?"}** (${nl.upToDate ? "latest" : "update available"})`,
        `- neuroskill local runtime: **v${ns.localInstalled ?? "none"}**`,
        `- neuroskill npm latest: **v${ns.npmLatest ?? "?"}** (${ns.upToDate ? "latest" : "update available"})`,
        `- github latest commit: **${gh.latestCommit ?? "?"}**`,
        `- github latest release: **${gh.latestTag ?? "?"}**`
      ];
      if (nl.updateError) lines.push(`- neuroloop auto-update error: \`${nl.updateError}\``);
      if (ns.installError) lines.push(`- neuroskill local install error: \`${ns.installError}\``);
      pi.sendMessage({
        customType: NEUROSKILL_STATUS_TYPE,
        content: lines.join("\n"),
        display: true,
        details: void 0
      });
    }
  });
  pi.registerCommand("updates", {
    description: "Show changelog updates in chat \xB7 /updates [all|reset]",
    handler: async (args, handlerCtx) => {
      const sub = args.trim().toLowerCase();
      if (sub === "reset") {
        writeChangelogState({});
        handlerCtx.ui.notify("Changelog state reset. New updates will be shown on next launch.", "info");
        return;
      }
      if (!existsSync9(CHANGELOG_PATH)) {
        handlerCtx.ui.notify("CHANGELOG.md not found.", "warning");
        return;
      }
      if (sub === "all") {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: readFileSync9(CHANGELOG_PATH, "utf8"),
          display: true,
          details: void 0
        });
        return;
      }
      const unseen = changelogSinceLastShown(_pkgVersion);
      if (!unseen) {
        handlerCtx.ui.notify("No unseen changelog updates.", "info");
        return;
      }
      pi.sendMessage({
        customType: NEUROSKILL_STATUS_TYPE,
        content: unseen,
        display: true,
        details: void 0
      });
      writeChangelogState({ lastShownVersion: _pkgVersion });
    }
  });
  async function neuroCmd(cmdArgs, title, handlerCtx) {
    const result = await runNeuroSkill(cmdArgs);
    if (result.ok && result.text) {
      pi.sendMessage({
        customType: NEUROSKILL_STATUS_TYPE,
        content: `## ${title}
\`\`\`
${result.text}
\`\`\``,
        display: true,
        details: void 0
      });
    } else {
      handlerCtx.ui.notify(result.error ?? "neuroskill command failed", "error");
    }
  }
  pi.registerCommand("exg-session", {
    description: "Session metrics \xB7 /exg-session [index]  (0 = latest)",
    handler: async (args, handlerCtx) => {
      const idx = args.trim() || "0";
      await neuroCmd(["session", idx], `\u{1F4CA} Session ${idx}`, handlerCtx);
    }
  });
  pi.registerCommand("sessions", {
    description: "List all recorded EXG sessions",
    handler: async (_args, handlerCtx) => {
      await neuroCmd(["sessions"], "\u{1F4CB} Sessions", handlerCtx);
    }
  });
  pi.registerCommand("sleep", {
    description: "Sleep staging \xB7 /sleep [index]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      await neuroCmd(["sleep", ...parts], "\u{1F634} Sleep", handlerCtx);
    }
  });
  pi.registerCommand("compare", {
    description: "Compare last two sessions (slow ~60 s, uses cache)",
    handler: async (_args, handlerCtx) => {
      handlerCtx.ui.notify("Running compare \u2014 this may take up to 60 s \u2026", "info");
      await neuroCmd(["compare"], "\u{1F500} Session Comparison", handlerCtx);
    }
  });
  pi.registerCommand("health", {
    description: "HealthKit \xB7 /health [sleep|workouts|hr|steps|summary|metrics \u2026]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      await neuroCmd(["health", ...parts], "\u{1F3E5} Health" + (parts.length ? ` \u2014 ${parts[0]}` : ""), handlerCtx);
    }
  });
  pi.registerCommand("label", {
    description: "Label this EXG moment \xB7 /label <text> [--context <ctx>]",
    handler: async (args, handlerCtx) => {
      const text = args.trim();
      if (!text) {
        handlerCtx.ui.notify("Usage: /label <text> [--context <context>]", "warning");
        return;
      }
      const parts = args.trim().split(/\s+/).filter(Boolean);
      await neuroCmd(["label", ...parts], `\u2B21 Label`, handlerCtx);
    }
  });
  pi.registerCommand("labels", {
    description: "Search labels \xB7 /labels <query> [--k <n>]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) {
        handlerCtx.ui.notify("Usage: /labels <search query> [--k <n>]", "warning");
        return;
      }
      await neuroCmd(["search-labels", ...parts], "\u{1F50D} Labels", handlerCtx);
    }
  });
  pi.registerCommand("hooks", {
    description: "Hooks \xB7 /hooks [list|add|remove|enable|disable|update|suggest|log]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      await neuroCmd(["hooks", ...parts], "\u{1FA9D} Hooks", handlerCtx);
    }
  });
  pi.registerCommand("dnd", {
    description: "Do Not Disturb \xB7 /dnd [on|off]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      await neuroCmd(["dnd", ...parts], "\u{1F515} DND", handlerCtx);
    }
  });
  pi.registerCommand("say", {
    description: "Speak text aloud \xB7 /say <text> [--voice <name>]",
    handler: async (args, handlerCtx) => {
      const text = args.trim();
      if (!text) {
        handlerCtx.ui.notify("Usage: /say <text> [--voice <name>]", "warning");
        return;
      }
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const result = await runNeuroSkill(["say", ...parts]);
      if (result.ok) {
        handlerCtx.ui.notify("\u{1F50A} Speaking \u2026", "info");
      } else {
        handlerCtx.ui.notify(result.error ?? "TTS failed", "error");
      }
    }
  });
  pi.registerCommand("notify", {
    description: "OS notification \xB7 /notify <title> [body]",
    handler: async (args, handlerCtx) => {
      const text = args.trim();
      if (!text) {
        handlerCtx.ui.notify("Usage: /notify <title> [body]", "warning");
        return;
      }
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const result = await runNeuroSkill(["notify", ...parts]);
      if (result.ok) {
        handlerCtx.ui.notify("\u{1F4EC} Notification sent", "info");
      } else {
        handlerCtx.ui.notify(result.error ?? "notify failed", "error");
      }
    }
  });
  pi.registerCommand("calibrate", {
    description: "Start EXG calibration sequence",
    handler: async (_args, handlerCtx) => {
      await neuroCmd(["calibrate"], "\u{1F3AF} Calibration", handlerCtx);
    }
  });
  let llmCatalogCache = [];
  let llmCatalogCacheAt = 0;
  async function refreshLlmCatalogCache() {
    if (Date.now() - llmCatalogCacheAt < 3e4 && llmCatalogCache.length > 0) return;
    try {
      const baseUrl = await getSkillServerBaseUrl();
      const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(3e3)
      });
      if (!res.ok) return;
      const data = await res.json();
      llmCatalogCache = (data.entries ?? []).map((e) => ({
        filename: String(e.filename ?? ""),
        state: String(e.state ?? "not_downloaded"),
        isMmproj: !!e.is_mmproj
      }));
      llmCatalogCacheAt = Date.now();
    } catch {
    }
  }
  pi.registerCommand("llm", {
    description: "LLM control \xB7 /llm [models|status|route|connect|start|stop|list|add|remove|select|download|cancel|pause|resume|fit|chat \u2026]",
    getArgumentCompletions(prefix) {
      const parts = prefix.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase() ?? "";
      const partial = (parts[1] ?? "").toLowerCase();
      if (parts.length <= 1) {
        const subs = [
          "models",
          "status",
          "route",
          "connect",
          "start",
          "stop",
          "list",
          "select",
          "download",
          "cancel",
          "pause",
          "resume",
          "add",
          "remove",
          "fit",
          "chat"
        ];
        return subs.filter((s) => s.startsWith(sub)).map((s) => ({ value: s, label: s, description: "" }));
      }
      const filenameSubs = /* @__PURE__ */ new Set(["select", "download", "cancel", "pause", "resume", "remove", "delete"]);
      if (filenameSubs.has(sub) && parts.length === 2) {
        refreshLlmCatalogCache();
        const models = llmCatalogCache.filter((m) => !m.isMmproj);
        let filtered = models;
        if (sub === "select") filtered = models.filter((m) => m.state === "downloaded");
        else if (sub === "download") filtered = models.filter((m) => m.state !== "downloaded");
        else if (sub === "cancel" || sub === "pause") filtered = models.filter((m) => m.state === "downloading");
        else if (sub === "resume") filtered = models.filter((m) => m.state === "paused");
        else if (sub === "remove" || sub === "delete") filtered = models.filter((m) => m.state === "downloaded");
        return filtered.filter((m) => m.filename.toLowerCase().includes(partial)).map((m) => ({ value: `${sub} ${m.filename}`, label: m.filename, description: m.state }));
      }
      return null;
    },
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const sub = (parts[0] ?? "").toLowerCase();
      if (!sub) {
        if (llmPanel) {
          overlayManager?.show("llm-panel");
        } else {
          handlerCtx.ui.notify("LLM panel not available \u2014 try /llm models", "warning");
        }
        return;
      }
      if (sub === "route") {
        const llmStatus = await runNeuroSkill(["llm", "status"]);
        let skillRoute = null;
        if (llmStatus.ok && llmStatus.data) {
          const data = llmStatus.data;
          const status = String(data.status ?? "").toLowerCase();
          if (status === "running" || status === "ok") {
            const mode2 = typeof data.mode === "string" ? data.mode : typeof data.backend === "string" ? data.backend : typeof data.remote === "boolean" ? data.remote ? "remote" : "local" : "";
            skillRoute = `skill-llm${mode2 ? ` (${mode2})` : ""}`;
          }
        }
        const authStorage2 = handlerCtx.modelRegistry.authStorage;
        const cloudProviders = KEY_PROVIDERS.filter((p) => authStorage2.has(p.id) || !!process.env[p.envVar]).map((p) => p.id);
        let ollamaOnline = false;
        try {
          const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(1200) });
          ollamaOnline = res.ok;
        } catch {
          ollamaOnline = false;
        }
        const active = skillRoute ?? cloudProviders[0] ?? (ollamaOnline ? "ollama" : "none detected");
        const fallbacks = [
          ...cloudProviders.filter((p) => p !== active),
          ...ollamaOnline && active !== "ollama" ? ["ollama"] : [],
          ...active !== "skill-llm (local)" ? ["skill-llm(local)"] : []
        ].join(" \u2192 ") || "none";
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## \u{1F9ED} LLM Route
active: **${active}**
fallbacks: ${fallbacks}`,
          display: true,
          details: void 0
        });
        return;
      }
      if (sub === "status") {
        const result = await runNeuroSkill(["llm", "status"]);
        if (result.ok) {
          const data = result.data;
          const status = data?.status ?? "unknown";
          const model = data?.model_name ?? data?.model ?? "\u2013";
          const nCtx = data?.n_ctx ?? "\u2013";
          const vision = data?.supports_vision ? "yes" : "no";
          const lines = [
            `**Status:** ${status}`,
            `**Model:** ${model}`,
            `**Context:** ${nCtx} tokens`,
            `**Vision:** ${vision}`
          ];
          pi.sendMessage({
            customType: NEUROSKILL_STATUS_TYPE,
            content: `## \u{1F916} LLM Server
${lines.join("\n")}`,
            display: true,
            details: void 0
          });
        } else {
          handlerCtx.ui.notify("LLM server not running. Use /llm start or /llm models to manage models.", "warning");
        }
        return;
      }
      if (sub === "connect") {
        const modeArg = (parts[1] ?? "auto").toLowerCase();
        const mode2 = modeArg === "remote" || modeArg === "local" || modeArg === "auto" ? modeArg : "auto";
        handlerCtx.ui.notify(`Connecting Skill LLM (${mode2}) \u2026`, "info");
        const started = await startSkillLlmServer(mode2);
        if (!started.ok) {
          handlerCtx.ui.notify(started.message, "error");
          return;
        }
        const registered = await registerSkillLlmProvider(handlerCtx.modelRegistry);
        handlerCtx.ui.notify(started.message, "info");
        if (registered) {
          handlerCtx.ui.notify("Skill LLM provider connected. Select it with /model (Ctrl+L).", "info");
        } else {
          handlerCtx.ui.notify("LLM server started but provider registration failed. Check /llm status.", "warning");
        }
        return;
      }
      if (sub === "start") {
        handlerCtx.ui.notify("Starting LLM server \u2014 loading model \u2026", "info");
        await neuroCmd(["llm", "start"], "\u{1F916} LLM \u2014 start", handlerCtx);
        return;
      }
      if (sub === "stop") {
        await neuroCmd(["llm", "stop"], "\u{1F916} LLM \u2014 stop", handlerCtx);
        return;
      }
      if (sub === "list" || sub === "catalog") {
        let data;
        try {
          const baseUrl = await getSkillServerBaseUrl();
          const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(5e3)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = await res.json();
        } catch (e) {
          handlerCtx.ui.notify(`Failed to fetch catalog: ${e instanceof Error ? e.message : String(e)}`, "error");
          return;
        }
        {
          const entries = data?.entries ?? [];
          const active = data?.active_model ?? "\u2013";
          const mmproj = data?.active_mmproj ?? "\u2013";
          if (!entries.length) {
            handlerCtx.ui.notify("Model catalog is empty. Use /llm add to add a model.", "warning");
            return;
          }
          const downloaded = [];
          const available = [];
          const downloading = [];
          for (const e of entries) {
            if (e.is_mmproj) continue;
            const fname = String(e.filename ?? "");
            const state = String(e.state ?? e.status ?? "not_downloaded");
            const size = e.size_gb ? `${Number(e.size_gb).toFixed(1)} GB` : "";
            const quant = e.quant ?? "";
            const family = e.family_name ?? "";
            const params = e.params_b ? `${e.params_b}B` : "";
            const info = [quant, params, size].filter(Boolean).join("  ");
            const rec = e.recommended ? " \u2B50" : "";
            if (state === "downloaded") {
              const mark = fname === active ? "\u25B6 " : "  ";
              downloaded.push(`${mark}**${fname}**  ${info}${rec}`);
            } else if (state === "downloading") {
              const pct = typeof e.progress === "number" ? ` ${Math.round(e.progress)}%` : "";
              downloading.push(`  \u2B07 **${fname}**  ${info}${pct}`);
            } else {
              available.push(`  \u25CB ${family ? `_${family}_  ` : ""}**${fname}**  ${info}${rec}`);
            }
          }
          const sections = [];
          sections.push(`Active: **${active}**` + (mmproj !== "\u2013" ? ` \xB7 mmproj: **${mmproj}**` : ""));
          if (downloaded.length) {
            sections.push("\n**Downloaded:**\n" + downloaded.join("\n"));
          }
          if (downloading.length) {
            sections.push("\n**Downloading:**\n" + downloading.join("\n"));
          }
          if (available.length) {
            sections.push("\n**Available to download:**\n" + available.join("\n"));
          }
          sections.push("\n`/llm download <file>` \xB7 `/llm pause|resume|cancel [file]` \xB7 `/llm select <file>` \xB7 `/llm start`");
          pi.sendMessage({
            customType: NEUROSKILL_STATUS_TYPE,
            content: `## \u{1F916} LLM Catalog
${sections.join("\n")}`,
            display: true,
            details: void 0
          });
        }
        return;
      }
      if (sub === "add") {
        if (parts.length < 2) {
          handlerCtx.ui.notify(
            "Usage: /llm add <repo> <filename> [--mmproj <file>]\n   or: /llm add <hf-url>",
            "warning"
          );
          return;
        }
        await neuroCmd(["llm", ...parts], "\u{1F916} LLM \u2014 add", handlerCtx);
        return;
      }
      if (sub === "remove" || sub === "delete") {
        const filename = parts[1];
        if (!filename) {
          handlerCtx.ui.notify("Usage: /llm remove <filename>", "warning");
          return;
        }
        await neuroCmd(["llm", "delete", filename], "\u{1F916} LLM \u2014 delete", handlerCtx);
        return;
      }
      if (sub === "select") {
        const filename = parts[1];
        if (!filename) {
          handlerCtx.ui.notify("Usage: /llm select <filename>", "warning");
          return;
        }
        await neuroCmd(["llm", "select", filename], "\u{1F916} LLM \u2014 select", handlerCtx);
        return;
      }
      if (sub === "download") {
        const filename = parts[1];
        if (!filename) {
          handlerCtx.ui.notify("Usage: /llm download <filename>", "warning");
          return;
        }
        handlerCtx.ui.notify(`Starting download: ${filename}`, "info");
        if (!llmDownloads.find((d) => d.filename === filename)) {
          llmDownloads.push({ filename, progress: 0, state: "downloading" });
        }
        startLlmDownloadPoll();
        uiTui?.requestRender();
        (async () => {
          try {
            const baseUrl = await getSkillServerBaseUrl();
            const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
            const startRes = await fetch(`${baseUrl}/v1/llm/download/start`, {
              method: "POST",
              headers: hdrs,
              body: JSON.stringify({ filename }),
              signal: AbortSignal.timeout(1e4)
            });
            if (!startRes.ok) {
              const body = await startRes.text().catch(() => "");
              uiNotify?.(`Download request failed: HTTP ${startRes.status} ${body}`, "error");
            }
          } catch (e) {
            uiNotify?.(`Download request failed: ${e instanceof Error ? e.message : String(e)}`, "error");
          }
        })();
        return;
      }
      if (sub === "cancel" || sub === "pause" || sub === "resume") {
        const target = parts[1] ?? (llmDownloads.length === 1 ? llmDownloads[0].filename : void 0);
        if (!target) {
          if (llmDownloads.length > 1) {
            const names = llmDownloads.map((d) => d.filename).join(", ");
            handlerCtx.ui.notify(`Multiple downloads active: ${names}
Usage: /llm ${sub} <filename>`, "warning");
          } else {
            handlerCtx.ui.notify(`No download in progress. Usage: /llm ${sub} <filename>`, "warning");
          }
          return;
        }
        const endpoint = sub === "cancel" ? "cancel" : sub === "pause" ? "pause" : "resume";
        try {
          const baseUrl = await getSkillServerBaseUrl();
          const hdrs = { ...authHeaders(), "Content-Type": "application/json" };
          const res = await fetch(`${baseUrl}/v1/llm/download/${endpoint}`, {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ filename: target }),
            signal: AbortSignal.timeout(5e3)
          });
          if (res.ok) {
            if (sub === "cancel") {
              llmDownloads = llmDownloads.filter((d) => d.filename !== target);
              if (llmDownloads.length === 0) stopLlmDownloadPoll();
              uiTui?.requestRender();
            }
            handlerCtx.ui.notify(`${target}: ${sub} OK`, "info");
          } else {
            handlerCtx.ui.notify(`${sub} failed: HTTP ${res.status}`, "error");
          }
        } catch (e) {
          handlerCtx.ui.notify(`${sub} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
        return;
      }
      if (sub === "downloads" || sub === "models") {
        let data;
        try {
          const baseUrl = await getSkillServerBaseUrl();
          const res = await fetch(`${baseUrl}/v1/llm/catalog`, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(5e3)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = await res.json();
        } catch (e) {
          handlerCtx.ui.notify(`Failed to fetch catalog: ${e instanceof Error ? e.message : String(e)}`, "error");
          return;
        }
        const entries = data?.entries ?? [];
        const active = data?.active_model ?? "\u2013";
        if (!entries.length) {
          handlerCtx.ui.notify("Model catalog is empty. Use /llm add to add a model.", "warning");
          return;
        }
        const downloaded = [];
        const available = [];
        const downloading = [];
        for (const e of entries) {
          if (e.is_mmproj) continue;
          const fname = String(e.filename ?? "");
          const state = String(e.state ?? "not_downloaded");
          const size = e.size_gb ? `${Number(e.size_gb).toFixed(1)} GB` : "";
          const quant = String(e.quant ?? "");
          const family = String(e.family_name ?? "");
          const params = e.params_b ? `${e.params_b}B` : "";
          const info = [quant, params, size].filter(Boolean).join("  ");
          const rec = e.recommended ? " \u2B50" : "";
          if (state === "downloaded") {
            const mark = fname === active ? "\u25B6 " : "  ";
            downloaded.push(`${mark}\`${fname}\`  ${info}${rec}`);
          } else if (state === "downloading") {
            const pct = typeof e.progress === "number" ? ` ${Math.round(e.progress)}%` : "";
            downloading.push(`  \u2B07 \`${fname}\`  ${info}${pct}`);
          } else {
            available.push(`  \u25CB ${family ? `_${family}_  ` : ""}\`${fname}\`  ${info}${rec}`);
          }
        }
        const sections = [];
        sections.push(`Active: **${active}**`);
        if (downloaded.length) sections.push("\n**Downloaded:**\n" + downloaded.join("\n"));
        if (downloading.length) sections.push("\n**Downloading:**\n" + downloading.join("\n"));
        if (available.length) sections.push("\n**Available to download:**\n" + available.join("\n"));
        sections.push("");
        sections.push("**Commands:**");
        sections.push("  `/llm select <file>` \u2014 set active model");
        sections.push("  `/llm download <file>` \u2014 download a model");
        sections.push("  `/llm pause|resume|cancel [file]` \u2014 manage downloads");
        sections.push("  `/llm start` / `/llm stop` \u2014 server control");
        sections.push("  `/llm status` \u2014 show server status");
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## \u{1F916} LLM Models
${sections.join("\n")}`,
          display: true,
          details: void 0
        });
        return;
      }
      if (sub === "edit") {
        handlerCtx.ui.notify(
          "Model editing is managed from the Skill app UI (Settings \u2192 LLM).\nUse /llm select <filename> to change the active model,\nor /llm add / /llm remove to manage the catalog.",
          "info"
        );
        return;
      }
      if (sub === "fit") {
        await neuroCmd(["llm", "fit"], "\u{1F916} LLM \u2014 hardware fit", handlerCtx);
        return;
      }
      await neuroCmd(["llm", ...parts], "\u{1F916} LLM" + (parts.length ? ` \u2014 ${sub}` : ""), handlerCtx);
    }
  });
  pi.registerCommand("screenshots", {
    description: "Search screenshots \xB7 /screenshots [query | --by-image <path>]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) {
        await neuroCmd(["screenshots-for-eeg"], "\u{1F4F8} Screenshots (EEG session)", handlerCtx);
      } else {
        await neuroCmd(["search-images", ...parts], "\u{1F4F8} Screenshots", handlerCtx);
      }
    }
  });
  pi.registerCommand("timer", {
    description: "Start focus timer",
    handler: async (_args, handlerCtx) => {
      await neuroCmd(["timer"], "\u23F1\uFE0F Timer", handlerCtx);
    }
  });
  pi.registerCommand("umap", {
    description: "3D UMAP projection of EXG data",
    handler: async (_args, handlerCtx) => {
      await neuroCmd(["umap"], "\u{1F5FA}\uFE0F UMAP", handlerCtx);
    }
  });
  pi.registerCommand("listen", {
    description: "Stream live EXG events \xB7 /listen [--seconds <n>]",
    handler: async (args, handlerCtx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      await neuroCmd(["listen", ...parts], "\u{1F4E1} Live Stream", handlerCtx);
    }
  });
  pi.registerCommand("connect", {
    description: "Connect to a NeuroSkill server \xB7 /connect",
    handler: async (_args, handlerCtx) => {
      handlerCtx.ui.notify("Checking for local daemon...", "info");
      const authSt = await checkAuthStatus();
      if (authSt === "local") {
        const port = getSkillPort();
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## Connected Locally

Daemon found on \`127.0.0.1:${port}\`. Auth token loaded automatically from:
\`${getDaemonTokenPath()}\``,
          display: true,
          details: void 0
        });
        return;
      }
      const options = [
        "LAN \u2014 connect to a daemon on your network",
        "Remote \u2014 connect via iroh relay (TOTP pairing)",
        "Cancel"
      ];
      const choice = await handlerCtx.ui.select(
        "No local daemon found. How would you like to connect?",
        options
      );
      if (!choice || choice === "Cancel") return;
      if (choice.startsWith("LAN")) {
        const hostPort = await handlerCtx.ui.input(
          "Enter the daemon address (host:port, e.g. 192.168.1.10:18444):"
        );
        if (!hostPort) return;
        const token = await handlerCtx.ui.input(
          "Enter the daemon auth token.\nFind it on the server machine at:\n  macOS:   ~/Library/Application Support/skill/daemon/auth.token\n  Linux:   ~/.config/skill/daemon/auth.token\n  Windows: %APPDATA%\\skill\\daemon\\auth.token"
        );
        if (!token) return;
        const [host, portStr] = hostPort.includes(":") ? hostPort.split(":") : [hostPort, "18444"];
        const port = parseInt(portStr, 10) || 18444;
        try {
          const res = await fetch(`http://${host}:${port}/healthz`, {
            signal: AbortSignal.timeout(5e3),
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            setSkillPort(port);
            pi.sendMessage({
              customType: NEUROSKILL_STATUS_TYPE,
              content: `## Connected via LAN

Daemon reachable at \`${host}:${port}\`. Connection verified.`,
              display: true,
              details: void 0
            });
          } else {
            handlerCtx.ui.notify(`Daemon responded with HTTP ${res.status}. Check your token.`, "error");
          }
        } catch (err) {
          handlerCtx.ui.notify(`Could not reach daemon at ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`, "error");
        }
        return;
      }
      if (choice.startsWith("Remote")) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: '## Remote Connection via iroh\n\n**Step 1:** On the server machine, create a TOTP credential:\n```\nneuroskill iroh totp create "my-client"\n```\n\n**Step 2:** Open the authenticator app and get the 6-digit code.\n\n**Step 3:** Enter the iroh endpoint ID and code below.',
          display: true,
          details: void 0
        });
        const endpointId = await handlerCtx.ui.input("Enter the server's iroh endpoint ID:");
        if (!endpointId) return;
        const otp = await handlerCtx.ui.input("Enter the 6-digit TOTP code:");
        if (!otp) return;
        const scopeChoice = await handlerCtx.ui.select(
          "Permission scope:",
          [
            "read",
            "full"
          ]
        );
        const scope = scopeChoice || "read";
        handlerCtx.ui.notify("Registering with iroh relay...", "info");
        const result = await runNeuroSkill([
          "iroh",
          "clients",
          "register",
          endpointId,
          "--otp",
          otp,
          "--scope",
          scope
        ]);
        if (result.ok) {
          pi.sendMessage({
            customType: NEUROSKILL_STATUS_TYPE,
            content: "## Remote Connection Established\n\nSuccessfully registered via iroh.\n```json\n" + result.text + "\n```",
            display: true,
            details: void 0
          });
        } else {
          handlerCtx.ui.notify(`Registration failed: ${result.error}`, "error");
        }
        return;
      }
    }
  });
  pi.registerShortcut("ctrl+shift+e", {
    description: "Show live EXG snapshot in chat",
    handler: async (handlerCtx) => {
      const result = await runNeuroSkill(["status"]);
      if (result.ok && result.text) {
        pi.sendMessage({
          customType: NEUROSKILL_STATUS_TYPE,
          content: `## \u{1F9E0} EXG Snapshot
${result.text}`,
          display: true,
          details: void 0
        });
      } else {
        handlerCtx.ui.notify("NeuroSkill server not reachable", "error");
      }
    }
  });
}

// src/main.ts
process.env.PI_SKIP_VERSION_CHECK = "1";
var [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`neuroloop requires Node.js >= 20 (running ${process.version})`);
  process.exit(1);
}
var MAIN_FILE = fileURLToPath4(import.meta.url);
var SRC_DIR2 = dirname5(MAIN_FILE);
var NEUROLOOP_DIR2 = join10(SRC_DIR2, "..");
var AGENT_DIR5 = join10(homedir10(), ".neuroloop");
var AGENT_SKILLS_DIR2 = getAgentSkillsDir();
var SKILLS_DIR = join10(NEUROLOOP_DIR2, "skills");
var SKILLS_SCAN_DIRS = [AGENT_SKILLS_DIR2, SKILLS_DIR];
var METRICS_MD_PATH = join10(NEUROLOOP_DIR2, "METRICS.md");
var LOCAL_NEUROLOOP_VERSION = JSON.parse(readFileSync10(join10(NEUROLOOP_DIR2, "package.json"), "utf8")).version;
var runtime = await refreshRuntimeVersions(LOCAL_NEUROLOOP_VERSION);
if (runtime.neuroloop.npmLatest) {
  const badge = runtime.neuroloop.upToDate ? "up-to-date" : "update available";
  console.log(`neuroloop: v${runtime.neuroloop.local} (npm latest: v${runtime.neuroloop.npmLatest}, ${badge})`);
}
if (runtime.neuroloop.updated) {
  console.log("neuroloop: updated globally from npm.");
} else if (runtime.neuroloop.updateError) {
  console.warn(`neuroloop: global update failed (${runtime.neuroloop.updateError})`);
}
if (runtime.neuroskill.npmLatest) {
  console.log(
    `neuroskill: local ${runtime.neuroskill.localInstalled ?? "none"} (npm latest: ${runtime.neuroskill.npmLatest})`
  );
  if (runtime.neuroskill.installedNow) {
    console.log("neuroskill: local runtime CLI updated.");
  }
  if (runtime.neuroskill.installError) {
    console.warn(`neuroskill: local install failed (${runtime.neuroskill.installError})`);
  }
}
var skillsSync = await syncSkillsFromGitHub();
process.env.NEUROLOOP_SKILLS_SYNC_STATUS = skillsSync.message;
process.env.NEUROLOOP_SKILLS_SYNC_OK = skillsSync.ok ? "1" : "0";
process.env.NEUROLOOP_SKILLS_SYNC_UPDATED = skillsSync.updated ? "1" : "0";
console.log(`skills: ${skillsSync.message}`);
if (!skillsSync.ok && skillsSync.error) {
  console.warn(`skills: ${skillsSync.error}`);
}
var authStorage = AuthStorage.create(join10(AGENT_DIR5, "auth.json"));
var modelRegistry = ModelRegistry.create(authStorage, join10(AGENT_DIR5, "models.json"));
var settingsManager = SettingsManager.create(process.cwd(), AGENT_DIR5);
await autoBootSkillLlmIfConfigured();
await registerSkillLlmProvider(modelRegistry);
var DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";
function ollamaModelEntry(id, paramSize = "") {
  const bigModel = /\b(70b|72b|110b|180b)\b/i.test(paramSize);
  return {
    id,
    name: paramSize ? `${id} (${paramSize})` : id,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: bigModel ? 65536 : 32768,
    maxTokens: bigModel ? 16384 : 8192,
    compat: {
      supportsStore: false,
      supportsReasoningEffort: false,
      supportsDeveloperRole: false,
      requiresToolResultName: false,
      supportsStrictMode: false
    }
  };
}
async function registerOllamaModels() {
  const models = [];
  const seen = /* @__PURE__ */ new Set();
  let ollamaOnline = false;
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3e3)
    });
    if (res.ok) {
      ollamaOnline = true;
      models.push(ollamaModelEntry(DEFAULT_OLLAMA_MODEL));
      seen.add(DEFAULT_OLLAMA_MODEL);
      const { models: tags = [] } = await res.json();
      for (const tag of tags) {
        if (!seen.has(tag.name)) {
          models.push(ollamaModelEntry(tag.name, tag.details?.parameter_size ?? ""));
          seen.add(tag.name);
        }
      }
    }
  } catch {
  }
  if (!ollamaOnline) return;
  modelRegistry.registerProvider("ollama", {
    baseUrl: "http://localhost:11434/v1",
    // "OLLAMA_API_KEY" is treated as an env-var name by resolveConfigValue;
    // falls back to the literal string (truthy) so hasAuth("ollama") is always true.
    apiKey: "OLLAMA_API_KEY",
    api: "openai-completions",
    models
  });
}
await registerOllamaModels();
var loadedSkills = [];
var loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: AGENT_DIR5,
  settingsManager,
  // Load individual skills from ~/.neuroloop/skills first, then bundled ./skills.
  skillsOverride: (base) => {
    const extra = [];
    const seen = new Set(base.skills.map((s) => s.name));
    const addSkill = (skillFile) => {
      if (!existsSync10(skillFile)) return;
      const content = readFileSync10(skillFile, "utf8");
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) return;
      const fm = fmMatch[1];
      const nameMatch = fm.match(/^name:\s*(.+)$/m);
      const descMatch = fm.match(/^description:\s*(.+)$/m);
      if (!nameMatch || !descMatch) return;
      const name = nameMatch[1].trim();
      if (seen.has(name)) return;
      seen.add(name);
      const baseDir = dirname5(skillFile);
      extra.push({
        name,
        description: descMatch[1].trim(),
        filePath: skillFile,
        baseDir,
        sourceInfo: createSyntheticSourceInfo(skillFile, {
          source: "neuroloop/skills",
          scope: "project",
          origin: "top-level",
          baseDir
        }),
        disableModelInvocation: false
      });
    };
    for (const root of SKILLS_SCAN_DIRS) {
      if (!existsSync10(root)) continue;
      addSkill(join10(root, "SKILL.md"));
      for (const container of [root, join10(root, "skills")]) {
        if (!existsSync10(container)) continue;
        for (const entry of readdirSync2(container, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          addSkill(join10(container, entry.name, "SKILL.md"));
        }
      }
    }
    if (existsSync10(METRICS_MD_PATH)) {
      extra.push({
        name: "neuroskill-metrics",
        description: "NeuroSkill EXG metrics reference \u2014 all indices, band powers, scores, and their scientific basis.",
        filePath: METRICS_MD_PATH,
        baseDir: NEUROLOOP_DIR2,
        sourceInfo: createSyntheticSourceInfo(METRICS_MD_PATH, {
          source: "neuroloop",
          scope: "project",
          origin: "top-level",
          baseDir: NEUROLOOP_DIR2
        }),
        disableModelInvocation: false
      });
    }
    loadedSkills = [...base.skills, ...extra];
    return { skills: loadedSkills, diagnostics: base.diagnostics };
  },
  // Brief context note (doesn't duplicate the skills above).
  agentsFilesOverride: (base) => {
    const note = [
      "# NeuroLoop Agent",
      "",
      "EXG-aware coding agent. A live neuroskill status snapshot is injected as an",
      "assistant message before every turn. Use the `neuroskill_run` tool to query",
      "any other neuroskill command.",
      "",
      `Skills cache dir: ${AGENT_SKILLS_DIR2}`,
      `Bundled skills dir: ${SKILLS_DIR}`,
      `METRICS.md: ${METRICS_MD_PATH}`
    ].join("\n");
    return {
      agentsFiles: [
        ...base.agentsFiles,
        { path: `${basename(NEUROLOOP_DIR2)}/NEUROLOOP.md`, content: note }
      ]
    };
  },
  // Extension factory: neuroskill status hook + custom tools
  extensionFactories: [neuroloopExtension]
});
await loader.reload();
var { session, modelFallbackMessage } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: AGENT_DIR5,
  authStorage,
  modelRegistry,
  resourceLoader: loader,
  sessionManager: SessionManager.create(process.cwd(), join10(AGENT_DIR5, "sessions")),
  settingsManager
  // No explicit model — let findInitialModel choose:
  //   built-in providers win if they have API keys / OAuth tokens,
  //   otherwise the first Ollama model (gpt-oss:20b) is used.
});
var mode = new InteractiveMode(session, {
  modelFallbackMessage,
  initialMessage: process.argv[2]
});
var origFormatScopeGroups = mode.formatScopeGroups.bind(mode);
var origFmtPath = mode.formatDisplayPath.bind(mode);
mode.formatScopeGroups = (groups, options) => {
  const lines = [];
  for (const group of groups) {
    lines.push(`  \x1B[36m${group.scope}\x1B[0m`);
    const sorted = [...group.paths].sort((a, b) => a.path.localeCompare(b.path));
    const cacheItems = [];
    const otherItems = [];
    let cacheRoot = "";
    for (const item of sorted) {
      const p = item.path;
      const cacheMatch = p.match(/skills-cache\/(?:skills\/)?([^/]+)\/SKILL\.md$/);
      if (cacheMatch) {
        cacheItems.push(cacheMatch[1]);
        if (!cacheRoot) {
          cacheRoot = origFmtPath(p).replace(/(?:skills\/)?[^/]+\/SKILL\.md$/, "");
        }
      } else if (p.match(/skills-cache\/SKILL\.md$/)) {
        cacheRoot = origFmtPath(p).replace(/SKILL\.md$/, "");
      } else {
        otherItems.push(item);
      }
    }
    if (cacheRoot || cacheItems.length > 0) {
      lines.push(`    root \x1B[2m${cacheRoot}\x1B[22m`);
      if (cacheItems.length > 0) {
        lines.push(`    \x1B[2m${cacheItems.join(", ")}\x1B[22m`);
      }
    }
    const cwd = process.cwd();
    for (const item of otherItems) {
      const p = item.path;
      const display = p.startsWith(cwd) ? "./" + relative(cwd, p) : options.formatPath(item);
      lines.push(`    ${display}`);
    }
    const sortedPkgs = Array.from(group.packages.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [source, items] of sortedPkgs) {
      lines.push(`    ${source}`);
      const sortedPkg = [...items].sort((a, b) => a.path.localeCompare(b.path));
      for (const item of sortedPkg) {
        lines.push(`\x1B[2m      ${options.formatPackagePath(item, source)}\x1B[22m`);
      }
    }
  }
  return lines.join("\n");
};
await mode.run();
console.log(`
Skills loaded (${loadedSkills.length}):`);
for (const skill of loadedSkills) {
  console.log(`  ${skill.name}`);
}
//# sourceMappingURL=neuroloop.js.map
