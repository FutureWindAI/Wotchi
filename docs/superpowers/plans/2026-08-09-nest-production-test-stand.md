# NestJS Production Test Stand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build an isolated NestJS 11 test stand under `.test_stands/nest-production` that runs Wotchi beside real PostgreSQL and Redis services, exercises HTTP and scheduled failures, and documents a safe path toward a later Render experiment.

**Architecture:** The stand is one NestJS process with Prisma and `ioredis` fixture dependencies. Built-in Node timers run a bounded scheduled probe; its worker boundary captures injected failures with Wotchi. Docker Compose supplies only local PostgreSQL and Redis. A root launcher builds and packs the current SDK, installs that tarball into the ignored stand, starts the services, applies Prisma, and runs the app.

**Tech Stack:** NestJS 11, TypeScript 5.5, Prisma 6, PostgreSQL 16 Alpine, Redis 7 Alpine, `ioredis`, Wotchi packed tarball, Node built-in test runner, Docker Compose.

---

## Task 1: Add pure configuration and failure-selection tests first

**Files:**

- Create: `.test_stands/nest-production/test/config.test.ts`
- Create: `.test_stands/nest-production/test/failure-selection.test.ts`
- Create: `.test_stands/nest-production/src/config.ts`
- Create: `.test_stands/nest-production/src/failure-selection.ts`

- [x] **Step 1: Write failing configuration tests**

Create tests using `node:test` and `node:assert/strict` that require `parseStandConfig` to:

```ts
test("uses safe local defaults", () => {
  const config = parseStandConfig({});
  assert.equal(config.port, 3011);
  assert.equal(config.failureInjection, false);
  assert.equal(config.failureIntervalMs, 30_000);
  assert.equal(config.failureRate, 0.25);
  assert.equal(config.failureKind, "rotate");
});

test("parses opt-in failure controls", () => {
  const config = parseStandConfig({
    WOTCHI_FAILURE_INJECTION: "true",
    WOTCHI_FAILURE_INTERVAL_MS: "5000",
    WOTCHI_FAILURE_RATE: "1",
    WOTCHI_FAILURE_KIND: "redis",
  });
  assert.equal(config.failureInjection, true);
  assert.equal(config.failureIntervalMs, 5000);
  assert.equal(config.failureRate, 1);
  assert.equal(config.failureKind, "redis");
});

test("rejects invalid bounded controls", () => {
  assert.throws(() => parseStandConfig({ WOTCHI_FAILURE_RATE: "2" }), /WOTCHI_FAILURE_RATE/);
  assert.throws(
    () => parseStandConfig({ WOTCHI_FAILURE_INTERVAL_MS: "0" }),
    /WOTCHI_FAILURE_INTERVAL_MS/,
  );
  assert.throws(() => parseStandConfig({ WOTCHI_FAILURE_KIND: "unknown" }), /WOTCHI_FAILURE_KIND/);
});
```

- [x] **Step 2: Run the focused tests and verify the expected RED state**

Run from `.test_stands/nest-production/`:

```bash
npm test -- --test-name-pattern="configuration|bounded"
```

Expected: the command fails because `src/config.ts` and `src/failure-selection.ts` do not exist yet.

- [x] **Step 3: Write the minimal parser and failure-kind helpers**

Implement `StandConfig`, `FailureKind`, and `parseStandConfig(env)` with these exact rules:

- defaults: `HOST=127.0.0.1`, `PORT=3011`, `REQUIRE_TEST_SERVICES=true`, `WOTCHI_FAILURE_INJECTION=false`, `WOTCHI_FAILURE_INTERVAL_MS=30000`, `WOTCHI_FAILURE_RATE=0.25`, `WOTCHI_FAILURE_KIND=rotate`, `WOTCHI_ALERT_THRESHOLD=3`;
- `failureIntervalMs` must be an integer from `1000` through `3_600_000`;
- `failureRate` must be a finite number from `0` through `1`;
- `failureKind` must be `app`, `postgres`, `redis`, or `rotate`;
- trim optional URLs, token, release, and instance values; preserve empty values as `undefined`;
- do not log or include secret values in thrown validation messages.

