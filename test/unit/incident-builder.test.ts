import assert from "node:assert/strict";
import test from "node:test";
import { buildIncidentAlert } from "../../src/core/incident-builder.js";
import type { IncidentGroup } from "../../src/index.js";

const group: IncidentGroup = {
  fingerprint: "abc123",
  firstSeenAt: "2026-08-07T00:00:00.000Z",
  lastSeenAt: "2026-08-07T00:01:00.000Z",
  totalCount: 4,
  windowCount: 4,
  sample: {
    id: "event-1",
    timestamp: "2026-08-07T00:01:00.000Z",
    service: "orders-api",
    environment: "production",
    error: {
      name: "DatabaseError",
      message: "query failed for order <number>",
    },
    request: { method: "POST", route: "/orders/:id", statusCode: 500 },
  },
  severity: "medium",
};

test("builds a deterministic observation summary with generic suggested checks", () => {
  const alert = buildIncidentAlert(group, { shouldAlert: true, severity: "medium" });
  const second = buildIncidentAlert(group, { shouldAlert: true, severity: "medium" });

  assert.deepEqual(alert, second);
  assert.equal(alert.title, "Wotchi — Medium incident");
  assert.equal(alert.service, "orders-api");
  assert.equal(alert.environment, "production");
  assert.equal(alert.occurrences, 4);
  assert.equal(alert.summary.includes("4 occurrences"), true);
  assert.equal(alert.summary.toLowerCase().includes("root cause"), false);
  assert.equal(alert.suggestedActions.length > 0, true);
  assert.equal(
    alert.suggestedActions.some((action: string) => action.includes("Check")),
    true,
  );
});
