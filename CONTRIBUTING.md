# Contributing to Wotchi

Wotchi is a pre-release project. Issues, design feedback, documentation improvements, and carefully scoped contributions are welcome.

## Start with Scope

The planned first release is a small in-process incident assistant for Node.js, Express, and NestJS with console and Telegram notification. Discuss substantial changes in an issue before implementation. Features such as a hosted platform, dashboard, AI integration, extra notifiers, infrastructure collectors, or automatic remediation require a separate product decision.

## Safety and Privacy

- Never submit credentials, tokens, `.env` files, private keys, production URLs, real customer errors, personal data, or proprietary application payloads.
- Use synthetic fixtures in bug reports and tests.
- Follow [SECURITY.md](SECURITY.md) for vulnerability reports; do not disclose exploit details publicly.
- Keep capture, storage, and notification data minimal and bounded.

## Dependencies and Compatibility

New dependencies and version upgrades require prior discussion, an explicit purpose, and dependency-security review. Do not weaken the Node.js, Express, NestJS, CommonJS, or ECMAScript module compatibility targets without measured evidence and approval.

Once source implementation begins, changes will be expected to pass the repository's available build, typecheck, lint, test, dependency-audit, package-content, and performance checks. The exact commands will be documented with the implementation; they do not exist during repository setup.

## Pull Requests

Keep each pull request focused. Explain the user problem, scope, security and performance impact, and verification performed. Public claims must describe implemented and tested behavior only.

By submitting a contribution, you agree that it is licensed under the repository's [Apache License 2.0](LICENSE).
