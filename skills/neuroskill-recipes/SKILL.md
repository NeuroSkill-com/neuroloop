---
name: neuroskill-recipes
description: NeuroSkill use-case recipes and scripting patterns — shell snippets for focus and productivity monitoring, stress and anxiety tracking, sleep quality analysis, ADHD/cognitive-load queries, meditation tracking, cross-modal graph search, A/B session comparison, time-range queries, and automation with cron/Python/Node.js/HTTP. Use when looking for practical examples or building automation pipelines.
---

# NeuroSkill Use-Case Recipes

---

## Focus & Productivity

```bash
# Current focus level:
npx neuroskill status --json | jq '.scores.focus'

# Is alpha suppressed? (good focus = low alpha)
npx neuroskill status --json | jq '.scores.bands.rel_alpha'

# Focus trend across today's session:
npx neuroskill session 0 --json | jq '{focus_avg: .metrics.focus, trend: .trends.focus, first_half: .first.focus, second_half: .second.focus}'

# Beta/alpha ratio — high = alert/focused, very high = stressed:
npx neuroskill status --json | jq '.scores.bar'

# Check spectral centroid — rises with cognitive load:
npx neuroskill status --json | jq '.scores.spectral_centroid'

# Compare a morning session vs an afternoon session:
npx neuroskill compare \
  --a-start 1740380100 --a-end 1740382665 \
  --b-start 1740412800 --b-end 1740415510 \
  --json | jq '.insights.deltas.focus'

# Find all moments in history that look like deep focus:
npx neuroskill search --start $(npx neuroskill sessions --json | jq '.sessions[0].start_utc') \
                   --end   $(npx neuroskill sessions --json | jq '.sessions[0].end_utc') \
                   --json | jq '.result.analysis.neighbor_metrics.focus'

# Label a focus block for later retrieval:
npx neuroskill label "deep focus block — no distractions"

# Search all prior labeled focus moments:
npx neuroskill search-labels "deep focus" --k 10

# Alert when focus drops — poll every 30 seconds:
while true; do
  F=$(npx neuroskill status --json | jq '.scores.focus')
  if (( $(echo "$F < 0.35" | bc -l) )); then
    npx neuroskill notify "Focus low" "Current: $F — take a break?"
  fi
  sleep 30
done
```

---

## Stress & Anxiety

```bash

# LF/HF ratio — high = sympathetic dominance (stress):
npx neuroskill status --json | jq '.scores.lf_hf_ratio'

# Composite stress index from PPG:
npx neuroskill session 0 --json | jq '.metrics.stress_index'

# FAA — negative = frontal alpha withdrawal (linked to anxiety/depression):
npx neuroskill status --json | jq '.scores.faa'

# Frontal beta elevation (anxiety marker):
npx neuroskill status --json | jq '[.scores.bar, .scores.faa, .scores.lf_hf_ratio]'

# Compare stress markers across two sessions:
npx neuroskill compare --json | jq '.insights.deltas | {anxiety_faa: .faa, stress_hr: .hr, lf_hf: .lf_hf_ratio}'

# HRV breakdown (low rmssd = stress):
npx neuroskill session 0 --json | jq '{rmssd: .metrics.rmssd, sdnn: .metrics.sdnn, pnn50: .metrics.pnn50}'

# Label a stressful event:
npx neuroskill label "stressful presentation — racing thoughts"

# Find neurally similar stressful moments in history:
npx neuroskill search-labels "stress anxiety overwhelmed" --mode both --k 10
```

---

## Sleep Quality

```bash
# Last night's sleep summary:
npx neuroskill sleep --json | jq '.summary'

# Deep sleep percentage (N3 — most restorative):
npx neuroskill sleep --json | jq '(.summary.n3_epochs / .summary.total_epochs * 100 | round | tostring) + "% N3"'

# REM percentage:
npx neuroskill sleep --json | jq '(.summary.rem_epochs / .summary.total_epochs * 100 | round | tostring) + "% REM"'

# Full analysis (efficiency, onset, transitions):
npx neuroskill sleep --json | jq '.analysis'

# Sleep for a specific session:
npx neuroskill sleep 0

# Wakefulness and drowsiness during the day:
npx neuroskill status --json | jq '{drowsiness: .scores.drowsiness, wakefulness: .consciousness.wakefulness}'

# 48h sleep summary from status:
npx neuroskill status --json | jq '.sleep'
```

