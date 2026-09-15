const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = fs.readFileSync(path.join(__dirname, "..", "js", "config.js"), "utf8");

test("Meta Pixel uses the configured production Pixel ID", () => {
  assert.match(config, /1804387653922669/);
});

test("Meta Pixel includes consent Accept and Reject controls", () => {
  assert.match(config, /data-cookie-accept/);
  assert.match(config, /data-cookie-reject/);
  assert.match(config, /avTrainingMetaConsent/);
});

test("Meta Pixel includes PageView, ViewContent, InitiateCheckout and Purchase", () => {
  assert.match(config, /PageView/);
  assert.match(config, /ViewContent/);
  assert.match(config, /InitiateCheckout/);
  assert.match(config, /Purchase/);
  assert.match(config, /booking\.status !== "confirmed"/);
});
