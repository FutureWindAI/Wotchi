import assert from "node:assert/strict";
import test from "node:test";
import { createWotchi } from "../../src/index.js";
import { createTelegramNotifier } from "../../src/notifiers/telegram.js";
import type { TelegramRequestFunction } from "../../src/notifiers/telegram-http.js";

test("Telegram credentials never appear in diagnostics or transport errors", async () => {
  const botToken = "123456:super-secret-token";
  const chatId = "987654321";
  const request: TelegramRequestFunction = async () => ({
    statusCode: 401,
    headers: {},
    body: `invalid token ${botToken} for chat ${chatId}`,
  });
  const notifier = createTelegramNotifier({ botToken, chatId }, request);
  const client = createWotchi({
    service: "secret-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });

  client.captureException(new Error("safe failure"));
  await client.flush();
  const diagnostics = JSON.stringify(client.getDiagnostics());
  assert.equal(diagnostics.includes(botToken), false);
  assert.equal(diagnostics.includes(chatId), false);
});
