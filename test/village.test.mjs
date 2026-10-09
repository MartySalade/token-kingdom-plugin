import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { test } from "node:test";
import { readJson, writeJsonPrivate } from "../scripts/lib/store.mjs";
import { village } from "../scripts/lib/village.mjs";
import { tmpHome } from "./helpers.mjs";

const LOGIN = "https://token-kingdom.com/login/tl_xyz";

function mockFetch(body, status = 200) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    },
  };
}

function deps(f) {
  const d = { started: 0, opened: [], fetchImpl: f.fetchImpl };
  d.startSync = () => d.started++;
  d.openUrl = (u) => d.opened.push(u);
  return d;
}

const START = { token: "tk_abc", handle: "joueur-ab12", loginUrl: LOGIN };

test("création : config 0600, état remis à zéro, sync lancée, navigateur ouvert", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.state, { files: { "/x/a.jsonl": { offset: 9 } } });
  const f = mockFetch(START);
  const d = deps(f);
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^✅ Ton royaume est créé/);
  assert.ok(msg.includes(LOGIN));
  assert.equal(f.calls[0].url, "https://token-kingdom.com/api/cli/start");
  assert.equal(f.calls[0].init.method, "POST");
  const cfg = readJson(paths.config, null);
  assert.equal(cfg.token, "tk_abc");
  assert.equal(cfg.handle, "joueur-ab12");
  assert.equal(cfg.apiUrl, "https://token-kingdom.com");
  assert.ok(cfg.linkedAt);
  assert.equal(statSync(paths.config).mode & 0o777, 0o600);
  assert.deepEqual(readJson(paths.state, null), { files: {} });
  assert.equal(d.started, 1);
  assert.deepEqual(d.opened, [LOGIN]);
  assert.ok(!msg.includes("tk_abc"));
});

test("reconnexion : Bearer, ouvre le lien, pas de sync ni de réécriture", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "http://localhost:3000", token: "tk_old", handle: "alice" });
  const f = mockFetch({ loginUrl: LOGIN });
  const d = deps(f);
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^✅ Ton village s'ouvre dans le navigateur/);
  assert.ok(msg.includes(LOGIN));
  assert.equal(f.calls[0].url, "http://localhost:3000/api/cli/login");
  assert.equal(f.calls[0].init.headers.authorization, "Bearer tk_old");
  assert.deepEqual(d.opened, [LOGIN]);
  assert.equal(d.started, 0);
  assert.equal(readJson(paths.config, null).token, "tk_old");
});

test("401 : token révoqué, rien ouvert, config gardée", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "https://token-kingdom.com", token: "tk_old", handle: "a" });
  const d = deps(mockFetch({ error: "invalid_token" }, 401));
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^❌ Ce Claude Code n'est plus lié/);
  assert.equal(d.opened.length, 0);
  assert.equal(readJson(paths.config, null).token, "tk_old");
});

test("429 : trop de tentatives, pas de config", async () => {
  const { paths } = tmpHome();
  const d = deps(mockFetch({ error: "rate_limited" }, 429));
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^❌ Trop de tentatives/);
  assert.equal(readJson(paths.config, null), null);
  assert.equal(d.started, 0);
});

test("réseau KO et 5xx : impossible de joindre", async () => {
  const { paths } = tmpHome();
  const ko = async () => {
    throw new TypeError("fetch failed");
  };
  const d = deps({ fetchImpl: ko });
  assert.match(await village({ args: [], paths, ...d }), /^❌ Impossible de joindre https:\/\/token-kingdom\.com/);
  const d2 = deps(mockFetch({}, 503));
  assert.match(await village({ args: [], paths, ...d2 }), /^❌ Impossible de joindre/);
  assert.equal(readJson(paths.config, null), null);
});

test("URL refusée sans appel réseau", async () => {
  const { paths } = tmpHome();
  const f = mockFetch(START);
  const msg = await village({ args: ["http://evil.com"], paths, ...deps(f) });
  assert.match(msg, /^❌ URL refusée/);
  assert.equal(f.calls.length, 0);
});

test("création avec URL locale explicite, / final retiré", async () => {
  const { paths } = tmpHome();
  const f = mockFetch(START);
  await village({ args: ["http://localhost:3000/"], paths, ...deps(f) });
  assert.equal(f.calls[0].url, "http://localhost:3000/api/cli/start");
  assert.equal(readJson(paths.config, null).apiUrl, "http://localhost:3000");
});

test("config existante : l'argument URL est ignoré", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "https://token-kingdom.com", token: "tk_old", handle: "a" });
  const f = mockFetch({ loginUrl: LOGIN });
  const msg = await village({ args: ["http://evil.com"], paths, ...deps(f) });
  assert.match(msg, /^✅/);
  assert.equal(f.calls[0].url, "https://token-kingdom.com/api/cli/login");
});

test("réponse de création sans token : impossible de joindre, pas de config", async () => {
  const { paths } = tmpHome();
  const msg = await village({ args: [], paths, ...deps(mockFetch({ nope: 1 })) });
  assert.match(msg, /^❌/);
  assert.equal(readJson(paths.config, null), null);
});
