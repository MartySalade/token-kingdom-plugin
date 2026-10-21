#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { getPaths } from "./lib/paths.mjs";
import { setupStatusLine } from "./lib/statusline.mjs";
import { openUrl, village } from "./lib/village.mjs";

const syncScript = fileURLToPath(new URL("./sync.mjs", import.meta.url));
const startSync = () => spawn(process.execPath, [syncScript], { detached: true, stdio: "ignore" }).unref();

try {
  const paths = getPaths();
  const first = !existsSync(paths.config);
  let msg = await village({ args: process.argv.slice(2), paths, startSync, openUrl });
  // premier lancement réussi : les gains du jour dans la status line, sans rien de plus à taper
  if (first && existsSync(paths.config)) {
    try {
      msg += `\n${setupStatusLine({ paths, mode: "auto" })}`;
    } catch {
      // la status line est un bonus
    }
  }
  console.log(msg);
} catch (e) {
  console.log(`❌ Unexpected error: ${e?.message ?? e}`);
}
process.exit(0);