---

## Cognitive Load & ADHD

```bash

# Raw TBR (theta/beta ratio) — main ADHD biomarker, healthy ~1.0:
npx neuroskill status --json | jq '.scores.tbr'

# Cognitive load score (0–1):
npx neuroskill status --json | jq '.scores.cognitive_load'

# PAC theta-gamma — working memory coupling:
npx neuroskill status --json | jq '.scores.pac_theta_gamma'

# Sample entropy — lower = more regular/predictable (seen in ADHD):
npx neuroskill session 0 --json | jq '.metrics.sample_entropy'

# Full session trend for TBR and cognitive load:
npx neuroskill session 0 --json | jq '{tbr: .metrics.tbr, cog_load: .metrics.cognitive_load, tbr_trend: .trends.tbr}'

# Watch TBR in real time (lower is better for focus):
while true; do
  npx neuroskill status --json | jq '{tbr: .scores.tbr, focus: .scores.focus}'
  sleep 10
done
```

---

## Meditation & Relaxation

```bash
# Current meditation score:
npx neuroskill status --json | jq '.scores.meditation'

# Alpha peak frequency — rises during deep relaxation:
npx neuroskill status --json | jq '.scores.apf'

# Theta elevation (meditative absorption):
npx neuroskill status --json | jq '.scores.bands.rel_theta'

# Full session meditation trend:
npx neuroskill session 0 --json | jq '{meditation: .metrics.meditation, relaxation: .metrics.relaxation, trend: .trends.meditation}'

# Complexity during meditation (lower = more ordered):
npx neuroskill session 0 --json | jq '{perm_entropy: .metrics.permutation_entropy, sample_entropy: .metrics.sample_entropy}'

# Label meditation milestones:
npx neuroskill label "entered theta meditation state"
npx neuroskill label "meditation ended — felt deeply rested"

# Find all prior meditation sessions:
npx neuroskill search-labels "meditation" --mode both --k 20

# Compare a meditation session to a work session:
npx neuroskill compare \
  --a-start <meditation_start> --a-end <meditation_end> \
  --b-start <work_start> --b-end <work_end> \
  --json | jq '.insights.deltas | {relaxation, meditation: .meditation, alpha: .rel_alpha}'
```

---

## Cross-Modal Graph Search

```bash
# Find concepts related to "deep focus" across all data layers:
npx neuroskill interactive "deep focus"

# Increase reach to capture labels up to 30 minutes from each EEG point:
npx neuroskill interactive "deep focus" --reach 30

# More neighbors at each layer for a richer graph:
npx neuroskill interactive "meditation" --k-text 8 --k-eeg 8 --k-labels 5 --reach 20

# What text labels are semantically closest to "anxiety"?
npx neuroskill interactive "anxiety" --json | jq '[.nodes[] | select(.kind == "text_label") | {text, sim: (1 - .distance | . * 100 | round)}]'

# What nearby labels cluster around EEG moments found via "stress"?
npx neuroskill interactive "stress" --json | jq '[.nodes[] | select(.kind == "found_label") | .text]'

# Count discovered nodes by layer:
npx neuroskill interactive "flow state" --json | jq '[.nodes | group_by(.kind)[] | {(.[0].kind): length}] | add'

# Visualize the graph (requires graphviz):
npx neuroskill interactive "deep focus" --dot | dot -Tsvg -o focus_graph.svg && open focus_graph.svg
npx neuroskill interactive "meditation" --dot | dot -Tpng -o meditation_graph.png
```

---

## Comparing Two Sessions

