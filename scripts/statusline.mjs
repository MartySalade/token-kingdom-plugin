#!/usr/bin/env node
// Status line posée par le plugin (copiée dans ~/.token-kingdom/) : ta ligne habituelle, puis les gains du jour.
// S'il existait déjà une status line, sa commande est dans statusline-inner.json et on l'exécute telle quelle.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const home = dirname(fileURLToPath(import.meta.url));
const read = (name) => {
  try {
    return readFileSync(join(home, name), "utf8");
  } catch {
    return "";
  }
};

let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  // pas d'entrée : on affiche quand même les gains
}

function defaultLine() {
  try {
    const j = JSON.parse(input);
    const dim = (s) => `\x1b[2m${s}\x1b[0m`;
    const ctx = j.context_window?.used_percentage;
    return [dim(j.model?.display_name ?? "Claude"), dim(basename(j.workspace?.current_dir ?? j.cwd ?? "")), ctx == null ? "" : `ctx: ${Math.round(ctx)}%`]
      .filter(Boolean)
      .join("  ");
  } catch {
    return "";
  }
}

let base;
try {
  const inner = JSON.parse(read("statusline-inner.json") || "null");
  base = inner?.command
    ? execSync(inner.command, { input, encoding: "utf8", timeout: 4000, stdio: ["pipe", "pipe", "ignore"] }).replace(/\n+$/, "")
    : defaultLine();
} catch {
  base = defaultLine();
}
const gains = read("statusline.txt");
process.stdout.write(gains ? `${base}    ${gains}` : base);
