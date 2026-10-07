import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { extractEvents, toWire } from "../scripts/lib/parse.mjs";
import { assistantLine } from "./helpers.mjs";

const buf = (...lines) => Buffer.from(lines.join(""));

test("extrait un message assistant avec son usage", () => {
  const { events, consumed } = extractEvents(buf(`${assistantLine({ id: "msg_a" })}\n`));
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    messageId: "msg_a",
    model: "claude-opus-5-5",
    input: 2,
    output: 100,
    cacheCreation: 1000,
    cacheRead: 50_000,
    ts: Date.parse("2026-10-07T12:00:00.000Z"),
  });
  assert.equal(consumed, Buffer.byteLength(`${assistantLine({ id: "msg_a" })}\n`));
});

test("ne consomme pas une dernière ligne incomplète", () => {
  const complete = `${assistantLine({ id: "msg_a" })}\n`;
  const partial = assistantLine({ id: "msg_b" }).slice(0, 40);
  const { events, consumed } = extractEvents(buf(complete, partial));
  assert.deepEqual(
    events.map((e) => e.messageId),
    ["msg_a"],
  );
  assert.equal(consumed, Buffer.byteLength(complete));
});

test("ne consomme rien sans aucun saut de ligne", () => {
  assert.deepEqual(extractEvents(buf(assistantLine())), { events: [], consumed: 0 });
});

test("ignore les autres types, le JSON invalide et les messages sans usage ou sans id", () => {
  const lines = [
    JSON.stringify({ type: "user", message: { content: "salut" } }),
    "{pas du json",
    JSON.stringify({ type: "assistant", timestamp: "2026-10-07T12:00:00Z", message: { id: "msg_x" } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-10-07T12:00:00Z", message: { usage: { output_tokens: 1 } } }),
    JSON.stringify({ type: "assistant", timestamp: "pas une date", message: { id: "m", usage: {} } }),
  ];
  assert.equal(extractEvents(buf(`${lines.join("\n")}\n`)).events.length, 0);
});

test("garde un message <synthetic> à zéro", () => {
  const line = assistantLine({ model: "<synthetic>", input: 0, output: 0, cacheCreation: 0, cacheRead: 0 });
  const [e] = extractEvents(buf(`${line}\n`)).events;
  assert.equal(e.model, "<synthetic>");
  assert.equal(e.output, 0);
});

test("coerce les compteurs (négatif, décimal, absent, énorme) et tronque le modèle", () => {
  const line = JSON.stringify({
    type: "assistant",
    timestamp: "2026-10-07T12:00:00Z",
    message: {
      id: "m",
      model: "x".repeat(150),
      usage: { input_tokens: -5, output_tokens: 12.7, cache_read_input_tokens: 5e12 },
    },
  });
  const [e] = extractEvents(buf(`${line}\n`)).events;
  assert.equal(e.input, 0);
  assert.equal(e.output, 12);
  assert.equal(e.cacheCreation, 0);
  assert.equal(e.cacheRead, 1e10);
  assert.equal(e.model.length, 100);
});

test("gère l'UTF-8 multi-octets dans le décompte d'octets", () => {
  const line = `${JSON.stringify({ type: "user", message: { content: "héhé 🎉" } })}\n`;
  assert.equal(extractEvents(buf(line)).consumed, Buffer.byteLength(line));
});

test("toWire remplace l'id par son SHA-256 hex", () => {
  const [e] = extractEvents(buf(`${assistantLine({ id: "msg_a" })}\n`)).events;
  const w = toWire(e);
  assert.equal(w.idHash, createHash("sha256").update("msg_a").digest("hex"));
  assert.equal("messageId" in w, false);
  assert.equal(w.output, 100);
});
