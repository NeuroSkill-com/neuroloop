---
name: neuroskill-status
description: NeuroSkill `status` command — full system snapshot including device state, signal quality, EXG scores, band powers, ratios, embeddings, labels, sleep summary, and recording history. Use when checking current EXG state, device connection, or session metadata.
---

# NeuroSkill `status` Command

Full snapshot: device state, session, signal quality, scores, bands, embeddings, labels,
sleep summary, and recording history.

```bash
npx neuroskill status
npx neuroskill status --json
npx neuroskill status --json | jq '.scores.focus'
npx neuroskill status --json | jq '.scores.bands'
npx neuroskill status --json | jq '.device.battery'
npx neuroskill status --json | jq '.signal_quality'
npx neuroskill status --json | jq '.sleep'
npx neuroskill status --json | jq '.history.current_streak_days'
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}'
```

---

## Full JSON Response

```jsonc
{
  "command": "status",
  "ok": true,
  "device": {
    "state": "connected",          // "connected" | "connecting" | "disconnected"
    "name": "Muse-A1B2",
    "battery": 73,                 // percent
    "firmware": "1.3.4",
    "EXG_samples": 195840,
    "ppg_samples": 30600,
    "imu_samples": 122400
  },
  "session": {
    "start_utc": 1740412800,       // Unix seconds (UTC)
    "duration_secs": 1847,
    "n_epochs": 369                // 5-second embedding epochs computed so far
  },
  "signal_quality": {
    "tp9": 0.95,                   // 0–1; ≥0.9 = good, ≥0.7 = acceptable
    "af7": 0.88,
    "af8": 0.91,
    "tp10": 0.97
  },
  "scores": {
    // Core scores (0–1 unless noted):
    "focus": 0.70,
    "relaxation": 0.40,
    "engagement": 0.60,
    "meditation": 0.52,
    "mood": 0.55,
    "cognitive_load": 0.33,
    "drowsiness": 0.10,
    "hr": 68.2,                    // bpm (from PPG)
    "snr": 14.3,                   // signal-to-noise ratio in dB
    "stillness": 0.88,             // 0–1; 1 = perfectly still
    // Band powers (relative, sum ≈ 1):
    "bands": {
      "rel_delta": 0.28,
      "rel_theta": 0.18,
      "rel_alpha": 0.32,
      "rel_beta":  0.17,
      "rel_gamma": 0.05
    },
    // EXG ratios & spectral indices:
    "faa": 0.042,                  // Frontal Alpha Asymmetry (positive = approach)
    "tar": 0.56,                   // Theta/Alpha Ratio
    "bar": 0.53,                   // Beta/Alpha Ratio
    "tbr": 1.06,                   // Theta/Beta Ratio (ADHD proxy)
    "apf": 10.1,                   // Alpha Peak Frequency (Hz)
    "coherence": 0.614,
    "mu_suppression": 0.031
  },
  "embeddings": {
    "today": 342,
    "total": 14820,
    "recording_days": 31
  },
  "labels": {
    "total": 58,
    "recent": [
      { "id": 42, "text": "meditation start", "created_at": 1740413100 }
    ]
  },
  "sleep": {
    // Last 48 h sleep staging summary:
    "total_epochs": 1054,
    "wake_epochs": 134,
    "n1_epochs": 89,
    "n2_epochs": 421,
    "n3_epochs": 298,
    "rem_epochs": 112,
    "epoch_secs": 5
  },
  "history": {
    "total_sessions": 63,
    "recording_days": 31,
    "current_streak_days": 7,
    "total_recording_hours": 94.2,
    "longest_session_min": 187,
    "avg_session_min": 89
  }
}
```

---

## Hidden Fields (visible only with `--full` or `--json`)

| Hidden field | Type | Contents |
|---|---|---|
| `scores.faa`, `scores.tar`, `scores.bar` … | numbers | EXG ratios and spectral indices not surfaced in the default summary |
| `calibration.actions[]` | array | Full ordered list of calibration step objects |
| `labels.recent[]` | array | Full label objects; summary only prints text + timestamp |
| `history.today_vs_avg` | object | Per-metric today-vs-7-day-avg comparison table |

```bash
npx neuroskill status --json | jq '.history.today_vs_avg'
npx neuroskill status --json | jq '.calibration.actions'
npx neuroskill status --json | jq '.labels.recent'
```
