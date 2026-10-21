import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { addSessionGains, formatSegment, sessionHash, sessionSegment, shareGains } from "../scripts/lib/gains.mjs";
import { writeJsonPrivate } from "../scripts/lib/store.mjs";
import { tmpHome } from "./helpers.mjs";

// retire les séquences d'échappement (couleur, lien) pour lire le texte
const plain = (s) => s.replace(/\x1b\][^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, "");
const link = (s) => /\x1b\]8;;([^\x1b]*)\x1b\\/.exec(s)?.[1];
const ev = (session, o = {}) => ({ session, input: 0, output: 0, cacheCreation: 0, cacheRead: 0, ...o });

test("icône collée à gauche de chaque valeur, rien sous 1, k au-delà de 1000", () => {
  assert.equal(plain(formatSegment({ gold: 1500, wood: 20.5, stone: 0.4 }, "https://x.test")), "💰1.5k 🪵20");
  assert.equal(formatSegment({ gold: 0.4, wood: 0, stone: 0 }, "https://x.test"), "");
  assert.equal(formatSegment(undefined, "https://x.test"), "");
});

test("chiffres en gris, lien vers l'URL donnée", () => {
  const s = formatSegment({ gold: 5, wood: 0, stone: 0 }, "https://x.test");
  assert.match(s, /💰\x1b\[90m5\x1b\[0m/);
  assert.equal(link(s), "https://x.test");
});

test("gains du lot répartis entre sessions au prorata des tokens de chaque ressource", () => {
  const batch = [ev("A", { output: 300, cacheRead: 100 }), ev("B", { output: 100, cacheRead: 300 }), ev("A", { input: 10 })];
  const s = shareGains(batch, { gold: 40, wood: 5, stone: 8 });
  assert.deepEqual(s.get("A"), { gold: 30, wood: 5, stone: 2 });
  assert.deepEqual(s.get("B"), { gold: 10, wood: 0, stone: 6 });
});

test("events sans session : leur part n'est attribuée à personne", () => {
  const s = shareGains([ev("A", { output: 100 }), ev(undefined, { output: 100 })], { gold: 10, wood: 0, stone: 0 });
  assert.deepEqual(s.get("A"), { gold: 5, wood: 0, stone: 0 });
  assert.equal(s.size, 1);
  assert.equal(shareGains([ev("A", { output: 1 })], undefined).size, 0);
});

test("cumul par session, sessions inactives oubliées après 3 jours", () => {
  const { paths } = tmpHome();
  const t = Date.UTC(2026, 9, 21);
  addSessionGains(paths.sessions, new Map([["A", { gold: 5, wood: 0, stone: 1 }]]), t);
  addSessionGains(paths.sessions, new Map([["A", { gold: 2, wood: 0, stone: 0 }], ["B", { gold: 1, wood: 0, stone: 0 }]]), t + 1000);
  const all = JSON.parse(readFileSync(paths.sessions, "utf8"));
  assert.equal(all.A.gold, 7);
  assert.equal(all.B.gold, 1);
  addSessionGains(paths.sessions, new Map([["C", { gold: 1, wood: 0, stone: 0 }]]), t + 4 * 86_400_000);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(paths.sessions, "utf8"))), ["C"]);
});

test("la ligne d'une session ne montre que ses gains, lien selon l'apiUrl", () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.sessions, { [sessionHash("s1")]: { at: Date.now(), gold: 12, wood: 0, stone: 3 }, [sessionHash("s2")]: { at: Date.now(), gold: 99, wood: 0, stone: 0 } });
  const s = sessionSegment({ paths, sessionId: "s1" });
  assert.equal(plain(s), "💰12 🪨3");
  assert.equal(link(s), "https://token-kingdom.com");
  assert.equal(sessionSegment({ paths, sessionId: "inconnue" }), "");
  assert.equal(sessionSegment({ paths, sessionId: undefined }), "");
  writeJsonPrivate(paths.config, { apiUrl: "http://localhost:3000", token: "tk_t" });
  assert.equal(link(sessionSegment({ paths, sessionId: "s1" })), "http://localhost:3000");
});
