---
name: village
description: Open your Token Kingdom village (and found your kingdom the first time)
disable-model-invocation: true
argument-hint: [url]
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/village.mjs" $ARGUMENTS`

Repeat the message above to the user exactly as is, adding nothing.
