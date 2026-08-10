import assert from "node:assert/strict";
import test from "node:test";
import { createWotchi, registerWotchiRuntimeWatcher } from "../../src/index.js";
import type { IncidentAlert, WotchiNotifier } from "../../src/index.js";

test("overload admission drops work before normalization and emits one sanitized signal", async () => {
  const alerts: IncidentAlert[] = [];
  const client = createWotchi({
    service: "admission-test",
    environment: "test",
    notifiers: [
      {
        name: "memory",
        async send(alert) {
          alerts.push(alert);
        },
      },
    ],
    grouping: { alertThreshold: 1, cooldownMs: 60_000 },
    overload: { maxEventsPerSecond: 1, burst: 1, alertCooldownMs: 60_000 },
  });

  client.captureException(new Error("first"));
  client.captureException(new Error("second"));
  await client.flush();

  assert.equal(client.getDiagnostics().eventsDroppedOverload, 1);
  assert.equal(alerts.length, 2);
  assert.equal(
    alerts.some((alert) => alert.fingerprint === "wotchi.capture.overload"),
    true,
  );
  assert.equal(
    alerts.every((alert) => JSON.stringify(alert).includes("second") === false),
    true,
  );
});

test("shutdown drains accepted work and prevents later captures", async () => {
  let sent = 0;
  const client = createWotchi({
    service: "shutdown-test",
    environment: "test",
    notifiers: [
      {
        name: "memory",
        async send() {
          sent += 1;
        },
      },
    ],
    grouping: { alertThreshold: 1 },
  });
  client.captureException(new Error("before shutdown"));
  await client.shutdown();
  client.captureException(new Error("after shutdown"));

  assert.equal(sent, 1);
  assert.equal(client.getDiagnostics().capturesAfterShutdown, 1);
});

test("slow notifier is time-bounded while a healthy notifier receives the same alert", async () => {
  let healthySent = 0;
  const blocked: WotchiNotifier = {
    name: "blocked",
    async send() {
      await new Promise<void>(() => undefined);
    },
  };
  const client = createWotchi({
    service: "notifier-isolation-test",
    environment: "test",
    notifiers: [
      blocked,
      {
        name: "healthy",
        async send() {
          healthySent += 1;
        },
      },
    ],
    grouping: { alertThreshold: 1 },
    queue: {
      notifierTimeoutMs: 10,
      notifierCircuitBreaker: { failureThreshold: 1, cooldownMs: 50 },
    },
  });
  client.captureException(new Error("notifier isolation"));
  await client.flush(100);

  assert.equal(healthySent, 1);
  assert.equal(client.getDiagnostics().notifierTimeouts, 1);
  assert.equal(client.getDiagnostics().notifierFailures, 1);
});

test("repeated notifier failures open a bounded circuit", async () => {
  let attempts = 0;
  const client = createWotchi({
    service: "circuit-test",
    environment: "test",
    notifiers: [
      {
        name: "failing",
        async send() {
          attempts += 1;
          throw new Error("transport unavailable");
        },
      },
    ],
    grouping: { alertThreshold: 1, cooldownMs: 1 },
    queue: { notifierCircuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 } },
  });
  for (let index = 0; index < 3; index += 1) {
    client.captureException(new Error("circuit failure"), undefined, {
      fingerprint: `circuit-${index}`,
    });
  }
  await client.flush();

  assert.equal(attempts, 2);
  assert.equal(client.getDiagnostics().notifierCircuitOpenSkips, 1);
});

test("runtime watcher samples bounded process metrics and can be unregistered", async () => {
  const alerts: IncidentAlert[] = [];
  const client = createWotchi({
    service: "runtime-watcher-test",
    environment: "test",
    notifiers: [
      {
        name: "memory",
        async send(alert) {
          alerts.push(alert);
        },
      },
    ],
    grouping: { alertThreshold: 1 },
  });
  const watcher = registerWotchiRuntimeWatcher(client, {
    intervalMs: 100,
    rssBytes: 1,
    alertThreshold: 1,
  });
  await new Promise((resolve) => setTimeout(resolve, 130));
  watcher.unregister();
  await client.flush();

  assert.equal(
    alerts.some((alert) => alert.fingerprint === "wotchi.runtime.rss-bytes"),
    true,
  );
  await client.shutdown();
});

test("runtime watcher measures notifier failures per sampling interval", async () => {
  let failNotifier = true;
  const runtimeAlerts: IncidentAlert[] = [];
  const client = createWotchi({
    service: "runtime-notifier-delta-test",
    environment: "test",
    grouping: { alertThreshold: 1, cooldownMs: 1 },
    notifiers: [
      {
        name: "toggle",
        async send(alert): Promise<void> {
          if (failNotifier) {
            throw new Error("intentional notifier failure");
          }
          if (alert.fingerprint === "wotchi.runtime.notifier-failures") {
            runtimeAlerts.push(alert);
          }
        },
      },
    ],
  });
  const watcher = registerWotchiRuntimeWatcher(client, {
    intervalMs: 100,
    notifierFailures: 1,
    alertThreshold: 1,
  });

  client.captureException(new Error("create one notifier failure"));
  await client.flush();
  failNotifier = false;
  await new Promise((resolve) => setTimeout(resolve, 250));
  watcher.unregister();
  await client.flush();

  assert.equal(client.getDiagnostics().notifierFailures, 1);
  assert.equal(runtimeAlerts.length, 1);
  await client.shutdown();
});
