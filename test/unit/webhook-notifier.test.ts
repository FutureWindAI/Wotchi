import assert from "node:assert/strict";
import test from "node:test";
import { createWebhookNotifier } from "../../src/notifiers/webhook.js";
import { sendWebhookAlert } from "../../src/notifiers/webhook-http.js";
import type {
  IncidentAlert,
  WebhookRequestFunction,
  WebhookRequestOptions,
  WebhookResponse,
} from "../../src/index.js";

const alert: IncidentAlert = {
  id: "alert-1",
  fingerprint: "fingerprint-1",
  title: "Wotchi incident",
  severity: "high",
  summary: "Observed a repeated failure.",
  suggestedActions: ["Check logs."],
  firstSeenAt: "2026-08-08T00:00:00.000Z",
  lastSeenAt: "2026-08-08T00:01:00.000Z",
  occurrences: 3,
  service: "orders-api",
  environment: "production",
  context: { password: "secret-value" },
};

const response = (statusCode: number): WebhookResponse => ({
  statusCode,
  headers: {},
  body: "{}",
});

test("webhook notifier posts a bounded sanitized JSON alert over HTTPS", async () => {
  let received: { options: WebhookRequestOptions; body: string; timeoutMs: number } | undefined;
  const request: WebhookRequestFunction = async (options, body, timeoutMs) => {
    received = { options, body, timeoutMs };
    return response(204);
  };

  const notifier = createWebhookNotifier(
    {
      url: "https://hooks.example.test/wotchi?channel=ops",
      headers: { Authorization: "Bearer test-secret" },
      timeoutMs: 250,
    },
    request,
  );
  await notifier.send(alert);

  assert.equal(notifier.name, "webhook");
  assert.equal(received?.options.protocol, "https:");
  assert.equal(received?.options.hostname, "hooks.example.test");
  assert.equal(received?.options.path, "/wotchi?channel=ops");
  assert.equal(received?.options.protocol, "https:");
  assert.equal(received?.timeoutMs, 250);
  assert.equal(received?.options.headers.authorization, "Bearer test-secret");
  const envelope = JSON.parse(received?.body ?? "{}") as Record<string, unknown>;
  const envelopeAlert = envelope.alert as Record<string, unknown>;
  assert.equal(envelope.version, 1);
  assert.equal(envelope.type, "incident.alert");
  assert.equal(typeof envelope.sentAt, "string");
  assert.equal((envelopeAlert.context as Record<string, unknown>).password, "[REDACTED]");
  assert.equal((received?.body.length ?? 0) <= 32_768, true);
});

test("webhook payload builder receives a frozen alert and its output is bounded", async () => {
  let receivedBody = "";
  let frozen = false;
  const request: WebhookRequestFunction = async (_options, body) => {
    receivedBody = body;
    return response(204);
  };
  const notifier = createWebhookNotifier(
    {
      url: "https://hooks.example.test/wotchi",
      payloadBuilder: (value) => {
        frozen = Object.isFrozen(value) && Object.isFrozen(value.context);
        return { custom: true, secret: "secret-value", summary: value.summary };
      },
    },
    request,
  );
  await notifier.send(alert);
  const payload = JSON.parse(receivedBody) as Record<string, unknown>;
  assert.equal(frozen, true);
  assert.deepEqual(payload.alert, {
    custom: true,
    secret: "[REDACTED]",
    summary: "Observed a repeated failure.",
  });
});

test("webhook transport retries one transient response and rejects non-HTTPS destinations", async () => {
  const statuses = [500, 204];
  let attempts = 0;
  const request: WebhookRequestFunction = async () => {
    attempts += 1;
    return response(statuses.shift() ?? 500);
  };

  await sendWebhookAlert({ url: "https://hooks.example.test/wotchi", alert }, request);
  assert.equal(attempts, 2);
  assert.throws(() => createWebhookNotifier({ url: "http://hooks.example.test/wotchi" }), /https/i);
  assert.throws(
    () => createWebhookNotifier({ url: "https://hooks.example.test/wotchi#fragment" }),
    /fragment/i,
  );
  assert.throws(
    () =>
      createWebhookNotifier({
        url: "https://hooks.example.test/wotchi",
        payloadBuilder: "bad" as never,
      }),
    /payloadBuilder/i,
  );
  assert.doesNotThrow(() =>
    createWebhookNotifier({ url: "http://127.0.0.1:4318/wotchi", allowHttpLoopback: true }),
  );
  assert.throws(
    () => createWebhookNotifier({ url: "http://127.0.0.1:4318/wotchi" }),
    /loopback|https/i,
  );
});

