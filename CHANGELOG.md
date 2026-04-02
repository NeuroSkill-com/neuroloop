# Changelog

All notable changes to NeuroLoop are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.14] — 2026-04-02

### Fixed

- Restored startup skill sync before resource loading so downloaded skills are available in the same launch/session.
- Kept TUI progress UX for manual `/skills-update` runs without delaying initial skill injection.

---

## [0.0.13] — 2026-04-02

### Changed

- Skills sync now supports a TUI progress indicator (spinner + progress bar) while fetching/updating skills.
- Startup skills sync moved into interactive session start so progress is visible in the UI.
- Skills are cached in `~/.neuroloop/skills` and loaded before bundled package skills.
- Cross-platform path handling tightened for Windows/macOS/Linux while retaining bundled `SKILLS_DIR` fallback.

---

## [0.0.12] — 2026-04-02

### Changed

- README alignment expanded against the latest `skill` backend updates:
  - native device coverage refresh
  - LSL + remote LSL coverage
  - EXG model (ZUNA) and LLM catalog family coverage
  - backend integration notes (HealthKit, Oura, Calendar)
- Startup behavior improved when local skills are missing:
  - automatically pulls skills from GitHub before loading
  - shows skills-sync status in the TUI at session start.

---

## [0.0.11] — 2026-04-02

### Added

- Auto-sync of `skills/` submodule on startup, plus `/skills-update` to force refresh from GitHub.
- Startup/runtime version intelligence:
  - local vs npm-latest checks for `neuroloop` and `neuroskill`
  - GitHub latest commit and latest release tag lookup
  - header version/status line in TUI
  - `/version [refresh]` command
- Changelog UX in TUI:
  - automatic "what changed" card shown once per version
  - `/updates`, `/updates all`, `/updates reset`
- Skill LLM connection orchestration:
  - `/llm connect [remote|local|auto]`
  - `/llm route` for active route + fallback visibility
  - optional startup boot via `NEUROLOOP_SKILL_LLM_BOOT`
- Model configuration management in TUI:
  - `/model-config add` interactive creator for `~/.neuroloop/models.json`
  - `/model-config open` to open the file in system editor (`open` / `start` / `xdg-open`)
  - `/model-config show` and `/model-config path`

### Changed

- Updated pi dependencies to the 0.64 line (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai`).
- Updated TypeScript compatibility for latest pi SDK types:
  - `ModelRegistry.create(...)` usage
  - skill `sourceInfo` metadata construction
- `runNeuroSkill()` now prefers locally installed runtime `neuroskill` binary under `~/.neuroloop/runtime` before falling back to `npx`.
- README updated to reflect all new commands and flows.
- README device/model coverage expanded to match current Skill app capabilities and recent backend changes:
  - native connectors (Muse, Ganglion, MW75, Hermes)
  - local + remote LSL ingestion
  - EXG foundation model (ZUNA) and current Skill LLM model families
  - backend capability alignment notes for HealthKit, Oura Ring cloud sync, and Calendar ingestion

---

## [0.0.10] — 2026-03-24

### Changed

- Renamed `/session` convenience command to `/exg-session` to avoid ambiguity
  with other session concepts; header hint updated accordingly.

---

## [0.0.9] — 2026-03-24

### Added

- **16 convenience slash commands** for direct neuroskill queries — no more
  remembering `/neuro session 0` when `/session` will do:
  - `/session [index]` — current or Nth session metrics (0 = latest)
  - `/sessions` — list all recorded EXG sessions
  - `/sleep [index]` — sleep staging summary
  - `/compare` — compare last two sessions (warns about ~60 s cost)
  - `/health [sub]` — HealthKit data (`sleep`, `workouts`, `hr`, `steps`, `summary`, `metrics`)
  - `/label <text>` — create a timestamped EXG annotation (`--context` supported)
  - `/labels <query>` — semantic search over EXG annotations (`--k` supported)
  - `/hooks [sub]` — proactive hook rules (`list`, `add`, `remove`, `enable`, `disable`, `log`)
  - `/dnd [on|off]` — Do Not Disturb status / toggle
  - `/say <text>` — speak text aloud via on-device TTS (`--voice` supported)
  - `/notify <title> [body]` — send an OS notification
  - `/calibrate` — start EXG calibration sequence
  - `/llm [sub]` — on-device LLM management (`status`, `start`, `stop`, `catalog`, `select`, `chat`)
  - `/screenshots [query]` — search screenshots (OCR / CLIP) or get EEG-session screenshots
  - `/timer` — start focus timer
  - `/umap` — 3D UMAP projection of EXG data
  - `/listen [--seconds n]` — stream live EXG broadcast events
- Internal `neuroCmd` helper to reduce boilerplate across all convenience commands.
- Header hints now show `/session` and `/sleep` for discoverability.
- `CHANGELOG.md` — this file.

### Changed

- Updated `README.md` with the full convenience command table and updated citation version.
- Updated `NEUROLOOP.md` skill index with all new slash commands.

---

## [0.0.8] — 2026-03-23

### Added

- `/neuro <cmd> [args…]` — generic slash command to run any neuroskill subcommand.
- `/exg` — EXG panel control (`on`, `off`, poll interval, port override).
- `/key` — in-app API key management (add, list, remove).
- `ctrl+shift+e` keyboard shortcut for quick EXG snapshot.
- Live WebSocket footer with real-time EXG scores and EEG band bars.
- Custom TUI header with brand logo and keybinding hints.
- Daily calibration nudge (at most once per 24 hours).
- `neuroskill-evidence` skill for scientific references.
- `neuroskill-screenshots` skill for visual memory / OCR / CLIP search.
- `neuroskill-hooks` skill for proactive hook rules.
- `neuroskill-dnd` skill for Do Not Disturb automation.
- `neuroskill-llm` skill for on-device LLM management.
- HealthKit integration (`health` command family).

---

## [0.0.7] — 2026-03-22

### Added

- Initial public release.
- Live EXG context injection on every LLM turn.
- 30+ domain signal detectors (stress, sleep, focus, grief, awe, philosophy, HRV, etc.).
- Guided protocol engine with 100+ mind-body practices.
- Auto-labelling of notable mental, emotional, and philosophical moments.
- Persistent agent memory (`~/.neuroskill/memory.md`).
- Prewarm cache for expensive `neuroskill compare` runs.
- `web_fetch` and `web_search` tools.
- Multi-provider model support (Anthropic, OpenAI, Gemini, Ollama).
