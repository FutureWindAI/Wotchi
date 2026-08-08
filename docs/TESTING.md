# Wotchi testing and smoke validation

All automated checks run without real customer data or external notifier credentials.

## Automated checks

From `projects/wotchi`:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run security:all
npm run verify:package
npm run test:compat
npm run benchmark
npm run benchmark:queue
```

The hosted workflow additionally runs the packed-tarball matrix on Node.js 18, 20, 22, 24, and 26,
OSV-Scanner, CodeQL, Gitleaks, and package/security gates.

## Local framework stands

The ignored `.test_stands/` directory contains Express 4/5 and NestJS 10/11 applications. The root
launcher builds Wotchi first and prints copy/pasteable commands:

```bash
npm run stand -- express 5
npm run stand -- nest 11
```

The NestJS 11 stand can also start local PostgreSQL, Prisma, Redis, and authentication fixtures.
It is local-only and must never receive production credentials.

## Clean packed-tarball smoke

Build a tarball, install it into a clean temporary consumer, and run one framework example. The
minimum console scenario is:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3101/repeat-error; done
curl -i http://127.0.0.1:3101/secret-error
```

Expected behavior:

- one or two matching errors do not alert at the default threshold;
- the third matching error produces one grouped console alert;
- further duplicates remain suppressed during cooldown;
- the secret fixture is redacted in the alert.

## Telegram smoke

Use only a dedicated test bot and test chat. Export credentials in the current shell, run one
controlled grouped-error scenario, verify one formatted alert, then unset the variables. Never put
the values in a file committed to Git or in command output. A Telegram smoke is optional for local
development and is not part of normal CI.

## Shadow validation

Installing a local tarball into a real application requires the application owner's approval. Use a
development environment and the console notifier only. Record CPU/heap observations, grouping
accuracy, redaction behavior, logger compatibility, and host stability without transmitting data.
