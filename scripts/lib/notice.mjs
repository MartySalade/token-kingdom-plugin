import { writeFileSync } from "node:fs";
import { readJson, writeJsonPrivate } from "./store.mjs";

export const NOTICE_EVERY_MS = 5 * 60_000;
const ICONS = [
  ["gold", "💰"],
  ["wood", "🪵"],
  ["stone", "🪨"],
];

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const localDay = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function line(total) {
  const parts = ICONS.map(([k, icon]) => [Math.floor(num(total[k])), icon]).filter(([n]) => n >= 1);
  return parts.length === 0 ? "" : `🏰 ${parts.map(([n, icon]) => `+${fmt(n)} ${icon}`).join(" ")}`;
}

/** Écrit le total du jour pour la status line (vide si rien, ou si le dernier gain date d'un autre jour). */
export function writeSegment(paths, now = Date.now()) {
  const t = readJson(paths.today, null);
  try {
    writeFileSync(paths.segment, t?.day === localDay(now) ? line(t) : "", { mode: 0o600 });
  } catch {
    // la status line n'affichera rien
  }
}

/** Ajoute les gains d'un lot accepté : cumul en attente d'affichage, et total du jour. */
export function addGains(paths, gains, now = Date.now()) {
  if (!gains || typeof gains !== "object") return;
  if (!ICONS.some(([k]) => num(gains[k]) > 0)) return;
  const sum = (cur) => Object.fromEntries(ICONS.map(([k]) => [k, num(cur?.[k]) + num(gains[k])]));
  const pending = readJson(paths.pending, {});
  writeJsonPrivate(paths.pending, { ...pending, ...sum(pending) });
  const day = localDay(now);
  const t = readJson(paths.today, null);
  writeJsonPrivate(paths.today, { day, ...sum(t?.day === day ? t : null) });
  writeSegment(paths, now);
}

/** Ligne à afficher, ou null (rien à dire, trop tôt, mode quiet ou status line). Remet le cumul à zéro quand elle part. */
export function takeNotice({ paths, quiet = false, now = Date.now() }) {
  const cur = readJson(paths.pending, null);
  if (!cur) return null;
  if (quiet) {
    writeJsonPrivate(paths.pending, {});
    return null;
  }
  if (now - num(cur.shownAt) < NOTICE_EVERY_MS) return null;
  const msg = line(cur);
  if (!msg) return null;
  writeJsonPrivate(paths.pending, { shownAt: now });
  return msg;
}
