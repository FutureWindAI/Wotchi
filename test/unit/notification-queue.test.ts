import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationQueue } from "../../src/core/notification-queue.js";
import type { IncidentAlert, WotchiNotifier } from "../../src/index.js";

const alert = (id: string): IncidentAlert => ({
  id,
  fingerprint: `fingerprint-${id}`,
  title: `Wotchi — Medium incident`,
  severity: "medium",
  summary: "An observed error occurred 3 times.",
  suggestedActions: ["Check the failing dependency."],
  firstSeenAt: "2026-08-07T00:00:00.000Z",
  lastSeenAt: "2026-08-07T00:01:00.000Z",
  occurrences: 3,
  service: "orders-api",
  environment: "production",
});

test("notification queue drains FIFO with one active notifier job", async () => {
  const order: string[] = [];
  let active = 0;
  let maximumActive = 0;
  const notifier: WotchiNotifier = {
    name: "test",
    async send(current): Promise<void> {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      order.push(current.id);
      active -= 1;
    },
  };
  const queue = createNotificationQueue({ maxPendingAlerts: 10, concurrency: 1 });

  assert.equal(queue.enqueue(alert("one"), [notifier]), true);
  assert.equal(queue.enqueue(alert("two"), [notifier]), true);
  await queue.flush();

  assert.deepEqual(order, ["one", "two"]);
  assert.equal(maximumActive, 1);
  assert.equal(queue.alertsQueued(), 2);
  assert.equal(queue.alertsSent(), 2);
  assert.equal(queue.pending(), 0);
});

test("notification queue bounds pending work and contains notifier failures", async () => {
  const failures: unknown[] = [];
  const notifier: WotchiNotifier = {
    name: "failing",
    async send(): Promise<void> {
      throw new Error("transport failed");
    },
  };
  const queue = createNotificationQueue({
    maxPendingAlerts: 1,
    concurrency: 1,
    onNotifierError: (error: unknown) => failures.push(error),
  });

  assert.equal(queue.enqueue(alert("one"), [notifier]), true);
  assert.equal(queue.enqueue(alert("two"), [notifier]), true);
  assert.equal(queue.enqueue(alert("three"), [notifier]), false);
  await queue.flush();

  assert.equal(queue.alertsDropped(), 1);
  assert.equal(queue.notifierFailures(), 2);
  assert.equal(failures.length, 2);
});

test("notification queue bounds flush waits", async () => {
  const notifier: WotchiNotifier = {
    name: "blocked",
    async send(): Promise<void> {
      await new Promise<void>(() => undefined);
    },
  };
  const queue = createNotificationQueue({ maxPendingAlerts: 1, concurrency: 1 });
  queue.enqueue(alert("blocked"), [notifier]);

  await assert.rejects(queue.flush(5), /flush timed out after 5ms/);
});
