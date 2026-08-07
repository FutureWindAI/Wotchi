import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStackFrame, selectApplicationFrame } from "../../src/core/stack-frame.js";

test("selects the first application frame and skips internal and dependency frames", () => {
  const stack = [
    "Error: failed",
    "    at framework (/app/node_modules/framework/index.js:10:2)",
    "    at processTicksAndRejections (node:internal/process/task_queues:95:5)",
    "    at createPayment (/app/src/payments/service.ts:42:17)",
    "    at /app/src/payments/controller.ts:80:4",
  ].join("\n");

  assert.equal(selectApplicationFrame(stack), "createPayment (/app/src/payments/service.ts)");
});

test("normalizes line and column changes without changing the application location", () => {
  assert.equal(
    normalizeStackFrame("at handler (/app/src/orders.ts:10:2)"),
    "handler (/app/src/orders.ts)",
  );
  assert.equal(
    normalizeStackFrame("at handler (/app/src/orders.ts:999:88)"),
    "handler (/app/src/orders.ts)",
  );
});

test("returns no application frame when a stack contains only internal frames", () => {
  assert.equal(
    selectApplicationFrame(
      "Error\n    at process (node:internal/process/task_queues:95:5)\n    at dep (/app/node_modules/dep/index.js:1:1)",
    ),
    undefined,
  );
});
