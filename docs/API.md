# API reference

The public API is exported from one npm package. Framework adapters are optional subpath imports;
unused framework runtime modules are not loaded by the root entry point.

The current stable release includes actionable context, event controls, status observation, bounded
HTTPS webhooks, and `testAlert()` diagnostics.

## Root import

```ts
import {
  consoleNotifier,
  createWotchi,
  createWotchiPrometheusExporter,
  registerWotchiProcessMonitor,
  registerWotchiRuntimeWatcher,
  telegramNotifier,
  webhookNotifier,
} from "@futurewindai/wotchi";
```

### Functions

| Export                                           | Contract                                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createWotchi(config)`                           | Validates and freezes configuration, then returns an isolated `WotchiClient`.                                                                                                     |
| `consoleNotifier(options?)`                      | Creates a notifier that writes bounded text or one-line JSON alerts to the console or a supplied writer.                                                                          |
| `telegramNotifier(options)`                      | Creates an opt-in Telegram notifier using a bot token and destination chat ID.                                                                                                    |
| `webhookNotifier(options)`                       | Creates a bounded versioned JSON notifier; HTTPS is required by default, with explicit loopback HTTP opt-in, optional headers, payload builder, timeout, and one transient retry. |
| `createWotchiPrometheusExporter(client)`         | Creates a pure renderer for aggregate Wotchi diagnostics in Prometheus text format; it does not open a listener or send network traffic.                                          |
| `registerWotchiProcessMonitor(client)`           | Opts into `uncaughtExceptionMonitor` observation without changing process exit behavior.                                                                                          |
| `registerWotchiRuntimeWatcher(client, options?)` | Opts into bounded CPU, memory, event-loop, and pending-queue threshold events on one unref'd timer; returns `unregister()`.                                                       |

### Client methods

| Method                                        | Behavior                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `captureException(error, context?, options?)` | Accepts an unknown thrown value from HTTP, worker, queue, or manual code, sanitizes it, groups it, and queues an alert when policy allows. |
| `captureEvent(event)`                         | Captures an explicit error-level event with optional metadata, context, request, trace, fingerprint, and severity fields.                  |
| `testAlert()`                                 | Returns a structured result distinguishing queue admission, flush timeout, notifier failure, and successful delivery.                      |
| `flush(timeoutMs?)`                           | Waits for queued notifier work when the host explicitly needs deterministic completion.                                                    |
| `shutdown(timeoutMs?)`                        | Closes capture admission and drains accepted notifier work within a bounded deadline.                                                      |
| `getDiagnostics()`                            | Returns a frozen snapshot of bounded counters and queue state.                                                                             |

The capture methods are synchronous and do not await network delivery. Notifier failures are
isolated from the host application. See [configuration](CONFIGURATION.md) for defaults and limits.

For background jobs, capture at the failure boundary and rethrow so the existing worker owns
retry, acknowledgement, and dead-letter behavior:

```ts
async function processOrder(job: { name: string }) {
  try {
    await runOrder(job);
  } catch (error) {
    wotchi.captureException(error, {
      operation: "orders.process",
      queue: job.name,
    });
    throw error;
  }
}
```

Keep job IDs, payloads, and credentials out of the context unless they are needed and safe. Wotchi
does not acknowledge, retry, or persist jobs, and `captureException` does not wait for a notifier.
Call `shutdown()` during an intentional graceful shutdown; use `flush()` for a non-closing
deterministic test.

`WotchiEventInput.alertThreshold` is optional and applies only to that event. The status observer
uses it internally when its adapter-specific `alertThreshold` is configured; ordinary errors keep
the client's `grouping.alertThreshold`.

`captureException` accepts a third `WotchiCaptureOptions` argument for a fingerprint override,
severity, threshold, request/trace/correlation context, operation/job labels, or bounded safe tags.
The `request` option is the sanitized `WotchiRequestContext` used by HTTP adapters; it keeps
request metadata first-class so correlation IDs and configured request/trace links are preserved.

`filter` and fingerprint callbacks receive frozen, normalized, redacted `SafeErrorEvent` values. An
exact `rules` match can ignore an event or override threshold/severity. An event `fingerprint` can
be a bounded string or callback. `beforeSend` receives a frozen, sanitized `IncidentAlert`, and may
return `null` to suppress it or a bounded alert to transform it. Callback work is synchronous and
should remain short; hook failures are isolated and reflected in diagnostics.

`queue.notifierTimeoutMs` bounds each notifier independently. `queue.notifierCircuitBreaker` opens
after repeated failures so one unhealthy destination does not continually consume delivery time.
`overload` is an opt-in pre-normalization token bucket for high-volume processes. Its counters and
the notifier protection counters are available through `getDiagnostics()` and the optional
Prometheus renderer.

### Prometheus diagnostics exporter

The exporter reads a fresh `getDiagnostics()` snapshot each time `render()` is called:

```ts
const metrics = createWotchiPrometheusExporter(wotchi);

