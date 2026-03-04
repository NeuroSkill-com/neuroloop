---
name: neuroskill-transport
description: NeuroSkill EXG API transport layer — WebSocket and HTTP protocols, port discovery, Quick Start, output modes (default/--json/--full), and global CLI flags. Use when setting up a connection, choosing transport, or understanding output format options.
---

# NeuroSkill Transport & Quick Start

NeuroSkill runs a local server (auto-discovered via mDNS or `lsof`). All commands work over
**both** transports; the CLI picks the best one automatically.

---

## WebSocket (`ws://127.0.0.1:<port>`)

- **Full-duplex, low-latency.** Best for live data, event streaming, and polling loops.
- Commands are JSON messages sent over the socket; responses arrive as JSON messages.
- Supports real-time broadcast events (EXG packets, scores, label-created, …).
- Used by default when the server is reachable.

```bash
# Force WebSocket:
npx neuroskill status --ws

# Direct WebSocket from any language (wscat example):
wscat -c ws://127.0.0.1:8375
> {"command":"status"}
< {"command":"status","ok":true,"device":{...},"scores":{...},...}
```

---

## HTTP (`http://127.0.0.1:<port>/`)

- **Request / response only.** No live streaming, no broadcast events.
- All commands are `POST /` with a JSON body; the response is JSON.
- Useful from `curl`, Python `requests`, Node `fetch`, or any HTTP client.
- Automatic fallback when the WebSocket is unreachable.

```bash
# Force HTTP:
npx neuroskill status --http

# curl equivalent of every CLI command:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}'

# Extract a single field with jq:
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}' | jq '.scores.focus'
```

---

## Auto-transport (default)

When neither `--ws` nor `--http` is given, the CLI probes WebSocket first and silently
falls back to HTTP. Informational lines are written to **stderr** (not stdout), so JSON
piping is never polluted.

---

## Port Discovery

The CLI finds the port automatically via:
1. `--port <n>` flag (explicit, skips all discovery)
2. mDNS (`_skill._tcp` service advertisement, 5 s timeout)
3. `lsof` / `pgrep` fallback (probes each TCP LISTEN port)

```bash
npx neuroskill status --port 62853    # skip discovery entirely
```

---

## Quick Start

```bash
# Prerequisites (run once):
npm install -g neuroskill

# Snapshot of everything:
npx neuroskill status

# Pipe-friendly JSON output:
npx neuroskill status --json | jq '.scores'

# Print full help with examples:
npx neuroskill --help
```

---

## Output Modes

Every command has three output modes.

### Default (no flag) — human-readable summary only

Colored, structured summary to **stdout**. Raw JSON is discarded after rendering.

```bash
npx neuroskill status        # colored summary, no JSON
npx neuroskill session 0     # trend table, no JSON
npx neuroskill sleep         # stage counts, no JSON
```

### `--json` — raw JSON only, pipe-safe

`print()` calls suppressed; only `printResult()` fires. Plain JSON, no ANSI codes on **stdout**.
Informational lines go to **stderr** and never pollute the JSON stream.

```bash
npx neuroskill status --json                            # full JSON, no summary
npx neuroskill status --json | jq '.scores.focus'       # pipe to jq
npx neuroskill sleep  --json | jq '.summary'
npx neuroskill search --json | jq '.result.results[0].neighbors'
npx neuroskill umap   --json | jq '.result.points | length'
```

### `--full` — human-readable summary **and** colorized JSON

Both `print()` and `printResult()` fire. Summary prints first, then complete colorized JSON.

```bash
npx neuroskill status       --full   # summary + full colorized JSON
npx neuroskill session 0    --full   # trend table + raw first/second/trends objects
npx neuroskill sleep        --full   # stage counts + full epochs[] array
npx neuroskill umap         --full   # cluster analysis + full points[] array
```

> **Colors:** `--full` uses ANSI-colored JSON. For plain text, pipe through
> `sed 's/\x1b\[[0-9;]*m//g'` or use `--json`.

---

## Global Options

| Flag | Description |
|---|---|
| `--port <n>` | Connect to an explicit port (skips mDNS) |
| `--ws` | Force WebSocket; error if unreachable |
| `--http` | Force HTTP REST; no live-event commands |
| `--json` | Raw JSON only — no summary, no colors, pipe-safe |
| `--full` | Human-readable summary **and** colorized full JSON appended below |
| `--dot` | (`interactive` only) Graphviz DOT to stdout — pipe to `dot -Tsvg` |
| `--trends` | (`sessions` only) Show first-half → second-half deltas |
| `--mode <m>` | (`search-labels`) `text` \| `context` \| `both` |
| `--k <n>` | Number of nearest neighbors (`search`, `search-labels`) |
| `--k-text <n>` | (`interactive`) k for text-label HNSW search (default 5) |
| `--k-EXG <n>` | (`interactive`) k for EXG-similarity HNSW search (default 5) |
| `--k-labels <n>` | (`interactive`) k for label-proximity step (default 3) |
| `--reach <n>` | (`interactive`) temporal window in minutes around each EXG point (default 10) |
| `--ef <n>` | HNSW ef parameter (`search-labels`; default `max(k×4, 64)`) |
| `--seconds <n>` | Duration for `listen` (default 5) |
| `--profile <p>` | Profile name or UUID for `calibrate` |
| `--help` | Show full help and exit |

---

## Polling with `status`

`status` is the single fastest call to get a complete system snapshot.
Poll it periodically from any script or external tool to react to EXG state changes.

```bash
# One-shot snapshot:
npx neuroskill status --json

# Poll every 5 seconds and print focus score:
while true; do
  npx neuroskill status --json | jq '.scores.focus'
  sleep 5
done

# Alert when focus drops below 0.4:
while true; do
  FOCUS=$(npx neuroskill status --json | jq '.scores.focus')
  if (( $(echo "$FOCUS < 0.4" | bc -l) )); then
    npx neuroskill notify "Focus dropped" "Current: $FOCUS"
  fi
  sleep 10
done
```
