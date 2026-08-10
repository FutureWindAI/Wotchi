import assert from "node:assert/strict";
import test from "node:test";
import { createWotchi } from "../../src/index.js";
import { formatConsoleAlert } from "../../src/notifiers/console.js";
import { formatTelegramAlert } from "../../src/notifiers/telegram-format.js";
import { sendWebhookAlert } from "../../src/notifiers/webhook-http.js";
import type { IncidentAlert, WotchiNotifier } from "../../src/index.js";

test("redacts stack-trace connection credentials before fingerprinting, grouping, and delivery", async () => {
  const firstCanary = "WotchiStackCredentialCanaryOne";
  const secondCanary = "WotchiStackCredentialCanaryTwo";
  const singleLabelCanary = "WotchiSingleLabelCredentialCanary";
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "security-redaction-test",
    environment: "test",
    grouping: { alertThreshold: 2 },
    notifiers: [notifier],
  });
  const capture = (credential: string): void => {
    const error = new Error(
      `Database connection failed for postgresql://db-user:${credential}@db.internal:5432/orders ` +
        `and db-user:${credential}@db.internal:5432/orders ` +
        `and db-user:${singleLabelCanary}@postgres:5432/orders`,
    );
    error.stack = `${error.name}: ${error.message}\n    at worker (worker.ts:10:4)`;
    client.captureException(error);
  };

  capture(firstCanary);
  capture(secondCanary);
  await client.flush();
  const alert = captured[0];
  assert.ok(alert, "one alert should be captured");

  assert.equal(captured.length, 1);
  assert.equal(alert.occurrences, 2);
  assert.equal(JSON.stringify(alert).includes(firstCanary), false);
  assert.equal(JSON.stringify(alert).includes(secondCanary), false);
  assert.equal(JSON.stringify(alert).includes(singleLabelCanary), false);
  assert.equal(formatConsoleAlert(alert, "json").includes(firstCanary), false);
  assert.equal(formatTelegramAlert(alert).includes(firstCanary), false);
  assert.equal(formatConsoleAlert(alert, "json").includes(singleLabelCanary), false);
  assert.equal(formatTelegramAlert(alert).includes(singleLabelCanary), false);

  let webhookBody = "";
  await sendWebhookAlert(
    { url: "https://hooks.example.test/wotchi", alert },
    async (_options, body) => {
      webhookBody = body;
      return { statusCode: 204, headers: {}, body: "" };
    },
  );
  assert.equal(webhookBody.includes(firstCanary), false);
  assert.equal(webhookBody.includes(singleLabelCanary), false);
});

test("redacts short-segment JWT credentials from every notifier output", async () => {
  const token = "eyJhbGciOiJIUzI1NiJ9.SecretJwt_20260810.signature";
  const captured: IncidentAlert[] = [];
  const client = createWotchi({
    service: "security-jwt-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [
      {
        name: "test",
        async send(alert): Promise<void> {
          captured.push(alert);
        },
      },
    ],
  });
  const error = new Error(`JWT failure ${token}`);
  error.stack = `${error.name}: ${error.message}\n    at worker (worker.ts:10:4)`;
  client.captureException(error);
  await client.flush();

  const alert = captured[0];
  assert.ok(alert, "one alert should be captured");
  assert.equal(JSON.stringify(alert).includes(token), false);
  assert.equal(formatConsoleAlert(alert, "json").includes(token), false);
  assert.equal(formatTelegramAlert(alert).includes(token), false);

  let webhookBody = "";
  await sendWebhookAlert(
    { url: "https://hooks.example.test/wotchi", alert },
    async (_options, body) => {
      webhookBody = body;
      return { statusCode: 204, headers: {}, body: "" };
    },
  );
  assert.equal(webhookBody.includes(token), false);
});
