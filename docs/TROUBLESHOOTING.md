# Troubleshooting

## No alert after one error

The default policy requires three matching events in a one-minute window. For a controlled smoke
test, set `grouping.alertThreshold` to `1`, or trigger the same failure three times:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3000/failure; done
```

Different fingerprints, an expired window, or a cooldown can also prevent a new alert. Inspect
`wotchi.getDiagnostics()` in a local test when you need queue and grouping counters.

For destination configuration, run `const result = await wotchi.testAlert()` in a controlled
environment and inspect `result.status`, `result.delivered`, and `result.notifierFailures`. This
uses the normal queue and notifier path without throwing a production application error.

## Numeric IDs are grouped together

The default fingerprint intentionally replaces numeric, UUID-like, and hexadecimal dynamic values
with stable placeholders. This prevents one incident per user ID, order ID, or database key. If two
numeric cases must be separate, distinguish them with an error name, message, route, or application
stack frame; metadata alone does not change the fingerprint.

Use an explicit `fingerprint` override, configuration fingerprint callback, `filter`, `beforeSend`,
or exact `rules` match when the default grouping does not match the service's incident boundaries.
Filter/fingerprint callbacks receive frozen sanitized events; `beforeSend` receives a frozen
sanitized alert. Returning `null` from `beforeSend` suppresses the alert.

## Express responses changed

Register `wotchiErrorHandler(wotchi)` after routes and before the existing final error handler.
Wotchi should be the observing middleware, not the response owner. Keep the host final handler after
it and confirm the handler calls `next(error)` exactly once.

## Background worker failures are not visible

HTTP adapters do not observe queue processors or cron jobs. Catch failures at the worker boundary,
call `wotchi.captureException(error, safeContext)`, and rethrow so the existing retry or
acknowledgement logic continues. Wotchi does not own job lifecycle decisions and does not wait for
notifier delivery in the worker path. See the [worker example](EXAMPLES.md#background-workers-and-queues).

## Direct 401, 403, or 429 responses are not visible

Authentication and rate-limit middleware may send a response without calling `next(error)`. Add
the opt-in status observer before routes:

```ts
app.use(
  wotchiStatusObserver(wotchi, {
    statusCodes: [401, 403, 429],
    statusClasses: ["5xx"],
    ignoreStatusCodes: [429],
  }),
);
```

Use `ignoreStatusCodes` for known-noisy responses. Use the observer's `alertThreshold` when a
status should alert only after a larger burst; it does not change thresholds for ordinary captured
errors. The observer records status and safe route metadata only, never bodies or headers.

## NestJS responses changed

Prefer `WotchiModule.forRoot(config)` in `AppModule`; no `main.ts` registration is needed. For an
existing dependency-injected `APP_FILTER`, use `withWotchiNestFilter(wotchi, filter)` with
`registerGlobalFilter: false` so the existing filter keeps its response body, status, and logging.
For bootstrap-based applications, register static filters with `app.useGlobalFilters(...)` first,
then call `registerWotchiNest(app, wotchi)`.

## Winston, Pino, or NestJS Logger is already installed

This is supported. Wotchi does not patch logger methods, intercept stdout, or install a logger
transport. Keep the existing logger configuration and add Wotchi at an error boundary or use
explicit `captureException` calls. Its default Nest fallback avoids forwarding unknown exceptions
to Nest's raw-error logger, but custom filters and host loggers still need their own redaction when
they receive the same context.

## Notifications are delayed or missing under a burst

Notification work is queued with bounded capacity and one alert worker. Each notifier attempt has a
deadline and failure circuit; healthy destinations are dispatched independently. When the queue is
full, new notification work is dropped so the host request is not delayed. `getDiagnostics()`
exposes `alertsDropped`, `pendingAlerts`, `notifierFailures`, `notifierTimeouts`, and circuit skips.
Increase limits only after measuring the host impact; do not remove bounds to preserve every alert.

## Capture work is too high during an incident

Enable the opt-in `overload` token bucket to reject captures before normalization. Tune
`maxEventsPerSecond` and `burst` from measurements, then watch `eventsDroppedOverload` and the
fixed `wotchi.capture.overload` signal. This budget is local to one process and does not replace
upstream rate limiting.

## Graceful shutdown

Call `await wotchi.shutdown(timeoutMs)` from the host shutdown hook after unregistering optional
runtime watchers. Accepted notifications drain until the deadline; captures arriving afterward are
ignored and counted.

## A secret appears in an error

Do not publish the output. Stop the test, rotate the credential if it was real, and report the
issue privately. Wotchi redacts configured sensitive keys and known secret patterns before storage,
fingerprinting, logging, or Telegram transmission, but host loggers and application code need their
own review as well.

## Telegram does not deliver

Confirm that the application supplied both `WOTCHI_TELEGRAM_BOT_TOKEN` and
`WOTCHI_TELEGRAM_CHAT_ID`, that the bot was started or added to the destination chat, and that the
host can reach Telegram over HTTPS. Never put the token in source control. Run the console notifier
first to separate capture and grouping problems from delivery problems.

## HTTPS webhook does not deliver

Run `const result = await wotchi.testAlert()` and inspect its status and `notifierFailures`. Confirm
the destination is an HTTPS URL without embedded credentials/fragments, the host can reach it, and
any authentication header is present in the environment. Wotchi retries one `429`/`5xx` response,
but it does not persist failed alerts or turn a webhook into a durable relay. For a local collector,
HTTP is allowed only with `allowHttpLoopback: true` and a loopback hostname.

## Duplicate alerts across replicas

Each process has its own bounded group store and cooldown state. Multiple replicas can therefore
send duplicate alerts, and restarts reset that state. Add an external uptime monitor for process
and host failures. A shared relay with cross-instance deduplication is a future architecture, not
part of this in-process package.

## Process monitoring did not keep a terminating process alive

The process monitor uses `uncaughtExceptionMonitor` to observe an exception without changing Node's
normal exit behavior. A process that exits immediately is not promised a synchronous network flush.
Use the normal application lifecycle and `shutdown()` for controlled termination; reserve `flush()`
for a non-closing deterministic wait.

See the [API reference](API.md) for public contracts, then reproduce the smallest failing case in a
public example without real secrets or customer data.
