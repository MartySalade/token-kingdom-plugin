import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, utimesSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { STALE_LOCK_MS, acquireLock, releaseLock } from "../scripts/lib/lock.mjs";
import { tmpHome } from "./helpers.mjs";

test("un seul détenteur à la fois", () => {
  const { paths } = tmpHome();
  assert.equal(acquireLock(paths.lock), true);
  assert.equal(acquireLock(paths.lock), false);
  releaseLock(paths.lock);
  assert.equal(acquireLock(paths.lock), true);
});

test("reprend un lock périmé", () => {
  const { paths } = tmpHome();
  acquireLock(paths.lock);
  const old = (Date.now() - STALE_LOCK_MS - 60_000) / 1000;
  utimesSync(paths.lock, old, old);
  assert.equal(acquireLock(paths.lock), true);
});

test("le script de hook sort en 0 et libère le lock, même non lié", () => {
  const { env, paths } = tmpHome();
  const script = fileURLToPath(new URL("../scripts/sync.mjs", import.meta.url));
  const r = spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, input: "{}" });
  assert.equal(r.status, 0, r.stderr.toString());
  assert.equal(existsSync(paths.lock), false);
});

test("le script de hook sort en 0 même si le lock est déjà pris", () => {
  const { env, paths } = tmpHome();
  acquireLock(paths.lock);
  const script = fileURLToPath(new URL("../scripts/sync.mjs", import.meta.url));
  const r = spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, input: "{}" });
  assert.equal(r.status, 0);
  assert.equal(existsSync(paths.lock), true); // pas touché : il appartient à l'autre run
});
