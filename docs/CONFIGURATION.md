# Wotchi configuration

`createWotchi` validates and freezes configuration at startup. Invalid values fail before the
application starts sending events; configuration errors do not echo supplied token-like values.

## Required fields

| Field         | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `service`     | Short service identifier included in alerts and fingerprints.    |
| `environment` | Deployment environment such as `development` or `production`.    |
| `notifiers`   | One or more notifier instances, for example `consoleNotifier()`. |

## Optional fields and defaults

| Path                          |  Default | Purpose                                              |
| ----------------------------- | -------: | ---------------------------------------------------- |
| `enabled`                     |   `true` | Disable capture without changing integration wiring. |
| `grouping.windowMs`           |  `60000` | Rolling grouping window.                             |
| `grouping.alertThreshold`     |      `3` | Matching events required before an alert.            |
| `grouping.cooldownMs`         | `900000` | Duplicate-alert suppression period.                  |
| `grouping.maxGroups`          |    `200` | Maximum in-memory fingerprints.                      |
| `grouping.maxEventsPerWindow` |    `100` | Maximum event timestamps retained per group.         |
| `queue.maxPendingAlerts`      |    `100` | Maximum queued alerts while a notifier is busy.      |
| `privacy.maxDepth`            |      `5` | Maximum nested metadata depth.                       |
| `privacy.maxKeys`             |    `100` | Maximum keys visited in one object.                  |
| `privacy.maxStringLength`     |    `500` | Maximum retained string length.                      |
| `privacy.maxStackLength`      |   `4000` | Maximum retained stack length.                       |

The queue has concurrency `1` in the current release. When the queue is full, new notification work is dropped
and the host request is not delayed. `getDiagnostics()` exposes counters for dropped work and
notifier failures.

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

## Telegram

Telegram is opt-in and requires a bot token plus a destination chat ID. Add the notifier only when
both values are present in the host environment:

```ts
telegramNotifier({
  botToken: process.env.WOTCHI_TELEGRAM_BOT_TOKEN ?? "",
  chatId: process.env.WOTCHI_TELEGRAM_CHAT_ID ?? "",
});
```

The application owner must create the bot, start or add it to the destination chat, and keep both
values outside source control. See [Security](SECURITY.md).

## Related documentation

- [API reference](API.md) — public functions and client methods.
- [Troubleshooting](TROUBLESHOOTING.md) — thresholds, queue saturation, logger coexistence, and Telegram checks.
- [Security and privacy](SECURITY.md) — data handling boundaries.

For a safe first test, use the console notifier before enabling an external notifier; see
[examples](EXAMPLES.md).
