# Security Policy

## Supported Versions

Wotchi is currently pre-release. Phase 1 targets consumers running Node.js `>=16.20.0`; the package is built and tested on a current maintained Node.js line. Node.js 16 is a compatibility target, not a production security recommendation after its upstream support period.

The current pre-release package contains the framework-independent capture core, console and Telegram notifiers, Express 4/5 middleware, NestJS 10/11 exception-filter integration, and opt-in process monitoring. The package has not been published to npm. Supported runtime and framework combinations will be declared only after the complete multi-Node compatibility and release-security gates pass.

## Reporting a Vulnerability

Do not disclose a suspected vulnerability, exploit detail, credential, token, or real customer error in a public issue, discussion, pull request, or example.

Use [GitHub private vulnerability reporting](https://github.com/FutureWindAI/wotchi/security/advisories/new) when it is available for this repository. If that private form is unavailable, open a public issue containing no sensitive detail and ask the maintainers to establish a private reporting channel.

Include only the minimum sanitized information needed to reproduce the problem. Remove application secrets, personal data, proprietary source, production URLs, and raw customer payloads.

We will acknowledge a valid private report, investigate its scope, and coordinate disclosure after a fix or mitigation is ready. Response-time commitments will be added only when the project has an active release and a maintained security process.
