# Frequently asked questions

## Which runtimes and frameworks are supported?

The package targets Node.js `>=18.18.0`, Express 4/5, and NestJS 10/11. The compatibility matrix
and release evidence are documented in [Compatibility](COMPATIBILITY.md).

## Does Wotchi replace Winston, Pino, or NestJS Logger?

No. Wotchi does not monkey-patch console methods or intercept logger transports. Keep the existing
logger and add Wotchi at the Express error-handler or NestJS exception-filter boundary, or call
`captureException` explicitly.

## Why did one error not alert?

The default threshold is three matching events in a one-minute window. Use
`grouping: { alertThreshold: 1 }` for a one-event smoke check, or review the [troubleshooting guide](TROUBLESHOOTING.md).

## How are releases versioned?

Wotchi follows semantic versioning. Beta versions use the `beta` dist-tag; stable versions use
`latest`. Published versions are immutable, so fixes require a new version.

## Where should I report a security issue?

Do not use a public issue for secrets or exploit details. Follow [SECURITY.md](../SECURITY.md) and
use GitHub private vulnerability reporting when available. See [configuration](CONFIGURATION.md)
and [troubleshooting](TROUBLESHOOTING.md) for operational details.
