import { readJson, writeJsonPrivate } from "./store.mjs";

export const NOTICE_EVERY_MS = 5 * 60_000;
const ICONS = [
  ["gold", "🪙"],
  ["wood", "🪵"],
  ["stone", "🪨"],
];

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

/** Ajoute les gains d'un lot accepté au cumul en attente d'affichage. */
export function addPending(file, gains) {
  if (!gains || typeof gains !== "object") return;
  const cur = readJson(file, {});
  const next = { ...cur };
  let any = false;
  for (const [k] of ICONS) {
    const g = num(gains[k]);
    if (g > 0) any = true;
    next[k] = num(cur[k]) + g;
  }
  if (any) writeJsonPrivate(file, next);
}

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

/** Ligne à afficher, ou null (rien à dire, trop tôt, ou mode quiet). Remet le cumul à zéro quand elle part. */
export function takeNotice({ paths, quiet = false, now = Date.now() }) {
  const cur = readJson(paths.pending, null);
  if (!cur) return null;
  if (quiet) {
    writeJsonPrivate(paths.pending, {});
    return null;
  }
  if (now - num(cur.shownAt) < NOTICE_EVERY_MS) return null;
  const parts = ICONS.map(([k, icon]) => [Math.floor(num(cur[k])), icon]).filter(([n]) => n >= 1);
  if (parts.length === 0) return null;
  writeJsonPrivate(paths.pending, { shownAt: now });
  return `🏰 ${parts.map(([n, icon]) => `+${fmt(n)} ${icon}`).join(" ")}`;
}
