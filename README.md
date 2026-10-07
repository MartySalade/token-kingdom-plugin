# Token Kingdom — plugin Claude Code

Tes tokens Claude Code construisent ton royaume sur [token-kingdom.com](https://token-kingdom.com).

## Installation

```
/plugin marketplace add MartySalade/token-kingdom-plugin
/plugin install token-kingdom@token-kingdom
```

Puis connecte-toi sur token-kingdom.com/connect, génère un code et lance :

```
/token-kingdom:link <CODE>
```

Prérequis : Node.js ≥ 18 dans le `PATH`.

## Ce que le plugin envoie

À la fin de chaque réponse de Claude, le plugin lit les nouveaux messages de `~/.claude/projects/**/*.jsonl` et envoie pour chacun :

- un hash SHA-256 de l'id du message ;
- le nom du modèle ;
- les 4 compteurs de tokens (input, output, cache creation, cache read) ;
- l'horodatage.

**Jamais** de contenu, de prompt, de chemin, de nom de projet ou de fichier.

## Fichiers locaux

`~/.token-kingdom/` contient `config.json` (ton token, en 0600), `state.json` (la position de lecture de chaque transcript) et `sync.log`.

Pour se délier : supprime `~/.token-kingdom/config.json` et révoque le token sur le site.
