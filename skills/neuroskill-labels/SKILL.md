---
name: neuroskill-labels
description: NeuroSkill `label`, `search-labels`, and `interactive` commands — creating EXG text annotations, semantic vector search over labels, and cross-modal 4-layer graph search combining text and EXG similarity. Use when annotating EXG moments or searching for past states by description.
---

# NeuroSkill Label Commands

---

## `label` — Create a Timestamped Annotation

Create a timestamped text annotation on the current EXG moment.
Labels are stored in the database, shown in the dashboard, and searchable via `search-labels`.

```bash
npx neuroskill label "meditation start"
npx neuroskill label "eyes closed"
npx neuroskill label "feeling anxious"
npx neuroskill label "coffee just finished"
npx neuroskill label "task switch: coding → email"
npx neuroskill label "phone notification distracted me"
npx neuroskill label --json "focus block start"   # just print the label_id
```

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"label","text":"meditation start"}'

LABEL_ID=$(curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"label","text":"focus block start"}' | jq '.label_id')
echo "Created label #$LABEL_ID"
```

**Response:** `{ "command": "label", "ok": true, "label_id": 42 }`

---

## `search-labels` — Semantic Search Over Annotations

Semantic (vector) search across all your EXG annotations.
The query is embedded and compared against the label HNSW index.

```bash
npx neuroskill search-labels "deep focus"
npx neuroskill search-labels "relaxed meditation" --k 10
npx neuroskill search-labels "anxiety" --mode context
npx neuroskill search-labels "flow state" --mode both --k 5
npx neuroskill search-labels "creative work" --json | jq '.results[].text'
npx neuroskill search-labels "morning routine" --json | jq '.results[] | {text, sim: .similarity}'
```

**Modes:**
- `text` (default) — searches the label short-text HNSW index
- `context` — searches the long-context HNSW (requires context fields to be set)
- `both` — runs both indexes, deduplicates by best cosine distance

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"search_labels","query":"deep focus","k":10,"mode":"text"}'
```

### JSON Response

```jsonc
{
  "command": "search_labels",
  "ok": true,
  "query": "deep focus",
  "mode": "text",
  "model": "Xenova/bge-small-en-v1.5",
  "k": 10,
  "count": 3,
  "results": [
    {
      "label_id": 7,
      "text": "focused reading session",
      "context": "",
      "distance": 0.1204,
      "similarity": 0.8796,         // 1 − distance
      "EXG_start": 1740412800,
      "EXG_end": 1740413100,
      "created_at": 1740412810,
      "embedding_model": "bge-small-en-v1.5",
      "EXG_metrics": {
        "focus": 0.74,
        "relaxation": 0.38,
        "engagement": 0.62,
        "hr": 66.1,
        "mood": 0.58,
        "rel_alpha": 0.35,
        "rel_beta": 0.19
      }
    }
  ]
}
```

### Hidden Fields

| Hidden field | Contents |
|---|---|
| `results[].EXG_metrics` | Full EXG metrics for the label window — summary shows only 5 fields |
| `results[].context` | Long-context string — only a truncated preview in the summary |

```bash
npx neuroskill search-labels "deep focus" --json | jq '.results[0].EXG_metrics'
npx neuroskill search-labels "stress" --json | jq '[.results[].EXG_metrics.tbr]'
```

---

## `interactive` — Cross-Modal 4-Layer Graph Search

Combines semantic text search, EXG similarity search, and temporal label proximity
into a single directed graph:

```
"deep focus"  →  text_label nodes       (semantically similar annotations)
                      ↓
              EXG_point nodes           (raw EXG moments from label time windows)
                      ↓
              found_label nodes         (labels near those EXG moments in time)
```

### Output Formats

| Flag | Output |
|---|---|
| _(none)_ | Colored human-readable summary |
| `--full` | Summary **+** colorized JSON |
| `--json` | Raw JSON: `{ query, nodes, edges, dot }` |
| `--dot` | Graphviz DOT source — pipe to `dot -Tsvg` or `dot -Tpng` |

```bash
npx neuroskill interactive "deep focus"
npx neuroskill interactive "meditation" --k-text 8 --k-EXG 8 --k-labels 5 --reach 15
npx neuroskill interactive "flow state" --json | jq '.nodes | length'
npx neuroskill interactive "focus" --json | jq '[.nodes[] | select(.kind == "text_label") | .text]'
npx neuroskill interactive "anxiety" --json | jq '[.nodes[] | select(.kind == "EXG_point") | .timestamp_unix]'
npx neuroskill interactive "stress" --json | jq '[.nodes[] | select(.kind == "found_label") | .text]'

# Render graph (requires graphviz):
npx neuroskill interactive "deep focus" --dot | dot -Tsvg > graph.svg
npx neuroskill interactive "meditation" --dot | dot -Tpng > graph.png
npx neuroskill interactive "focus" --json | jq -r '.dot' | dot -Tsvg > graph.svg
```

### Pipeline Parameters

| Flag | Default | Range | Description |
|---|---|---|---|
| `--k-text <n>` | 5 | 1–20 | k for text-label HNSW search |
| `--k-EXG <n>` | 5 | 1–20 | k for EXG-similarity HNSW per text label |
| `--k-labels <n>` | 3 | 1–10 | k for label-proximity per EXG point |
| `--reach <n>` | 10 | 1–60 | Temporal window (minutes) around each EXG point |

**HTTP:**
```bash
curl -s -X POST http://127.0.0.1:8375/ \
  -H "Content-Type: application/json" \
  -d '{"command":"interactive_search","query":"deep focus","k_text":5,"k_EXG":5,"k_labels":3,"reach_minutes":10}'
```

### JSON Response Structure

```jsonc
{
  "command": "interactive_search",
  "ok": true,
  "query": "deep focus",
  "nodes": [
    { "id": "query",    "kind": "query",       "text": "deep focus",           "distance": 0.0    },
    { "id": "tl_0",    "kind": "text_label",   "text": "focused reading",      "distance": 0.1204 },
    { "id": "ep_...",  "kind": "EXG_point",    "text": null, "timestamp_unix": 1740413565, "distance": 0.0231 },
    { "id": "fl_42",   "kind": "found_label",  "text": "eyes closed",          "distance": 0.133  }
  ],
  "edges": [
    { "from_id": "query", "to_id": "tl_0",   "kind": "text_sim",   "distance": 0.1204 },
    { "from_id": "tl_0",  "to_id": "ep_...", "kind": "EXG_bridge", "distance": 0.0231 },
    { "from_id": "ep_...", "to_id": "fl_42", "kind": "label_prox", "distance": 0.133  }
  ],
  "dot": "digraph interactive_search { ... }"
}
```

### Node Kinds

| Kind | Layer | Description |
|---|---|---|
| `query` | 0 | The embedded search keyword (always exactly 1) |
| `text_label` | 1 | Annotations semantically similar to the query |
| `EXG_point` | 2 | Raw EXG moments from label time windows |
| `found_label` | 3 | Annotations discovered near EXG moments in time |

### Edge Kinds

| Kind | Connects | Distance meaning |
|---|---|---|
| `text_sim` | query → text_label | Cosine distance in text embedding space |
| `EXG_bridge` | text_label → EXG_point | Cosine distance in EXG embedding space |
| `EXG_sim` | EXG_point → EXG_point | Cosine distance (cross-edge) |
| `label_prox` | EXG_point → found_label | Temporal proximity (fraction of reach window) |

> **Empty results:** If no labels have been embedded yet, only the query node is returned.
> Annotate moments with `label` first, then run `search-labels` to verify, then re-run `interactive`.
