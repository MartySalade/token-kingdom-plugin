#!/usr/bin/env node
import { getPaths } from "./lib/paths.mjs";
import { mobile, openUrl } from "./lib/village.mjs";

try {
  console.log(await mobile({ paths: getPaths(), openUrl }));
} catch (e) {
  console.log(`❌ Unexpected error: ${e?.message ?? e}`);
}
process.exit(0);
