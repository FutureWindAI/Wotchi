# Wotchi AI Agent Instructions

Read `AGENTS.md` before changing this repository. For product decisions, architecture, or phase boundaries, also read the private local documents when available:

1. `.local/PRODUCT_PLAN.md`
2. `.local/TECH_STACK.md`
3. `.local/IMPLEMENTATION_TASKS.md`
4. `.local/TODO.md`

The `.local/` directory is machine-local and ignored. Never copy it into source, tests, package archives, issues, commits, or public examples.

## Current phase

Phases 1–6 are complete locally. The public package is `@futurewindai/wotchi`, with root, `/express`, and `/nest` exports. Safe configuration validation, bounded normalization, redaction, stack-frame selection, fingerprinting, grouping, policy, queueing, diagnostics, console and Telegram notification, Express 4/5 middleware, NestJS 10/11 exception-filter integration, and opt-in process monitoring are implemented. Do not implement Slack, Discord, email, Teams, AI, dashboards, Docker, Helm, or Kubernetes until their approved phases.

## Required workflow

- Read the plan before implementing a phase.
- Write a focused failing test before production behavior; verify the red state, then implement the smallest green change.
- Preserve zero direct runtime dependencies.
- Keep ESM and CommonJS outputs, declarations, and package exports aligned.
- Keep framework imports out of the root runtime entry point.
- Run the relevant format, lint, typecheck, build, test, security, and package-content checks before reporting status.
- Never publish npm, reserve names, change external accounts, or claim trademark clearance from local research.

## Safety boundaries

Never include credentials, tokens, `.env` files, real customer errors, production payloads, or machine-specific paths in code, tests, fixtures, documentation, or logs. Preserve host application error behavior and keep future capture, storage, and notification paths bounded and privacy-first.
