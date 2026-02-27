---
name: neuroskill-sessions
description: NeuroSkill `session` and `sessions` commands — per-session metric breakdowns with first/second-half trends, session listing across all days, and Unix timestamp helpers. Use when analysing a specific recording session or listing all available sessions.
---

# NeuroSkill `session` and `sessions` Commands

---

## `session` — Single Session Breakdown

Full metric breakdown for a single recording session, with first-half → second-half trend arrows.
Index `0` = most recent, `1` = previous, and so on.

```bash
npx neuroskill session          # most recent session (default: 0)
npx neuroskill session 0        # same
npx neuroskill session 1        # previous session
npx neuroskill session 2        # two sessions ago
npx neuroskill session --json
npx neuroskill session 1 --json | jq '.metrics.focus'
npx neuroskill session 0 --json | jq '{focus: .metrics.focus, hr: .metrics.hr, trend: .trends.focus}'
```

**HTTP (two requests):**
```bash
# Step 1 — get session list to find timestamps:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"sessions"}' | jq '.sessions[0]'

# Step 2 — fetch full metrics for that session:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"session_metrics","start_utc":1740412800,"end_utc":1740415510}'
```

### Example Output

```
⚡ session [0]
  20260224  2/24/2026, 8:00:00 AM → 8:45:10 AM  45m 10s  541 epochs

  Core Scores
  focus                   0.70  ↑  (0.64 → 0.76)
  relaxation              0.40  ↓  (0.44 → 0.36)
  engagement              0.60  →  (0.60 → 0.61)
  meditation              0.52  ↑  (0.47 → 0.57)
  mood                    0.55  →  (0.54 → 0.56)
  cognitive load          0.33  ↓  (0.38 → 0.28)
  drowsiness              0.10  →  (0.11 → 0.09)
```

### JSON Response Structure

```jsonc
{
  "ok": true,
  "metrics": {
    "focus": 0.70,
    "relaxation": 0.40,
    "n_epochs": 541
    // ... all ~50 metrics (see neuroskill-data-reference skill)
  },
  "first": { "focus": 0.64, /* first-half averages */ },
  "second": { "focus": 0.76, /* second-half averages */ },
  "trends": {
    "focus": "up",       // "up" | "down" | "flat"
    "relaxation": "down"
    // ...
  }
}
```

### Hidden Fields (visible only with `--full` or `--json`)

| Hidden field | Contents |
|---|---|
| `first` | Every metric averaged over the **first half** of the session |
| `second` | Every metric averaged over the **second half** |
| `trends` | Direction string (`"up"` / `"down"` / `"flat"`) for every metric key |
| `metrics` | All ~50 metric fields — summary only prints a curated subset |

```bash
npx neuroskill session 0 --json | jq '.metrics'          # all metric averages
npx neuroskill session 0 --json | jq '.trends'           # all trend directions
npx neuroskill session 0 --json | jq '{f1: .first.focus, f2: .second.focus}'
npx neuroskill session 0 --json | jq '[.trends | to_entries[] | select(.value == "up") | .key]'
```

---

## `sessions` — List All Sessions

List every recorded session across all days. Sessions are contiguous embedding ranges
(gap threshold: 120 seconds between epochs).

```bash
npx neuroskill sessions
npx neuroskill sessions --json
npx neuroskill sessions --json | jq '.sessions | length'
npx neuroskill sessions --json | jq '.sessions[0]'
npx neuroskill sessions --json | jq '[.sessions[] | {day, dur: (.end_utc - .start_utc)}]'
npx neuroskill sessions --trends              # show per-session metric trends
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"sessions"}'
```

### Example Output

```
⚡ sessions
3 session(s)

  20260223  2/23/2026, 9:15:00 AM → 10:02:33 AM  47m 33s  570 epochs
  20260223  2/23/2026, 2:30:00 PM → 3:12:45 PM   42m 45s  513 epochs
  20260224  2/24/2026, 8:00:00 AM → 8:45:10 AM   45m 10s  541 epochs
```

### JSON Response

```jsonc
{
  "command": "sessions",
  "ok": true,
  "sessions": [
    {
      "day": "20260224",
      "start_utc": 1740412800,   // Unix seconds — newest first
      "end_utc": 1740415510,
      "n_epochs": 541
    },
    {
      "day": "20260223",
      "start_utc": 1740380100,
      "end_utc": 1740382665,
      "n_epochs": 513
    }
  ]
}
```

> **Getting Unix timestamps for other commands:**
> ```bash
> npx neuroskill sessions --json | jq '{start: .sessions[0].start_utc, end: .sessions[0].end_utc}'
> ```
