# Wotchi

> Low-noise error alerts for Node.js services.

> **Status:** Public beta (`0.1.0-beta.4`). Install with the `beta` tag; the API may evolve before the first stable release.

[![CI](https://github.com/FutureWindAI/Wotchi/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FutureWindAI/Wotchi/actions/workflows/ci.yml)
[![CodeQL](https://github.com/FutureWindAI/Wotchi/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/FutureWindAI/Wotchi/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/%40futurewindai%2Fwotchi?label=npm%20beta)](https://www.npmjs.com/package/@futurewindai/wotchi)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 18–26](https://img.shields.io/badge/node-18%E2%80%9326-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)

Wotchi captures application errors in-process, removes sensitive values, groups repeated failures, and delivers bounded console, Telegram, or HTTPS webhook alerts without changing framework response handling. It is a signal-conditioning layer, not a replacement for a full observability platform.

## Quick start

```bash
npm install @futurewindai/wotchi@beta
```

```ts
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";

const wotchi = createWotchi({
  service: "orders-api",
  environment: "development",
  grouping: { alertThreshold: 1 },
  notifiers: [consoleNotifier()],
});

wotchi.captureException(new Error("database query failed"));
await wotchi.flush();
```

The example uses a threshold of one so the alert is visible immediately. The default policy groups three matching errors in one minute and suppresses duplicate alerts during the cooldown. Capture is synchronous; call `flush()` when the host needs to wait for notifier work.

To validate a notifier without deliberately throwing an application error, call `const result = await wotchi.testAlert()` in a controlled setup. The structured result reports whether the alert was queued, flushed, delivered, or rejected by a notifier; configuration errors still throw during `createWotchi`.

Example console output:

```text
Wotchi — Medium incident
Service: orders-api
Environment: development
Summary: Observed 1 occurrences of Error: database query failed.
Occurrences: 1
First seen: 2026-08-08T12:00:00.000Z
Last seen: 2026-08-08T12:00:00.000Z
Suggested checks:
- Check database availability, connection saturation, and recent schema changes.
- Check the affected query and its dependency health before increasing capacity.
```

Timestamps and the fingerprint vary for each run. The alert is sanitized before it reaches a
notifier.

## What you get

| Capability                                | Result                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bounded capture and queueing              | Repeated failures cannot create unbounded in-memory work.                                                      |
| Redaction before processing               | Sensitive values are removed before grouping, logging, or transmission.                                        |
| Grouping and cooldowns                    | Repeated failures produce a small number of useful alerts.                                                     |
| Express 4/5 and NestJS 10/11 adapters     | Errors are observed while the framework keeps response ownership.                                              |
| ESM, CommonJS, and TypeScript types       | Use the package with common Node.js module setups.                                                             |
| Console and optional Telegram notifiers   | Start locally or self-host delivery without a Wotchi control plane.                                            |
| Generic HTTPS webhook notifier            | Route bounded JSON alerts to an existing internal alert destination.                                           |
| Actionable context and trace passthrough  | Include route, release, request/correlation IDs, operation/job, safe tags, links, and existing trace/span IDs. |
| Optional status observation and JSON logs | Observe direct `401`/`403`/`429`/`5xx` responses and emit collector-friendly JSON.                             |

## How it works

```text
Application error
  -> normalize and redact
  -> stable fingerprint and optional user rule
  -> threshold and cooldown
  -> bounded notification queue
  -> console, Telegram, or HTTPS webhook
```

The same bounded capture path can be called from HTTP handlers, background workers, and queue
processors. Wotchi does not replace the host application's response, retry, or acknowledgement
logic.

## Framework integrations

Express applications install the middleware after routes and before the existing final error handler:

```ts
import express from "express";
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";
import { wotchiErrorHandler } from "@futurewindai/wotchi/express";

const app = express();
const wotchi = createWotchi({
  service: "orders-api",
  environment: "production",
  notifiers: [consoleNotifier()],
});

app.use(wotchiErrorHandler(wotchi));
```

NestJS applications register the delegating global filter once after creating the application:

```ts
import { registerWotchiNest } from "@futurewindai/wotchi/nest";

registerWotchiNest(app, wotchi);
```

The package keeps compatibility with Node.js `>=18.18.0` and is tested across Node.js 18–26. Node.js 22 or 24 LTS is recommended for production. Express and NestJS adapters are optional subpath integrations, so applications only load the framework adapter they use.

## Telegram alerts

Telegram is an optional self-hosted notifier. Create a bot with BotFather, start or add it to the destination chat, and keep both values outside source control:

```ts
import { consoleNotifier, createWotchi, telegramNotifier } from "@futurewindai/wotchi";

const wotchi = createWotchi({
  service: "orders-api",
  environment: "production",
  notifiers: [
    consoleNotifier(),
    telegramNotifier({
      botToken: requiredEnv("WOTCHI_TELEGRAM_BOT_TOKEN"),
      chatId: requiredEnv("WOTCHI_TELEGRAM_CHAT_ID"),
    }),
  ],
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} must be configured before enabling Telegram`);
  }
  return value;
}
```

Wotchi does not ship a shared bot token. Delivery is queued outside the request path and sends only the sanitized incident alert. See [configuration](docs/CONFIGURATION.md) for notifier and security options.

## HTTPS webhook alerts

Use the generic webhook when an existing internal alerting or automation endpoint accepts JSON. Wotchi requires HTTPS by default, bounds headers and payloads, emits a versioned `{ version: 1, type: "incident.alert", sentAt, alert }` envelope, times out delivery, and retries one `429`/`5xx` response. Explicit loopback HTTP can be enabled for a local collector with `allowHttpLoopback: true`:

```ts
import { createWotchi, webhookNotifier } from "@futurewindai/wotchi";

const wotchi = createWotchi({
  service: "orders-api",
  environment: "production",
  notifiers: [
    webhookNotifier({
      url: requiredEnv("WOTCHI_WEBHOOK_URL"),
      headers: { Authorization: requiredEnv("WOTCHI_WEBHOOK_AUTH") },
      payloadBuilder: (alert) => ({
        incident: alert.fingerprint,
        summary: alert.summary,
      }),
    }),
  ],
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} must be configured before enabling the webhook`);
  }
  return value;
}
```

Keep the URL and authentication header outside source control. `payloadBuilder` receives a frozen, sanitized alert and its output is redacted and bounded before transport; it is not a hosted Wotchi collector.

## Context, filtering, and existing traces

Pass safe operational context and an existing OpenTelemetry trace/span ID explicitly; Wotchi does not install an OpenTelemetry SDK:

```ts
wotchi.captureEvent({
  level: "error",
  message: "payment provider failed",
  error,
  request: {
    method: "POST",
    route: "/orders/:id",
    requestId: "req-123",
    correlationId: "corr-456",
    trace: { traceId, spanId },
  },
  operation: "orders.pay",
  job: "payment-retry",
  tags: { component: "checkout" },
  context: { provider: "stripe" },
});
```

Use `filter`, `fingerprint`, `beforeSend`, and bounded exact-match `rules` for service-specific noise and grouping controls. `filter` and fingerprint callbacks receive frozen, normalized, redacted events. `beforeSend` receives a frozen, sanitized `IncidentAlert`; return `null` to suppress it or a bounded alert to transform it. Hook failures are isolated and counted in diagnostics. Optional `links.log` and `links.trace` templates can use placeholders such as `{{service}}`, `{{requestId}}`, and `{{traceId}}`.

## Deployment boundaries

Wotchi keeps grouping and cooldown state in one process. Replicas have independent state, restarts
reset groups, and a serverless instance can terminate before asynchronous delivery completes. An
in-process SDK cannot reliably detect an OOM kill, frozen event loop, host failure, or unavailable
network. Pair it with an external uptime monitor and keep graceful shutdown explicit; see the
[production recipe](examples/production-recipe/README.md).

## Process monitoring

Crash observation is opt-in:

```ts
import { registerWotchiProcessMonitor } from "@futurewindai/wotchi";

const monitor = registerWotchiProcessMonitor(wotchi);
// monitor.unregister() when the host intentionally stops observing crashes
```

## What it is not

- A full observability, APM, or log-management platform.
- A hosted dashboard, collector, or persistent incident database.
- An AI-generated incident-summary service in this release.
- A Slack, Discord, email, or full incident-workflow platform.
- A Docker, Kubernetes, or Helm collector bundled into the npm SDK.
- An automatic-remediation system.

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [Examples](docs/EXAMPLES.md)
- [API reference](docs/API.md)
- [Configuration](docs/CONFIGURATION.md)
- [Compatibility](docs/COMPATIBILITY.md)
- [Performance](docs/PERFORMANCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [FAQ](docs/FAQ.md)
- [Security and privacy](docs/SECURITY.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [GitHub releases](https://github.com/FutureWindAI/Wotchi/releases)
- [Apache License 2.0](LICENSE)

## Security

Do not include real secrets or customer error data in issues, examples, or test fixtures. Report security vulnerabilities privately using [SECURITY.md](SECURITY.md).

Wotchi is open source and maintained by FutureWind AI.
