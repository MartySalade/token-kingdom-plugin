#!/usr/bin/env node
// Hook Stop : ne bloque jamais Claude, sort toujours en 0.
// --spawn : relance le sync dans un processus détaché, qui survit à la fin de Claude Code.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { acquireLock, releaseLock } from "./lib/lock.mjs";
import { getPaths } from "./lib/paths.mjs";
import { log } from "./lib/store.mjs";
import { runSync } from "./lib/sync.mjs";

if (process.argv.includes("--spawn")) {
  try {
    spawn(process.execPath, [fileURLToPath(import.meta.url)], { detached: true, stdio: "ignore" }).unref();
  } catch {
    // rien à faire : le prochain Stop retentera
  }
  process.exit(0);
}

const paths = getPaths();
try {
  if (acquireLock(paths.lock)) {
    try {
      const r = await runSync({ paths });
      if (r.status !== "not_linked") log(paths.log, `sync ${r.status} : ${r.sent} events, ${r.requests} requêtes`);
      if (r.status === "unauthorized") log(paths.log, "token refusé : relance /token-kingdom:link");
    } finally {
      releaseLock(paths.lock);
    }
  }
} catch (e) {
  try {
    log(paths.log, `erreur : ${e?.message ?? e}`);
  } catch {
    // rien à faire
  }
}
process.exit(0);