Implement `shouldInjectFailure(rate, randomValue)` and `selectFailureKind(kind, rotationIndex)`, where `rotate` cycles `app`, `postgres`, `redis` and explicit kinds remain unchanged.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npm test -- --test-name-pattern="configuration|bounded"
```

Expected: all configuration and failure-selection tests pass.

## Task 2: Create the isolated fixture shell and services

**Files:**

- Create: `.test_stands/nest-production/package.json`
- Create: `.test_stands/nest-production/tsconfig.json`
- Create: `.test_stands/nest-production/.env.example`
- Create: `.test_stands/nest-production/docker-compose.yml`
- Create: `.test_stands/nest-production/prisma/schema.prisma`

- [x] **Step 1: Add the fixture package manifest**

Use a private CommonJS package with these scripts:

```json
{
  "name": "wotchi-test-stand-nest-production",
  "private": true,
  "version": "0.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "prisma generate && ts-node src/main.ts",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "typecheck": "tsc --noEmit",
    "test": "node --require ts-node/register --test test/*.test.ts"
  }
}
```

Add only fixture dependencies: the current local Wotchi tarball bootstrap reference, NestJS 11 packages, Express 4, Prisma 6 CLI/client, `ioredis`, `reflect-metadata`, `rxjs`, `ts-node`, and TypeScript. Do not modify root `package.json` or root `package-lock.json` with these packages.

- [x] **Step 2: Add strict TypeScript configuration**

Configure CommonJS output, `target` compatible with Node 18, `strict: true`, `esModuleInterop: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `skipLibCheck: true`, and include `src/**/*.ts` plus `test/**/*.ts`.

- [x] **Step 3: Add safe environment and Compose defaults**

Create `.env.example` with `PORT=3011`, `HOST=127.0.0.1`, PostgreSQL on `55432`, Redis on `56381`, `REQUIRE_TEST_SERVICES=true`, disabled failure injection, empty webhook/token values, and no secrets.

Create `docker-compose.yml` with PostgreSQL `16-alpine` and Redis `7-alpine`, isolated ports `55432:5432` and `56381:6379`, health checks, and named volumes `wotchi-nest-production-postgres` and `wotchi-nest-production-redis`.

- [x] **Step 4: Add a bounded Prisma state model**

Use one `ProbeState` model:

```prisma
model ProbeState {
  id        String   @id @default("stand")
  lastRunAt DateTime
  runCount  Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

Run `npm install --no-audit --no-fund` and `npm run prisma:generate` inside the stand, then rerun the package tests. Expected: the fixture dependencies install and the existing pure tests remain green.

## Task 3: Implement runtime service ownership

**Files:**

- Create: `.test_stands/nest-production/src/runtime-services.ts`
- Modify: `.test_stands/nest-production/src/config.ts`

- [x] **Step 1: Add service initialization and status helpers**

Implement `RuntimeServices` with `prisma`, `redis`, `database`, `cache`, and sanitized error summaries. `initializeRuntimeServices(config)` must:

- connect Prisma with the configured `DATABASE_URL`;
- connect Redis with `lazyConnect`, short connect timeout, offline queue disabled, and no retry loop;
- mark each service `connected` or `unavailable` without leaking a URL or credential;
- avoid reconnect storms after an initial failure;
- upsert the `ProbeState` row only after PostgreSQL connects.

Implement `requireDatabase`, `requireRedis`, `checkServiceReadiness`, and `closeRuntimeServices`. Closing must tolerate already-disconnected clients.

- [x] **Step 2: Run typecheck and tests**

Run:

```bash
npm run typecheck
npm test
```

Expected: no TypeScript errors and all pure tests pass without requiring Docker.

## Task 4: Implement scheduled probe and worker-boundary capture

**Files:**

- Create: `.test_stands/nest-production/src/scheduled-probe.service.ts`
- Create: `.test_stands/nest-production/test/scheduled-probe.test.ts`

- [x] **Step 1: Write failing scheduler lifecycle tests**

Test the pure scheduling boundary with injected callbacks or a small exported helper:

```ts
test("disabled injection never calls the failure injector", async () => {
  const result = await runProbeTick({ failureInjection: false, shouldInject: true });
  assert.equal(result.injected, false);
});

