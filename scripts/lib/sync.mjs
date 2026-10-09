import { postEvents } from "./api.mjs";
import { extractEvents, sessionHash, toWire } from "./parse.mjs";
import { sep } from "node:path";
import { READ_CHUNK, listTranscripts, readFrom } from "./scan.mjs";
import { log, readJson, writeJsonPrivate } from "./store.mjs";

export const BATCH = 500;
export const TITLES_PER_REQUEST = 100;
export const REQUESTS_PER_MINUTE = 50;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSync({ paths, fetchImpl = fetch, sleep = wait, readChunk = READ_CHUNK, heartbeat = () => {} }) {
  const config = readJson(paths.config, null);
  if (!config?.token || !config?.apiUrl) return { status: "not_linked", sent: 0, requests: 0 };

  const state = readJson(paths.state, { files: {} });
  const seen = new Set();
  let queue = [];
  let commits = [];
  let sent = 0;
  let requests = 0;
  /** titres de session à envoyer (empreinte → titre) : partent avec le prochain lot, même vide */
  const titles = new Map();

  /** Envoie toute la file ; n'avance les offsets qu'une fois tous leurs events acceptés. */
  async function flush() {
    while (queue.length > 0 || titles.size > 0) {
      if (requests > 0 && requests % REQUESTS_PER_MINUTE === 0) {
        heartbeat();
        await sleep(60_000);
      }
      heartbeat();
      const batch = queue.slice(0, BATCH);
      const sessions = [...titles].slice(0, TITLES_PER_REQUEST).map(([id, title]) => ({ id, title }));
      const { status } = await postEvents({ apiUrl: config.apiUrl, token: config.token, events: batch, sessions, fetchImpl });
      requests++;
      if (status === 401) return "unauthorized";
      if (status === 400) log(paths.log, `batch of ${batch.length} events rejected (400), skipped`);
      else if (status < 200 || status >= 300) return "retry_later";
      else sent += batch.length;
      queue = queue.slice(BATCH);
      for (const s of sessions) titles.delete(s.id);
    }
    for (const c of commits) state.files[c.file] = { offset: c.offset };
    commits = [];
    writeJsonPrivate(paths.state, state);
    return "ok";
  }

  const files = listTranscripts(paths.projects);
  const existing = new Set(files);
  // n'oublie que les fichiers disparus de ce dossier : un autre CLAUDE_CONFIG_DIR garde son état
  const root = paths.projects + sep;
  for (const f of Object.keys(state.files)) if (f.startsWith(root) && !existing.has(f)) delete state.files[f];

  for (const file of files) {
    let offset = state.files[file]?.offset ?? 0;
    let max = readChunk;
    for (;;) {
      let read;
      try {
        read = readFrom(file, offset, max);
      } catch {
        break; // illisible ou supprimé entre-temps : on passe au suivant
      }
      const { buf, start } = read;
      offset = start;
      if (buf.length === 0) break;
      const { events, titles: found, consumed } = extractEvents(buf);
      for (const [sid, title] of Object.entries(found)) titles.set(sessionHash(sid), title);
      if (consumed === 0) {
        // ligne plus longue que le chunk : on relit plus large ; sinon ligne en cours d'écriture
        if (buf.length < max) break;
        max *= 4;
        continue;
      }
      for (const e of events) {
        if (seen.has(e.messageId)) continue;
        seen.add(e.messageId);
        queue.push(toWire(e));
      }
      offset += consumed;
      commits.push({ file, offset });
      if (queue.length >= BATCH) {
        const r = await flush();
        if (r !== "ok") return { status: r, sent, requests };
      }
      if (buf.length < max) break;
    }
  }

  const status = await flush();
  return { status, sent, requests };
}
