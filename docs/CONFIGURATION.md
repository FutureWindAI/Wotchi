# Wotchi configuration

`createWotchi` validates and freezes configuration at startup. Invalid values fail before the
application starts sending events; configuration errors do not echo supplied token-like values.

> **Release note:** The advanced context, event controls, `testAlert()`, status observation, and
> webhook sections below describe unreleased source-revision additions. They are not available from
> the published `0.1.0-beta.2` package until a new beta is approved and published.

## Required fields

| Field         | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `service`     | Short service identifier included in alerts and fingerprints.    |
| `environment` | Deployment environment such as `development` or `production`.    |
| `notifiers`   | One or more notifier instances, for example `consoleNotifier()`. |

## Optional fields and defaults

| Path                          |  Default | Purpose                                                       |
| ----------------------------- | -------: | ------------------------------------------------------------- |
| `enabled`                     |   `true` | Disable capture without changing integration wiring.          |
| `instance`                    |        — | Explicit host, replica, or process label for alerts.          |
| `release`                     |        — | Explicit release/version label for alerts.                    |
| `filter`                      |        — | Sanitized callback that can drop an event.                    |
| `fingerprint`                 |        — | Config-level callback for sanitized event grouping.           |
| `beforeSend`                  |        — | Sanitized alert callback that can transform or drop an alert. |
| `links.log` / `links.trace`   |        — | HTTPS URL templates for bounded log/trace links.              |
| `rules`                       |        — | Up to 50 exact environment/route policy rules.                |
| `grouping.windowMs`           |  `60000` | Rolling grouping window.                                      |
| `grouping.alertThreshold`     |      `3` | Matching events required before an alert.                     |
| `grouping.cooldownMs`         | `900000` | Duplicate-alert suppression period.                           |
| `grouping.maxGroups`          |    `200` | Maximum in-memory fingerprints; hard cap `10000`.             |
| `grouping.maxEventsPerWindow` |    `100` | Maximum event timestamps per group; hard cap `10000`.         |
| `queue.maxPendingAlerts`      |    `100` | Maximum queued alerts; hard cap `10000`.                      |
| `privacy.maxDepth`            |      `5` | Maximum nested metadata depth; hard cap `20`.                 |
| `privacy.maxKeys`             |    `100` | Maximum keys visited; hard cap `10000`.                       |
| `privacy.maxStringLength`     |    `500` | Maximum retained string length; hard cap `32768`.             |
| `privacy.maxStackLength`      |   `4000` | Maximum retained stack length; hard cap `32768`.              |

The queue has concurrency `1` in the current release. Values above the hard caps are rejected
with `WotchiConfigurationError`. When the queue is full, new notification work is dropped
and the host request is not delayed. `getDiagnostics()` exposes counters for dropped work and
notifier failures.

## Filtering, fingerprints, and per-route policy

Callbacks run only after normalization and redaction. Filter and fingerprint callbacks receive a
deep-frozen `SafeErrorEvent`; `beforeSend` receives a deep-frozen `IncidentAlert` after grouping and
link expansion. A callback that throws is contained by the capture boundary and counted in
diagnostics; a `beforeSend` result of `null` suppresses the alert. Returning `undefined` keeps the
sanitized alert.

```ts
const wotchi = createWotchi({
  service: "orders-api",
  environment: "production",
  filter: (event) => event.request?.route !== "/health",
  fingerprint: (event) => (event.request?.route === "/checkout" ? "checkout.failure" : undefined),
  beforeSend: (alert) => ({
    ...alert,
    context: { ...(alert.context ?? {}), team: "payments" },
  }),
  links: {
    log: "https://logs.example.test/{{service}}/{{requestId}}",
    trace: "https://traces.example.test/{{traceId}}",
  },
  rules: [
    { environment: "production", route: "/health", ignore: true },
    { environment: "production", route: "/checkout", alertThreshold: 2, severity: "high" },
  ],
  notifiers: [consoleNotifier()],
});

wotchi.captureEvent({
  level: "error",
  message: "order lookup failed for 123",
  error,
  fingerprint: "orders.lookup.failure",
  request: { route: "/orders/:id" },
});
```

An event `fingerprint` may be a bounded string or a callback receiving the sanitized event. The
configuration-level `fingerprint` callback is used when an event does not provide an override. Exact
`rules.environment` and `rules.route` matches can ignore an event or override its threshold and
severity. Keep callback work short; Wotchi bounds the event data, not arbitrary user callback CPU.
If a rule threshold is greater than `grouping.maxEventsPerWindow`, raise that bounded window limit
as well or the rule cannot observe enough events to alert.

## Fingerprint normalization

Wotchi normalizes dynamic values before creating a fingerprint. Numeric runs become `<number>`,
UUID-like values become `<uuid>`, hexadecimal IDs become `<hex>`, and casing and repeated
whitespace are normalized. The fingerprint is derived from the service, environment, error name,
error message, method, route, and first application stack frame after this normalization.

This intentionally groups messages such as `user 123 lookup failed` and `user 456 lookup failed`
when the rest of the failure is the same. It can also merge failures whose numeric value is
meaningful. The current release does not expose a switch for changing these rules; use a distinct
error name, message, route, or application frame when two numeric cases must remain separate.
Arbitrary metadata is redacted and retained for the alert sample, but it is not part of the
fingerprint identity.

## Console format

`consoleNotifier()` writes a human-readable alert by default. Set `format: "json"` for a bounded,
one-line JSON object suitable for log collectors:

```ts
consoleNotifier({ format: "json" });
```

