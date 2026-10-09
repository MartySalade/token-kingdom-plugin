import { createHash } from "node:crypto";

const MAX_COUNT = 1e10;
const MAX_MODEL_LENGTH = 100;
const MAX_TITLE_LENGTH = 120;

const count = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX_COUNT) : 0);

/**
 * Événements des lignes complètes du buffer ; `consumed` = octets jusqu'au dernier "\n" inclus.
 * `titles` : titre de chaque session vue (celui que Claude Code génère, ou celui que l'utilisateur a donné).
 */
export function extractEvents(buf) {
  const end = buf.lastIndexOf(0x0a);
  if (end === -1) return { events: [], titles: {}, consumed: 0 };
  const events = [];
  const titles = {};
  const custom = new Set();
  for (const line of buf.subarray(0, end).toString("utf8").split("\n")) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const sid = typeof o?.sessionId === "string" ? o.sessionId : null;
    if (sid && (o.type === "ai-title" || o.type === "custom-title")) {
      const t = String(o.type === "ai-title" ? (o.aiTitle ?? "") : (o.customTitle ?? "")).trim().slice(0, MAX_TITLE_LENGTH);
      // un titre donné par l'utilisateur l'emporte sur celui que Claude Code génère
      if (t && (o.type === "custom-title" || !custom.has(sid))) titles[sid] = t;
      if (t && o.type === "custom-title") custom.add(sid);
      continue;
    }
    const m = o?.message;
    const u = m?.usage;
    if (o?.type !== "assistant" || !u || typeof m.id !== "string") continue;
    const ts = Date.parse(o.timestamp);
    if (!Number.isFinite(ts)) continue;
    events.push({
      messageId: m.id,
      sessionId: sid,
      model: String(m.model ?? "").slice(0, MAX_MODEL_LENGTH),
      input: count(u.input_tokens),
      output: count(u.output_tokens),
      cacheCreation: count(u.cache_creation_input_tokens),
      cacheRead: count(u.cache_read_input_tokens),
      ts,
    });
  }
  return { events, titles, consumed: end + 1 };
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Empreinte de session envoyée au serveur (l'identifiant brut ne quitte pas la machine). */
export const sessionHash = (sessionId) => sha256(`session:${sessionId}`);

export function toWire({ messageId, sessionId, ...rest }) {
  return { idHash: sha256(messageId), ...rest, ...(sessionId ? { session: sessionHash(sessionId) } : {}) };
}
