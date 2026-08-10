# Wotchi security and privacy notes

Wotchi is designed to observe failures without becoming a log collector. The current release has no hosted
control plane, persistent event database, or automatic environment scraping.

## Data flow

1. The integration receives an error and a small request context.
2. Unknown values are normalized with depth, key, string, and stack limits.
3. Credential-shaped fields, connection URL userinfo/query credentials, and configured sensitive
   keys are redacted.
4. Safe filters and fingerprint callbacks run on the frozen sanitized event; `beforeSend` runs on a frozen sanitized alert.
5. The sanitized event is fingerprinted and retained only in bounded in-memory groups.
6. A deterministic alert is queued for the configured notifier.

Raw request bodies, response bodies, cookies, arbitrary headers, and environment variables are not
collected by the framework adapters. The notifier receives the sanitized alert, not the original
error object.

## Credentials

- Never commit Telegram bot tokens, chat IDs, npm credentials, or production error payloads.
- Never commit webhook URLs or authorization headers; treat webhook destinations and headers as
  application secrets when they grant access.
- Use environment variables or a secret manager in the host application.
- Treat a token pasted into chat, an issue, a CI log, or a public repository as compromised and
  rotate it immediately.
- The package does not contain a shared Wotchi Telegram bot token.

The generic webhook notifier accepts HTTPS URLs without embedded credentials or fragments by
default, rejects loopback, RFC1918, link-local, unique-local IPv6, metadata and internal DNS
destinations, limits custom header names/count/values, bounds the versioned JSON envelope and
response body, rejects redirects, and limits timeout/retry behavior. HTTP is accepted only for
explicit loopback opt-in. An explicit allowPrivateDestinations opt-in exists for isolated
development only; never derive it or the destination from untrusted runtime input. The real
transport resolves and pins the destination address immediately before connecting. Webhook
operators should validate authentication, authorization, retention, and redaction again at the
receiving service.

Trace and span IDs are passed through only when the host application supplies them. Wotchi does not
install an OpenTelemetry SDK or collect trace data automatically.

The optional Prometheus diagnostics exporter renders only fixed aggregate counters and queue/group
gauges from `getDiagnostics()`. It opens no endpoint, accepts no request data, and includes no
stacks, fingerprints, routes, or secrets. The host application must protect its metrics route and
the receiving system controls authentication and retention.

## Operational boundaries

Notifier work is asynchronous and bounded so a slow or failing notifier does not replace the
application's response behavior. Each notifier has an independent deadline and failure circuit;
healthy destinations can receive an alert even when another destination is slow. Queue overflow
drops notification work and records a diagnostic counter. The optional overload admission bucket
can reject work before normalization and emits only a fixed sanitized signal. `shutdown()` closes
admission and drains accepted work within a caller-supplied deadline. The process monitor and
runtime watcher are opt-in; neither changes process exit behavior or sends automatic telemetry.

Connection URLs for PostgreSQL, Redis, and MongoDB, plus authority-shaped `user:password@host`
fragments, are sanitized before fingerprinting, grouping, logging, and notifier delivery. The URL
host is retained when possible for diagnosis, while userinfo and credential-shaped query values are
replaced with `[REDACTED]`. Wotchi's default Nest fallback does not send unknown exceptions to
Nest's raw-error logger. Applications should still avoid placing full connection strings in error
messages and should configure their primary logger and any custom Nest filter's redaction
independently.

See [Threat model](THREAT_MODEL.md) for assets, trust boundaries, mitigations, and residual risks.
To report a vulnerability, follow the private-reporting guidance in the repository
[security policy](../SECURITY.md).
