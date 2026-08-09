# Wotchi documentation

Wotchi is a small in-process incident-alerting SDK for Node.js applications. The public beta
supports Express 4/5, NestJS 10/11, console alerts, optional Telegram delivery, and bounded HTTPS
webhooks with actionable context and test-alert diagnostics.

## Start here

- [Getting started](GETTING_STARTED.md) — install the beta and trigger a first grouped alert.
- [Examples](EXAMPLES.md) — run the checked-in Express and NestJS examples.
- [API reference](API.md) — public exports, methods, and framework entry points.

## Operate and understand Wotchi

- [Configuration](CONFIGURATION.md) — defaults, grouping, queue, privacy, and Telegram settings.
- [Compatibility](COMPATIBILITY.md) — supported Node.js and framework combinations.
- [Performance](PERFORMANCE.md) — bounded-work budgets and measured checks.
- [Architecture](ARCHITECTURE.md) — package boundaries and the processing flow.
- [Roadmap](ROADMAP.md) — public milestones and intentionally deferred scope.
- [Troubleshooting](TROUBLESHOOTING.md) — common setup and runtime problems.
- [FAQ](FAQ.md) — short answers to recurring questions.
- [Security and privacy](SECURITY.md) — data handling and reporting boundaries.
- [Threat model](THREAT_MODEL.md) — current security assumptions and residual risks.

## Contribute

- [Contributing](../CONTRIBUTING.md) — scope, support, and pull-request expectations.
- [Changelog](../CHANGELOG.md) — released changes.

The current public version is `0.1.0-beta.3`. Use `npm install @futurewindai/wotchi@beta` until a
stable release moves the `latest` dist-tag.
