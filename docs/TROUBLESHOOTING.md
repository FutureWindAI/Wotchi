# Troubleshooting

## No alert after one error

The default policy requires three matching events in a one-minute window. For a controlled smoke
test, set `grouping.alertThreshold` to `1`, or trigger the same failure three times:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3000/failure; done
```

Different fingerprints, an expired window, or a cooldown can also prevent a new alert. Inspect
`wotchi.getDiagnostics()` in a local test when you need queue and grouping counters.

## Express responses changed

Register `wotchiErrorHandler(wotchi)` after routes and before the existing final error handler.
Wotchi should be the observing middleware, not the response owner. Keep the host final handler after
it and confirm the handler calls `next(error)` exactly once.

## NestJS responses changed

Call `registerWotchiNest(app, wotchi)` once after creating the Nest application. Do not replace the
normal NestJS exception filter chain with a custom response implementation.

## Winston, Pino, or NestJS Logger is already installed

This is supported. Wotchi does not patch logger methods, intercept stdout, or install a logger
transport. Keep the existing logger configuration and add Wotchi at an error boundary or use
explicit `captureException` calls. Configure redaction in both systems when both systems receive
the same context.

## Notifications are delayed or missing under a burst

Notification work is queued with bounded capacity and concurrency one. When the queue is full,
new notification work is dropped so the host request is not delayed. `getDiagnostics()` exposes
`alertsDropped`, `pendingAlerts`, and `notifierFailures`. Increase limits only after measuring the
host impact; do not remove bounds to preserve every alert.

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

## Process monitoring did not keep a terminating process alive

The process monitor uses `uncaughtExceptionMonitor` to observe an exception without changing Node's
normal exit behavior. A process that exits immediately is not promised a synchronous network flush.
Use the normal application lifecycle and `flush()` for controlled shutdowns when appropriate.

See the [API reference](API.md) for public contracts, then reproduce the smallest failing case in a
public example without real secrets or customer data.
