# Frequently asked questions

> **Release note:** The webhook, advanced context, status observation, and `testAlert()` answers
> below describe unreleased source-revision additions, not the published `0.1.0-beta.2` package.

## Which runtimes and frameworks are supported?

The package keeps compatibility with Node.js `>=18.18.0`, is tested across Node.js 18–26, and
recommends Node.js 22 or 24 LTS for production. Express 4/5 and NestJS 10/11 are supported. The
compatibility matrix and release evidence are documented in [Compatibility](COMPATIBILITY.md).

## Does Wotchi replace Winston, Pino, or NestJS Logger?

No. Wotchi does not monkey-patch console methods or intercept logger transports. Keep the existing
logger and add Wotchi at the Express error-handler or NestJS exception-filter boundary, or call
`captureException` explicitly.

## Why did one error not alert?

The default threshold is three matching events in a one-minute window. Use
`grouping: { alertThreshold: 1 }` for a one-event smoke check, or review the [troubleshooting guide](TROUBLESHOOTING.md).

## Can I route alerts to an existing endpoint?

Yes. `webhookNotifier` sends a bounded, redacted versioned JSON envelope to an HTTPS endpoint with
an optional payload builder, timeout, and one transient-error retry. Explicit loopback HTTP is
available for local development only. It is a delivery adapter, not a hosted collector or incident
database.

## Does Wotchi install OpenTelemetry?

No. Pass existing trace/span and correlation IDs explicitly in the event request context. Wotchi
does not add a tracing SDK, exporter, or telemetry backend.

## What does `testAlert()` return?

It returns a structured result with `status`, queue/flush/delivery booleans, notifier-failure
count, and a frozen diagnostics snapshot. Configuration rejection still throws during client
creation; notifier failures do not escape the capture path.

## How are releases versioned?

Wotchi follows semantic versioning. Beta versions use the `beta` dist-tag; stable versions use
`latest`. Published versions are immutable, so fixes require a new version.

## Where should I report a security issue?

Do not use a public issue for secrets or exploit details. Follow [SECURITY.md](../SECURITY.md) and
use GitHub private vulnerability reporting when available. See [configuration](CONFIGURATION.md)
and [troubleshooting](TROUBLESHOOTING.md) for operational details.
