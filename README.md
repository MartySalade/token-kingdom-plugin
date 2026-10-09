# Token Kingdom — Claude Code plugin

Your Claude Code tokens build your kingdom on [token-kingdom.com](https://token-kingdom.com).

## Installation

```
/plugin marketplace add MartySalade/token-kingdom-plugin
/plugin install token-kingdom@token-kingdom
/token-kingdom:village
```

The first time, `/token-kingdom:village` founds your kingdom (you pick your handle in the browser); after that, each call opens your village.

Requires Node.js ≥ 18 on your `PATH`.

## What the plugin sends

At the end of each Claude reply, the plugin reads the new messages in `~/.claude/projects/**/*.jsonl` and sends, for each one:

- a SHA-256 hash of the message id;
- the model name;
- the 4 token counters (input, output, cache creation, cache read);
- the timestamp.

**Never** any content, prompt, path, project name or file name.

## Local files

`~/.token-kingdom/` holds `config.json` (your token, mode 0600), `state.json` (the read position in each transcript) and `sync.log`.

To unlink: delete `~/.token-kingdom/config.json` and revoke the token on the site.
