# Changelog

All notable changes to Wotchi are documented here.

## 0.1.0-beta.5 — 2026-08-09

- Fixed the protected staging workflow to pass the exact release tarball as an explicit local path.

## 0.1.0-beta.4 — 2026-08-09

- Added bounded generic HTTPS webhook delivery with optional headers, timeout, and one transient retry.
- Added actionable release, instance, request/correlation, operation/job, safe tags, stack-frame, context, links, and explicit trace/span fields.
- Added frozen sanitized event filters/config fingerprint callbacks, alert-level `beforeSend`, fingerprint overrides, and exact environment/route rules with hook diagnostics.
- Added a versioned webhook envelope, sanitized payload builder, explicit loopback HTTP option, and redirect/configuration guards.
- Added structured `WotchiClient.testAlert()` results for queue, timeout, delivery, and notifier-failure diagnostics.
- Added production deployment, uptime-monitor, graceful-shutdown, and worker recipes.

- Closed the alert-boundary redaction bypasses with serialized-notifier regression coverage.
- Added hard resource caps, prototype-safe normalization, and typed configuration failures for hostile getters.
- Rejected private and metadata HTTPS webhook destinations by default and pinned resolved transport addresses.
- Added content-digest names for local packed artifacts so they cannot be confused with published releases.
- Fixed release staging to submit the exact gated tarball rather than repacking an unbuilt checkout.

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
