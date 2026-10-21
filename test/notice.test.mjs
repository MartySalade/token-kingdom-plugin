import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { addGains, formatSegment, writeSegment } from "../scripts/lib/notice.mjs";
import { writeJsonPrivate } from "../scripts/lib/store.mjs";
import { tmpHome } from "./helpers.mjs";

// retire les séquences d'échappement (couleur, lien) pour lire le texte
const plain = (s) => s.replace(/\x1b\][^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, "");
const link = (s) => /\x1b\]8;;([^\x1b]*)\x1b\\/.exec(s)?.[1];

test("icône à gauche de chaque valeur, rien sous 1, k au-delà de 1000", () => {
  assert.equal(plain(formatSegment({ gold: 1500, wood: 20.5, stone: 0.4 }, "https://x.test")), "💰 1.5k  🪵 20");
  assert.equal(formatSegment({ gold: 0.4, wood: 0, stone: 0 }, "https://x.test"), "");
});

test("chiffres en gris, lien vers l'URL donnée", () => {
  const s = formatSegment({ gold: 5, wood: 0, stone: 0 }, "https://x.test");
  assert.match(s, /💰 \x1b\[90m5\x1b\[0m/);
  assert.equal(link(s), "https://x.test");
});

test("total du jour cumulé, remis à zéro le lendemain", () => {
  const { paths } = tmpHome();
  const day = new Date(2026, 9, 21, 12).getTime();
  addGains(paths, { gold: 100, wood: 0, stone: 5 }, day);
  addGains(paths, { gold: 50, wood: 0, stone: 0 }, day + 1000);
  assert.equal(plain(readFileSync(paths.segment, "utf8")), "💰 150  🪨 5");
  writeSegment(paths, day + 24 * 3600_000);
  assert.equal(readFileSync(paths.segment, "utf8"), "");
});

test("gains absents ou nuls ignorés", () => {
  const { paths } = tmpHome();
  addGains(paths, undefined);
  addGains(paths, { gold: 0, wood: 0, stone: 0 });
  assert.throws(() => readFileSync(paths.segment, "utf8"));
});

test("le lien suit l'apiUrl de la config, l'URL de prod sinon", () => {
  const { paths } = tmpHome();
  const now = Date.now();
  addGains(paths, { gold: 3, wood: 0, stone: 0 }, now);
  assert.equal(link(readFileSync(paths.segment, "utf8")), "https://token-kingdom.com");
  writeJsonPrivate(paths.config, { apiUrl: "http://localhost:3000", token: "tk_t" });
  writeSegment(paths, now);
  assert.equal(link(readFileSync(paths.segment, "utf8")), "http://localhost:3000");
});
