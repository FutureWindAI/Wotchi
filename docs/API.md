# API reference

The public API is exported from one npm package. Framework adapters are optional subpath imports;
unused framework runtime modules are not loaded by the root entry point.

## Root import

```ts
import {
  consoleNotifier,
  createWotchi,
  registerWotchiProcessMonitor,
  telegramNotifier,
} from "@futurewindai/wotchi";
```

### Functions

| Export                                 | Contract                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `createWotchi(config)`                 | Validates and freezes configuration, then returns an isolated `WotchiClient`.            |
| `consoleNotifier(options?)`            | Creates a notifier that writes bounded alert lines to the console or a supplied writer.  |
| `telegramNotifier(options)`            | Creates an opt-in Telegram notifier using a bot token and destination chat ID.           |
| `registerWotchiProcessMonitor(client)` | Opts into `uncaughtExceptionMonitor` observation without changing process exit behavior. |

### Client methods

| Method                              | Behavior                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `captureException(error, context?)` | Accepts an unknown thrown value, sanitizes it, groups it, and queues an alert when policy allows. |
| `captureEvent(event)`               | Captures an explicit error-level event with optional metadata, context, and request fields.       |
| `flush(timeoutMs?)`                 | Waits for queued notifier work when the host explicitly needs deterministic completion.           |
| `getDiagnostics()`                  | Returns a frozen snapshot of bounded counters and queue state.                                    |

The capture methods are synchronous and do not await network delivery. Notifier failures are
isolated from the host application. See [configuration](CONFIGURATION.md) for defaults and limits.

## Public types

The root exports the public contracts used by consumers and adapters:

`ConsoleNotifierOptions`, `IncidentAlert`, `IncidentGroup`, `IncidentSeverity`, `SafeErrorEvent`,
`TelegramNotifierOptions`, `WotchiClient`, `WotchiConfig`, `WotchiDiagnostics`, `WotchiEventInput`,
`WotchiEventKind`, `WotchiNotifier`, `WotchiRequestContext`, `NormalizedWotchiConfig`,
`ProcessMonitorHandle`, and `WotchiConfigurationError`.

## Express entry point

```ts
import { wotchiErrorHandler } from "@futurewindai/wotchi/express";

app.use(wotchiErrorHandler(wotchi, options?));
```

Register the handler after application routes and before the existing final error handler. The
adapter captures the error, then calls Express `next(error)` exactly once. It does not replace the
application's response handler.

## NestJS entry point

```ts
import { registerWotchiNest } from "@futurewindai/wotchi/nest";

registerWotchiNest(app, wotchi, options?);
```

Register once after `NestFactory.create()`. The adapter delegates to NestJS's normal exception
filter chain after capture.

## Module formats and dependencies

The package publishes ESM, CommonJS, and TypeScript declaration targets for the root, `/express`,
and `/nest` exports. The root package has zero direct runtime dependencies. Express, NestJS, and
their peer runtime packages are optional and supplied by the host application. See
[configuration](CONFIGURATION.md) for thresholds, cooldowns, privacy, and notifier settings.