app.get("/metrics", (_request, response) => {
  response.setHeader("Content-Type", metrics.contentType);
  response.send(metrics.render());
});
```

The host owns route authentication, scraping, retention, and aggregation. Wotchi emits fixed
aggregate counters and gauges only; it does not include stacks, fingerprints, request data, routes,
or secrets and does not install an OpenTelemetry SDK.

## Runtime watcher

```ts
const watcher = registerWotchiRuntimeWatcher(wotchi, {
  intervalMs: 5_000,
  cpuPercent: 90,
  rssBytes: 1_000_000_000,
  eventLoopDelayMs: 100,
  pendingAlerts: 80,
  notifierFailures: 10,
});
// call watcher.unregister() before the host exits
```

The watcher is disabled unless registered, keeps numeric samples bounded, and sends no automatic
network telemetry. Its `notifierFailures` threshold is an interval delta, so old failures do not
repeat after recovery. It is an incident signal, not a replacement for a full runtime metrics agent.

## Public types

The root exports the public contracts used by consumers and adapters:

`ConsoleNotifierOptions`, `IncidentAlert`, `IncidentGroup`, `IncidentSeverity`, `SafeErrorEvent`,
`TelegramNotifierOptions`, `WebhookNotifierOptions`, `WotchiBeforeSend`, `WotchiCaptureOptions`,
`WotchiClient`, `WotchiConfig`, `WotchiDiagnostics`, `WotchiEventFilter`, `WotchiEventInput`,
`WotchiEventKind`, `WotchiFingerprintCallback`, `WotchiFingerprintOverride`, `WotchiIncidentRule`,
`WotchiLinkTemplates`, `WotchiLinks`, `WotchiNotifier`, `WotchiRequestContext`, `WotchiTags`,
`WotchiTestAlertResult`, `WotchiTestAlertStatus`, `WotchiTraceContext`, `NormalizedWotchiConfig`,
`ProcessMonitorHandle`, `WotchiPrometheusExporter`, `WotchiRuntimeWatcherHandle`,
`WotchiRuntimeWatcherOptions`, `WotchiConfigurationError`, and `PROMETHEUS_CONTENT_TYPE`.

## Express entry point

```ts
import { wotchiErrorHandler, wotchiStatusObserver } from "@futurewindai/wotchi/express";

