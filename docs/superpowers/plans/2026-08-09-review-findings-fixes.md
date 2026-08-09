# Review Findings Fixes Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a failing test before each production change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the seven review findings in the unreleased Wotchi audit-hardening batch while preserving host responses, transport cleanup, per-job delivery results, bounded shutdown, and beta.2-facing documentation accuracy.

**Architecture:** Keep the core queue and notifier boundaries intact. Add cancellation through an `AbortSignal`, return completion results for individual queue jobs, and move production-recipe shutdown/error behavior into small testable helpers. Mark source-only audit-hardening docs and the recipe as unreleased until a new package version is published.

**Tech Stack:** Node.js 18.18+, TypeScript 6, built-in `node:test`, Express 5, Node HTTP/HTTPS transports, npm package dual builds.

---

### Task 1: Cancel timed-out webhook transports

**Files:**

- Modify: `src/notifiers/webhook-http.ts`
- Test: `test/unit/webhook-notifier.test.ts`

- [x] Add a request-function regression test that waits for the request options’ abort signal and asserts that `sendWebhookAlert()` rejects with a timeout while the signal is aborted.
- [x] Run the focused webhook test and observe the new assertion fail because the current timeout race exposes no cancellation.
- [x] Add an optional `signal` to `WebhookRequestOptions`; create an `AbortController` per attempt; abort it before rejecting from the outer timeout; and pass the signal into `http.request`/`https.request`.
- [x] Remove the abort listener when the default request settles so timed-out and completed requests do not retain callbacks.
- [x] Run the focused webhook test and the notifier unit suite.

### Task 2: Preserve application frames after `beforeSend`

**Files:**

- Modify: `src/core/client.ts`
- Test: `test/unit/audit-hardening.test.ts`

- [x] Add a regression test where `beforeSend` returns `{ ...alert, context: ... }` and assert that the delivered alert still has the incident builder’s `error.applicationFrame`.
- [x] Run the focused audit-hardening test and observe the application-frame assertion fail.
- [x] Extend transformed-alert sanitization to retain a bounded redacted `applicationFrame` field.
- [x] Run the focused audit-hardening test.

### Task 3: Attribute `testAlert()` results to its own queue job

**Files:**

- Modify: `src/core/notification-queue.ts`
- Modify: `src/core/client.ts`
- Test: `test/unit/audit-hardening.test.ts`

- [x] Add a regression sequence that queues a failing ordinary alert before calling `testAlert()`, then assert the test alert is delivered and reports zero failures for its own job while diagnostics retain the ordinary failure.
- [x] Run the focused test and observe the current global-counter delta produce `notifier-failed`.
- [x] Add an internal per-job completion callback/result to the queue and use that result in `testAlert()` instead of the global failure counter.
- [x] Run queue and audit-hardening unit tests.

### Task 4: Harden the production recipe error and shutdown paths

**Files:**

- Create: `examples/production-recipe/src/error-handler.ts`
- Create: `examples/production-recipe/src/shutdown.ts`
- Modify: `examples/production-recipe/src/server.ts`
- Test: `test/unit/production-recipe.test.ts`

- [x] Add an Express integration regression for the extracted production error handler: Express must invoke it as four-argument middleware, return a generic JSON 500 body, and never include the thrown secret.
- [x] Add a shutdown regression using a raw open socket: bounded close must force-close the connection and resolve before notification draining.
- [x] Add a drain regression: a rejected flush must be caught, logged generically, and resolve without an unhandled rejection.
- [x] Run the focused recipe test and observe the handler/close/drain assertions fail against the current recipe behavior.
- [x] Implement a four-argument generic handler, a bounded `server.close()` helper using Node’s connection-close methods, and a drain helper that catches timeout/rejection; wire all three into the SIGTERM/SIGINT shutdown path.
- [x] Run the focused recipe tests and compile the recipe independently.

### Task 5: Make beta.2-facing documentation and recipe versioning explicit

**Files:**

- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/API.md`
- Modify: `docs/CONFIGURATION.md`
- Modify: `docs/EXAMPLES.md`
- Modify: `docs/FAQ.md`
- Modify: `docs/GETTING_STARTED.md`
- Modify: `examples/production-recipe/README.md`
- Modify: `examples/production-recipe/package.json`

- [x] Add a clear unreleased-source notice wherever the audit-hardening APIs are documented, including the production recipe.
- [x] Change the recipe’s source-branch dependency from published `0.1.0-beta.2` to the local package (`file:../..`) and document that the root package must be built first; keep published beta examples unchanged.
- [x] Run formatting, lint, typecheck, package/build checks, and inspect the final diff for private files or unrelated changes.

### Verification and handoff

- [x] Run the focused regression tests first, then `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and the recipe build.
- [x] Confirm the current main worktree remains unchanged and the isolated branch contains the snapshot plus the fixes.
- [ ] Commit the isolated branch with a review-fix commit and report the branch/worktree path and commit hashes for later merge/cherry-pick after the other model’s work is integrated.
