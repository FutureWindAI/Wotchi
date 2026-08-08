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
