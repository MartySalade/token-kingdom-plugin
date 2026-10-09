import assert from "node:assert/strict";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_API_URL, getPaths } from "../scripts/lib/paths.mjs";
import { log, readJson, writeJsonPrivate } from "../scripts/lib/store.mjs";
import { tmpHome } from "./helpers.mjs";

test("getPaths respecte TOKEN_KINGDOM_HOME et CLAUDE_CONFIG_DIR", () => {
  const p = getPaths({ TOKEN_KINGDOM_HOME: "/x/tk", CLAUDE_CONFIG_DIR: "/x/claude" });
  assert.equal(p.config, "/x/tk/config.json");
  assert.equal(p.projects, "/x/claude/projects");
  assert.equal(DEFAULT_API_URL, "https://token-kingdom.malleinmartin.workers.dev");
});

test("readJson renvoie le fallback si absent ou corrompu", () => {
  const { paths } = tmpHome();
  assert.deepEqual(readJson(paths.state, { files: {} }), { files: {} });
  writeJsonPrivate(paths.state, { ok: 1 });
  writeFileSync(paths.state, "{pas du json");
  assert.equal(readJson(paths.state, null), null);
});

test("writeJsonPrivate écrit en 0600 dans un dossier 0700", () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { token: "tk_x" });
  assert.deepEqual(readJson(paths.config, null), { token: "tk_x" });
  assert.equal(statSync(paths.config).mode & 0o777, 0o600);
  assert.equal(statSync(paths.home).mode & 0o777, 0o700);
});

test("log ajoute une ligne horodatée et repart à zéro au-delà de 1 Mo", () => {
  const { paths } = tmpHome();
  log(paths.log, "bonjour");
  assert.match(readFileSync(paths.log, "utf8"), /^\d{4}-\d{2}-\d{2}T.* bonjour\n$/);
  writeFileSync(paths.log, "x".repeat(1_000_001));
  log(paths.log, "après");
  assert.match(readFileSync(paths.log, "utf8"), /^\S+ après\n$/);
});
