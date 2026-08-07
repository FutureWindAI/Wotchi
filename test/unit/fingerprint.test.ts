import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintSafeErrorEvent } from "../../src/core/fingerprint.js";
import type { SafeErrorEvent } from "../../src/index.js";

const event = (overrides: Partial<SafeErrorEvent> = {}): SafeErrorEvent => ({
  id: "event-1",
  timestamp: "2026-08-07T00:00:00.000Z",
  service: "orders-api",
  environment: "production",
  error: {
    name: "DatabaseError",
    message: "query failed for order 12345",
    stack:
      "Error\n    at saveOrder (/app/src/orders/service.ts:42:7)\n    at node:internal/process:1:1",
  },
  request: {
    method: "POST",
    route: "/orders/:id",
    statusCode: 500,
  },
  ...overrides,
});

test("normalizes numeric and UUID-like values into stable fingerprints", () => {
  const first = event();
  const second = event({
    error: {
      ...first.error,
      message: "query failed for order 987654",
      stack: "Error\n    at saveOrder (/app/src/orders/service.ts:999:88)",
    },
  });
  const uuidFirst = event({
    error: { ...first.error, message: "order 123e4567-e89b-12d3-a456-426614174000 failed" },
  });
  const uuidSecond = event({
    error: { ...first.error, message: "order 987e6543-e89b-12d3-a456-426614174999 failed" },
  });

  assert.equal(fingerprintSafeErrorEvent(first), fingerprintSafeErrorEvent(second));
  assert.equal(fingerprintSafeErrorEvent(uuidFirst), fingerprintSafeErrorEvent(uuidSecond));
});

test("separates error names, services, routes, and application locations", () => {
  const baseline = fingerprintSafeErrorEvent(event());
  assert.notEqual(
    baseline,
    fingerprintSafeErrorEvent(event({ error: { ...event().error, name: "TimeoutError" } })),
  );
  assert.notEqual(baseline, fingerprintSafeErrorEvent(event({ service: "billing-api" })));
  assert.notEqual(
    baseline,
    fingerprintSafeErrorEvent(
      event({ request: { method: "POST", route: "/users/:id", statusCode: 500 } }),
    ),
  );
  assert.notEqual(
    baseline,
    fingerprintSafeErrorEvent(
      event({
        error: {
          ...event().error,
          stack: "Error\n    at saveOrder (/app/src/other.ts:42:7)",
        },
      }),
    ),
  );
});

test("hashes sanitized fields without using raw stack or secret text", () => {
  const secretStack = event({
    error: {
      ...event().error,
      message: "Authorization: super-secret-token",
      stack: "Error\n    at saveOrder (/app/src/orders/service.ts:1:1)\nsecret-stack-value",
    },
  });
  const sanitizedStack = event({
    error: {
      ...event().error,
      message: "Authorization: [REDACTED]",
      stack: "Error\n    at saveOrder (/app/src/orders/service.ts:999:99)\nother-stack-value",
    },
  });

  const fingerprint = fingerprintSafeErrorEvent(secretStack);
  assert.equal(fingerprint, fingerprintSafeErrorEvent(sanitizedStack));
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
});
