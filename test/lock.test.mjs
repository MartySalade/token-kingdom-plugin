import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync as mk, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { STALE_LOCK_MS, acquireLock, releaseLock, touchLock } from "../scripts/lib/lock.mjs";
import { writeJsonPrivate } from "../scripts/lib/store.mjs";
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

test("reprend tout de suite un lock dont le processus est mort", () => {
  const { paths } = tmpHome();
  const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"]).stdout.toString();
  mk(paths.home, { recursive: true });
  writeFileSync(paths.lock, dead);
  assert.equal(acquireLock(paths.lock), true);
});

test("ne reprend pas un lock récent dont le processus est vivant", () => {
  const { paths } = tmpHome();
  mk(paths.home, { recursive: true });
  writeFileSync(paths.lock, String(process.pid));
  assert.equal(acquireLock(paths.lock), false);
});

test("ne supprime pas un lock qui appartient à un autre processus", () => {
  const { paths } = tmpHome();
  mk(paths.home, { recursive: true });
  writeFileSync(paths.lock, "999999");
  releaseLock(paths.lock);
  assert.equal(existsSync(paths.lock), true);
});

test("touchLock rafraîchit le lock pour qu'un sync long ne soit pas évincé", () => {
  const { paths } = tmpHome();
  acquireLock(paths.lock);
  const old = (Date.now() - STALE_LOCK_MS - 60_000) / 1000;
  utimesSync(paths.lock, old, old);
  touchLock(paths.lock);
  assert.equal(acquireLock(paths.lock), false);
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

test("--spawn rend la main tout de suite et le sync continue dans un processus détaché", async () => {
  const { createServer } = await import("node:http");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  // serveur qui ne répond jamais : un sync synchrone bloquerait jusqu'au timeout de 5 s
  const server = createServer(() => {});
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const { port } = server.address();
  try {
    const { env, paths } = tmpHome();
    writeJsonPrivate(paths.config, { apiUrl: `http://localhost:${port}`, token: "tk_x", handle: "a" });
    mkdirSync(join(paths.projects, "p"), { recursive: true });
    const line = { type: "assistant", timestamp: "2026-10-07T12:00:00Z", message: { id: "m", usage: { output_tokens: 1 } } };
    writeFileSync(join(paths.projects, "p", "a.jsonl"), `${JSON.stringify(line)}\n`);
    const script = fileURLToPath(new URL("../scripts/sync.mjs", import.meta.url));
    const t0 = Date.now();
    const child = spawn(process.execPath, [script, "--spawn"], { env: { ...process.env, ...env }, stdio: "ignore" });
    const code = await new Promise((res) => child.on("exit", res));
    assert.equal(code, 0);
    assert.ok(Date.now() - t0 < 2000, `le parent doit rendre la main vite (${Date.now() - t0} ms)`);
    for (let i = 0; i < 100 && !existsSync(paths.log); i++) await new Promise((res) => setTimeout(res, 100));
    assert.match(readFileSync(paths.log, "utf8"), /sync retry_later/);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
