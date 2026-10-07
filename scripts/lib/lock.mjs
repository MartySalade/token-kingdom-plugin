import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

export const STALE_LOCK_MS = 15 * 60_000;

const create = (path) => {
  closeSync(openSync(path, "wx", 0o600));
  return true;
};

export function acquireLock(path, now = Date.now()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    return create(path);
  } catch {
    try {
      if (now - statSync(path).mtimeMs <= STALE_LOCK_MS) return false;
      unlinkSync(path);
      return create(path);
    } catch {
      return false;
    }
  }
}

export function releaseLock(path) {
  try {
    unlinkSync(path);
  } catch {
    // déjà libéré
  }
}
