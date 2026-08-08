# Wotchi development workflow

## Prerequisites

Use a maintained Node.js LTS release for development. The package compatibility floor is Node.js `18.18.0`.

## Install

```bash
npm ci
```

The lockfile is authoritative. Keep dependency additions small, documented, and reviewed for security and runtime impact.

## Local test stands

Build the package, then start one of the ignored framework stands with the root launcher:

```bash
npm run build
npm run stand -- nest 11
npm run stand -- nest 10
npm run stand -- express 5
npm run stand -- express 4
```

The launcher accepts only those server/version combinations, builds Wotchi first, prints the stand's local endpoints plus one-error and grouped-error commands, and then runs the stand's existing `start` script. For `nest 11`, it also starts the ignored local PostgreSQL/Redis fixture services, creates `.env.local`, applies Prisma, and installs the packed SDK automatically. Install a stand's dependencies once from its directory when needed, for example `cd .test_stands/nest-v11 && npm install --no-audit --no-fund`.

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
node test/compatibility/package-exports.smoke.cjs
npm run security:audit
npm run security:osv
npm pack --dry-run --json
npm run verify:package
npm run test:compat
npm run benchmark
npm run benchmark:queue
npm run build && node scripts/run-compatibility-matrix.mjs --framework core --module commonjs
```

`npm run security:all` runs both dependency security checks. `npm run benchmark` builds the package and runs the bounded latency/heap benchmark with `--expose-gc`.

## Test-first changes

For behavior changes, write one focused failing test, run it and confirm the expected failure, implement the smallest change, then rerun the focused test and the full applicable checks. Configuration-only files are the exception to the test-first rule.

## Repository hygiene

Before a commit, inspect the complete staged file list. The following are local or generated and must stay out of Git and npm archives:

- `.idea/`
- `.test_stands/`
- `node_modules/`
- `dist/`
- `.test-dist/`
- build source maps (excluded from the package archive)
- `.env` files and logs

Never use real customer errors, production URLs, tokens, or credentials in tests or documentation.
