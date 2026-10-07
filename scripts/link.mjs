#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { link } from "./lib/link.mjs";
import { getPaths } from "./lib/paths.mjs";

const syncScript = fileURLToPath(new URL("./sync.mjs", import.meta.url));
const startSync = () => spawn(process.execPath, [syncScript], { detached: true, stdio: "ignore" }).unref();

try {
  console.log(await link({ args: process.argv.slice(2), paths: getPaths(), startSync }));
} catch (e) {
  console.log(`❌ Erreur inattendue : ${e?.message ?? e}`);
}
process.exit(0);
