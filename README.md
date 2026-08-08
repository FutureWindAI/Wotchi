# Wotchi

> Bounded incident alerts for Node.js services.

> **Status:** Public beta (`0.1.0-beta.1`). Install with the `beta` tag; the API may evolve before the first stable release.

[![CI](https://github.com/FutureWindAI/Wotchi/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FutureWindAI/Wotchi/actions/workflows/ci.yml)
[![CodeQL](https://github.com/FutureWindAI/Wotchi/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/FutureWindAI/Wotchi/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/%40futurewindai%2Fwotchi?label=npm%20beta)](https://www.npmjs.com/package/@futurewindai/wotchi)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js >=18.18](https://img.shields.io/badge/node-%3E%3D18.18.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)

Wotchi captures application errors in-process, removes sensitive values, groups repeated failures, and delivers bounded console or Telegram alerts without changing framework response handling.

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

## What you get

| Capability                              | Result                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Bounded capture and queueing            | Repeated failures cannot create unbounded in-memory work.               |
| Redaction before processing             | Sensitive values are removed before grouping, logging, or transmission. |
| Grouping and cooldowns                  | Repeated failures produce a small number of useful alerts.              |
| Express 4/5 and NestJS 10/11 adapters   | Errors are observed while the framework keeps response ownership.       |
| ESM, CommonJS, and TypeScript types     | Use the package with common Node.js module setups.                      |
| Console and optional Telegram notifiers | Start locally or self-host delivery without a Wotchi control plane.     |

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

The package supports Node.js `>=18.18.0`. Express and NestJS adapters are optional subpath integrations, so applications only load the framework adapter they use.

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
      botToken: process.env.WOTCHI_TELEGRAM_BOT_TOKEN ?? "",
      chatId: process.env.WOTCHI_TELEGRAM_CHAT_ID ?? "",
    }),
  ],
});
```

Wotchi does not ship a shared bot token. Delivery is queued outside the request path and sends only the sanitized incident alert. See [configuration](https://github.com/FutureWindAI/Wotchi/blob/main/docs/CONFIGURATION.md) for notifier and security options.

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
- A Slack, Discord, email, or generic webhook notifier in this release.
- A Docker, Kubernetes, or Helm collector bundled into the npm SDK.
- An automatic-remediation system.

## Documentation

- [Getting started](https://github.com/FutureWindAI/Wotchi/blob/main/docs/GETTING_STARTED.md)
- [Examples](https://github.com/FutureWindAI/Wotchi/blob/main/docs/EXAMPLES.md)
- [API reference](https://github.com/FutureWindAI/Wotchi/blob/main/docs/API.md)
- [Configuration](https://github.com/FutureWindAI/Wotchi/blob/main/docs/CONFIGURATION.md)
- [Compatibility](https://github.com/FutureWindAI/Wotchi/blob/main/docs/COMPATIBILITY.md)
- [Performance](https://github.com/FutureWindAI/Wotchi/blob/main/docs/PERFORMANCE.md)
- [Architecture](https://github.com/FutureWindAI/Wotchi/blob/main/docs/ARCHITECTURE.md)
- [Roadmap](https://github.com/FutureWindAI/Wotchi/blob/main/docs/ROADMAP.md)
- [Troubleshooting](https://github.com/FutureWindAI/Wotchi/blob/main/docs/TROUBLESHOOTING.md)
- [FAQ](https://github.com/FutureWindAI/Wotchi/blob/main/docs/FAQ.md)
- [Security and privacy](https://github.com/FutureWindAI/Wotchi/blob/main/docs/SECURITY.md)
- [Threat model](https://github.com/FutureWindAI/Wotchi/blob/main/docs/THREAT_MODEL.md)
- [Contributing](https://github.com/FutureWindAI/Wotchi/blob/main/CONTRIBUTING.md)
- [Changelog](https://github.com/FutureWindAI/Wotchi/blob/main/CHANGELOG.md)
- [GitHub releases](https://github.com/FutureWindAI/Wotchi/releases)
- [Apache License 2.0](https://github.com/FutureWindAI/Wotchi/blob/main/LICENSE)

## Security

Do not include real secrets or customer error data in issues, examples, or test fixtures. Report security vulnerabilities privately using [SECURITY.md](https://github.com/FutureWindAI/Wotchi/blob/main/SECURITY.md).

Wotchi is open source and maintained by FutureWind AI.
