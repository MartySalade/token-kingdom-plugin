import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NOTICE_EVERY_MS, addGains, takeNotice, writeSegment } from "../scripts/lib/notice.mjs";
import { readJson } from "../scripts/lib/store.mjs";
import { tmpHome } from "./helpers.mjs";

test("cumule puis affiche une ligne, une seule fois", () => {
  const { paths } = tmpHome();
  addGains(paths, { gold: 100, wood: 20.5, stone: 0 });
  addGains(paths, { gold: 30, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 }), "🏰 +130 💰 +20 🪵");
  assert.equal(takeNotice({ paths, now: 1e12 + 1 }), null);
});

test("garde le cumul tant que la pause de 5 min n'est pas passée", () => {
  const { paths } = tmpHome();
  addGains(paths, { gold: 5, wood: 0, stone: 0 });
  takeNotice({ paths, now: 1e12 });
  addGains(paths, { gold: 7, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 + 1000 }), null);
  assert.equal(takeNotice({ paths, now: 1e12 + NOTICE_EVERY_MS }), "🏰 +7 💰");
});

test("rien sous 1, gains absents ignorés, k au-delà de 1000", () => {
  const { paths } = tmpHome();
  addGains(paths, undefined);
  addGains(paths, { gold: 0.4, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 }), null);
  addGains(paths, { gold: 1500, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 }), "🏰 +1.5k 💰");
});

test("quiet vide le cumul sans rien afficher", () => {
  const { paths } = tmpHome();
  addGains(paths, { gold: 50, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, quiet: true, now: 1e12 }), null);
  assert.equal(readJson(paths.pending, null).gold, undefined);
});

test("total du jour pour la status line, remis à zéro le lendemain", () => {
  const { paths } = tmpHome();
  const day = new Date(2026, 9, 21, 12).getTime();
  addGains(paths, { gold: 100, wood: 0, stone: 5 }, day);
  addGains(paths, { gold: 50, wood: 0, stone: 0 }, day + 1000);
  assert.equal(readFileSync(paths.segment, "utf8"), "🏰 +150 💰 +5 🪨");
  writeSegment(paths, day + 24 * 3600_000);
  assert.equal(readFileSync(paths.segment, "utf8"), "");
});
