import { writeFileSync } from "node:fs";
import { DEFAULT_API_URL } from "./paths.mjs";
import { readJson, writeJsonPrivate } from "./store.mjs";
import { validApiUrl } from "./url.mjs";

const ICONS = [
  ["gold", "💰"],
  ["wood", "🪵"],
  ["stone", "🪨"],
];
const GREY = "\x1b[90m";
const RESET = "\x1b[0m";
const NO_UNDERLINE = "\x1b[24m";

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const localDay = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** « 💰 340  🪵 90 », chiffres en gris ; vide s'il n'y a rien. Lien du terminal (OSC 8) vers le village. */
export function formatSegment(total, url) {
  const parts = ICONS.map(([k, icon]) => [Math.floor(num(total[k])), icon]).filter(([n]) => n >= 1);
  if (parts.length === 0) return "";
  const text = parts.map(([n, icon]) => `${icon} ${GREY}${fmt(n)}${RESET}`).join(" ");
  return `\x1b]8;;${url}\x1b\\${NO_UNDERLINE}${text}\x1b]8;;\x1b\\`;
}

/** Écrit le total du jour pour la status line (vide si rien, ou si le dernier gain date d'un autre jour). */
export function writeSegment(paths, now = Date.now()) {
  const t = readJson(paths.today, null);
  const apiUrl = readJson(paths.config, null)?.apiUrl;
  const url = typeof apiUrl === "string" && validApiUrl(apiUrl) ? apiUrl : DEFAULT_API_URL;
  try {
    writeFileSync(paths.segment, t?.day === localDay(now) ? formatSegment(t, url) : "", { mode: 0o600 });
  } catch {
    // la status line n'affichera rien
  }
}

/** Ajoute les gains d'un lot accepté au total du jour et met la ligne à jour. */
export function addGains(paths, gains, now = Date.now()) {
  if (!gains || typeof gains !== "object") return;
  if (!ICONS.some(([k]) => num(gains[k]) > 0)) return;
  const day = localDay(now);
  const cur = readJson(paths.today, null);
  const base = cur?.day === day ? cur : null;
  writeJsonPrivate(paths.today, { day, ...Object.fromEntries(ICONS.map(([k]) => [k, num(base?.[k]) + num(gains[k])])) });
  writeSegment(paths, now);
}
