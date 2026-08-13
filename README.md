# Wotchi

> Low-noise error alerts for Node.js services.

> **Status:** Public beta (`0.1.0-beta.6`). The API may evolve before the first stable release.

[![CI](https://github.com/FutureWindAI/Wotchi/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FutureWindAI/Wotchi/actions/workflows/ci.yml)
[![CodeQL](https://github.com/FutureWindAI/Wotchi/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/FutureWindAI/Wotchi/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/%40futurewindai%2Fwotchi?label=npm%20beta)](https://www.npmjs.com/package/@futurewindai/wotchi)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/FutureWindAI/Wotchi/blob/v0.1.0-beta.6/LICENSE)
[![Node.js 18–26](https://img.shields.io/badge/node-18%E2%80%9326-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)

[Read the Wotchi story on Medium](https://medium.com/@alkazavr94/wotchi-low-noise-error-alerts-for-node-js-services-83cac7cf3f50)

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
