import assert from "node:assert/strict";
import test from "node:test";
import { evaluateIncidentPolicy } from "../../src/core/incident-policy.js";
import type { IncidentGroup } from "../../src/index.js";

const group = (overrides: Partial<IncidentGroup> = {}): IncidentGroup => ({
  fingerprint: "fingerprint",
  firstSeenAt: "2026-08-07T00:00:00.000Z",
  lastSeenAt: "2026-08-07T00:01:00.000Z",
  totalCount: 3,
  windowCount: 3,
  sample: {
    id: "event-1",
    timestamp: "2026-08-07T00:01:00.000Z",
    service: "orders-api",
    environment: "production",
    error: { name: "Error", message: "query failed" },
  },
  severity: "medium",
  ...overrides,
});

test("alerts only at the threshold and suppresses alerts during cooldown", () => {
  const first = evaluateIncidentPolicy({
    group: group({ totalCount: 1, windowCount: 1 }),
    now: 1_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });
  const second = evaluateIncidentPolicy({
    group: group({ totalCount: 2, windowCount: 2 }),
    now: 2_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });
  const third = evaluateIncidentPolicy({
    group: group(),
    now: 3_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });
  const cooldown = evaluateIncidentPolicy({
    group: group({ lastAlertedAt: new Date(3_000).toISOString(), totalCount: 10, windowCount: 10 }),
    now: 4_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });
  const afterCooldown = evaluateIncidentPolicy({
    group: group({ lastAlertedAt: new Date(3_000).toISOString(), totalCount: 10, windowCount: 10 }),
    now: 904_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });

  assert.equal(first.shouldAlert, false);
  assert.equal(second.shouldAlert, false);
  assert.equal(third.shouldAlert, true);
  assert.equal(third.severity, "medium");
  assert.equal(cooldown.shouldAlert, false);
  assert.equal(afterCooldown.shouldAlert, true);
});

test("assigns critical and high severity according to explicit observations", () => {
  const crash = evaluateIncidentPolicy({
    group: group({ totalCount: 1, windowCount: 1 }),
    now: 1_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
    eventKind: "process-monitor",
  });
  const spike = evaluateIncidentPolicy({
    group: group({ totalCount: 20, windowCount: 20 }),
    now: 1_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });
  const unavailable = evaluateIncidentPolicy({
    group: group({ sample: { ...group().sample, request: { statusCode: 503 } } }),
    now: 1_000,
    alertThreshold: 3,
    cooldownMs: 900_000,
  });

  assert.deepEqual(crash, { shouldAlert: true, severity: "critical" });
  assert.equal(spike.severity, "high");
  assert.equal(spike.shouldAlert, true);
  assert.equal(unavailable.severity, "high");
  assert.equal(unavailable.shouldAlert, true);
});
