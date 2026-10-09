import assert from "node:assert/strict";
import { test } from "node:test";
import { validApiUrl } from "../scripts/lib/url.mjs";

test("valide les URLs : https ou http://localhost uniquement", () => {
  assert.equal(validApiUrl("https://token-kingdom.com"), true);
  assert.equal(validApiUrl("http://localhost:3000"), true);
  assert.equal(validApiUrl("http://evil.com"), false);
  assert.equal(validApiUrl("http://localhost.evil.com"), false);
  assert.equal(validApiUrl("pas une url"), false);
});
