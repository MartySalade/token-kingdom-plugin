import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync, truncateSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LOG_MAX_BYTES = 1_000_000;

export function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJsonPrivate(path, data) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  renameSync(tmp, path);
}

export function log(path, msg) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    if (statSync(path).size > LOG_MAX_BYTES) truncateSync(path, 0);
  } catch {
    // pas encore de log
  }
  appendFileSync(path, `${new Date().toISOString()} ${msg}\n`, { mode: 0o600 });
}
