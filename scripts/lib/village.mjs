import { spawn } from "node:child_process";
import { DEFAULT_API_URL } from "./paths.mjs";
import { readJson, writeJsonPrivate } from "./store.mjs";
import { validApiUrl } from "./url.mjs";

/** Ouvre l'URL dans le navigateur par défaut. Erreurs ignorées : le lien est toujours affiché. */
export function openUrl(url) {
  try {
    const [cmd, args] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", '""', url]]
          : ["xdg-open", [url]];
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // ignoré
  }
}

const unreachable = (apiUrl) => `❌ Impossible de joindre ${apiUrl}. Vérifie ta connexion et réessaie.`;
const RATE_LIMITED = "❌ Trop de tentatives, réessaie dans une minute.";

async function post(fetchImpl, url, headers = {}) {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => null);
    return { res, body };
  } catch {
    return null;
  }
}

export async function village({ args, paths, fetchImpl = fetch, startSync, openUrl: open = openUrl }) {
  const config = readJson(paths.config, null);

  if (config?.token && config?.apiUrl) {
    const r = await post(fetchImpl, `${config.apiUrl}/api/cli/login`, { authorization: `Bearer ${config.token}` });
    if (!r || r.res.status >= 500) return unreachable(config.apiUrl);
    if (r.res.status === 401) {
      return "❌ Ce Claude Code n'est plus lié (token révoqué). Supprime ~/.token-kingdom/config.json puis relance /token-kingdom:village pour créer un nouveau royaume.";
    }
    if (r.res.status === 429) return RATE_LIMITED;
    if (!r.res.ok || typeof r.body?.loginUrl !== "string") return unreachable(config.apiUrl);
    open(r.body.loginUrl);
    return `✅ Ton village s'ouvre dans le navigateur : ${r.body.loginUrl}`;
  }

  const [rawUrl = DEFAULT_API_URL] = args;
  const apiUrl = rawUrl.trim().replace(/\/+$/, "");
  if (!validApiUrl(apiUrl)) return `❌ URL refusée : ${apiUrl} (https ou http://localhost uniquement).`;

  const r = await post(fetchImpl, `${apiUrl}/api/cli/start`);
  if (!r) return unreachable(apiUrl);
  if (r.res.status === 429) return RATE_LIMITED;
  const b = r.body;
  if (!r.res.ok || typeof b?.token !== "string" || typeof b?.loginUrl !== "string") return unreachable(apiUrl);

  writeJsonPrivate(paths.config, { apiUrl, token: b.token, handle: b.handle, linkedAt: new Date().toISOString() });
  // nouveau token = fenêtre d'import d'historique côté serveur : on relit tout (le serveur dédoublonne)
  writeJsonPrivate(paths.state, { files: {} });
  startSync();
  open(b.loginUrl);
  return `✅ Ton royaume est créé. Choisis ton pseudo dans le navigateur (lien valable 2 min) : ${b.loginUrl}. Import de ton historique en cours.`;
}
