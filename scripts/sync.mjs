#!/usr/bin/env node
// Hook Stop (async) : ne bloque jamais Claude, sort toujours en 0.
import { acquireLock, releaseLock } from "./lib/lock.mjs";
import { getPaths } from "./lib/paths.mjs";
import { log } from "./lib/store.mjs";
import { runSync } from "./lib/sync.mjs";

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