app.use(
  wotchiStatusObserver(wotchi, {
    statusCodes: [401, 403, 429],
    statusClasses: ["5xx"],
    ignoreStatusCodes: [429],
    alertThreshold: 10,
  }),
);
// Register application routes here.
app.use(wotchiErrorHandler(wotchi, options?));
```

Register the handler after application routes and before the existing final error handler. The
adapter calls Express `next(error)` exactly once, then captures the error when the response finishes
so its request metadata contains the final status selected by the application's error handler. It
does not replace the application's response handler.

`wotchiStatusObserver` is optional and observes only selected completed HTTP responses. It does
not read bodies or headers. Its default selection is `401`, `403`, `429`, and `5xx`; configure
`statusCodes`, `statusClasses`, or `ignoreStatusCodes` for the host application's traffic. An
optional `alertThreshold` applies only to events created by this observer; otherwise the client's
normal grouping threshold is used. Register it before routes so direct responses from middleware
are visible. The Express error handler and NestJS exception filter mark captured errors so a `5xx`
response is not reported twice.
For thresholds above `grouping.maxEventsPerWindow`, increase that bounded client limit as well.

The Express subpath also exports the `WotchiStatusClass` and `WotchiStatusObserverOptions` types.

## NestJS entry point

```ts
import {
  withWotchiNestFilter,
  registerWotchiNest,
  registerWotchiNestStatusObserver,
  WotchiModule,
  WOTCHI_CLIENT,
} from "@futurewindai/wotchi/nest";

WotchiModule.forRoot(config, { registerGlobalFilter? });
registerWotchiNest(app, wotchi, options?);
registerWotchiNestStatusObserver(app, wotchi, {
  statusCodes: [401, 403, 429],
  statusClasses: ["5xx"],
});
```

`WotchiModule.forRoot(config)` is the primary integration. It registers one `WOTCHI_CLIENT`
provider and a safe global filter, so normal controller errors are captured without code in
`main.ts`. It supports Nest applications using `@nestjs/platform-express`. Inject `WOTCHI_CLIENT`
when a provider needs explicit worker or queue capture.

For an existing dependency-injected `APP_FILTER`, disable the module's automatic filter and wrap
the existing filter. The wrapper captures first and then calls the original filter once, preserving
its status, response body, and logging policy:

```ts
import { Catch, Injectable, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { WotchiClient } from "@futurewindai/wotchi";
import { withWotchiNestFilter, WotchiModule, WOTCHI_CLIENT } from "@futurewindai/wotchi/nest";

@Catch()
@Injectable()
class AppExceptionFilter {
  catch(error: unknown, host: unknown): void {
    // Keep the application's existing response and logging logic here.
  }
}

@Module({
  imports: [WotchiModule.forRoot(config, { registerGlobalFilter: false })],
  providers: [
    AppExceptionFilter,
    {
      provide: APP_FILTER,
      useFactory: (wotchi: WotchiClient, filter: AppExceptionFilter) =>
        withWotchiNestFilter(wotchi, filter),
      inject: [WOTCHI_CLIENT, AppExceptionFilter],
    },
  ],
})
export class AppModule {}
```

`registerWotchiNest(app, wotchi)` remains available for bootstrap-based applications. When using
it with a static filter added through `app.useGlobalFilters(...)`, add that filter first and then
register Wotchi. The status observer is an additional opt-in for NestJS applications using the
Express platform adapter; Fastify status observation is not advertised by this release.

## Structured console output

Human-readable text is the default. Set `format: "json"` when the host log pipeline expects one
bounded JSON object per line:

```ts
consoleNotifier({ format: "json" });
```

The JSON fields include `title`, `fingerprint`, `severity`, `summary`, `suggestedActions`,
`firstSeenAt`, `lastSeenAt`, `occurrences`, `service`, `environment`, and any available bounded
`release`, `instance`, `correlationId`, `operation`, `job`, `tags`, `links`, `error`, `request`,
`trace`, and `context` fields. Values are bounded and redacted before writing.

## Module formats and dependencies

The package publishes ESM, CommonJS, and TypeScript declaration targets for the root, `/express`,
and `/nest` exports. The root package has zero direct runtime dependencies. Express, NestJS, and
their peer runtime packages are optional and supplied by the host application. See
[configuration](CONFIGURATION.md) for thresholds, cooldowns, privacy, and notifier settings.
