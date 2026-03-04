---
name: neuroskill-search
description: NeuroSkill `search` and `compare` commands — ANN search for neurally similar EXG moments across all history, and A/B session comparison with metric deltas, trend directions, and UMAP enqueuing. Use when finding similar past brain states or comparing two recording sessions.
---

# NeuroSkill `search` and `compare` Commands

---

## `search` — Neural Similarity Search

Find EXG moments from your entire history that are neurally similar to a query range.
Uses approximate nearest-neighbor (ANN) search over the 5-second embedding HNSW index.

Auto-range: when no `--start`/`--end` flags are given, the CLI automatically uses your
most recent session and prints a `rerun:` line you can copy-paste.

```bash
npx neuroskill search                                     # auto: last session, k=5
npx neuroskill search --k 10                             # 10 nearest neighbors
npx neuroskill search --start 1740412800 --end 1740415500
npx neuroskill search --start 1740412800 --end 1740415500 --k 20
npx neuroskill search --json | jq '.result.results | length'
npx neuroskill search --json | jq '.result.results[0].neighbors[0]'
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"search","start_utc":1740412800,"end_utc":1740415500,"k":5}'
```

### JSON Response

```jsonc
{
  "command": "search",
  "ok": true,
  "result": {
    "query_count": 541,
    "searched_days": ["20260224", "20260223"],
    "analysis": {
      "distance_stats": { "min": 0.0231, "mean": 0.1842, "max": 0.3901, "stddev": 0.0612 },
      "time_span_hours": 744.3,
      "neighbor_metrics": { "focus": 0.67, "relaxation": 0.43, "hr": 67.4 },
      "temporal_distribution": { "8": 142, "9": 198 },
      "top_days": [["20260222", 312], ["20260221", 289]]
    },
    "results": [
      {
        "timestamp_unix": 1740412800,
        "neighbors": [
          {
            "distance": 0.0231,
            "timestamp_unix": 1740320040,
            "date": "20260222",
            "device_name": "Muse-A1B2",
            "labels": [{ "text": "morning focus block" }],
            "metrics": { "focus": 0.73, "relaxation": 0.41, "hr": 66.2, "rel_alpha": 0.34 }
          }
        ]
      }
    ]
  }
}
```

### Hidden Fields (visible only with `--full` or `--json`)

| Hidden field | Contents |
|---|---|
| `result.results[]` | Full list of query epochs with complete `neighbors[]` arrays |
| `result.analysis.temporal_distribution` | Hour-of-day match counts as raw numbers |
| `result.analysis.top_days` | `[["YYYYMMDD", count], …]` |

```bash
npx neuroskill search --json | jq '.result.results | length'
npx neuroskill search --json | jq '.result.results[0].neighbors'
npx neuroskill search --json | jq '[.result.results[].neighbors[]] | sort_by(.distance) | .[0]'
npx neuroskill search --json | jq '.result.analysis.temporal_distribution'
```

---

## `compare` — A/B Session Comparison

Side-by-side A/B comparison of two sessions. Returns averaged metrics for both ranges,
delta values, and trend direction for every metric. Also enqueues a 3D UMAP projection.

Auto-range: uses your last two sessions as A (older) and B (newer).

```bash
npx neuroskill compare                                    # auto: last 2 sessions
npx neuroskill compare --a-start 1740380100 --a-end 1740382665 \
                    --b-start 1740412800 --b-end 1740415510
npx neuroskill compare --json
npx neuroskill compare --json | jq '{a_focus: .a.focus, b_focus: .b.focus}'
npx neuroskill compare --json | jq '.insights.deltas.focus'
npx neuroskill compare --json | jq '.insights.improved'
npx neuroskill compare --json | jq '.insights.declined'
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{
    "command": "compare",
    "a_start_utc": 1740380100, "a_end_utc": 1740382665,
    "b_start_utc": 1740412800, "b_end_utc": 1740415510
  }' | jq '{a_focus: .a.focus, b_focus: .b.focus}'
```

### JSON Response

```jsonc
{
  "ok": true,
  "a": { "focus": 0.62, "relaxation": 0.45, "hr": 72.1, "n_epochs": 513 /* ... */ },
  "b": { "focus": 0.71, "relaxation": 0.38, "hr": 68.4, "n_epochs": 541 /* ... */ },
  "sleep_a": { "total_epochs": 0 /* ... */ },
  "sleep_b": { "total_epochs": 0 /* ... */ },
  "insights": {
    "n_epochs_a": 513,
    "n_epochs_b": 541,
    "deltas": {
      "focus": { "a": 0.62, "b": 0.71, "abs": 0.09, "pct": 14.5, "direction": "up" },
      "relaxation": { "a": 0.45, "b": 0.38, "abs": -0.07, "pct": -15.6, "direction": "down" }
    },
    "improved": ["focus", "meditation", "engagement"],
    "declined": ["relaxation", "hr"]
  },
  "umap": {
    "queued": true,
    "job_id": 5,
    "estimated_secs": 14,
    "n_a": 513,
    "n_b": 541
  }
}
```

### Hidden Fields

| Hidden field | Contents |
|---|---|
| `a` / `b` | All ~50 averaged metrics for each session |
| `sleep_a` / `sleep_b` | Full sleep staging summary for each range |
| `insights.deltas` | Full delta table for every metric |
| `umap` | Enqueued job info — use with `umap` command |

```bash
npx neuroskill compare --json | jq '.a'                         # all metrics for A
npx neuroskill compare --json | jq '.b'                         # all metrics for B
npx neuroskill compare --json | jq '.insights.deltas'           # every metric delta
npx neuroskill compare --json | jq '.insights.deltas | to_entries | sort_by(.value.pct) | reverse'
npx neuroskill compare --json | jq '.umap.job_id'               # use with umap --json
```
