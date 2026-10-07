import { createHash } from "node:crypto";

const MAX_COUNT = 1e10;
const MAX_MODEL_LENGTH = 100;

const count = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX_COUNT) : 0);

/** Événements des lignes complètes du buffer ; `consumed` = octets jusqu'au dernier "\n" inclus. */
export function extractEvents(buf) {
  const end = buf.lastIndexOf(0x0a);
  if (end === -1) return { events: [], consumed: 0 };
  const events = [];
  for (const line of buf.subarray(0, end).toString("utf8").split("\n")) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const m = o?.message;
    const u = m?.usage;
    if (o?.type !== "assistant" || !u || typeof m.id !== "string") continue;
    const ts = Date.parse(o.timestamp);
    if (!Number.isFinite(ts)) continue;
    events.push({
      messageId: m.id,
      model: String(m.model ?? "").slice(0, MAX_MODEL_LENGTH),
      input: count(u.input_tokens),
      output: count(u.output_tokens),
      cacheCreation: count(u.cache_creation_input_tokens),
      cacheRead: count(u.cache_read_input_tokens),
      ts,
    });
  }
  return { events, consumed: end + 1 };
}

export function toWire({ messageId, ...rest }) {
  return { idHash: createHash("sha256").update(messageId).digest("hex"), ...rest };
}
