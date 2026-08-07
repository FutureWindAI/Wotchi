import assert from "node:assert/strict";
import test from "node:test";
import { createTelegramNotifier, telegramNotifier } from "../../src/notifiers/telegram.js";
import type { IncidentAlert } from "../../src/index.js";
import type { TelegramRequestFunction } from "../../src/notifiers/telegram-http.js";

const alert: IncidentAlert = {
  id: "alert-1",
  fingerprint: "fingerprint-1",
  title: "Wotchi incident",
  severity: "high",
  summary: "Observed a repeated failure.",
  suggestedActions: ["Check logs."],
  firstSeenAt: "2026-08-07T00:00:00.000Z",
  lastSeenAt: "2026-08-07T00:01:00.000Z",
  occurrences: 3,
  service: "orders-api",
  environment: "production",
};

test("Telegram notifier sends formatted alerts through the queue contract", async () => {
  let sentText = "";
  const request: TelegramRequestFunction = async (_options, body) => {
    sentText = JSON.parse(body).text as string;
    return { statusCode: 200, headers: {}, body: JSON.stringify({ ok: true }) };
  };
  const notifier = createTelegramNotifier({ botToken: "123:token", chatId: "42" }, request);

  assert.equal(notifier.name, "telegram");
  await notifier.send(alert);
  assert.equal(sentText.includes("orders-api"), true);
  assert.equal(sentText.length <= 4_096, true);
});

test("Telegram notifier validates credentials without reflecting them", () => {
  assert.throws(() => telegramNotifier({ botToken: "", chatId: "42" }), /botToken/i);
  assert.throws(
    () => telegramNotifier({ botToken: "123:secret", chatId: "" }),
    (error: unknown) => {
      assert.equal(String(error).includes("123:secret"), false);
      return true;
    },
  );
});