test("an injected failure is captured and does not escape the worker boundary", async () => {
  const captured: unknown[] = [];
  const result = await runProbeTick({
    failureInjection: true,
    shouldInject: true,
    inject: async () => {
      throw new Error("scheduled fixture failure");
    },
    capture: (error) => captured.push(error),
  });
  assert.equal(result.injected, true);
  assert.equal(captured.length, 1);
});
```

- [x] **Step 2: Run the scheduler tests and verify RED**

Run `npm test -- --test-name-pattern="injection|worker boundary"`. Expected: failure because the scheduler helper does not exist.

- [x] **Step 3: Implement the service**

Create a Nest injectable implementing `OnModuleInit` and `OnModuleDestroy`. On initialization, run one probe immediately and schedule `setInterval` at `failureIntervalMs`. On destruction, clear the timer and expose a `getStatus()` snapshot.

Each probe must:

1. Upsert `ProbeState` and set a short-lived Redis key.
2. Catch dependency failures and call `wotchi.captureException(error, { job: "scheduled-probe", dependency, trigger: "health-check" })`.
3. If injection is enabled and `shouldInjectFailure` passes, select the configured failure kind, deliberately fail the application/Prisma/Redis operation, catch it, and call `wotchi.captureException` with `{ job: "scheduled-failure", dependency, trigger: "injected" }`.
4. Never throw out of the timer callback.

Use a fixed Redis key with a short TTL and one bounded database row; do not append unbounded probe history.

- [x] **Step 4: Run scheduler tests and refactor only after GREEN**

Run `npm test`. Expected: all configuration, failure-selection, and scheduler tests pass.

## Task 5: Add Nest module, routes, Wotchi wiring, and shutdown

**Files:**

- Create: `.test_stands/nest-production/src/app.module.ts`
- Create: `.test_stands/nest-production/src/app.controller.ts`
- Create: `.test_stands/nest-production/src/main.ts`

- [x] **Step 1: Register providers and Wotchi**

Create `AppModule.register(config)` with providers for `StandConfig`, `RuntimeServices`, a Wotchi client, and `ScheduledProbeService`. Configure Wotchi with service `wotchi-nest-production-stand`, the configured environment/release/instance, console notifier, optional webhook notifier, and `grouping.alertThreshold` from `WOTCHI_ALERT_THRESHOLD`.

- [x] **Step 2: Add safe routes**

Implement:

- `GET /healthz` — dependency-independent liveness response.
- `GET /readyz` — dependency check, `503` if PostgreSQL or Redis is unavailable.
- `GET /service-status` — dependency states, scheduler state, and Wotchi diagnostics.
- `GET /db-check` and `GET /redis-check` — successful dependency operations.
- `GET /trigger/app-error`, `/trigger/db-error`, `/trigger/redis-error`, `/trigger/random-error` — deterministic or selected failures.
- `POST /test-alert` — authorized `wotchi.testAlert()` diagnostic.

When `WOTCHI_STAND_TOKEN` is non-empty, all trigger and test-alert routes must require the exact `x-wotchi-stand-token` header and otherwise return `401`. No route may echo the configured token or connection URLs.

- [x] **Step 3: Wire the official Nest adapter and graceful shutdown**

Create the app, call `registerWotchiNest(app, wotchi)`, validate `REQUIRE_TEST_SERVICES`, listen on configured host/port, and handle `SIGINT`/`SIGTERM` by closing Nest, stopping the scheduled service, closing Prisma/Redis, and awaiting a bounded `wotchi.flush()`.

- [x] **Step 4: Run typecheck and fixture tests**

Run `npm run typecheck && npm test`. Expected: all tests pass without Docker; the app compiles.

## Task 6: Add the local Docker workflow and root launcher

**Files:**

- Create: `scripts/start-nest-production-stand.mjs`
- Modify: `package.json`
- Modify: `.local/TEST_STAND_WORKFLOW.md`

- [x] **Step 1: Add the root command**

Add `"stand:production": "node scripts/start-nest-production-stand.mjs"` without changing the existing `npm run stand -- nest <version>` behavior.

- [x] **Step 2: Implement the launcher**

The launcher must:

1. build Wotchi with `npm run build`;
2. require `.test_stands/nest-production` and its dependencies, printing the exact install command if missing;
3. copy `.env.example` to ignored `.env.local` when absent and parse it without printing secrets;
4. run `docker compose up -d --wait` in the stand directory;
5. run `npm run prisma:push` with the stand environment;
6. pack the current root package into `.test_stands` and install that tarball offline into the stand;
7. print safe curl smoke commands;
8. spawn `npm run start` with inherited stdio and propagate its exit code.

The launcher must never run `npm publish`, read production credentials, or delete volumes.

- [x] **Step 3: Document the command**

Add to `.local/TEST_STAND_WORKFLOW.md`:

```bash
npm install --no-audit --no-fund
npm run stand:production
```

Document `docker compose down`, `docker compose down -v`, required ports, opt-in injection, token protection, and the fact that `.test_stands` remains local-only.

- [x] **Step 4: Run the launcher preflight**

With Docker unavailable, run the launcher far enough to verify argument/dependency diagnostics. Expected: it fails with a clear Docker/dependency message and does not start a misleading app. With Docker available, continue to Task 7.

## Task 7: Add stand README and smoke verification

**Files:**

- Create: `.test_stands/nest-production/README.md`

- [x] **Step 1: Document local setup**

Document the exact commands for dependency installation, `npm run typecheck`, `npm test`, `docker compose up -d --wait`, Prisma sync, `npm run start`, and cleanup. Include the default endpoints and a warning that this fixture is not safe to expose publicly without `WOTCHI_STAND_TOKEN`.

- [x] **Step 2: Document deterministic smoke checks**

Include commands for:

```bash
curl -i http://127.0.0.1:3011/healthz
curl -i http://127.0.0.1:3011/readyz
curl -i http://127.0.0.1:3011/db-check
curl -i http://127.0.0.1:3011/redis-check
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3011/trigger/app-error; done
curl -i http://127.0.0.1:3011/trigger/db-error
curl -i http://127.0.0.1:3011/trigger/redis-error
curl -i -X POST http://127.0.0.1:3011/test-alert
```

Document expected status codes, grouped console alerts, redaction checks, and scheduler behavior with injection disabled and enabled.

- [x] **Step 3: Document future Render preparation without deploying**

Explain that the app needs a Render web service, managed PostgreSQL, Redis-compatible service, environment variables, a non-empty stand token, and an external uptime monitor. State that no Render resources or external credentials are created in this task and the ignored stand cannot be deployed until a source/release decision is approved.

## Task 8: Run end-to-end verification and review boundaries

- [x] **Step 1: Run stand checks without Docker**

From `.test_stands/nest-production/`, run:

```bash
npm run typecheck
npm test
```

Expected: all pure tests pass.

- [x] **Step 2: Run the full Docker smoke**

Run `npm run stand:production`, then execute all README smoke commands. Verify `/healthz` remains `200`, `/readyz` is `200` with healthy services, each dependency trigger returns an error response, Wotchi produces sanitized grouped alerts, `/test-alert` sends one deterministic alert, and scheduled injection remains disabled by default.

- [x] **Step 3: Verify opt-in scheduled failures**

Stop the app, set in `.env.local`:

```text
WOTCHI_FAILURE_INJECTION=true
WOTCHI_FAILURE_INTERVAL_MS=5000
WOTCHI_FAILURE_RATE=1
WOTCHI_FAILURE_KIND=rotate
```

Restart the stand, observe at least three scheduled failures across application/PostgreSQL/Redis categories without process exit, then restore `WOTCHI_FAILURE_INJECTION=false`.

- [x] **Step 4: Run root quality checks when the SDK source is involved**

Run from the repository root:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:package
npm run test:compat
npm run security:all
```

Expected: existing SDK checks remain green and the stand files do not enter the package archive.

- [x] **Step 5: Review repository hygiene**

Run:

```bash
git diff --check
git status --short
npm pack --dry-run --json
```

Confirm `.test_stands/`, `.env.local`, Docker volumes, credentials, and generated logs are absent from the package archive and Git index. Do not commit, push, publish, or deploy without explicit approval.
