# Wotchi architecture

## Current status

Wotchi is an installable, framework-independent SDK with optional Express and NestJS adapters. The
current package provides bounded input handling, URL-aware redaction,
fingerprinting, grouping, threshold/cooldown policy, deterministic incident construction,
diagnostics, bounded notification queueing, notifier timeouts/circuit protection, text console, Telegram, opt-in process monitoring,
actionable context, safe event controls, a generic HTTPS webhook notifier, JSON console output,
optional HTTP status observation, opt-in overload admission, graceful shutdown, an opt-in runtime
watcher, and the production recipe.

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
  core/notification-queue.ts       bounded notifier queue with timeouts/circuits
  core/admission.ts                optional pre-normalization token bucket
  core/process-monitor.ts          opt-in uncaught-exception observation
  core/diagnostics.ts              frozen counter snapshots
  core/prometheus.ts               pure Prometheus diagnostics renderer
  core/runtime-monitor.ts          opt-in numeric process-pressure watcher
  core/client.ts                   framework-independent orchestration
  notifiers/console.ts              bounded console formatting
  notifiers/telegram-format.ts      bounded HTML alert formatting
  notifiers/telegram-http.ts        fixed-host HTTPS transport
  notifiers/telegram.ts             Telegram notifier adapter
  notifiers/alert-payload.ts        shared bounded redacted alert payload
  notifiers/webhook-http.ts         bounded versioned webhook transport (HTTPS; loopback HTTP opt-in)
  notifiers/webhook.ts              generic webhook notifier adapter
  integrations/express/index.ts    Express-only public boundary
  integrations/express/status-observer.ts  opt-in direct-response observation
  integrations/nest/capture.ts    shared safe Nest exception capture
  integrations/nest/filter-wrapper.ts  preserves custom Nest filter ownership
  integrations/nest/module.ts     AppModule provider and global-filter integration
  integrations/nest/index.ts      NestJS-only public boundary
```

Future changes should add behavior behind these contracts:

```text
capture -> optional admission -> normalize -> redact -> frozen filter/fingerprint -> rules -> group -> policy
        -> alert/links -> frozen beforeSend -> bounded queue -> isolated notifier attempts
optional getDiagnostics() -> Prometheus text renderer -> host-owned metrics endpoint
optional runtime watcher -> bounded numeric runtime event -> same sanitized capture path
```

Capture performs optional bounded admission, then normalization and redaction before frozen user filters and fingerprint callbacks. Grouping and policy produce an alert with optional correlation/operation/job/tags and owner-configured HTTPS links; a frozen `beforeSend` alert hook may transform or suppress it before queue admission. Queue work uses one bounded alert worker, dispatches notifiers independently, and applies per-notifier timeouts/circuits; it is never awaited by framework error handling. `shutdown()` closes admission and drains accepted work within a caller-supplied deadline. The same core capture path is available to background workers and queue processors; the host remains responsible for retry, acknowledgement, and dead-letter behavior. Express calls `next(error)` exactly once. For NestJS, `WotchiModule.forRoot` provides one client and a safe global filter from `AppModule`; `withWotchiNestFilter` captures an existing `APP_FILTER` while leaving its response behavior intact. Bootstrap registration remains available for applications that need it. Telegram and webhook work is bounded and asynchronous. Process monitoring uses `uncaughtExceptionMonitor` only, captures a critical event, and does not suppress or change the host process exit behavior; an immediately terminating process is not promised a synchronous network flush. The runtime watcher is separate, opt-in, numeric-only, and unref'd.

The status observer is separate from error handling and runs on the response `finish` event. It
captures only configured status codes/classes, supports ignored noisy codes and a per-status
threshold, and never reads response bodies or headers. The Express error handler and NestJS
exception filter mark captured errors so a response generated by the normal error path is not
captured a second time.

## Package build

- `dist/esm/` is the ESM build.
- `dist/cjs/` is the CommonJS build and contains a local `package.json` declaring `type: commonjs`.
- `dist/types/` contains declarations.
- `dist/types-cjs/` contains CommonJS `.d.cts` declarations selected by the `require` export condition.
- `package.json` exports explicit `import`, `require`, and `types` targets for every public subpath.
- `files` limits the eventual npm archive to `dist`, `README.md`, `SECURITY.md`, and `LICENSE`.

## Product constraints

- zero direct runtime dependencies in the current release;
- optional Express and NestJS peer dependencies;
- Node.js `>=18.18.0` compatibility target;
- bounded memory, queues, payloads, and traversal;
- redact before storage, fingerprinting, logging, or transmission;
- no request/response bodies, raw headers, automatic environment collection, or hosted collector in v0.1;
- console, Telegram, and generic HTTPS webhook are the notification channels in the current beta.
- webhook destinations are explicit application-owned endpoints; Wotchi does not provide a hosted relay.
- trace context is passed through from existing instrumentation; Wotchi does not install an OpenTelemetry SDK.

See [Security](SECURITY.md) and [Threat model](THREAT_MODEL.md) for the security boundary and residual risks.
