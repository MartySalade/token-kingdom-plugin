import { existsSync } from "node:fs";
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
          ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
          : ["xdg-open", [url]];
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // ignoré
  }
}

const unreachable = (apiUrl) => `❌ Couldn't reach ${apiUrl}. Check your connection and try again.`;
const RATE_LIMITED = "❌ Too many attempts, try again in a minute.";

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

// un second /start créerait un second royaume : le token se copie, il ne se recrée pas
const SECOND_COMPUTER =
  "Using Claude Code on another computer? Copy ~/.token-kingdom/config.json to it instead of running this command there, or you'll found a second kingdom.";

const unexpected = (status) => `❌ Unexpected server response (HTTP ${status}). Try again later.`;

function sameOrigin(loginUrl, apiUrl) {
  try {
    const u = new URL(loginUrl);
    return (u.protocol === "https:" || u.protocol === "http:") && u.origin === new URL(apiUrl).origin;
  } catch {
    return false;
  }
}

const REVOKED =
  "❌ This Claude Code is no longer linked (token revoked). Delete ~/.token-kingdom/config.json, then run /token-kingdom:village again to found a new kingdom.";
const BAD_LINK = "❌ Sign-in link rejected (unexpected origin).";

/** Nouveau lien de connexion pour un plugin déjà configuré : { apiUrl, loginUrl } ou { error } (message prêt). */
async function requestLogin(paths, fetchImpl) {
  const config = readJson(paths.config, null);
  if (typeof config?.token !== "string" || !config.token) {
    return { error: "❌ Local config is unreadable (~/.token-kingdom/config.json). Delete it, then run /token-kingdom:village again." };
  }
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;
  if (typeof apiUrl !== "string" || !validApiUrl(apiUrl)) return { error: `❌ URL rejected in the config: ${apiUrl}` };
  const r = await post(fetchImpl, `${apiUrl}/api/cli/login`, { authorization: `Bearer ${config.token}` });
  if (!r || r.res.status >= 500) return { error: unreachable(apiUrl) };
  if (r.res.status === 401) return { error: REVOKED };
  if (r.res.status === 429) return { error: RATE_LIMITED };
  if (!r.res.ok || typeof r.body?.loginUrl !== "string") return { error: unexpected(r.res.status) };
  if (!sameOrigin(r.body.loginUrl, apiUrl)) return { error: BAD_LINK };
  return { apiUrl, loginUrl: r.body.loginUrl };
}

const TICKET_PATH = /^\/login\/(tl_[A-Za-z0-9_-]{43})$/;

/**
 * /token-kingdom:mobile : ouvre sur cet ordinateur une page avec le QR à scanner au téléphone.
 * Le ticket passe après le « # » : le navigateur ne l'envoie pas au serveur, donc ne le consomme pas.
 */
export async function mobile({ paths, fetchImpl = fetch, openUrl: open = openUrl }) {
  if (!existsSync(paths.config)) return "❌ No kingdom on this computer yet: run /token-kingdom:village first.";
  const r = await requestLogin(paths, fetchImpl);
  if (r.error) return r.error;
  const u = new URL(r.loginUrl);
  const ticket = u.pathname.match(TICKET_PATH)?.[1];
  if (!ticket) return BAD_LINK;
  const url = `${u.origin}/mobile#${ticket}`;
  open(url);
  return `✅ A QR code is opening in your browser: scan it with your phone to play there (valid for 2 min). ${url}`;
}

export async function village({ args, paths, fetchImpl = fetch, startSync, openUrl: open = openUrl }) {
  if (existsSync(paths.config)) {
    const r = await requestLogin(paths, fetchImpl);
    if (r.error) return r.error;
    open(r.loginUrl);
    return `✅ Your village is opening in the browser: ${r.loginUrl}`;
  }

  const [rawUrl = DEFAULT_API_URL] = args;
  const apiUrl = rawUrl.trim().replace(/\/+$/, "");
  if (!validApiUrl(apiUrl)) return `❌ URL rejected: ${apiUrl} (https or http://localhost only).`;

  const r = await post(fetchImpl, `${apiUrl}/api/cli/start`);
  if (!r || r.res.status >= 500) return unreachable(apiUrl);
  if (r.res.status === 429) return RATE_LIMITED;
  const b = r.body;
  if (!r.res.ok || typeof b?.token !== "string" || typeof b?.loginUrl !== "string") return unexpected(r.res.status);

  writeJsonPrivate(paths.config, { apiUrl, token: b.token, handle: b.handle, linkedAt: new Date().toISOString() });
  // nouveau token = fenêtre d'import d'historique côté serveur : on relit tout (le serveur dédoublonne)
  writeJsonPrivate(paths.state, { files: {} });
  startSync();
  if (!sameOrigin(b.loginUrl, apiUrl)) {
    return `${BAD_LINK} Your kingdom has been founded: run /token-kingdom:village again.`;
  }
  open(b.loginUrl);
  return `✅ Your kingdom has been founded. Pick your handle in the browser (link valid for 10 min): ${b.loginUrl}. Importing your history now.\n${SECOND_COMPUTER}`;
}
