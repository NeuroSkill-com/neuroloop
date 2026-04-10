# Response Compression in NeuroLoop

This document describes the response compression feature in NeuroLoop, which reduces token usage while maintaining technical accuracy.

## Overview

NeuroLoop now supports two compression modes for agent responses:

1. **Standard (default)**: Light compression that removes filler words and phrases while keeping grammar intact.
2. **Strong**: Heavy compression that drops articles, pronouns, and auxiliary verbs for maximum token reduction (caveman-style).

## Usage

### Configure Compression Mode

Use the `/settings` command to configure the compression mode:

```
/settings compression standard   # Light compression (default)
/settings compression strong     # Heavy compression
/settings compression off        # Disable compression
```

### Check Current Settings

```
/settings
```

This will display the current NeuroLoop settings, including the compression mode.

## Examples

### Standard Compression

**Input:**
```
I think the issue is that you are creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. I would recommend using useMemo to memoize the object.
```

**Output:**
```
the issue is that you are creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. using useMemo to memoize the object.
```

### Strong Compression

**Input:**
```
I think the issue is that you are creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. I would recommend using useMemo to memoize the object.
```

**Output:**
```
issue creating new object reference each render cycle. When pass inline object as prop, React's shallow compari⇒n sees as different object every time, triggers re-render. using useMemo memoize object.
```

## Implementation Details

### Compression Logic

The compression logic is implemented in `src/compression.ts`:

- **Standard Compression**: Removes common filler phrases like "I think", "I believe", "In my opinion", etc.
- **Strong Compression**: Applies standard compression and then:
  - Drops articles (a, an, the)
  - Drops auxiliary verbs (is, are, was, were, have, has, had, am)
  - Drops pronouns (I, you, we, they, he, she, it, my, your, our, their, his, her, its)
  - Drops conjunctions (and, but, or, so, then)
  - Drops prepositions (in, on, at, to, for, with, from, by, about)
  - Drops modal verbs (can, could, would, should, may, might, must)
  - Drops relative pronouns (that, which, who, whom, whose)
  - Drops adverbs (really, very, quite, rather, too, so, just)
  - Replaces common phrases with symbols (e.g., "because" → "⇒")

### Integration

The compression is integrated into the `neuroloop.ts` extension:

1. **Settings Management**: The `/settings` command allows users to configure the compression mode.
2. **Response Compression**: The `after_agent_finish` hook applies compression to agent responses based on the configured mode.

### Settings Persistence

Compression settings are stored in `~/.neuroloop/compression.json`:

```json
{
  "mode": "standard"
}
```

## Benefits

- **Token Reduction**: Reduces token usage by ~30-50% depending on the mode.
- **Faster Responses**: Fewer tokens mean faster response times.
- **Cost Savings**: Lower token usage reduces API costs.
- **Readability**: Strong compression can make responses more concise and easier to scan.

## Limitations

- **Strong Compression**: May reduce readability for complex technical explanations.
- **Code Blocks**: Compression is not applied to code blocks to preserve syntax.
- **Context**: Compression is applied to the agent's response only, not to the system prompt or context.

## Future Improvements

- Add more compression modes (e.g., "medium" for a balance between standard and strong).
- Allow per-session compression mode overrides.
- Add compression statistics to the UI (e.g., tokens saved).
- Support compression for specific domains (e.g., code reviews, commit messages).
