# Wotchi threat model

This document describes the security boundary for the Wotchi SDK. It is an engineering model, not a security certification.

## Assets

- Application availability and request latency.
- Sanitized incident metadata and stack excerpts.
- Telegram bot tokens and destination chat IDs supplied by the host application.
- Package integrity, release provenance, and repository credentials.
- Developer and customer source code that imports Wotchi.

## Trust boundaries

1. A host application passes errors, request context, and metadata into the SDK.
2. Wotchi normalizes and redacts values inside the host process.
3. Sanitized alerts enter a bounded in-memory notification queue.
4. Console output remains local; Telegram alerts cross the host-to-Telegram HTTPS boundary.
5. GitHub Actions builds the package; npm distributes the packed artifact.

Wotchi has no hosted backend, database, AI provider, or persistent incident store in the current release.

## Threats and mitigations

| Threat                                        | Mitigation                                                                                                   | Residual risk                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Secrets in metadata or errors                 | Key-based, pattern-based, and URL-aware redaction before storage, fingerprinting, logging, or transport      | New secret formats may need new patterns; applications must avoid sending unnecessary data                            |
| Cyclic, hostile, or oversized values          | Safe property reads, cycle detection, depth/key/string/stack bounds                                          | Getters can still consume host CPU before they return; Wotchi catches failures but cannot make arbitrary getters safe |
| High-cardinality errors exhaust memory        | Maximum groups, rolling event windows, bounded samples, and deterministic eviction                           | The host application still owns all other application memory                                                          |
| Notification storm delays requests            | Fixed queue capacity, serial work, dropped overflow, and non-awaited framework adapters                      | A notifier can consume network resources outside the request path; operators should configure sensible thresholds     |
| Telegram token exposure                       | Token is accepted only at runtime, excluded from diagnostics, and sent only to `api.telegram.org` over HTTPS | A compromised host process or host environment can still read its own token                                           |
| Notifier failure changes application behavior | Capture and queue errors are contained; Express calls `next` and Nest delegates to the base filter           | Severe process-level failures can terminate the host before asynchronous delivery completes                           |
| Package contains secrets or private files     | npm file allowlist and packed-size/dependency verifier                                                       | A maintainer must review the packed file list before publication                                                      |
| Dependency or workflow compromise             | Locked installs, npm audit, OSV-Scanner, CodeQL, secret scanning, and protected release approvals            | GitHub/npm account compromise remains an operational risk                                                             |
| Confused framework loading                    | Framework-specific subpath exports and isolation smoke tests                                                 | Unsupported bundler or framework combinations require separate verification                                           |

## Security invariants

- Capture must not throw into the host application after valid initialization.
- Notification work must not be awaited by Express or NestJS error handling.
- Raw input, raw `Error` instances, credentials, and unbounded payloads must not be retained by the SDK.
- Queue, group, traversal, payload, and stack limits must remain finite and tested.
- No secret belongs in source, fixtures, documentation, Git history, npm archives, or CI logs.

## Out of scope for the current release

- Authentication or authorization for a hosted dashboard.
- Multi-tenant isolation.
- Durable incident storage or replay.
- Automatic remediation or infrastructure write access.
- End-to-end encryption beyond the Telegram HTTPS transport.

Review this model when adding a notifier, persistence, hosted service, Docker image, Helm chart, or AI provider.
