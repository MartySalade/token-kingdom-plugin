# Token Kingdom — Claude Code plugin

Your Claude Code tokens build your kingdom on [Token Kingdom](https://token-kingdom.malleinmartin.workers.dev).

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
- a SHA-256 hash of its session id;
- the model name;
- the 4 token counters (input, output, cache creation, cache read);
- the timestamp.

It also sends the **title of each session** (the one Claude Code generates, or the one you gave it with `/rename`), so your village can list your sessions and what each one earned you. Titles are shown only to you, never on your public village.

**Never** any prompt, reply, code, path, project name or file name.

## Local files

`~/.token-kingdom/` holds `config.json` (your token, mode 0600), `state.json` (the read position in each transcript) and `sync.log`.

`config.json` is a secret: anyone who has it can sign in to your kingdom and send usage in your name. Don't share it or commit it.

Using Claude Code on another computer? Copy ~/.token-kingdom/config.json to it instead of running this command there, or you'll found a second kingdom.

To unlink this computer: delete `~/.token-kingdom/config.json`.
