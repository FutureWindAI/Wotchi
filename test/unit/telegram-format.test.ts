import assert from "node:assert/strict";
import test from "node:test";
import { formatTelegramAlert } from "../../src/notifiers/telegram-format.js";
import type { IncidentAlert } from "../../src/index.js";

const alert: IncidentAlert = {
  id: "alert-1",
  fingerprint: "fingerprint-1",
  title: "Wotchi — Medium incident",
  severity: "medium",
  summary: "Observed 3 occurrences of Error: database failed.",
  suggestedActions: ["Check the application logs.", "Check the latest deployment."],
  firstSeenAt: "2026-08-07T00:00:00.000Z",
  lastSeenAt: "2026-08-07T00:01:00.000Z",
  occurrences: 3,
  service: "orders-api",
  environment: "production",
};

test("Telegram formatter escapes HTML metacharacters and is deterministic", () => {
  const escaped = formatTelegramAlert({
    ...alert,
    summary: "<script>alert('x')</script> & database failed",
    suggestedActions: ["Check <logs> & deployments"],
  });

  assert.equal(
    escaped,
    formatTelegramAlert({
      ...alert,
      summary: "<script>alert('x')</script> & database failed",
      suggestedActions: ["Check <logs> & deployments"],
    }),
  );
  assert.equal(escaped.includes("<script>"), false);
  assert.equal(escaped.includes("&lt;script&gt;alert('x')&lt;/script&gt; &amp;"), true);
  assert.equal(escaped.includes("&lt;logs&gt; &amp; deployments"), true);
});

test("Telegram formatter bounds long alerts and action count", () => {
  const formatted = formatTelegramAlert({
    ...alert,
    title: "T".repeat(2_000),
    service: "S".repeat(2_000),
    environment: "E".repeat(2_000),
    summary: "X".repeat(20_000),
    suggestedActions: Array.from({ length: 20 }, (_, index) => `action-${index}`.repeat(200)),
  });

  assert.equal(formatted.length <= 4_096, true);
  assert.equal(formatted.includes("action-0"), true);
  assert.equal(formatted.includes("action-6"), false);
});

test("Telegram formatter includes trace and request context", () => {
  const formatted = formatTelegramAlert({
    ...alert,
    request: { method: "POST", route: "/orders/:id", statusCode: 500 },
    trace: { traceId: "trace-1", spanId: "span-1" },
    context: { operation: "orders.save" },
  });

  assert.match(formatted, /Request: POST \/orders\/:id status 500/);
  assert.match(formatted, /Trace: trace-1 span span-1/);
  assert.match(formatted, /orders\.save/);
});
