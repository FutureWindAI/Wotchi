const assert = require("node:assert/strict");

const root = require("@futurewindai/wotchi");
const express = require("@futurewindai/wotchi/express");
const nest = require("@futurewindai/wotchi/nest");

assert.equal(typeof root.createWotchi, "function");
assert.equal(typeof root.consoleNotifier, "function");
assert.equal(typeof root.telegramNotifier, "function");
assert.equal(typeof root.webhookNotifier, "function");
assert.equal(typeof root.createWotchiPrometheusExporter, "function");
assert.equal(typeof root.registerWotchiRuntimeWatcher, "function");
assert.equal(root.PROMETHEUS_CONTENT_TYPE, "text/plain; version=0.0.4; charset=utf-8");
assert.equal(typeof express.wotchiErrorHandler, "function");
assert.equal(typeof express.wotchiStatusObserver, "function");
assert.equal(typeof express.webhookNotifier, "function");
assert.equal(typeof nest.registerWotchiNest, "function");
assert.equal(typeof nest.registerWotchiNestStatusObserver, "function");
assert.equal(typeof nest.withWotchiNestFilter, "function");
assert.equal(typeof nest.WotchiModule, "function");

(async () => {
  const [esmRoot, esmExpress, esmNest] = await Promise.all([
    import("@futurewindai/wotchi"),
    import("@futurewindai/wotchi/express"),
    import("@futurewindai/wotchi/nest"),
  ]);
  assert.equal(typeof esmRoot.createWotchi, "function");
  assert.equal(typeof esmRoot.webhookNotifier, "function");
  assert.equal(typeof esmRoot.createWotchiPrometheusExporter, "function");
  assert.equal(typeof esmRoot.registerWotchiRuntimeWatcher, "function");
  assert.equal(esmRoot.PROMETHEUS_CONTENT_TYPE, "text/plain; version=0.0.4; charset=utf-8");
  assert.equal(typeof esmExpress.wotchiErrorHandler, "function");
  assert.equal(typeof esmExpress.wotchiStatusObserver, "function");
  assert.equal(typeof esmExpress.webhookNotifier, "function");
  assert.equal(typeof esmNest.registerWotchiNest, "function");
  assert.equal(typeof esmNest.registerWotchiNestStatusObserver, "function");
  assert.equal(typeof esmNest.withWotchiNestFilter, "function");
  assert.equal(typeof esmNest.WotchiModule, "function");
})().catch((error) => {
  globalThis.console.error(error);
  globalThis.process.exitCode = 1;
});