test("webhook rejects private HTTPS destinations unless explicitly opted in", () => {
  const privateUrls = [
    "https://127.0.0.1/wotchi",
    "https://10.0.0.1/wotchi",
    "https://169.254.169.254/latest/meta-data",
    "https://metadata.google.internal/computeMetadata/v1",
    "https://[::1]/wotchi",
    "https://[::ffff:127.0.0.1]/wotchi",
    "https://[::ffff:7f00:1]/wotchi",
    "https://[fc00::1]/wotchi",
    "https://[fe80::1]/wotchi",
    "https://[::]/wotchi",
    "https://2130706433/wotchi",
    "https://0x7f000001/wotchi",
  ];

  for (const url of privateUrls) {
    assert.throws(() => createWebhookNotifier({ url }), /private|internal|destination/i, url);
    assert.doesNotThrow(() =>
      createWebhookNotifier({ url, allowPrivateDestinations: true } as never),
    );
  }
});

test("webhook rejects redirects instead of following them", async () => {
  const redirecting: WebhookRequestFunction = async () => response(302);
  await assert.rejects(
    sendWebhookAlert(
      { url: "https://hooks.example.test/wotchi", alert, maxRetries: 0 },
      redirecting,
    ),
    /status 302/i,
  );
});

test("webhook falls back to a bounded envelope when a custom payload is oversized", async () => {
  let receivedBody = "";
  const request: WebhookRequestFunction = async (_options, body) => {
    receivedBody = body;
    return response(204);
  };
  const notifier = createWebhookNotifier(
    {
      url: "https://hooks.example.test/wotchi",
      payloadBuilder: () =>
        Object.fromEntries(
          Array.from({ length: 100 }, (_, index) => [`field-${index}`, "x".repeat(1_000)]),
        ),
    },
    request,
  );
  await notifier.send(alert);
  const payload = JSON.parse(receivedBody) as {
    version: number;
    type: string;
    alert: Record<string, unknown>;
  };
  assert.equal(payload.version, 1);
  assert.equal(payload.type, "incident.alert");
  assert.equal(payload.alert.truncated, true);
  assert.equal(Buffer.byteLength(receivedBody, "utf8") <= 32_768, true);
});

test("webhook transport bounds headers, payloads, and failure messages", async () => {
  assert.throws(
    () =>
      createWebhookNotifier({
        url: "https://hooks.example.test/wotchi",
        headers: { "bad header": "value" },
      }),
    /header/i,
  );
  assert.throws(
    () =>
      createWebhookNotifier({
        url: "https://hooks.example.test/wotchi",
        headers: { Authorization: "x".repeat(2_001) },
      }),
    /header/i,
  );
  const blocked: WebhookRequestFunction = async () => new Promise<WebhookResponse>(() => {});
  await assert.rejects(
    sendWebhookAlert(
      { url: "https://hooks.example.test/wotchi", alert, timeoutMs: 20, maxRetries: 0 },
      blocked,
    ),
    /timed out/i,
  );

  const unauthorized: WebhookRequestFunction = async () => ({
    statusCode: 401,
    headers: {},
    body: "invalid token secret-value",
  });
  await assert.rejects(
    sendWebhookAlert(
      {
        url: "https://hooks.example.test/wotchi",
        alert,
        headers: { Authorization: "Bearer secret-value" },
        maxRetries: 0,
      },
      unauthorized,
    ),
    (error: unknown) => {
      assert.equal(String(error).includes("secret-value"), false);
      return true;
    },
  );
});

test("webhook timeout aborts the underlying request attempt", async () => {
  let aborted = false;
  const request: WebhookRequestFunction = async (options) => {
    const signal = (options as WebhookRequestOptions & { signal?: AbortSignal }).signal;
    await new Promise<void>((resolve) => {
      if (signal?.aborted) {
        aborted = true;
        resolve();
        return;
      }
      signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          resolve();
        },
        { once: true },
      );
    });
    return response(204);
  };

  await assert.rejects(
    sendWebhookAlert(
      { url: "https://hooks.example.test/wotchi", alert, timeoutMs: 10, maxRetries: 0 },
      request,
    ),
    /timed out/i,
  );
  assert.equal(aborted, true);
});
