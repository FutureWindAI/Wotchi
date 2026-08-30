# Public roadmap

This roadmap describes possible direction, not a promise or a release schedule. Current behavior
is limited to the published package and its documentation.

## Planning windows

These are non-binding planning windows, not release promises. Each release remains subject to
security, compatibility, performance, package, and maintainer-approval gates.

| Window   | Focus                                                                                                                        | Exit signal                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Aug 2026 | Stable v1: compatibility, release safety, actionable context, installation diagnostics, deployment recipes, and worker docs. | An immutable `1.0.0` artifact passes every release gate and is published to `latest`.     |
| Q4 2026  | Post-stable feedback, compatibility evidence, security review, and operational documentation.                                | Maintainers prioritize verified user issues without expanding the SDK's trust boundary.   |
| 2027+    | Separate design work for additional notifiers, collector/relay delivery, and optional AI-assisted wording.                   | An approved design defines trust boundaries, resource budgets, and maintenance ownership. |

## Current stable release

- Bounded in-process error capture and grouping
- Redaction before storage, fingerprinting, logging, or transmission
- Console and optional Telegram notifications
- Actionable context, event controls, status observation, bounded HTTPS webhooks, and `testAlert()`
- Express 4/5 and NestJS 10/11/12 adapters
- ESM, CommonJS, and TypeScript declaration exports
- Compatibility, security, performance, and package checks
- Optional aggregate Prometheus diagnostics export
- Optional overload admission, notifier delivery protection, graceful shutdown, and numeric runtime watcher

## Next priorities

- Improve documentation and compatibility examples from user feedback.
- Continue publishing release evidence with each immutable prerelease or stable version.
- Validate runtime-watcher overhead and threshold policy in representative host workloads before enabling it broadly.
- Consider additional logger integrations only after a small public API and performance review.

## Later, only after separate design review

- Optional AI-assisted wording that remains deterministic and privacy-conscious.
- Docker or Helm delivery for a separately designed collector or relay.
- Additional notification channels when their credentials, failure behavior, and maintenance cost
  are understood.
- A local testing UI or relay with explicit token expiry, privacy, retention, and abuse controls.

The npm SDK remains in-process and does not require a hosted account, database, Redis instance, or
FutureWind service. See the [changelog](../CHANGELOG.md) for released changes and the issue tracker
for proposals.
