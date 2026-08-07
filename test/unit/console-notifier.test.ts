import assert from "node:assert/strict";
import test from "node:test";
import { consoleNotifier } from "../../src/index.js";
import type { IncidentAlert } from "../../src/index.js";

const alert: IncidentAlert = {
  id: "incident-1",
  fingerprint: "fingerprint",
  title: "Wotchi — High incident",
  severity: "high",
  summary: "An observed error occurred 20 times.",
  suggestedActions: ["Check the database dependency."],
  firstSeenAt: "2026-08-07T00:00:00.000Z",
  lastSeenAt: "2026-08-07T00:01:00.000Z",
  occurrences: 20,
  service: "orders-api",
  environment: "production",
};

test("console notifier writes a bounded, readable alert without ANSI escapes", async () => {
  const lines: string[] = [];
  const notifier = consoleNotifier({ write: (line) => lines.push(line) });

  await notifier.send(alert);

  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.includes("Wotchi — High incident"), true);
  assert.equal(lines[0]?.includes("orders-api"), true);
  assert.equal(lines[0]?.includes("Check the database dependency."), true);
  assert.equal(lines[0]?.includes("\u001b["), false);
});
