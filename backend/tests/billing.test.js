import test from "node:test";
import assert from "node:assert/strict";
import { RATES, tokensForBytes } from "../lib/billing.js";
import { decryptSecret, encryptSecret } from "../lib/secretBox.js";

const MB = 1048576;
test("token cost is always a whole number, rounded up", () => {
  assert.equal(tokensForBytes(1 * MB, RATES.captionPerMB), 5);
  assert.equal(tokensForBytes(2.12 * MB, RATES.captionPerMB), 11); // 10.6 → 11
  assert.equal(tokensForBytes(1.018 * MB, RATES.captionPerMB), 6); // 5.09 → 6
  assert.equal(tokensForBytes(5 * MB, RATES.cloudSharePerMB), 10);
  assert.equal(tokensForBytes(5 * MB + 1, RATES.cloudSharePerMB), 11);
  assert.equal(tokensForBytes(10, RATES.cloudSharePerMB), 1); // minimum 1
  for (const b of [1, 999, 123456, 7 * MB + 3]) assert.ok(Number.isInteger(tokensForBytes(b, 5)));
});

test("secretBox round-trips and rejects tampering", () => {
  const e = encryptSecret("AQ.some-key-123");
  assert.notEqual(e, "AQ.some-key-123");
  assert.equal(decryptSecret(e), "AQ.some-key-123");
  assert.equal(decryptSecret(e.slice(0, -2) + "xx"), "");
  assert.equal(decryptSecret(""), "");
});

import { RATE_DEFS, normalizeRates, getRates, rateDeps, chargeFlat, deps as billingDeps } from "../lib/billing.js";

test("admin rates: defaults, clamping, whole numbers, free tools", async () => {
  const d = normalizeRates({});
  assert.equal(d.captionPerMB, 5);
  assert.equal(d.qrPerUse, 0);
  const n = normalizeRates({ captionPerMB: 7.6, cloudSharePerMB: -3, voiceCharsPerToken: 0, junk: 1, ttsPerUse: "abc" });
  assert.equal(n.captionPerMB, 8);
  assert.equal(n.cloudSharePerMB, 0); // clamped to min
  assert.equal(n.voiceCharsPerToken, 1); // never 0 (division)
  assert.equal(n.ttsPerUse, 0);
  assert.ok(!("junk" in n));
  assert.equal(RATE_DEFS.length, Object.keys(d).length);
  assert.equal(tokensForBytes(5 * 1048576, 0), 0); // free
  rateDeps.read = async () => ({ captionPerMB: 9 });
  assert.equal((await getRates()).captionPerMB, 9);
  rateDeps.read = async () => { throw new Error("no db"); };
  assert.equal((await getRates()).captionPerMB, 5);
});

test("chargeFlat: free passes, paid needs login and charges + refunds on failure", async () => {
  const calls = [];
  const old = { c: billingDeps.charge, u: billingDeps.usage, r: billingDeps.refund };
  billingDeps.charge = async (id, cost) => { calls.push(["charge", cost]); return 10; };
  billingDeps.usage = async () => {};
  billingDeps.refund = async (id, cost) => { calls.push(["refund", cost]); };
  const run = (req, res) => new Promise((resolve) => chargeFlat("qrPerUse", "qr")(req, res, (e) => resolve(e || null)));
  const mkRes = () => { const h = {}; return { statusCode: 200, writableFinished: false, on: (ev, f) => { h[ev] = f; }, emit: (ev) => h[ev]?.() }; };
  rateDeps.read = async () => ({ qrPerUse: 0 });
  assert.equal(await run({}, mkRes()), null);
  rateDeps.read = async () => ({ qrPerUse: 3 });
  const err = await run({}, mkRes());
  assert.equal(err.code, "LOGIN_REQUIRED");
  const res = mkRes();
  assert.equal(await run({ user: { _id: "u1" } }, res), null);
  res.statusCode = 500; res.emit("finish");
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(calls, [["charge", 3], ["refund", 3]]);
  Object.assign(billingDeps, { charge: old.c, usage: old.u, refund: old.r });
  rateDeps.read = async () => null;
});
