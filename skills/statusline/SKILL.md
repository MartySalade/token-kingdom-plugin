---
name: statusline
description: Show today's Token Kingdom earnings in your Claude Code status line (add "off" to remove them)
disable-model-invocation: true
argument-hint: [off]
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-setup.mjs" $ARGUMENTS`

Repeat the message above to the user exactly as is, adding nothing.
