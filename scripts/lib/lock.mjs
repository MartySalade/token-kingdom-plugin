import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, utimesSync, writeSync } from "node:fs";
import { dirname } from "node:path";

export const STALE_LOCK_MS = 15 * 60_000;

const create = (path) => {
  const fd = openSync(path, "wx", 0o600);
  writeSync(fd, String(process.pid));
  closeSync(fd);
  return true;
};

function holderAlive(path) {
  const pid = Number.parseInt(readFileSync(path, "utf8"), 10);
  if (!Number.isInteger(pid) || pid <= 0) return true; // contenu illisible : on se fie à l'âge
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

export function acquireLock(path, now = Date.now()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    return create(path);
  } catch {
    try {
      // lock laissé par un processus tué (ex. Claude Code fermé en plein sync) ou trop vieux
      const stale = now - statSync(path).mtimeMs > STALE_LOCK_MS || !holderAlive(path);
      if (!stale) return false;
      unlinkSync(path);
      return create(path);
    } catch {
      return false;
    }
  }
}

/** Heartbeat : un sync long garde son lock frais pour ne pas être pris pour périmé. */
export function touchLock(path) {
  try {
    const now = new Date();
    utimesSync(path, now, now);
  } catch {
    // lock disparu : rien à rafraîchir
  }
}

/** Ne supprime que notre propre lock, jamais celui d'un autre processus. */
export function releaseLock(path) {
  try {
    if (readFileSync(path, "utf8") === String(process.pid)) unlinkSync(path);
  } catch {
    // déjà libéré
  }
}
