import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";
import { setupStatusLine } from "../scripts/lib/statusline.mjs";
import { tmpHome } from "./helpers.mjs";

const ours = (paths) => `node "${paths.statuslineScript}"`;
const settingsOf = (paths) => JSON.parse(readFileSync(paths.settings, "utf8"));
function withSettings(settings) {
  const h = tmpHome();
  mkdirSync(dirname(h.paths.settings), { recursive: true });
  if (settings !== undefined) writeFileSync(h.paths.settings, typeof settings === "string" ? settings : JSON.stringify(settings));
  return h;
}
const run = (paths, input = "{}") =>
  spawnSync(process.execPath, [paths.statuslineScript], { input, encoding: "utf8", env: { ...process.env, TOKEN_KINGDOM_HOME: paths.home } }).stdout;

test("pas de status line → la nôtre est posée, le reste des réglages intact", () => {
  const { paths } = withSettings({ theme: "dark" });
  assert.match(setupStatusLine({ paths, mode: "on" }), /^✅ Your status line now shows/);
  assert.deepEqual(settingsOf(paths), { theme: "dark", statusLine: { type: "command", command: ours(paths) } });
  assert.ok(existsSync(`${paths.settings}.token-kingdom.bak`));
});

test("pas de fichier de réglages → créé", () => {
  const { paths } = withSettings(undefined);
  setupStatusLine({ paths, mode: "on" });
  assert.equal(settingsOf(paths).statusLine.command, ours(paths));
});

test("status line existante : enveloppée, off la rétablit", () => {
  const original = { type: "command", command: "echo mine" };
  const { paths } = withSettings({ statusLine: original });
  assert.match(setupStatusLine({ paths, mode: "on" }), /yours is kept/);
  assert.equal(settingsOf(paths).statusLine.command, ours(paths));
  assert.equal(run(paths), "mine");
  writeFileSync(paths.segment, "💰5");
  assert.equal(run(paths), "mine    💰5");
  assert.match(setupStatusLine({ paths, mode: "off" }), /restored/);
  assert.deepEqual(settingsOf(paths).statusLine, original);
  assert.equal(existsSync(paths.statuslineInner), false);
});

test("sans ancienne status line : ligne par défaut + gains, off la retire", () => {
  const { paths } = withSettings({});
  setupStatusLine({ paths, mode: "on" });
  writeFileSync(paths.segment, "💰5");
  const out = run(paths, JSON.stringify({ model: { display_name: "Sonnet" }, cwd: "/a/b", context_window: { used_percentage: 11.4 } }));
  assert.match(out, /Sonnet.*b.*ctx: 11%\s+💰5$/s);
  setupStatusLine({ paths, mode: "off" });
  assert.equal("statusLine" in settingsOf(paths), false);
});

test("idempotent, et une status line qui lit déjà les gains est laissée", () => {
  const a = withSettings({});
  setupStatusLine({ paths: a.paths, mode: "on" });
  assert.match(setupStatusLine({ paths: a.paths, mode: "on" }), /already shows/);
  const b = withSettings({ statusLine: { type: "command", command: "cat ~/.token-kingdom/statusline.txt" } });
  assert.match(setupStatusLine({ paths: b.paths, mode: "on" }), /already reads/);
});

test("réglages illisibles : rien n'est écrit", () => {
  const { paths } = withSettings("{ pas du json");
  assert.match(setupStatusLine({ paths, mode: "on" }), /^❌/);
  assert.equal(readFileSync(paths.settings, "utf8"), "{ pas du json");
});

test("off sans notre status line : rien à faire", () => {
  const { paths } = withSettings({ statusLine: { type: "command", command: "echo x" } });
  assert.match(setupStatusLine({ paths, mode: "off" }), /nothing to remove/);
});

test("un script qui lit déjà les gains est reconnu", () => {
  const h = withSettings({});
  const script = `${h.root}/mine.sh`;
  writeFileSync(script, "tk=$(cat ~/.token-kingdom/statusline.txt)\n");
  writeFileSync(h.paths.settings, JSON.stringify({ statusLine: { type: "command", command: `bash ${script}` } }));
  assert.match(setupStatusLine({ paths: h.paths, mode: "on" }), /already reads/);
});
