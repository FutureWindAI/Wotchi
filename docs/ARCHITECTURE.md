# Wotchi architecture

## Current status

Phase 1 established the installable package boundary. Phase 2 added the safe-input primitives: configuration validation, bounded normalization, redaction, application-frame selection, and SHA-256 fingerprints. Phase 3 wires those primitives into bounded grouping, threshold/cooldown policy, deterministic incident construction, a serial notification queue, diagnostics, and the console notifier. Phase 4 adds pass-through Express error middleware, Phase 5 adds a delegating NestJS exception filter, and Phase 6 adds bounded Telegram delivery plus opt-in process monitoring. npm publication remains a later release gate.

## Consumer-facing package shape

```text
@futurewindai/wotchi              framework-independent API and public types
@futurewindai/wotchi/express      root API plus Express error middleware
@futurewindai/wotchi/nest         root API plus NestJS registration
```

Each entry point is available as ESM, CommonJS, and declaration output. The root entry point does not import Express or NestJS runtime modules. Framework integrations are loaded only when the corresponding subpath is imported.

## Source boundaries

```text
src/
  index.ts                         stable public root boundary
  core/types.ts                    public domain and configuration contracts
  core/config.ts                   validated immutable runtime configuration
  core/errors.ts                   typed initialization errors
  core/normalize.ts                bounded unknown-value traversal
  core/redact.ts                   key and secret-pattern redaction
  core/stack-frame.ts              application-frame selection
  core/fingerprint.ts              canonical SHA-256 incident identity
  core/rolling-window.ts           fixed-capacity rolling timestamps
  core/group-store.ts              bounded groups and oldest eviction
  core/incident-policy.ts          threshold, cooldown, and severity
  core/incident-builder.ts         deterministic sanitized alerts
  core/notification-queue.ts       serial bounded notifier queue
  core/process-monitor.ts          opt-in uncaught-exception observation
  core/diagnostics.ts              frozen counter snapshots
  core/client.ts                   framework-independent orchestration
  notifiers/console.ts              bounded console formatting
  notifiers/telegram-format.ts      bounded HTML alert formatting
  notifiers/telegram-http.ts        fixed-host HTTPS transport
  notifiers/telegram.ts             Telegram notifier adapter
  integrations/express/index.ts    Express-only public boundary
  integrations/nest/index.ts      NestJS-only public boundary
```

Later phases add behavior behind these contracts:

```text
capture -> normalize -> redact -> fingerprint -> group
        -> policy -> bounded queue -> console/Telegram notifier
```

The Phase 3–6 local flow is implemented and tested. Capture performs bounded normalization, redaction, fingerprinting, grouping, policy evaluation, incident construction, and queue admission synchronously. Queue work runs with concurrency one and is never awaited by framework error handling. Express calls `next(error)` exactly once; NestJS calls `super.catch(exception, host)` exactly once. Telegram work is bounded and asynchronous. Process monitoring uses `uncaughtExceptionMonitor` only, captures a critical event, and does not suppress or change the host process exit behavior; an immediately terminating process is not promised a synchronous network flush.

## Package build

- `dist/esm/` is the ESM build.
- `dist/cjs/` is the CommonJS build and contains a local `package.json` declaring `type: commonjs`.
- `dist/types/` contains declarations.
- `package.json` exports explicit `import`, `require`, and `types` targets for every public subpath.
- `files` limits the eventual npm archive to `dist`, `README.md`, `SECURITY.md`, and `LICENSE`.

## Product constraints

- zero direct runtime dependencies in the MVP;
- optional Express and NestJS peer dependencies;
- Node.js `>=18.18.0` compatibility target;
- bounded memory, queues, payloads, and traversal;
- redact before storage, fingerprinting, logging, or transmission;
- no request/response bodies, raw headers, automatic environment collection, or hosted collector in v0.1;
- console and Telegram are the only MVP notification channels.

See the private `.local/PRODUCT_PLAN.md` for the complete product and threat model. It is intentionally not part of the public repository.
