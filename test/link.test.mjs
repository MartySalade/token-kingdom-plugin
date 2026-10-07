import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { test } from "node:test";
import { link, validApiUrl } from "../scripts/lib/link.mjs";
import { readJson, writeJsonPrivate } from "../scripts/lib/store.mjs";
import { tmpHome } from "./helpers.mjs";

function okFetch(body = { token: "tk_abc", handle: "alice" }, status = 200) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify(body), { status });
    },
  };
}

test("valide les URLs : https ou http://localhost uniquement", () => {
  assert.equal(validApiUrl("https://token-kingdom.com"), true);
  assert.equal(validApiUrl("http://localhost:3000"), true);
  assert.equal(validApiUrl("http://evil.com"), false);
  assert.equal(validApiUrl("http://localhost.evil.com"), false);
  assert.equal(validApiUrl("pas une url"), false);
});

test("lie le compte, écrit la config en 0600 et lance un sync", async () => {
  const { paths } = tmpHome();
  const f = okFetch();
  let started = 0;
  const msg = await link({ args: ["yrkcrank"], paths, fetchImpl: f.fetchImpl, startSync: () => started++ });
  assert.match(msg, /^✅ .*alice/);
  assert.equal(f.calls[0].url, "https://token-kingdom.com/api/link");
  assert.deepEqual(f.calls[0].body, { code: "YRKCRANK" });
  const cfg = readJson(paths.config, null);
  assert.equal(cfg.token, "tk_abc");
  assert.equal(cfg.apiUrl, "https://token-kingdom.com");
  assert.equal(statSync(paths.config).mode & 0o777, 0o600);
  assert.equal(started, 1);
});

test("accepte une URL locale explicite et retire le / final", async () => {
  const { paths } = tmpHome();
  const f = okFetch();
  await link({ args: ["YRKCRANK", "http://localhost:3000/"], paths, fetchImpl: f.fetchImpl, startSync: () => {} });
  assert.equal(f.calls[0].url, "http://localhost:3000/api/link");
  assert.equal(readJson(paths.config, null).apiUrl, "http://localhost:3000");
});

test("refuse un code mal formé sans appeler le réseau", async () => {
  const { paths } = tmpHome();
  const f = okFetch();
  for (const args of [[], ["ABC"], ["YRKCRAN0"], ["YRKCRANK1"]]) {
    assert.match(await link({ args, paths, fetchImpl: f.fetchImpl, startSync: () => {} }), /^❌ Code invalide/);
  }
  assert.equal(f.calls.length, 0);
});

test("refuse une URL non autorisée", async () => {
  const { paths } = tmpHome();
  const msg = await link({ args: ["YRKCRANK", "http://evil.com"], paths, fetchImpl: okFetch().fetchImpl, startSync: () => {} });
  assert.match(msg, /^❌ URL refusée/);
});

test("code expiré côté serveur : message clair, pas de config, pas de sync", async () => {
  const { paths } = tmpHome();
  let started = 0;
  const f = okFetch({ error: "invalid_code" }, 400);
  const msg = await link({ args: ["YRKCRANK"], paths, fetchImpl: f.fetchImpl, startSync: () => started++ });
  assert.match(msg, /^❌ Code invalide ou expiré/);
  assert.equal(readJson(paths.config, null), null);
  assert.equal(started, 0);
});

test("serveur injoignable : message clair", async () => {
  const { paths } = tmpHome();
  const fetchImpl = async () => {
    throw new TypeError("fetch failed");
  };
  assert.match(await link({ args: ["YRKCRANK"], paths, fetchImpl, startSync: () => {} }), /^❌ Impossible de joindre/);
});

test("une nouvelle liaison repart de zéro pour réimporter l'historique", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.state, { files: { "/x/a.jsonl": { offset: 999 } } });
  await link({ args: ["YRKCRANK"], paths, fetchImpl: okFetch().fetchImpl, startSync: () => {} });
  assert.deepEqual(readJson(paths.state, null), { files: {} });
});
