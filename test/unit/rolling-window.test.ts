import assert from "node:assert/strict";
import test from "node:test";
import { createRollingWindow } from "../../src/core/rolling-window.js";

test("rolling window expires old timestamps and keeps a hard capacity", () => {
  let now = 0;
  const window = createRollingWindow({
    maxEvents: 100,
    windowMs: 60_000,
    now: () => now,
  });

  window.add();
  now = 1_000;
  window.add();
  assert.equal(window.count(), 2);

  now = 61_001;
  assert.equal(window.count(), 0);

  for (let index = 0; index < 150; index += 1) {
    window.add(index);
  }
  assert.equal(window.count(149), 100);
  assert.equal(window.size(149), 100);
});
