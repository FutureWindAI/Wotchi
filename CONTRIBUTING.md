# Contributing to Wotchi

Issues, design feedback, documentation improvements, and carefully scoped contributions are welcome.

## Start with Scope

The current release is a small in-process incident assistant for Node.js, Express, and NestJS with console and Telegram notification. Discuss substantial changes in an issue before implementation. Features such as a hosted platform, dashboard, AI integration, extra notifiers, infrastructure collectors, or automatic remediation require a separate product decision.

## Safety and Privacy

- Never submit credentials, tokens, `.env` files, private keys, production URLs, real customer errors, personal data, or proprietary application payloads.
- Use synthetic fixtures in bug reports and tests.
- Follow [SECURITY.md](SECURITY.md) for vulnerability reports; do not disclose exploit details publicly.
- Keep capture, storage, and notification data minimal and bounded.

## Dependencies and Compatibility

New dependencies and version upgrades require prior discussion, an explicit purpose, and dependency-security review. Do not weaken the Node.js, Express, NestJS, CommonJS, or ECMAScript module compatibility targets without measured evidence and approval.

Changes should pass the applicable repository checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
node test/compatibility/package-exports.smoke.cjs
npm run security:all
npm pack --dry-run --json
```

Performance and compatibility-matrix commands are required when the relevant changes affect those harnesses.

## Pull Requests

Keep each pull request focused. Explain the user problem, scope, security and performance impact, and verification performed. Public claims must describe implemented and tested behavior only.

By submitting a contribution, you agree that it is licensed under the repository's [Apache License 2.0](LICENSE).

## Support and issue routing

Search the [documentation index](docs/README.md), [FAQ](docs/FAQ.md), and
[troubleshooting guide](docs/TROUBLESHOOTING.md) before opening a request. When GitHub Discussions
is enabled, use it for general usage questions and design discussion. Use an issue for a
reproducible bug or a narrowly scoped feature request. Use [SECURITY.md](SECURITY.md) for
vulnerabilities; never publish credentials, private keys, production URLs, customer payloads, or
proprietary source.

There is no response-time SLA. Maintainer availability may vary.
