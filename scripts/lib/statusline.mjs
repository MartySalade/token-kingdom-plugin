import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJsonPrivate } from "./store.mjs";

// copiés dans ~/.token-kingdom/statusline/ : stable d'une version du plugin à l'autre, et sans dépendre de son dossier
const FILES = [
  ["statusline-run.mjs", "statusline.mjs"],
  ["gains.mjs", "gains.mjs"],
  ["paths.mjs", "paths.mjs"],
  ["store.mjs", "store.mjs"],
  ["url.mjs", "url.mjs"],
];

/** La commande, ou le script qu'elle lance, appelle déjà notre script (ex. status line réglée à la main). */
function readsGains(command) {
  if (command.includes("statusline.mjs")) return true;
  return command
    .split(/\s+/)
    .map((t) => t.replace(/^["']|["']$/g, "").replace(/^~(?=\/)/, homedir()))
    .filter((t) => /\.(sh|mjs|js|py)$/.test(t))
    .some((f) => {
      try {
        return readFileSync(f, "utf8").includes("statusline.mjs");
      } catch {
        return false;
      }
    });
}

function writeSettings(file, settings) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(tmp, file);
}

/**
 * Branche (ou débranche) les gains du jour dans la status line de Claude Code.
 * mode « on » : pose la nôtre, en enveloppant l'existante s'il y en a une (elle est gardée). « off » : rétablit
 * l'ancienne. Renvoie le message à afficher.
 */
export function setupStatusLine({ paths, mode }) {
  let settings = {};
  if (existsSync(paths.settings)) {
    try {
      settings = JSON.parse(readFileSync(paths.settings, "utf8"));
    } catch {
      return `❌ ${paths.settings} is unreadable: left untouched.`;
    }
    if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
      return `❌ ${paths.settings} is unreadable: left untouched.`;
    }
  }
  const ours = `node "${paths.statuslineScript}"`;
  const cur = settings.statusLine;
  const wrapped = readJson(paths.statuslineInner, null);

  if (mode === "off") {
    if (cur?.command !== ours) return "Your status line isn't managed by Token Kingdom: nothing to remove.";
    if (wrapped?.original) settings.statusLine = wrapped.original;
    else delete settings.statusLine;
    writeSettings(paths.settings, settings);
    if (wrapped) unlinkSync(paths.statuslineInner);
    return "✅ Status line restored. Session earnings are no longer shown.";
  }

  if (cur?.command === ours) return "✅ Your status line already shows what each session earns.";
  if (cur?.command && readsGains(cur.command)) return "✅ Your status line already shows what each session earns.";

  mkdirSync(paths.statuslineDir, { recursive: true, mode: 0o700 });
  for (const [from, to] of FILES) copyFileSync(fileURLToPath(new URL(from, import.meta.url)), `${paths.statuslineDir}/${to}`);
  if (cur?.command) writeJsonPrivate(paths.statuslineInner, { original: cur, command: cur.command });
  if (existsSync(paths.settings)) {
    const bak = `${paths.settings}.token-kingdom.bak`;
    if (!existsSync(bak)) copyFileSync(paths.settings, bak);
  } else {
    mkdirSync(dirname(paths.settings), { recursive: true });
  }
  settings.statusLine = { type: "command", command: ours };
  writeSettings(paths.settings, settings);
  return cur?.command
    ? "✅ Each session's earnings are now added to your status line (yours is kept). Undo: /token-kingdom:statusline off"
    : "✅ Your status line now shows what each session earns. Undo: /token-kingdom:statusline off";
}
