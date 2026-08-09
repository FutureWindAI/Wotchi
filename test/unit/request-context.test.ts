import assert from "node:assert/strict";
import test from "node:test";
import { buildRequestContext } from "../../src/integrations/request-context.js";

test("request context can pass through existing trace identifiers from a trusted property", () => {
  const context = buildRequestContext({
    request: { observability: { traceId: "trace-123", spanId: "span-456" } },
    method: "GET",
    route: "/orders/123",
    options: { traceContextProperty: "observability" },
  });

  assert.deepEqual(context, {
    method: "GET",
    route: "/orders/:id",
    trace: { traceId: "trace-123", spanId: "span-456" },
  });
});

test("request context rejects unsafe trace property names", () => {
  assert.throws(
    () =>
      buildRequestContext({
        request: {},
        options: { traceContextProperty: "observability.trace" },
      }),
    /traceContextProperty/i,
  );
});

test("request context reads a bounded correlation identifier from a trusted property", () => {
  const context = buildRequestContext({
    request: { correlation: "corr-123" },
    route: "/orders/123",
    options: { correlationIdProperty: "correlation" },
  });

  assert.equal(context?.correlationId, "corr-123");
});
