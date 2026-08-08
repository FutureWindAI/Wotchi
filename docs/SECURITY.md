# Wotchi security and privacy notes

Wotchi is designed to observe failures without becoming a log collector. The current release has no hosted
control plane, persistent event database, or automatic environment scraping.

## Data flow

1. The integration receives an error and a small request context.
2. Unknown values are normalized with depth, key, string, and stack limits.
3. Credential-shaped fields and configured sensitive keys are redacted.
4. The sanitized event is fingerprinted and retained only in bounded in-memory groups.
5. A deterministic alert is queued for the configured notifier.

Raw request bodies, response bodies, cookies, arbitrary headers, and environment variables are not
collected by the framework adapters. The notifier receives the sanitized alert, not the original
error object.

## Credentials

- Never commit Telegram bot tokens, chat IDs, npm credentials, or production error payloads.
- Use environment variables or a secret manager in the host application.
- Treat a token pasted into chat, an issue, a CI log, or a public repository as compromised and
  rotate it immediately.
- The package does not contain a shared Wotchi Telegram bot token.

## Operational boundaries

Notifier work is asynchronous and bounded so a slow or failing notifier does not replace the
application's response behavior. Queue overflow drops notification work and records a diagnostic
counter. The process monitor is opt-in and never converts an observed crash into a successful exit.

See [Threat model](THREAT_MODEL.md) for assets, trust boundaries, mitigations, and residual risks.
To report a vulnerability, follow the private-reporting guidance in the repository
[security policy](../SECURITY.md).
