import assert from "node:assert/strict";
import test from "node:test";
import { createGroupStore } from "../../src/core/group-store.js";
import type { SafeErrorEvent } from "../../src/index.js";

const event = (fingerprint: string): SafeErrorEvent => ({
  id: `${fingerprint}-event`,
  timestamp: "2026-08-07T00:00:00.000Z",
  service: "demo-api",
  environment: "test",
  error: { name: "Error", message: fingerprint },
});

test("group store tracks lifetime counts, rolling counts, samples, and eviction", () => {
  let now = 0;
  const store = createGroupStore({
    maxGroups: 2,
    maxEventsPerWindow: 100,
    windowMs: 60_000,
    now: () => now,
  });

  const first = store.record("a", event("a"));
  store.record("a", event("a"));
  assert.equal(first.totalCount, 1);
  assert.equal(store.get("a")?.totalCount, 2);
  assert.equal(store.get("a")?.windowCount, 2);
  assert.equal(store.get("a")?.sample.error.message, "a");

  now = 61_000;
  store.record("a", event("a"));
  assert.equal(store.get("a")?.totalCount, 3);
  assert.equal(store.get("a")?.windowCount, 1);

  store.record("b", event("b"));
  store.record("c", event("c"));
  assert.equal(store.size(), 2);
  assert.equal(store.get("a"), undefined);
  assert.equal(store.groupsEvicted(), 1);
});

test("group store keeps one sanitized sample and caps rolling events", () => {
  const store = createGroupStore({
    maxGroups: 2,
    maxEventsPerWindow: 3,
    windowMs: 60_000,
    now: () => 0,
  });
  for (let index = 0; index < 10; index += 1) {
    store.record("same", event(`same-${index}`));
  }

  const group = store.get("same");
  assert.equal(group?.totalCount, 10);
  assert.equal(group?.windowCount, 3);
  assert.equal(group?.sample.error.message, "same-0");
});
