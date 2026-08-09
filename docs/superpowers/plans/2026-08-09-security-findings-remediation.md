# Wotchi Security Findings Remediation Implementation Plan

> For agentic workers: Execute this plan inline with test-driven development and verify every red-green cycle before moving to the next task.

Goal: Close the six findings from the local Wotchi security/stress review while preserving bounded capture, host response behavior, and local-only artifact workflows.

Architecture: Keep redaction as the single final boundary used by storage, fingerprinting and every notifier. Put shared resource caps in one core limits module, reject dangerous object keys during normalization, validate notifier getters through the typed configuration error, reject private webhook destinations by default with connection-time DNS address pinning, and make local packed artifacts carry a content digest instead of the published beta filename.

Tech Stack: TypeScript, Node.js built-in test runner, Node http/https/dns modules, npm packed-artifact scripts.

---

### Task 1: Prove and fix final redaction bypasses

Files:

- Modify: test/unit/redact.test.ts
- Modify: test/unit/audit-hardening.test.ts
- Modify: src/core/redact.ts
- Modify: src/core/normalize.ts

- [x] Add failing unit coverage for Basic credentials, x-api-key, dbPassword, Cookie literals, webhook path secrets, signature query values and percent-encoded token query keys.
- [x] Run the focused redaction tests and confirm they fail because the canary strings remain.
- [x] Expand canonical key matching, parse sensitive query keys after percent-decoding, redact Basic credentials and Cookie literals, and mask known secret-bearing webhook path segments.
- [x] Rerun focused redaction tests and then the full unit/security suites.

### Task 2: Add hard resource caps

Files:

- Create: src/core/limits.ts
- Modify: src/core/config.ts
- Modify: src/core/normalize.ts
- Modify: src/core/redact.ts
- Modify: src/core/group-store.ts
- Modify: src/core/notification-queue.ts
- Modify: test/unit/config.test.ts
- Modify: test/unit/normalize.test.ts

- [x] Add tests that reject Number.MAX_SAFE_INTEGER, Infinity, fractional values above each documented cap, and verify that normal configured values remain accepted.
- [x] Run the focused tests and confirm the new oversized cases fail only because they are currently accepted.
- [x] Add shared caps of 10,000 groups, 10,000 events per window, 10,000 pending alerts, depth 20, 10,000 keys, 32,768 string bytes and 32,768 stack bytes.
- [x] Make configuration reject values above the cap and make direct normalization, group-store and queue constructors fall back or reject consistently.
- [x] Rerun the focused tests, benchmarks and existing suites.

### Task 3: Make normalization and configuration access prototype/getter safe

Files:

- Modify: src/core/normalize.ts
- Modify: src/core/config.ts
- Modify: test/unit/normalize.test.ts
- Modify: test/unit/config.test.ts

- [x] Add tests proving **proto**, prototype and constructor input keys cannot create inherited attacker-controlled properties, and a throwing notifier getter produces only WotchiConfigurationError.
- [x] Run those tests and confirm the prototype and raw getter-error assertions fail.
- [x] Skip unsafe object keys before assignment and wrap notifier structural access so hostile getters become a generic typed configuration failure.
- [x] Rerun focused and full tests.

### Task 4: Close webhook SSRF defaults and pin resolved destinations

Files:

- Modify: src/core/types.ts
- Modify: src/notifiers/webhook-http.ts
- Modify: test/unit/webhook-notifier.test.ts
- Modify: docs/SECURITY.md
- Modify: docs/CONFIGURATION.md

- [x] Add failing tests rejecting HTTPS loopback, RFC1918, link-local, unique-local IPv6, integer/hex loopback and metadata destinations by default while retaining an explicit development opt-in.
- [x] Run the focused webhook tests and confirm private HTTPS cases currently pass validation.
- [x] Add lexical private-address checks, a documented allowPrivateDestinations opt-in, bounded DNS resolution for the real transport, and an address-pinned request lookup callback to reduce DNS rebinding.
- [x] Rerun webhook tests and the mocked webhook security harness.

### Task 5: Remove local artifact version ambiguity

Files:

- Create: scripts/local-artifact.mjs
- Modify: scripts/start-test-stand.mjs
- Modify: scripts/start-nest-production-stand.mjs
- Create: test/unit/local-artifact.test.ts

- [x] Add a pure helper test showing a packed beta.2 version receives a -local-sha256-prefix filename and never equals the published filename.
- [x] Run the helper test and confirm the current naming behavior fails the distinction.
- [x] Implement deterministic content-digest naming and make both local stand launchers install the digest-named file.
- [x] Rerun the helper test, package verification and a local pack dry run.

### Task 6: Update security documentation and run the complete release gate

Files:

- Modify: docs/SECURITY.md
- Modify: docs/CONFIGURATION.md
- Modify: docs/COMPATIBILITY.md only if the verified matrix changes

- [x] Document the hard caps, final redaction boundary, private destination default, explicit development opt-in and local artifact naming.
- [x] Run format check, lint, typecheck, full tests, package verification, compatibility tests, benchmarks, all custom stress harnesses, webhook checks and available framework loads.
- [x] Run npm audit and OSV-Scanner in the strongest available mode and report any environment-limited result.
- [x] Verify the root source diff contains only the requested remediation files plus the plan/docs changes, and preserve all unrelated pre-existing dirty work.