The formatter keeps the same alert fields in both modes and performs a final defensive redaction
before writing.

## Existing trace context

Wotchi does not install an OpenTelemetry SDK. Pass identifiers from the instrumentation you already
use:

```ts
wotchi.captureEvent({
  level: "error",
  message: "payment provider failed",
  error,
  request: {
    method: "POST",
    route: "/orders/:id",
    trace: { traceId, spanId },
  },
});
```

Framework request-context options also accept `traceContextProperty` when an existing tracer stores
safe `{ traceId, spanId }` values on the request object, and `correlationIdProperty` for a bounded
request correlation identifier.

## Optional HTTP status observation

Error middleware and NestJS exception filters capture thrown errors. Some authentication or rate
limit middleware writes a response directly instead of calling `next(error)`. Opt into status
observation when those responses should be visible:

```ts
app.use(
  wotchiStatusObserver(wotchi, {
    statusCodes: [401, 403, 429],
    statusClasses: ["5xx"],
    ignoreStatusCodes: [429],
    alertThreshold: 10,
  }),
);
```

The default selection observes `401`, `403`, `429`, and `5xx`. `statusCodes` and `statusClasses`
form an allow-list; `ignoreStatusCodes` removes noisy codes from that selection. The optional
`alertThreshold` applies only to status events, so a noisy `429` stream can require 1,000 matches
without delaying ordinary application-error alerts. If the threshold is greater than the default
`grouping.maxEventsPerWindow` of `100`, raise that bounded window limit to at least the threshold.
Capture remains bounded and the observer does not read response bodies or headers.

For NestJS, call `registerWotchiNestStatusObserver` after `NestFactory.create()` when using the
Express platform adapter. It is separate from `registerWotchiNest` and remains opt-in.

## Manual capture and shutdown

```ts
wotchi.captureException(error, { operation: "checkout" });
wotchi.captureEvent({
  level: "error",
  kind: "manual",
  message: "payment provider returned an error",
  metadata: { provider: "example" },
});

await wotchi.flush();
```

Capture is synchronous and bounded. Use `flush()` only when the host explicitly wants to wait for
queued notifier work, such as a controlled shutdown or deterministic test.

To validate configured destinations without manufacturing an application exception:

```ts
const result = await wotchi.testAlert();
console.log(result.status, result.delivered, result.notifierFailures);
```

The test alert uses the same bounded queue and notifier delivery path and returns `sent`,
`notifier-failed`, `timeout`, or `queue-full`. A failed notifier remains isolated; configuration
rejection still throws `WotchiConfigurationError` when the client is created.

## Telegram

Telegram is opt-in and requires a bot token plus a destination chat ID. Add the notifier only when
both values are present in the host environment:

```ts
telegramNotifier({
  botToken: requiredEnv("WOTCHI_TELEGRAM_BOT_TOKEN"),
  chatId: requiredEnv("WOTCHI_TELEGRAM_CHAT_ID"),
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} must be configured before enabling Telegram`);
  }
  return value;
}
```

The application owner must create the bot, start or add it to the destination chat, and keep both
values outside source control. See [Security](SECURITY.md).

## HTTPS webhook

`webhookNotifier` sends a bounded versioned JSON envelope to an explicit HTTPS destination. It
validates the destination, rejects embedded URL credentials and fragments, limits custom headers,
times out requests, rejects redirects, and retries one `429` or `5xx` response. HTTP is accepted
only for `localhost`, `127.0.0.1`, or `::1` when `allowHttpLoopback: true` is explicitly set.
Loopback, RFC1918, link-local, unique-local IPv6, metadata and internal DNS destinations are
rejected for HTTPS by default. Set `allowPrivateDestinations: true` only for a deliberately
isolated development destination; never pass it values derived from requests or tenants. The real
transport resolves the hostname immediately before connecting and pins the resolved address for
that request.

```ts
webhookNotifier({
  url: requiredEnv("WOTCHI_WEBHOOK_URL"),
  headers: { Authorization: requiredEnv("WOTCHI_WEBHOOK_AUTH") },
  payloadBuilder: (alert) => ({
    incident: alert.fingerprint,
    summary: alert.summary,
  }),
});
```

The endpoint is operated by the application owner; Wotchi does not host or retain webhook data.
The payload builder receives a frozen sanitized alert, and its result is redacted and bounded before
being placed in the stable envelope `{ version: 1, type: "incident.alert", sentAt, alert }`.

## Deployment model and production recipe

Wotchi runs inside one application process and keeps groups and cooldowns in bounded memory. In a
cluster or multi-replica deployment, each process has independent state, so duplicate alerts are
possible and a restart resets grouping. A serverless instance may terminate before asynchronous
delivery completes. Hard crashes, out-of-memory failures, frozen event loops, and unavailable
networks cannot be detected reliably from inside the process.

Use an external uptime/health monitor alongside Wotchi. Keep graceful shutdown explicit:

```ts
const server = app.listen(process.env.PORT ?? 3000);
const shutdown = async () => {
  server.close();
  await wotchi.flush(3_000);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
```

See [production recipe](EXAMPLES.md#production-recipe) for a deployable Express shape suitable for
Render, Railway, or Cloud Run and a health-check workflow.

## Related documentation

- [API reference](API.md) — public functions and client methods.
- [Troubleshooting](TROUBLESHOOTING.md) — thresholds, queue saturation, logger coexistence, and Telegram checks.
- [Security and privacy](SECURITY.md) — data handling boundaries.

For a safe first test, use the console notifier before enabling an external notifier; see
[examples](EXAMPLES.md).
