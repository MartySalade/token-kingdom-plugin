import assert from "node:assert/strict";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
  assert.match(msg, /^✅ Your kingdom has been founded/);
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
  const local = "http://localhost:3000/login/tl_xyz";
  const f = mockFetch({ loginUrl: local });
  const d = deps(f);
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^✅ Your village is opening in the browser/);
  assert.ok(msg.includes(local));
  assert.equal(f.calls[0].url, "http://localhost:3000/api/cli/login");
  assert.equal(f.calls[0].init.headers.authorization, "Bearer tk_old");
  assert.deepEqual(d.opened, [local]);
  assert.equal(d.started, 0);
  assert.equal(readJson(paths.config, null).token, "tk_old");
});

test("401 : token révoqué, rien ouvert, config gardée", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "https://token-kingdom.com", token: "tk_old", handle: "a" });
  const d = deps(mockFetch({ error: "invalid_token" }, 401));
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^❌ This Claude Code is no longer linked/);
  assert.equal(d.opened.length, 0);
  assert.equal(readJson(paths.config, null).token, "tk_old");
});

test("429 : trop de tentatives, pas de config", async () => {
  const { paths } = tmpHome();
  const d = deps(mockFetch({ error: "rate_limited" }, 429));
  const msg = await village({ args: [], paths, ...d });
  assert.match(msg, /^❌ Too many attempts/);
  assert.equal(readJson(paths.config, null), null);
  assert.equal(d.started, 0);
});

test("réseau KO et 5xx : impossible de joindre", async () => {
  const { paths } = tmpHome();
  const ko = async () => {
    throw new TypeError("fetch failed");
  };
  const d = deps({ fetchImpl: ko });
  assert.match(await village({ args: [], paths, ...d }), /^❌ Couldn't reach https:\/\/token-kingdom\.com/);
  const d2 = deps(mockFetch({}, 503));
  assert.match(await village({ args: [], paths, ...d2 }), /^❌ Couldn't reach/);
  assert.equal(readJson(paths.config, null), null);
});

test("URL refusée sans appel réseau", async () => {
  const { paths } = tmpHome();
  const f = mockFetch(START);
  const msg = await village({ args: ["http://evil.com"], paths, ...deps(f) });
  assert.match(msg, /^❌ URL rejected/);
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

const UNREADABLE = /^❌ Local config is unreadable/;

test("config corrompue ou sans token : pas de /start", async () => {
  for (const content of ["{pas du json", JSON.stringify({ apiUrl: "https://token-kingdom.com" })]) {
    const { paths } = tmpHome();
    mkdirSync(dirname(paths.config), { recursive: true });
    writeFileSync(paths.config, content);
    const f = mockFetch(START);
    const d = deps(f);
    assert.match(await village({ args: [], paths, ...d }), UNREADABLE);
    assert.equal(f.calls.length, 0);
    assert.equal(d.started, 0);
  }
});

test("config avec token sans apiUrl : reconnexion sur l'URL par défaut", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { token: "tk_old" });
  const f = mockFetch({ loginUrl: LOGIN });
  assert.match(await village({ args: [], paths, ...deps(f) }), /^✅ Your village/);
  assert.equal(f.calls[0].url, "https://token-kingdom.com/api/cli/login");
});

test("statut inattendu ou corps invalide : réponse inattendue", async () => {
  for (const [body, status] of [[{}, 404], [{ nope: 1 }, 200]]) {
    const { paths } = tmpHome();
    const msg = await village({ args: [], paths, ...deps(mockFetch(body, status)) });
    assert.match(msg, new RegExp(`^❌ Unexpected server response \\(HTTP ${status}\\)`));
    assert.equal(readJson(paths.config, null), null);
  }
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "https://token-kingdom.com", token: "t" });
  assert.match(await village({ args: [], paths, ...deps(mockFetch({}, 200)) }), /Unexpected server response \(HTTP 200\)/);
});

test("loginUrl d'une autre origine : refusé, pas ouvert, config écrite à la création", async () => {
  for (const bad of ["https://evil.com/login/x", "javascript:alert(1)", "pas une url", "http://token-kingdom.com/x"]) {
    const { paths } = tmpHome();
    const d = deps(mockFetch({ ...START, loginUrl: bad }));
    const msg = await village({ args: [], paths, ...d });
    assert.match(msg, /^❌ Sign-in link rejected \(unexpected origin\)\. Your kingdom has been founded: run \/token-kingdom:village again\./);
    assert.equal(d.opened.length, 0);
    assert.equal(readJson(paths.config, null).token, "tk_abc");
  }
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "https://token-kingdom.com", token: "t" });
  const d = deps(mockFetch({ loginUrl: "https://evil.com/x" }));
  assert.equal(await village({ args: [], paths, ...d }), "❌ Sign-in link rejected (unexpected origin).");
  assert.equal(d.opened.length, 0);
});

test("apiUrl invalide dans la config : pas d'envoi du token", async () => {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: "http://evil.com", token: "tk_old" });
  const f = mockFetch({ loginUrl: LOGIN });
  assert.equal(await village({ args: [], paths, ...deps(f) }), "❌ URL rejected in the config: http://evil.com");
  assert.equal(f.calls.length, 0);
});
