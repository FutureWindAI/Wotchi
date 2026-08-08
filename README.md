# Wotchi

> Your production's night shift.

Wotchi is a lightweight incident assistant for Node.js applications. It is intended to help small teams turn repeated Express and NestJS application errors into a small number of useful console or Telegram alerts without operating a separate monitoring stack.

> **Project status:** Private beta candidate (`0.1.0-beta.1`). Phases 1–8 are implemented and locally validated, including bounded incident processing, console and Telegram alerts, Express 4/5 middleware, NestJS 10/11 exception-filter integration, opt-in crash observation, security gates, performance budgets, packed-tarball examples, and Node.js 18–26 CI. The source repository is public; the npm package is not published yet.

The working package name is `@futurewindai/wotchi`. The founder accepted the documented Wotchi trademark risk for the beta release on 2026-08-08; this is not legal clearance. The package remains unpublished until the exact release snapshot and gates are verified.

## Planned v0.1 Scope

- one framework-independent TypeScript core;
- focused integrations for Express 4/5 and NestJS 10/11;
- manual exception and structured error-event capture;
- sensitive-data redaction before storage, fingerprinting, logging, or transmission;
- stable fingerprints and deterministic incident summaries;
- bounded in-memory grouping, thresholds, cooldowns, and notification queueing;
- console and Telegram notifiers;
- CommonJS and ECMAScript module package exports;
- measured latency, CPU, heap, queue, and package-size release gates.

The package exposes a root entry point plus focused `/express` and `/nest` entry points. Framework adapters are loaded only through their subpaths, and they observe errors while leaving response ownership with Express or NestJS.

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

Telegram is an optional self-hosted notifier. The application owner creates a bot with BotFather, starts or adds it to the destination chat, and keeps the credentials outside source control:

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

Wotchi does not ship a shared bot token. Telegram delivery is queued outside the request path, uses bounded HTTPS timeouts/retries, and sends only the sanitized incident alert.

Crash observation is also opt-in:

```ts
import { registerWotchiProcessMonitor } from "@futurewindai/wotchi";

const monitor = registerWotchiProcessMonitor(wotchi);
// monitor.unregister() when the host intentionally stops observing crashes
```

The implemented core can be exercised directly:

```ts
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";

const wotchi = createWotchi({
  service: "orders-api",
  environment: "production",
  notifiers: [consoleNotifier()],
});

wotchi.captureException(new Error("database query failed"));
await wotchi.flush();
```

The default policy emits after three matching errors in one minute and suppresses duplicate alerts during the cooldown. The capture path remains synchronous; `flush()` is only needed when the host explicitly wants to wait for notifier work.

## Product Principles

- **Host safety:** Wotchi must not break, suppress, or materially delay the application's normal error flow.
- **Bounded overhead:** memory, payloads, groups, and queued notifications must all have explicit limits.
- **Privacy first:** request bodies, response bodies, raw headers, and arbitrary environment variables are outside the first release.
- **Deterministic first:** the MVP must work without an AI provider, database, hosted account, or collector.
- **Honest compatibility:** the MVP targets Node.js 18.18 and later. Supported framework/module combinations are claimed only after packed-tarball CI verification. Maintained Node.js LTS versions are recommended for production.

## Not Planned for v0.1

- a full observability, APM, or log-management platform;
- a hosted dashboard, collector, or persistent incident history;
- AI-generated summaries;
- Slack, Discord, email, or generic webhook notifiers;
- logger transports, Docker collectors, Kubernetes agents, or Helm charts in the npm SDK itself; a separate future collector/relay deployment may receive its own Docker and Helm milestone;
- automatic remediation.

A token-based hosted demo viewer is a separate possible future milestone, not part of the package MVP.

## Project Documents

- [Architecture and package boundaries](docs/ARCHITECTURE.md)
- [Setup](docs/SETUP.md)
- [Configuration](docs/CONFIGURATION.md)
- [Testing and smoke validation](docs/TESTING.md)
- [Security and privacy notes](docs/SECURITY.md)
- [Development workflow](docs/DEVELOPMENT.md)
- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Apache License 2.0](LICENSE)

Wotchi is an early open-source project from FutureWind AI. Contributions and product feedback should stay within the documented scope and avoid real secrets or customer error data.
