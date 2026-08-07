import assert from "node:assert/strict";
import test from "node:test";
import { validateConfig, WotchiConfigurationError } from "../../src/core/config.js";
import type { WotchiConfig, WotchiNotifier } from "../../src/index.js";

const notifier: WotchiNotifier = {
  name: "test",
  async send(): Promise<void> {},
};

const baseConfig = (): WotchiConfig => ({
  service: "payments-api",
  environment: "test",
  notifiers: [notifier],
});

test("configuration validation applies bounded defaults and freezes the result", () => {
  const normalized = validateConfig(baseConfig());

  assert.equal(normalized.enabled, true);
  assert.deepEqual(normalized.grouping, {
    windowMs: 60_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
    maxGroups: 200,
    maxEventsPerWindow: 100,
  });
  assert.deepEqual(normalized.queue, {
    maxPendingAlerts: 100,
    concurrency: 1,
  });
  assert.deepEqual(normalized.privacy, {
    maxDepth: 5,
    maxKeys: 100,
    maxStringLength: 500,
    maxStackLength: 4_000,
    redactKeys: [],
  });
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.grouping), true);
  assert.equal(Object.isFrozen(normalized.queue), true);
  assert.equal(Object.isFrozen(normalized.privacy), true);
  assert.equal(Object.isFrozen(normalized.notifiers), true);
});

test("configuration rejects blank service and environment", () => {
  for (const field of ["service", "environment"] as const) {
    const config = baseConfig();
    config[field] = "   ";

    assert.throws(
      () => validateConfig(config),
      (error: unknown) => error instanceof WotchiConfigurationError,
    );
  }
});

test("configuration rejects empty notifier arrays and invalid concurrency", () => {
  const emptyNotifiers = baseConfig();
  emptyNotifiers.notifiers = [];
  assert.throws(() => validateConfig(emptyNotifiers), WotchiConfigurationError);

  const invalidConcurrency = baseConfig();
  invalidConcurrency.queue = { concurrency: 2 as 1 };
  assert.throws(() => validateConfig(invalidConcurrency), WotchiConfigurationError);
});

test("configuration rejects zero, negative, non-integer, and oversized limits", () => {
  const invalidCases: WotchiConfig[] = [
    { ...baseConfig(), grouping: { windowMs: 0 } },
    { ...baseConfig(), grouping: { alertThreshold: -1 } },
    { ...baseConfig(), grouping: { maxGroups: 1.5 } },
    { ...baseConfig(), privacy: { maxDepth: 0 } },
    { ...baseConfig(), privacy: { redactKeys: Array.from({ length: 101 }, (_, i) => `key-${i}`) } },
  ];

  for (const config of invalidCases) {
    assert.throws(() => validateConfig(config), WotchiConfigurationError);
  }
});

test("configuration errors never echo token-like supplied values", () => {
  const token = "super-secret-token-123";
  const config = baseConfig();
  config.notifiers = [
    {
      name: `Bearer ${token}`,
      async send(): Promise<void> {},
    },
  ];
  config.grouping = { windowMs: 0 };

  assert.throws(
    () => validateConfig(config),
    (error: unknown) => {
      assert.equal(error instanceof WotchiConfigurationError, true);
      assert.equal((error as Error).message.includes(token), false);
      return true;
    },
  );
});
