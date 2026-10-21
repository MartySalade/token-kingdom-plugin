#!/usr/bin/env node
// Status line posée par le plugin (copiée dans ~/.token-kingdom/statusline/) : ta ligne habituelle, puis les gains
// de CETTE session. S'il existait déjà une status line, sa commande est dans statusline-inner.json et on l'exécute telle quelle.
// --segment : n'affiche que les gains (pour une status line écrite à la main).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sessionSegment } from "./gains.mjs";
import { getPaths } from "./paths.mjs";

const paths = getPaths({ ...process.env, TOKEN_KINGDOM_HOME: dirname(dirname(fileURLToPath(import.meta.url))) });

let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  // pas d'entrée : pas de session, donc pas de gains
}
let json = {};
try {
  json = JSON.parse(input) ?? {};
} catch {
  // entrée illisible
}
const gains = sessionSegment({ paths, sessionId: json.session_id });

function defaultLine() {
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const ctx = json.context_window?.used_percentage;
  return [dim(json.model?.display_name ?? "Claude"), dim(basename(json.workspace?.current_dir ?? json.cwd ?? "")), ctx == null ? "" : `ctx: ${Math.round(ctx)}%`]
    .filter(Boolean)
    .join("  ");
}

let base = "";
if (!process.argv.includes("--segment")) {
  try {
    const inner = JSON.parse(readFileSync(paths.statuslineInner, "utf8"));
    base = inner?.command
      ? execSync(inner.command, { input, encoding: "utf8", timeout: 4000, stdio: ["pipe", "pipe", "ignore"] }).replace(/\n+$/, "")
      : defaultLine();
  } catch {
    base = defaultLine();
  }
}
process.stdout.write(base && gains ? `${base}    ${gains}` : base || gains);
