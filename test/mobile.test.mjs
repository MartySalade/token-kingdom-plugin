import assert from "node:assert/strict";
import { test } from "node:test";
import { writeJsonPrivate } from "../scripts/lib/store.mjs";
import { mobile } from "../scripts/lib/village.mjs";
import { tmpHome } from "./helpers.mjs";

const TICKET = `tl_${"a".repeat(43)}`;
const API = "https://token-kingdom.com";

function setup(body, status = 200) {
  const { paths } = tmpHome();
  writeJsonPrivate(paths.config, { apiUrl: API, token: "tk_abc", handle: "alice" });
  const d = { calls: [], opened: [] };
  d.fetchImpl = async (url, init) => {
    d.calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  d.openUrl = (u) => d.opened.push(u);
  return { paths, d };
}

test("mobile : ticket via Bearer, ouvre /mobile#ticket (jamais /login, que le navigateur consommerait)", async () => {
  const { paths, d } = setup({ loginUrl: `${API}/login/${TICKET}` });
  const msg = await mobile({ paths, ...d });
  assert.equal(d.calls[0].url, `${API}/api/cli/login`);
  assert.equal(d.calls[0].init.headers.authorization, "Bearer tk_abc");
  assert.deepEqual(d.opened, [`${API}/mobile#${TICKET}`]);
  assert.match(msg, /^✅ A QR code is opening in your browser/);
  assert.match(msg, /2 min/);
  assert.ok(msg.includes(`${API}/mobile#${TICKET}`));
  assert.ok(!msg.includes("tk_abc"));
});

test("mobile sans config : demande de fonder le royaume d'abord, aucun appel", async () => {
  const { paths } = tmpHome();
  const d = { calls: [], opened: [], fetchImpl: async () => assert.fail("pas d'appel"), openUrl: (u) => d.opened.push(u) };
  const msg = await mobile({ paths, ...d });
  assert.equal(msg, "❌ No kingdom on this computer yet: run /token-kingdom:village first.");
  assert.deepEqual(d.opened, []);
});

test("mobile : token révoqué, limite, serveur en panne", async () => {
  for (const [status, re] of [
    [401, /no longer linked/],
    [429, /Too many attempts/],
    [503, /Couldn't reach/],
  ]) {
    const { paths, d } = setup({ error: "x" }, status);
    assert.match(await mobile({ paths, ...d }), re);
    assert.deepEqual(d.opened, []);
  }
});

test("mobile : lien d'une autre origine ou sans ticket lisible, refusé", async () => {
  for (const loginUrl of [`https://evil.com/login/${TICKET}`, `${API}/login/nope`, `${API}/autre/${TICKET}`]) {
    const { paths, d } = setup({ loginUrl });
    assert.equal(await mobile({ paths, ...d }), "❌ Sign-in link rejected (unexpected origin).");
    assert.deepEqual(d.opened, []);
  }
});
