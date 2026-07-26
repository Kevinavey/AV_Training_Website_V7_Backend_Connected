const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadSiteConfig() {
  const configPath = path.join(__dirname, "..", "js", "config.js");
  const source = fs.readFileSync(configPath, "utf8");
  const context = {};
  vm.runInNewContext(`${source}\nthis.loadedConfig = SITE_CONFIG;`, context);
  return context.loadedConfig;
}

test("public booking endpoints use HTTPS and do not point to localhost", () => {
  const config = loadSiteConfig();

  for (const endpoint of [config.courseSessionsUrl, config.backendUrl]) {
    assert.match(endpoint, /^https:\/\//);
    assert.doesNotMatch(endpoint, /localhost|127\.0\.0\.1/);
  }
});

test("course sessions and checkout use the same deployed backend", () => {
  const config = loadSiteConfig();
  const sessionsOrigin = new URL(config.courseSessionsUrl).origin;
  const checkoutOrigin = new URL(config.backendUrl).origin;

  assert.equal(sessionsOrigin, checkoutOrigin);
});
