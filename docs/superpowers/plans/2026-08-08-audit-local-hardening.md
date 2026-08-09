# Audit Local Hardening Implementation Plan

> **For agentic workers:** Implement this plan inline with test-first checkpoints.

**Goal:** Deliver the audit recommendations that can be implemented and verified locally: a bounded generic HTTPS webhook, actionable alert context, user-controlled filtering/fingerprints, explicit trace-context passthrough, an installation diagnostic, and public worker/deployment/production documentation.

**Architecture:** Keep the existing synchronous capture pipeline and serial bounded notification queue. New webhook transport uses fixed HTTPS validation, bounded payloads, timeout, and one retry; event controls operate only on already-normalized/redacted events; alert formatters render the same bounded optional context across console, Telegram, and webhook outputs. No OpenTelemetry SDK or runtime dependency is added.

**Tech Stack:** Existing TypeScript, Node.js built-ins, and Node test runner.

---

### Task 1: Extend safe event and alert contracts

**Files:** `src/core/types.ts`, `src/core/incident-builder.ts`, `src/core/client.ts`, `src/core/incident-policy.ts`, focused unit tests.

- [x] Add optional release, trace, bounded request/context/error details, capture fingerprint override, event severity, safe filter/beforeSend callbacks, and exact environment/route rules.
- [x] Write failing tests for override, filtering, transformed safe context, rule threshold/severity, and trace propagation.
- [x] Implement minimal validation and fail-closed callback handling.

### Task 2: Add generic HTTPS webhook notifier

**Files:** `src/notifiers/webhook-http.ts`, `src/notifiers/webhook.ts`, `src/index.ts`, `src/core/types.ts`, `test/unit/webhook*.test.ts`, `test/unit/public-api.test.ts`.

- [x] Test fixed HTTPS destination validation, bounded headers/payload, timeout, one retry, and redacted failures.
- [x] Implement transport and notifier using Node `https` only.

### Task 3: Make alert output actionable and add installation diagnostic

**Files:** `src/notifiers/console.ts`, `src/notifiers/telegram-format.ts`, `src/core/diagnostics.ts` or new diagnostic module, `src/index.ts`, tests.

- [x] Test bounded context rendering and a notifier-independent test alert.
- [x] Implement shared bounded alert serialization and `testAlert` diagnostic behavior through the configured queue.

### Task 4: Update public docs and examples

**Files:** `README.md`, `package.json`, relevant `docs/*.md`, `examples/*` only where needed.

- [x] Document positioning, Node LTS wording, webhook setup, context/filter controls, OTel passthrough, worker ownership, deployment limitations, uptime monitoring, graceful shutdown, and diagnostic usage.
- [x] Replace npm Mermaid-only rendering with a portable text flow and point homepage to GitHub.

### Task 5: Verify locally

- [x] Run focused red/green tests, typecheck, lint, build, full tests, package verification, and pack inspection.
- [x] Confirm no `.local` files or credentials enter tracked/package output and report unresolved external-only gates: npm/GitHub trust configuration, publication, cloud deployment, and user evidence.
