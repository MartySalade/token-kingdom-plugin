#!/usr/bin/env node
import { getPaths } from "./lib/paths.mjs";
import { setupStatusLine } from "./lib/statusline.mjs";

try {
  console.log(setupStatusLine({ paths: getPaths(), mode: process.argv[2] === "off" ? "off" : "on" }));
} catch (e) {
  console.log(`❌ Unexpected error: ${e?.message ?? e}`);
}
process.exit(0);
