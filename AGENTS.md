# Wotchi Contributor and Agent Instructions

## Current Status

Wotchi is a pre-release, planning-stage open-source project. No npm release or supported package implementation exists yet.

If `.local/AGENTS.md` exists, read it before planning or changing this repository. That file contains machine-local context and must remain ignored.

## Product Scope

Wotchi is a lightweight incident assistant for Node.js applications. The planned first release is one npm package with a framework-independent core, Express and NestJS integrations, bounded local error grouping, and console and Telegram notifiers.

Do not expand the MVP into a hosted monitoring platform, log database, dashboard, AI service, infrastructure collector, automatic-remediation system, or additional notifier ecosystem without an approved product-plan change.

## Engineering Principles

- Host application behavior comes first. Capture and notifier failures must never break or delay the application's normal error flow.
- Performance is a product feature. Use bounded memory, bounded payloads, bounded queues, and measured CPU and latency budgets.
- Security and privacy are product features. Redact before storage, fingerprinting, logging, or transmission; collect the minimum data needed.
- Keep the MVP small. Prefer Node.js built-ins and simple, explicit TypeScript over new runtime dependencies or abstractions.
- Preserve compatibility goals deliberately. Do not claim support for an untested Node.js, Express, NestJS, ESM, or CommonJS combination.

## Change Rules

- Do not start package implementation unless the user explicitly approves the relevant implementation phase.
- Do not add or upgrade dependencies without the documented approval and security-review flow.
- Keep public claims aligned with code and verification evidence.
- Never commit credentials, tokens, `.env` files, real customer errors, customer data, private planning files, or machine-specific paths.
- Add focused tests for implementation changes and run the available build, typecheck, lint, test, security, package-content, and benchmark checks that apply.

## Public Repository Boundary

Only contributor-safe files belong in Git. The `.local/` directory is intentionally private and ignored. Before every commit, inspect both the staged file list and the complete staged diff.
