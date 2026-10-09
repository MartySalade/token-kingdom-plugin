#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getPaths } from "./lib/paths.mjs";
import { openUrl, village } from "./lib/village.mjs";

const syncScript = fileURLToPath(new URL("./sync.mjs", import.meta.url));
const startSync = () => spawn(process.execPath, [syncScript], { detached: true, stdio: "ignore" }).unref();

try {
  console.log(await village({ args: process.argv.slice(2), paths: getPaths(), startSync, openUrl }));
} catch (e) {
  console.log(`❌ Unexpected error: ${e?.message ?? e}`);
}
process.exit(0);
