# Public roadmap

This roadmap describes possible direction, not a promise or a release schedule. Current behavior
is limited to the published package and its documentation.

## Planning windows

These are non-binding planning windows, not release promises. Each release remains subject to
security, compatibility, performance, package, and maintainer-approval gates.

| Window       | Focus                                                                                                                                            | Exit signal                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Aug–Sep 2026 | Beta hardening: URL-aware redaction, direct HTTP status observation, JSON console output, CommonJS declaration checks, and worker documentation. | A reviewed immutable beta artifact passes the release gates.                              |
| Q4 2026      | Stable-readiness review: API feedback, compatibility evidence, security review, and operational documentation.                                   | Maintainers decide whether the API and evidence justify a stable release.                 |
| 2027+        | Separate design work for additional notifiers, collector/relay delivery, and optional AI-assisted wording.                                       | An approved design defines trust boundaries, resource budgets, and maintenance ownership. |

## Current beta

- Bounded in-process error capture and grouping
- Redaction before storage, fingerprinting, logging, or transmission
- Console and optional Telegram notifications
- Express 4/5 and NestJS 10/11 adapters
- ESM, CommonJS, and TypeScript declaration exports
- Compatibility, security, performance, and package checks

## Next priorities

- Improve documentation and compatibility examples from maintainer feedback.
- Publish release evidence with each immutable beta or stable version.
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
