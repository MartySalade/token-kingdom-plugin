import { DEFAULT_API_URL } from "./paths.mjs";
import { writeJsonPrivate } from "./store.mjs";

// même alphabet que le serveur : sans I, O, 0, 1
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

export function validApiUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

export async function link({ args, paths, fetchImpl = fetch, startSync }) {
  const [rawCode = "", rawUrl = DEFAULT_API_URL] = args;
  const code = rawCode.trim().toUpperCase();
  const apiUrl = rawUrl.trim().replace(/\/+$/, "");
  if (!CODE_RE.test(code)) {
    return `❌ Code invalide : « ${rawCode} ». Copie le code de 8 caractères affiché sur ${DEFAULT_API_URL}/connect.`;
  }
  if (!validApiUrl(apiUrl)) return `❌ URL refusée : ${apiUrl} (https ou http://localhost uniquement).`;

  let res;
  try {
    res = await fetchImpl(`${apiUrl}/api/link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return `❌ Impossible de joindre ${apiUrl}. Vérifie ta connexion et réessaie.`;
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || typeof body?.token !== "string") {
    return `❌ Code invalide ou expiré. Génère un nouveau code sur ${apiUrl}/connect.`;
  }

  writeJsonPrivate(paths.config, {
    apiUrl,
    token: body.token,
    handle: body.handle,
    linkedAt: new Date().toISOString(),
  });
  // nouveau token = fenêtre d'import d'historique côté serveur : on relit tout (le serveur dédoublonne)
  writeJsonPrivate(paths.state, { files: {} });
  startSync();
  return `✅ Claude Code est lié au royaume de ${body.handle}. Import de ton historique en cours, en arrière-plan.`;
}
