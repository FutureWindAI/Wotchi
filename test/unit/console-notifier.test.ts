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

test("console notifier can emit one-line structured JSON", async () => {
  const lines: string[] = [];
  const notifier = consoleNotifier({
    write: (line: string) => lines.push(line),
    format: "json",
  } as never);

  await notifier.send(alert);

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  assert.equal(parsed.title, alert.title);
  assert.equal(parsed.service, alert.service);
  assert.equal(parsed.occurrences, alert.occurrences);
  assert.equal(lines[0]?.includes("\n"), false);
});

test("console notifier defensively redacts connection URL credentials", async () => {
  const lines: string[] = [];
  const notifier = consoleNotifier({ write: (line: string) => lines.push(line) });

  await notifier.send({
    ...alert,
    summary: "postgres://user:console-password@db.internal:5432/orders",
  });

  assert.equal(lines[0]?.includes("console-password"), false);
  assert.equal(lines[0]?.includes("[REDACTED]"), true);
});
