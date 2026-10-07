import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readJson, writeJsonPrivate } from "../scripts/lib/store.mjs";
import { runSync } from "../scripts/lib/sync.mjs";
import { assistantLine, fakeFetch, tmpHome } from "./helpers.mjs";

function setup({ linked = true } = {}) {
  const h = tmpHome();
  const dir = join(h.paths.projects, "-Users-me-app");
  mkdirSync(dir, { recursive: true });
  if (linked) writeJsonPrivate(h.paths.config, { apiUrl: "http://localhost:3000", token: "tk_test", handle: "alice" });
  const file = (name, ...lines) => {
    const f = join(dir, name);
    writeFileSync(f, lines.map((l) => `${l}\n`).join(""));
    return f;
  };
  return { ...h, dir, file };
}
const noSleep = async () => {};

test("n'appelle pas le réseau si le plugin n'est pas lié", async () => {
  const s = setup({ linked: false });
  s.file("a.jsonl", assistantLine());
  const { fetchImpl, calls } = fakeFetch();
  assert.deepEqual(await runSync({ paths: s.paths, fetchImpl, sleep: noSleep }), {
    status: "not_linked",
    sent: 0,
    requests: 0,
  });
  assert.equal(calls.length, 0);
  assert.equal(existsSync(s.paths.log), false);
});

test("envoie les nouveaux events puis rien au run suivant", async () => {
  const s = setup();
  s.file("a.jsonl", assistantLine({ id: "m1" }), assistantLine({ id: "m2" }));
  const f1 = fakeFetch();
  const r1 = await runSync({ paths: s.paths, fetchImpl: f1.fetchImpl, sleep: noSleep });
  assert.deepEqual(r1, { status: "ok", sent: 2, requests: 1 });
  assert.equal(f1.calls[0].url, "http://localhost:3000/api/ingest");
  assert.equal(f1.calls[0].init.headers.authorization, "Bearer tk_test");
  assert.equal(f1.calls[0].body.events.length, 2);
  assert.match(f1.calls[0].body.events[0].idHash, /^[0-9a-f]{64}$/);

  const f2 = fakeFetch();
  assert.deepEqual(await runSync({ paths: s.paths, fetchImpl: f2.fetchImpl, sleep: noSleep }), {
    status: "ok",
    sent: 0,
    requests: 0,
  });
  assert.equal(f2.calls.length, 0);
});

test("dédoublonne les lignes d'un même message, y compris entre fichiers", async () => {
  const s = setup();
  s.file("a.jsonl", assistantLine({ id: "m1" }), assistantLine({ id: "m1" }));
  s.file("b.jsonl", assistantLine({ id: "m1" }), assistantLine({ id: "m2" }));
  const f = fakeFetch();
  await runSync({ paths: s.paths, fetchImpl: f.fetchImpl, sleep: noSleep });
  assert.equal(f.calls[0].body.events.length, 2);
});

test("envoie une ligne incomplète seulement une fois terminée", async () => {
  const s = setup();
  const path = s.file("a.jsonl", assistantLine({ id: "m1" }));
  const partial = assistantLine({ id: "m2" });
  appendFileSync(path, partial.slice(0, 30));
  const f1 = fakeFetch();
  await runSync({ paths: s.paths, fetchImpl: f1.fetchImpl, sleep: noSleep });
  assert.equal(f1.calls[0].body.events.length, 1);

  appendFileSync(path, `${partial.slice(30)}\n`);
  const f2 = fakeFetch();
  const r2 = await runSync({ paths: s.paths, fetchImpl: f2.fetchImpl, sleep: noSleep });
  assert.equal(r2.sent, 1);
});

test("401 : s'arrête sans avancer, et renvoie tout au run suivant", async () => {
  const s = setup();
  s.file("a.jsonl", assistantLine({ id: "m1" }));
  const f1 = fakeFetch([401]);
  assert.equal((await runSync({ paths: s.paths, fetchImpl: f1.fetchImpl, sleep: noSleep })).status, "unauthorized");
  const f2 = fakeFetch([200]);
  assert.equal((await runSync({ paths: s.paths, fetchImpl: f2.fetchImpl, sleep: noSleep })).sent, 1);
});

test("5xx, 429 ou réseau : retry_later sans avancer l'offset", async () => {
  for (const status of [500, 429, 0]) {
    const s = setup();
    s.file("a.jsonl", assistantLine({ id: "m1" }));
    const f1 = fakeFetch([status]);
    assert.equal((await runSync({ paths: s.paths, fetchImpl: f1.fetchImpl, sleep: noSleep })).status, "retry_later");
    assert.deepEqual(readJson(s.paths.state, { files: {} }).files, {});
  }
});

test("400 : batch ignoré et offset avancé (pas de poison pill)", async () => {
  const s = setup();
  s.file("a.jsonl", assistantLine({ id: "m1" }));
  const f1 = fakeFetch([400]);
  assert.equal((await runSync({ paths: s.paths, fetchImpl: f1.fetchImpl, sleep: noSleep })).status, "ok");
  const f2 = fakeFetch();
  await runSync({ paths: s.paths, fetchImpl: f2.fetchImpl, sleep: noSleep });
  assert.equal(f2.calls.length, 0);
});

test("découpe en batchs de 500 et fait une pause toutes les 50 requêtes", async () => {
  const s = setup();
  const lines = Array.from({ length: 501 * 51 }, (_, i) => assistantLine({ id: `m${i}` }));
  s.file("a.jsonl", ...lines);
  const f = fakeFetch();
  const sleeps = [];
  const r = await runSync({ paths: s.paths, fetchImpl: f.fetchImpl, sleep: async (ms) => sleeps.push(ms) });
  assert.equal(r.requests, Math.ceil((501 * 51) / 500));
  assert.ok(f.calls.every((c) => c.body.events.length <= 500));
  assert.deepEqual(sleeps, [60_000]);
});

test("une ligne plus grande que le chunk de lecture ne bloque pas", async () => {
  const s = setup();
  const huge = JSON.stringify({ type: "user", message: { content: "x".repeat(5000) } });
  s.file("a.jsonl", huge, assistantLine({ id: "m1" }));
  const f = fakeFetch();
  const r = await runSync({ paths: s.paths, fetchImpl: f.fetchImpl, sleep: noSleep, readChunk: 1024 });
  assert.equal(r.sent, 1);
});

test("oublie l'état des fichiers supprimés", async () => {
  const s = setup();
  s.file("a.jsonl", assistantLine({ id: "m1" }));
  await runSync({ paths: s.paths, fetchImpl: fakeFetch().fetchImpl, sleep: noSleep });
  unlinkSync(join(s.dir, "a.jsonl"));
  s.file("b.jsonl", assistantLine({ id: "m2" }));
  await runSync({ paths: s.paths, fetchImpl: fakeFetch().fetchImpl, sleep: noSleep });
  assert.deepEqual(Object.keys(readJson(s.paths.state, null).files), [join(s.dir, "b.jsonl")]);
});
