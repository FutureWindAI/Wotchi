# Changelog

All notable changes to Wotchi are documented here.

## 0.1.0-beta.2 — 2026-08-08

- Added URL-aware redaction for PostgreSQL, Redis, MongoDB, and credential-bearing connection strings before fingerprinting and delivery.
- Added opt-in HTTP status observation for selected `401`, `403`, `429`, and `5xx` responses with per-status thresholds and ignore rules.
- Added one-line JSON output for the console notifier.
- Improved CommonJS and TypeScript declaration exports across the root, Express, and NestJS entry points.
- Added worker and queue integration guidance and expanded release verification for bounded queues, redaction, compatibility, and notifier isolation.

### Upgrade notes

This beta is backward-compatible with the beta.1 public API. Status observation and JSON console output are opt-in. Published versions are immutable; use `npm install @futurewindai/wotchi@beta` to receive the latest beta.

## 0.1.0-beta.1 — 2026-08-08

- Initial public beta of `@futurewindai/wotchi`.
- Added bounded error normalization, redaction, grouping, cooldowns, deterministic incident summaries, diagnostics, and notification queueing.
- Added console and Telegram notifiers with bounded asynchronous delivery.
- Added Express 4/5 middleware and NestJS 10/11 exception-filter integrations.
- Added ESM, CommonJS, and TypeScript declaration exports.
- Added compatibility, security, performance, and packed-package verification workflows.
