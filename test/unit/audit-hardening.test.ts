import assert from "node:assert/strict";
import test from "node:test";
import { createWotchi } from "../../src/index.js";
import type { IncidentAlert, WotchiNotifier } from "../../src/index.js";

const collect = (): { alerts: IncidentAlert[]; notifier: WotchiNotifier } => {
  const alerts: IncidentAlert[] = [];
  return {
    alerts,
    notifier: {
      name: "test",
      async send(alert): Promise<void> {
        alerts.push(alert);
      },
    },
  };
};

test("alert includes bounded actionable context and existing trace identifiers", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    release: "2026.08.08",
    instance: "orders-7f9d",
    links: {
      log: "https://logs.example.test/{{service}}/{{requestId}}",
      trace: "https://traces.example.test/{{traceId}}",
    },
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });

  client.captureEvent({
    level: "error",
    message: "payment provider failed",
    error: new Error("payment provider failed"),
    request: {
      method: "POST",
      route: "/orders/:id",
      statusCode: 502,
      requestId: "req-123",
      correlationId: "corr-789",
      trace: { traceId: "trace-123", spanId: "span-456" },
    },
    operation: "orders.pay",
    job: "payment-retry",
    tags: { component: "checkout", secret: "do-not-expose" },
    context: { operation: "orders.pay", provider: "stripe" },
  });
  await client.flush();

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.release, "2026.08.08");
  assert.equal(alerts[0]?.instance, "orders-7f9d");
  assert.deepEqual(alerts[0]?.request, {
    method: "POST",
    route: "/orders/:id",
    statusCode: 502,
    requestId: "req-123",
    correlationId: "corr-789",
    trace: { traceId: "trace-123", spanId: "span-456" },
  });
  assert.deepEqual(alerts[0]?.trace, { traceId: "trace-123", spanId: "span-456" });
  assert.equal(alerts[0]?.correlationId, "corr-789");
  assert.equal(alerts[0]?.operation, "orders.pay");
  assert.equal(alerts[0]?.job, "payment-retry");
  assert.deepEqual(alerts[0]?.tags, { component: "checkout", secret: "[REDACTED]" });
  assert.deepEqual(alerts[0]?.links, {
    log: "https://logs.example.test/orders-api/req-123",
    trace: "https://traces.example.test/trace-123",
  });
  assert.deepEqual(alerts[0]?.context, { operation: "orders.pay", provider: "stripe" });
  assert.equal((alerts[0]?.error?.applicationFrame?.length ?? 0) > 0, true);
});

test("filter and beforeSend run on sanitized frozen values and can suppress noise", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    filter: (event) => event.request?.route !== "/health",
    beforeSend: (alert) => {
      assert.equal(Object.isFrozen(alert), true);
      assert.equal(Object.isFrozen(alert.context), true);
      return {
        ...alert,
        context: { ...(alert.context ?? {}), transformed: true, token: "secret" },
      };
    },
    notifiers: [notifier],
  });

  client.captureEvent({
    level: "error",
    message: "health check noise",
    error: new Error("health check noise"),
    request: { route: "/health" },
  });
  client.captureEvent({
    level: "error",
    message: "order failed",
    error: new Error("order failed"),
    context: { password: "do-not-expose" },
    request: { route: "/orders/:id" },
  });
  await client.flush();

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.summary.includes("do-not-expose"), false);
  assert.equal(alerts[0]?.context?.transformed, true);
  assert.equal(alerts[0]?.context?.token, "[REDACTED]");
  assert.equal(client.getDiagnostics().eventsSuppressed, 1);
});

test("beforeSend spread transformations preserve the actionable application frame", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    beforeSend: (alert) => ({
      ...alert,
      context: { ...(alert.context ?? {}), transformed: true },
    }),
    notifiers: [notifier],
  });

  client.captureException(new Error("application frame must survive"));
  await client.flush();

  assert.equal(typeof alerts[0]?.error?.applicationFrame, "string");
  assert.equal(alerts[0]?.context?.transformed, true);
});

test("configuration fingerprint callback sees a frozen sanitized event", async () => {
  const { alerts, notifier } = collect();
  let frozen = false;
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    fingerprint: (event) => {
      frozen = Object.isFrozen(event) && Object.isFrozen(event.error);
      assert.equal(event.context?.password, "[REDACTED]");
      return event.request?.route === "/orders/:id" ? "orders.route" : undefined;
    },
    notifiers: [notifier],
  });

  client.captureEvent({
    level: "error",
    message: "first",
    error: new Error("first"),
    request: { route: "/orders/:id" },
    context: { password: "secret" },
  });
  await client.flush();

  assert.equal(frozen, true);
  assert.equal(alerts[0]?.fingerprint, "orders.route");
});

