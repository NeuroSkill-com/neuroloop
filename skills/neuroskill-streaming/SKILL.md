---
name: neuroskill-streaming
description: NeuroSkill `listen`, `notify`, `calibrate`, `timer`, and `raw` commands — real-time WebSocket event streaming, OS notifications, calibration profiles, focus timer, and raw JSON passthrough. Use when streaming live EXG events, sending alerts, starting calibration, or sending arbitrary commands.
---

# NeuroSkill Streaming & Control Commands

---

## `listen` — Real-Time Event Streaming

Passively collect real-time broadcast events from the server for a fixed duration.
Events include raw EXG packets, PPG, IMU, scores, and label-created notifications.

> Requires WebSocket (`--http` mode has no push streaming).

```bash
npx neuroskill listen                         # 5 seconds (default)
npx neuroskill listen --seconds 30
npx neuroskill listen --seconds 10 --json
npx neuroskill listen --seconds 5 --json | jq '[.[] | select(.event == "scores")]'
npx neuroskill listen --seconds 5 --json | jq 'map(select(.event == "EXG")) | length'
```

### JSON Event Shapes

```jsonc
// EXG packet (4 channels × N samples):
{ "event": "EXG", "electrode": 0, "samples": [12.3, -4.1], "timestamp": 1740412800.512 }

// PPG packet:
{ "event": "ppg", "channel": 0, "samples": [2048.1, 2051.3], "timestamp": 1740412800.512 }

// IMU packet:
{ "event": "imu", "ax": 0.01, "ay": -0.02, "az": 9.81, "gx": 0.0, "gy": 0.0, "gz": 0.0 }

// 5-second epoch scores:
{ "event": "scores", "focus": 0.70, "relaxation": 0.40, "engagement": 0.60,
  "rel_delta": 0.28, "rel_theta": 0.18, "rel_alpha": 0.32, "rel_beta": 0.17,
  "hr": 68.2, "snr": 14.3, "timestamp": 1740412805 }

// Label created:
{ "event": "label_created", "label_id": 43, "text": "distracted", "created_at": 1740412830 }
```

### Hidden Fields

| Hidden field | Contents |
|---|---|
| events array | Full array of every raw broadcast event — default summary only prints counts |

```bash
npx neuroskill listen --seconds 10 --json | jq '[.[] | select(.event == "scores")]'
npx neuroskill listen --seconds 5  --json | jq '.[0]'
```

---

## `notify` — OS Notification

Send a native OS notification through the NeuroSkill app.

```bash
npx neuroskill notify "Session complete"
npx neuroskill notify "Focus done" "Take a 5-minute break"
npx neuroskill notify "High drowsiness detected" "Consider a break"
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"notify","title":"Session done","body":"Great work!"}'
```

**Response:** `{ "command": "notify", "ok": true }`

```bash
# Verify in a script:
npx neuroskill notify "build finished" --json | jq -e '.ok' > /dev/null \
  && echo "notification sent" || echo "notification failed"
```

---

## `calibrate` — Open Calibration Window

Open the calibration window and start a profile immediately.
With `--profile`, matches by profile name (case-insensitive substring) or exact UUID.

```bash
npx neuroskill calibrate                              # uses active profile
npx neuroskill calibrate --profile "Eyes Open"        # by name
npx neuroskill calibrate --profile default            # by id
npx neuroskill calibrate --json | jq '.ok'
```

**List all profiles (raw command):**
```bash
npx neuroskill raw '{"command":"list_calibrations"}' --json | jq '[.profiles[].name]'
```

The `list_calibrations` response shape:
```jsonc
{
  "profiles": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Eyes Open/Closed",
      "loop_count": 3,
      "break_duration_secs": 5,
      "auto_start": true,
      "actions": [
        { "name": "Eyes Open",   "duration_secs": 20 },
        { "name": "Eyes Closed", "duration_secs": 20 }
      ]
    }
  ]
}
```

**HTTP:**
```bash
# List profiles:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"list_calibrations"}' | jq '.profiles[].name'

# Run a specific profile by UUID:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"run_calibration","id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'
```

```bash
# Script usage:
npx neuroskill calibrate --profile "Eyes Open" --json | jq -e '.ok' > /dev/null \
  && echo "calibration started" || echo "failed — is a Muse connected?"
```

---

## `timer` — Focus Timer

Open the Focus Timer window and auto-start the work phase using the last saved preset
(Pomodoro 25/5, Deep Work 50/10, or Short Focus 15/5).

```bash
npx neuroskill timer
npx neuroskill timer --json   # → { "command": "timer", "ok": true }
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"timer"}'
```

---

## `raw` — Raw JSON Passthrough

Send any JSON payload to the server and print the raw response.
Use this for commands not yet exposed as named CLI subcommands.

```bash
npx neuroskill raw '{"command":"status"}'
npx neuroskill raw '{"command":"sessions"}' --json
npx neuroskill raw '{"command":"search","start_utc":1740412800,"end_utc":1740415500,"k":3}'
npx neuroskill raw '{"command":"label","text":"retrospective note","label_start_utc":1740412800}'
```

**HTTP:**
```bash
# The raw command body is forwarded verbatim:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"search","start_utc":1740412800,"end_utc":1740415500,"k":3}'
```
