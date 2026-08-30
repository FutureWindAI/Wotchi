# Changelog

All notable changes to Wotchi are documented here.

## Unreleased

- Fixed CommonJS declaration generation so strict Node16/NodeNext consumers can resolve internal
  Wotchi types without an ambient compatibility bridge.
- Added package verification for every relative import in generated CommonJS declarations.
- Documented application-specific `privacy.redactKeys` configuration.

## 0.1.0-beta.6 — 2026-08-10

- Added `WotchiModule.forRoot()` for AppModule-based NestJS setup and `withWotchiNestFilter()` for preserving application-owned exception filters.
- Preserved native NestJS response bodies for object and string `HttpException` values.
- Redacted credential-bearing connection URLs from error messages and stacks before fingerprinting, grouping, console output, Telegram delivery, and webhook delivery.
- Corrected Express incident status metadata by observing the final response status after downstream error handling without creating duplicate status-observer incidents.
- Added legacy CommonJS TypeScript declaration resolution for ordinary static root, Express, and NestJS imports.
- Expanded packed-consumer, framework, redaction, response-preservation, and notifier-output regression coverage.
- Fixed same-millisecond high-cardinality eviction so a recently recorded group is not evicted as the oldest entry.
- Applied the configured stack-specific privacy limit before the generic string limit.
- Redacted short-segment JWT-shaped credentials in summaries, stacks, and notifier payloads.
- Added an opt-in, zero-dependency Prometheus diagnostics renderer for aggregate Wotchi counters and queue/group gauges.
- Added opt-in pre-normalization overload admission with bounded synthetic overload diagnostics.
- Added per-notifier delivery timeouts, concurrent notifier dispatch, failure circuits, and diagnostics counters.
- Added `WotchiClient.shutdown(timeoutMs?)` for closed-state capture and bounded graceful draining.
- Added the separate opt-in `registerWotchiRuntimeWatcher()` for numeric CPU, memory, event-loop, queue, and notifier-failure thresholds using one unref'd timer.
- Extended ignored Express/Nest test stands with packed-package `/metrics` smoke routes and runtime-watcher coverage.
- Redacted authority credentials for single-label internal hosts such as `user:password@postgres`.
- Preserved late Express error capture when the response has already finished, without changing the host response.
- Measured runtime-watcher notifier failures per sampling interval so recovered failures do not repeat as pressure alerts.
- Corrected the public configuration examples for runtime-watcher and Prometheus code fences.

## 0.1.0-beta.5 — 2026-08-09

- Added bounded generic HTTPS webhook delivery with optional headers, timeout, and one transient retry.
- Added actionable release, instance, request/correlation, operation/job, safe tags, stack-frame, context, links, and explicit trace/span fields.
- Added frozen sanitized event filters/config fingerprint callbacks, alert-level `beforeSend`, fingerprint overrides, and exact environment/route rules with hook diagnostics.
- Added a versioned webhook envelope, sanitized payload builder, explicit loopback HTTP option, and redirect/configuration guards.
- Added structured `WotchiClient.testAlert()` results for queue, timeout, delivery, and notifier-failure diagnostics.
- Added production deployment, uptime-monitor, graceful-shutdown, and worker recipes.
- Closed alert-boundary redaction bypasses with serialized-notifier regression coverage.
- Added hard resource caps, prototype-safe normalization, and typed configuration failures for hostile getters.
- Rejected private and metadata HTTPS webhook destinations by default and pinned resolved transport addresses.

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
