import assert from "node:assert/strict";
import test from "node:test";
import { createWotchi } from "../../src/index.js";
import type { IncidentAlert, WotchiNotifier } from "../../src/index.js";

test("client captures, redacts, groups, and sends a threshold alert", async () => {
  const alerts: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      alerts.push(alert);
    },
  };
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    notifiers: [notifier],
    grouping: { alertThreshold: 3 },
  });
  const error = new Error("database query failed");

  client.captureException(error, { password: "secret-value", orderId: 42 });
  client.captureException(error, { password: "secret-value", orderId: 43 });
  client.captureException(error, { password: "secret-value", orderId: 44 });
  await client.flush();

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.occurrences, 3);
  assert.equal(alerts[0]?.service, "orders-api");
  assert.equal(alerts[0]?.summary.includes("secret-value"), false);
  assert.equal(alerts[0]?.summary.includes("3 occurrences"), true);
  assert.deepEqual(client.getDiagnostics(), {
    capturedEvents: 3,
    captureFailures: 0,
    groupsEvicted: 0,
    alertsQueued: 1,
    alertsDropped: 0,
    alertsSent: 1,
    notifierFailures: 0,
    activeGroups: 1,
    pendingAlerts: 0,
  });
});

test("disabled client performs no capture work", async () => {
  let sends = 0;
  const notifier: WotchiNotifier = {
    name: "test",
    async send(): Promise<void> {
      sends += 1;
    },
  };
  const client = createWotchi({
    service: "orders-api",
    environment: "test",
    enabled: false,
    notifiers: [notifier],
  });

  client.captureEvent({ level: "error", message: "ignored" });
  await client.flush();

  assert.equal(sends, 0);
  assert.equal(client.getDiagnostics().capturedEvents, 0);
});

test("client applies cooldown, contains malformed capture, and freezes diagnostics", async () => {
  const alerts: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      alerts.push(alert);
    },
  };
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    notifiers: [notifier],
    grouping: { alertThreshold: 1, cooldownMs: 60_000 },
  });
  const error = new Error("timeout from dependency");

  assert.doesNotThrow(() => {
    client.captureException(error);
    client.captureException(error);
    client.captureEvent({ level: "invalid" } as never);
  });
  await client.flush();

  assert.equal(alerts.length, 1);
  const diagnostics = client.getDiagnostics();
  assert.equal(diagnostics.captureFailures, 1);
  assert.equal(Object.isFrozen(diagnostics), true);
});

test("notifier failures do not escape the capture path", async () => {
  const notifier: WotchiNotifier = {
    name: "failing",
    async send(): Promise<void> {
      throw new Error("notifier failed");
    },
  };
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    notifiers: [notifier],
    grouping: { alertThreshold: 1 },
  });

  assert.doesNotThrow(() => client.captureException(new Error("failure")));
  await client.flush();

  assert.equal(client.getDiagnostics().notifierFailures, 1);
  assert.equal(client.getDiagnostics().alertsSent, 0);
});

test("redacts connection URL credentials before fingerprinting, grouping, and notification", async () => {
  const alerts: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      alerts.push(alert);
    },
  };
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    notifiers: [notifier],
    grouping: { alertThreshold: 2 },
  });

  client.captureException(
    new Error("database unavailable: postgres://user:first-password@db.internal:5432/orders"),
  );
  client.captureException(
    new Error("database unavailable: postgres://user:second-password@db.internal:5432/orders"),
  );
  await client.flush();

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.occurrences, 2);
  assert.equal(alerts[0]?.summary.includes("first-password"), false);
  assert.equal(alerts[0]?.summary.includes("second-password"), false);
});
