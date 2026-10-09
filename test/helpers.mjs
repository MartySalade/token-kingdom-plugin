import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPaths } from "../scripts/lib/paths.mjs";

export function tmpHome() {
  const root = mkdtempSync(join(tmpdir(), "tk-"));
  const env = { TOKEN_KINGDOM_HOME: join(root, "tk"), CLAUDE_CONFIG_DIR: join(root, "claude") };
  return { root, env, paths: getPaths(env) };
}

/** Une ligne JSONL de message assistant, comme Claude Code l'écrit. */
export function assistantLine({
  id = "msg_1",
  model = "claude-opus-5-5",
  input = 2,
  output = 100,
  cacheCreation = 1000,
  cacheRead = 50_000,
  timestamp = "2026-10-07T12:00:00.000Z",
  sessionId,
} = {}) {
  return JSON.stringify({
    type: "assistant",
    timestamp,
    ...(sessionId ? { sessionId } : {}),
    message: {
      id,
      model,
      usage: {
        input_tokens: input,
        output_tokens: output,
        cache_creation_input_tokens: cacheCreation,
        cache_read_input_tokens: cacheRead,
        service_tier: "standard",
      },
    },
  });
}

/** fetch factice : renvoie les statuts dans l'ordre (le dernier se répète). */
export function fakeFetch(statuses = [200]) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return new Response(JSON.stringify({}), { status });
  };
  return { fetchImpl, calls };
}
