import assert from "node:assert/strict";
import test from "node:test";
import { sendTelegramMessage } from "../../src/notifiers/telegram-http.js";
import type {
  TelegramHttpResponse,
  TelegramRequestFunction,
} from "../../src/notifiers/telegram-http.js";

const response = (
  statusCode: number,
  body = JSON.stringify({ ok: true }),
): TelegramHttpResponse => ({
  statusCode,
  headers: {},
  body,
});

test("Telegram transport builds a fixed HTTPS Bot API request", async () => {
  let received:
    | { options: Parameters<TelegramRequestFunction>[0]; body: string; timeoutMs: number }
    | undefined;
  const request: TelegramRequestFunction = async (options, body, timeoutMs) => {
    received = { options, body, timeoutMs };
    return response(200);
  };

  await sendTelegramMessage(
    { botToken: "123:secret-token", chatId: "-42", text: "hello", timeoutMs: 200 },
    request,
  );

  assert.deepEqual(received?.options, {
    protocol: "https:",
    hostname: "api.telegram.org",
    method: "POST",
    path: "/bot123:secret-token/sendMessage",
    headers: {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(received?.body ?? "", "utf8"),
    },
  });
  assert.deepEqual(JSON.parse(received?.body ?? "{}"), {
    chat_id: "-42",
    text: "hello",
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  assert.equal(received?.timeoutMs, 200);
});

test("Telegram transport retries one rate-limit and one transient server response", async () => {
  const statuses = [
    response(429, JSON.stringify({ ok: false, parameters: { retry_after: 0 } })),
    response(503),
    response(200),
  ];
  let attempts = 0;
  const request: TelegramRequestFunction = async () => {
    attempts += 1;
    return statuses.shift() ?? response(500);
  };

  await sendTelegramMessage({ botToken: "123:token", chatId: "42", text: "hello" }, request);
  assert.equal(attempts, 3);
});

test("Telegram transport does not retry permanent failures or expose tokens", async () => {
  let attempts = 0;
  const request: TelegramRequestFunction = async () => {
    attempts += 1;
    return response(401, '{"description":"bad token 123:secret-token"}');
  };

  await assert.rejects(
    sendTelegramMessage({ botToken: "123:secret-token", chatId: "42", text: "hello" }, request),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal(String(error).includes("123:secret-token"), false);
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test("Telegram transport bounds response bodies and timeout waits", async () => {
  const oversized: TelegramRequestFunction = async () => response(200, "x".repeat(9_000));
  await assert.rejects(
    sendTelegramMessage({ botToken: "123:token", chatId: "42", text: "hello" }, oversized),
    /response body/i,
  );

  const blocked: TelegramRequestFunction = async () => new Promise<TelegramHttpResponse>(() => {});
  await assert.rejects(
    sendTelegramMessage(
      { botToken: "123:token", chatId: "42", text: "hello", timeoutMs: 20 },
      blocked,
    ),
    /timed out/i,
  );
});