```bash
# Auto: last 2 sessions:
npx neuroskill compare

# Get timestamps then compare explicitly:
npx neuroskill sessions --json | jq '.sessions[:2] | [.[].start_utc, .[].end_utc]'

npx neuroskill compare \
  --a-start 1740380100 --a-end 1740382665 \
  --b-start 1740412800 --b-end 1740415510

# Which metrics improved?
npx neuroskill compare --json | jq '.insights.improved'
npx neuroskill compare --json | jq '.insights.declined'

# Full delta table sorted by change:
npx neuroskill compare --json | jq '.insights.deltas | to_entries | sort_by(.value.pct) | reverse'

# 3D UMAP — how spatially separated are the two sessions?
npx neuroskill umap \
  --a-start 1740380100 --a-end 1740382665 \
  --b-start 1740412800 --b-end 1740415510 \
  --json | jq '.result.analysis.separation_score'
```

---

## Time-Range Queries

All commands that accept `--start` and `--end` use **Unix seconds (UTC)**.

```bash
# Get timestamps from the session list:
npx neuroskill sessions --json | jq '.sessions[0] | {start: .start_utc, end: .end_utc}'

# Convert a human date to Unix seconds:
date -j -f "%Y-%m-%d %H:%M" "2026-02-24 08:00" +%s      # macOS
date -d "2026-02-24 08:00" +%s                            # Linux

# Last 2 hours:
NOW=$(date +%s)
npx neuroskill sleep --start $((NOW - 7200)) --end $NOW

# Today midnight to now:
TODAY=$(date -j -v0H -v0M -v0S +%s 2>/dev/null || date -d "today 00:00" +%s)
npx neuroskill sleep --start $TODAY --end $(date +%s)

# The CLI always prints exact timestamps when auto-selecting — copy the rerun: line:
npx neuroskill sleep
# → rerun: npx neuroskill sleep --start 1740380100 --end 1740415510
```

---

## Automation & Scripting

```bash
# ── Cron / scheduled polling ──────────────────────────────────────────────
# Every 5 minutes: log focus score to a CSV
*/5 * * * * node /path/to/npx neuroskill status --json \
  | jq -r '[now, .scores.focus, .scores.relaxation, .scores.hr] | @csv' \
  >> ~/eeg_log.csv

# ── Shell function wrappers ───────────────────────────────────────────────
neuroskill_focus()  { npx neuroskill status --json | jq '.scores.focus'; }
neuroskill_relax()  { npx neuroskill status --json | jq '.scores.relaxation'; }
neuroskill_tbr()    { npx neuroskill status --json | jq '.scores.tbr'; }
neuroskill_battery(){ npx neuroskill status --json | jq '.device.battery'; }
```

**Python polling:**
```python
import subprocess, json, time

def neuroskill(cmd):
    r = subprocess.run(
        ["node", "neuroskill", *cmd.split(), "--json"],
        capture_output=True, text=True
    )
    return json.loads(r.stdout)

while True:
    data = neuroskill("status")
    focus = data["scores"]["focus"]
    print(f"Focus: {focus:.2f}")
    if focus < 0.35:
        neuroskill(f'notify "Focus dropped" "Current: {focus:.2f}"')
    time.sleep(30)
```

**Python HTTP (no Node required):**
```python
import requests

PORT = 8375

def neuroskill(command, **kwargs):
    return requests.post(
        f"http://127.0.0.1:{PORT}/",
        json={"command": command, **kwargs}
    ).json()

status = neuroskill("status")
print("Focus:", status["scores"]["focus"])
print("Battery:", status["device"]["battery"], "%")

sessions = neuroskill("sessions")
sleep = neuroskill("sleep",
    start_utc=sessions["sessions"][0]["start_utc"],
    end_utc=sessions["sessions"][0]["end_utc"])
print("N3 sleep:", sleep["summary"]["n3_epochs"], "epochs")
```

**Node.js HTTP polling:**
```javascript
const PORT = 8375;
const neuroskill = (cmd) =>
  fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  }).then(r => r.json());

setInterval(async () => {
  const { scores } = await neuroskill({ command: "status" });
  console.log(`focus=${scores.focus.toFixed(2)} relax=${scores.relaxation.toFixed(2)} hr=${scores.hr.toFixed(1)}`);
}, 5000);
```

---

> **⚠ Research use only.** EXG indices, sleep staging, consciousness metrics, and all
> derived scores are research biomarkers and experimental indicators. They are **not** validated
> medical devices and must **not** be used for diagnosis or clinical decision-making.
