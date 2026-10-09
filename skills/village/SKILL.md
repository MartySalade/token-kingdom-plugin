---
name: village
description: Ouvre ton village Token Kingdom (et crée ton royaume la première fois)
disable-model-invocation: true
argument-hint: [url]
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/village.mjs" $ARGUMENTS`

Répète le message ci-dessus à l'utilisateur tel quel, sans rien ajouter.
