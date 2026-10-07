---
name: link
description: Lie Claude Code à ton compte Token Kingdom avec le code affiché sur token-kingdom.com/connect
disable-model-invocation: true
argument-hint: <CODE> [url]
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/link.mjs" $ARGUMENTS`

Répète le message ci-dessus à l'utilisateur tel quel, sans rien ajouter.
