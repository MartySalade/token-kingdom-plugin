import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { listTranscripts, readFrom } from "../scripts/lib/scan.mjs";
import { tmpHome } from "./helpers.mjs";

test("liste les .jsonl récursivement, sous-agents compris, triés", () => {
  const { paths } = tmpHome();
  const proj = join(paths.projects, "-Users-me-app");
  mkdirSync(join(proj, "sess1", "subagents"), { recursive: true });
  writeFileSync(join(proj, "b.jsonl"), "");
  writeFileSync(join(proj, "a.jsonl"), "");
  writeFileSync(join(proj, "notes.txt"), "");
  writeFileSync(join(proj, "sess1", "subagents", "agent-x.jsonl"), "");
  assert.deepEqual(listTranscripts(paths.projects), [
    join(proj, "a.jsonl"),
    join(proj, "b.jsonl"),
    join(proj, "sess1", "subagents", "agent-x.jsonl"),
  ]);
});

test("renvoie une liste vide si le dossier n'existe pas", () => {
  assert.deepEqual(listTranscripts("/nexiste/pas"), []);
});

test("lit à partir d'un offset, borné par max", () => {
  const { root } = tmpHome();
  const f = join(root, "t.jsonl");
  writeFileSync(f, "0123456789");
  assert.deepEqual(readFrom(f, 4), { buf: Buffer.from("456789"), start: 4 });
  assert.deepEqual(readFrom(f, 4, 3), { buf: Buffer.from("456"), start: 4 });
  assert.equal(readFrom(f, 10).buf.length, 0);
});

test("repart de 0 si le fichier est plus petit que l'offset (tronqué ou remplacé)", () => {
  const { root } = tmpHome();
  const f = join(root, "t.jsonl");
  writeFileSync(f, "abc");
  assert.deepEqual(readFrom(f, 50), { buf: Buffer.from("abc"), start: 0 });
});
