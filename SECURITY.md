# Security Policy

## Supported Versions

Wotchi targets applications running Node.js `>=18.18.0` and is built and tested across the Node.js 18–26 matrix. Node.js versions below 18.18 are not supported.

The current package contains the framework-independent capture core, console, Telegram, and generic HTTPS webhook notifiers, Express 4/5 middleware, NestJS 10/11 exception-filter integration, optional HTTP status observation, and opt-in process monitoring. Supported runtime and framework combinations are documented after packed-tarball compatibility and release-security checks.

## Reporting a Vulnerability

Do not disclose a suspected vulnerability, exploit detail, credential, token, or real customer error in a public issue, discussion, pull request, or example.

Use [GitHub private vulnerability reporting](https://github.com/FutureWindAI/Wotchi/security/advisories/new). Do not open a public issue for a suspected vulnerability.

Include only the minimum sanitized information needed to reproduce the problem. Remove application secrets, personal data, proprietary source, production URLs, and raw customer payloads.

We will acknowledge a valid private report, investigate its scope, and coordinate disclosure after a fix or mitigation is ready. Response-time commitments will be added only when the project has an active release and a maintained security process.
