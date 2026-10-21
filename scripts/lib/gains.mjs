import { createHash } from "node:crypto";
import { readJson, writeJsonPrivate } from "./store.mjs";
import { DEFAULT_API_URL } from "./paths.mjs";
import { validApiUrl } from "./url.mjs";

const DAY_MS = 86_400_000;
const KEEP_MS = 3 * DAY_MS;
export const RESOURCES = ["gold", "wood", "stone"];
const ICONS = { gold: "💰", wood: "🪵", stone: "🪨" };
const GREY = "\x1b[90m";
const RESET = "\x1b[0m";
const NO_UNDERLINE = "\x1b[24m";

/** Empreinte de session envoyée au serveur (l'identifiant brut ne quitte pas la machine). */
export const sessionHash = (sessionId) => createHash("sha256").update(`session:${sessionId}`).digest("hex");

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

// même correspondance tokens → ressource que le serveur (output → or, input + cache créé → bois, cache lu → pierre)
const weights = (e) => ({ gold: num(e.output), wood: num(e.input) + num(e.cacheCreation), stone: num(e.cacheRead) });

/** Part de chaque session dans les gains d'un lot, au prorata de ses tokens : Map empreinte → { gold, wood, stone }. */
export function shareGains(batch, gains) {
  const shares = new Map();
  if (!gains) return shares;
  const w = batch.map(weights);
  for (const r of RESOURCES) {
    const total = w.reduce((s, x) => s + x[r], 0);
    if (total <= 0 || num(gains[r]) <= 0) continue;
    batch.forEach((e, i) => {
      if (!e.session || w[i][r] <= 0) return;
      const s = shares.get(e.session) ?? { gold: 0, wood: 0, stone: 0 };
      s[r] += (num(gains[r]) * w[i][r]) / total;
      shares.set(e.session, s);
    });
  }
  return shares;
}

/** Cumule les parts dans sessions.json (les sessions inactives depuis 3 jours sont oubliées). */
export function addSessionGains(file, shares, now = Date.now()) {
  if (shares.size === 0) return;
  const all = readJson(file, {});
  const next = {};
  for (const [h, v] of Object.entries(all)) if (now - num(v?.at) < KEEP_MS) next[h] = v;
  for (const [h, s] of shares) {
    const cur = next[h] ?? {};
    next[h] = { at: now, ...Object.fromEntries(RESOURCES.map((r) => [r, num(cur[r]) + s[r]])) };
  }
  writeJsonPrivate(file, next);
}

/** « 💰340 🪵90 », chiffres en gris ; vide s'il n'y a rien. Lien du terminal (OSC 8) vers le village. */
export function formatSegment(total, url) {
  const parts = RESOURCES.map((r) => [Math.floor(num(total?.[r])), ICONS[r]]).filter(([n]) => n >= 1);
  if (parts.length === 0) return "";
  const text = parts.map(([n, icon]) => `${icon}${GREY}${fmt(n)}${RESET}`).join(" ");
  return `\x1b]8;;${url}\x1b\\${NO_UNDERLINE}${text}\x1b]8;;\x1b\\`;
}

/** La ligne de gains d'une session, d'après le JSON que Claude Code donne à la status line. */
export function sessionSegment({ paths, sessionId }) {
  if (typeof sessionId !== "string" || !sessionId) return "";
  const apiUrl = readJson(paths.config, null)?.apiUrl;
  const url = typeof apiUrl === "string" && validApiUrl(apiUrl) ? apiUrl : DEFAULT_API_URL;
  return formatSegment(readJson(paths.sessions, {})[sessionHash(sessionId)], url);
}