test("hook failures are isolated and reported in diagnostics", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    fingerprint: () => {
      throw new Error("callback secret");
    },
    filter: () => {
      throw new Error("filter secret");
    },
    notifiers: [notifier],
  });
  client.captureException(new Error("failure"));
  await client.flush();
  assert.equal(alerts.length, 0);
  assert.equal(client.getDiagnostics().filterFailures, 1);
  assert.equal(client.getDiagnostics().eventsSuppressed, 1);
});

test("per-event fingerprint overrides group changing messages", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 2 },
    notifiers: [notifier],
  });

  client.captureEvent({
    level: "error",
    message: "order 101 failed",
    error: new Error("order 101 failed"),
    fingerprint: "orders.payment.failure",
  });
  client.captureEvent({
    level: "error",
    message: "order 202 failed",
    error: new Error("order 202 failed"),
    fingerprint: () => "orders.payment.failure",
  });
  await client.flush();

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.fingerprint, "orders.payment.failure");
  assert.equal(alerts[0]?.occurrences, 2);
});

test("captureException options can carry existing trace context", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });

  client.captureException(new Error("traceable failure"), undefined, {
    trace: { traceId: "trace-exception", spanId: "span-exception" },
  });
  await client.flush();

  assert.deepEqual(alerts[0]?.trace, {
    traceId: "trace-exception",
    spanId: "span-exception",
  });
});

test("matching rules can ignore a route or override threshold and severity", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 10 },
    rules: [
      { environment: "production", route: "/health", ignore: true },
      { environment: "production", route: "/checkout", alertThreshold: 2, severity: "high" },
    ],
    notifiers: [notifier],
  });

  client.captureEvent({
    level: "error",
    message: "health failure",
    error: new Error("health failure"),
    request: { route: "/health" },
  });
  client.captureEvent({
    level: "error",
    message: "checkout failure",
    error: new Error("checkout failure"),
    request: { route: "/checkout" },
  });
  client.captureEvent({
    level: "error",
    message: "checkout failure",
    error: new Error("checkout failure"),
    request: { route: "/checkout" },
  });
  await client.flush();

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.severity, "high");
  assert.equal(alerts[0]?.occurrences, 2);
});

test("testAlert sends a deterministic notifier configuration alert", async () => {
  const { alerts, notifier } = collect();
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    notifiers: [notifier],
  });

  const result = await client.testAlert();

  assert.equal(result.status, "sent");
  assert.equal(result.configurationAccepted, true);
  assert.equal(result.queued, true);
  assert.equal(result.flushed, true);
  assert.equal(result.delivered, true);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.title, "Wotchi — Test alert");
  assert.match(alerts[0]?.summary ?? "", /notifier configuration/i);
});

test("testAlert returns a structured notifier failure result", async () => {
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    notifiers: [
      {
        name: "broken",
        async send(): Promise<void> {
          throw new Error("secret");
        },
      },
    ],
  });

  const result = await client.testAlert();

  assert.equal(result.status, "notifier-failed");
  assert.equal(result.queued, true);
  assert.equal(result.flushed, true);
  assert.equal(result.delivered, false);
  assert.equal(result.notifierFailures, 1);
  assert.equal(result.error?.includes("secret"), false);
});

test("testAlert reports notifier failures from its own queue job", async () => {
  const alerts: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "mixed",
    async send(alert): Promise<void> {
      if (alert.fingerprint !== "wotchi-test-alert") {
        throw new Error("ordinary alert failed");
      }
      alerts.push(alert);
    },
  };
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });

  client.captureException(new Error("ordinary alert"));
  const result = await client.testAlert();

  assert.equal(result.status, "sent");
  assert.equal(result.delivered, true);
  assert.equal(result.notifierFailures, 0);
  assert.equal(client.getDiagnostics().notifierFailures, 1);
  assert.equal(alerts.length, 1);
});

test("final alert serialization redacts hostile credential context", async () => {
  const { alerts, notifier } = collect();
  const canaries = [
    "WotchiXApiAlertCanary",
    "WotchiDbPasswordAlertCanary",
    "WotchiCookieAlertCanary",
    "WotchiSignatureAlertCanary",
    "WotchiEncodedAlertCanary",
    "WotchiWebhookPathAlertCanary",
  ];
  const client = createWotchi({
    service: "orders-api",
    environment: "production",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });

  client.captureEvent({
    level: "error",
    message: "hostile metadata",
    error: new Error("hostile metadata"),
    context: {
      xApiKey: canaries[0],
      dbPassword: canaries[1],
      cookie: "Cookie: session=" + canaries[2],
      signatureUrl: "https://hooks.example.test/callback?signature=" + canaries[3],
      encodedUrl: "https://hooks.example.test/callback?t%6fken=" + canaries[4],
      webhookUrl: "https://hooks.example.test/services/" + canaries[5],
      authorization: "Basic V290Y2hpQmFzaWNDYW5hcnk=",
    },
  });
  await client.flush();

  const serialized = JSON.stringify(alerts[0]);
  for (const canary of canaries) {
    assert.equal(serialized.includes(canary), false, canary + " escaped alert serialization");
  }
});
