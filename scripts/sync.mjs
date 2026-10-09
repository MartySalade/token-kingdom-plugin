#!/usr/bin/env node
// Hook Stop : ne bloque jamais Claude, sort toujours en 0.
// --spawn : relance le sync dans un processus détaché, qui survit à la fin de Claude Code.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { acquireLock, releaseLock, touchLock } from "./lib/lock.mjs";
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
      const r = await runSync({ paths, heartbeat: () => touchLock(paths.lock) });
      if (r.status !== "not_linked") log(paths.log, `sync ${r.status}: ${r.sent} events, ${r.requests} requests`);
      if (r.status === "unauthorized") log(paths.log, "token rejected: delete ~/.token-kingdom/config.json, then run /token-kingdom:village again");
    } finally {
      releaseLock(paths.lock);
    }
  }
} catch (e) {
  try {
    log(paths.log, `error: ${e?.message ?? e}`);
  } catch {
    // rien à faire
  }
}
process.exit(0);
