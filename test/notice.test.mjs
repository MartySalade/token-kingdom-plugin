import assert from "node:assert/strict";
import { test } from "node:test";
import { NOTICE_EVERY_MS, addPending, takeNotice } from "../scripts/lib/notice.mjs";
import { readJson } from "../scripts/lib/store.mjs";
import { tmpHome } from "./helpers.mjs";

test("cumule puis affiche une ligne, une seule fois", () => {
  const { paths } = tmpHome();
  addPending(paths.pending, { gold: 100, wood: 20.5, stone: 0 });
  addPending(paths.pending, { gold: 30, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 }), "🏰 +130 🪙 +20 🪵");
  assert.equal(takeNotice({ paths, now: 1e12 + 1 }), null);
});

test("garde le cumul tant que la pause de 5 min n'est pas passée", () => {
  const { paths } = tmpHome();
  addPending(paths.pending, { gold: 5, wood: 0, stone: 0 });
  takeNotice({ paths, now: 1e12 });
  addPending(paths.pending, { gold: 7, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 + 1000 }), null);
  assert.equal(takeNotice({ paths, now: 1e12 + NOTICE_EVERY_MS }), "🏰 +7 🪙");
});

test("rien sous 1, gains absents ignorés, k au-delà de 1000", () => {
  const { paths } = tmpHome();
  addPending(paths.pending, undefined);
  addPending(paths.pending, { gold: 0.4, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 }), null);
  addPending(paths.pending, { gold: 1500, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, now: 1e12 }), "🏰 +1.5k 🪙");
});

test("quiet vide le cumul sans rien afficher", () => {
  const { paths } = tmpHome();
  addPending(paths.pending, { gold: 50, wood: 0, stone: 0 });
  assert.equal(takeNotice({ paths, quiet: true, now: 1e12 }), null);
  assert.equal(readJson(paths.pending, null).gold, undefined);
});
