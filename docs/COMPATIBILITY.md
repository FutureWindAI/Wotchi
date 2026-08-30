# Wotchi compatibility evidence

The package declares Node.js `>=22.14.0` and keeps framework dependencies optional peers. The declaration is a compatibility target; each combination must be verified before it is advertised as supported.

## Verified locally

The local compatibility matrix uses the packed build output and exercises the public adapters with real loopback requests. Its fixture applications and generated dependencies remain local-only:

| Runtime family                           | Framework | Result                                                                        |
| ---------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| Current development runtime (`v22.14.0`) | Express 4 | passed: response pass-through and grouped console alert                       |
| Current development runtime (`v22.14.0`) | Express 5 | passed: response pass-through and grouped console alert                       |
| Current development runtime (`v22.14.0`) | NestJS 10 | passed: `AppModule` integration, response preservation, grouped console alert |
| Current development runtime (`v22.14.0`) | NestJS 11 | passed: `AppModule` integration, response preservation, grouped console alert |
| Current development runtime (`v22.14.0`) | NestJS 12 | passed: integration suite plus packed ESM/CommonJS consumer checks            |

The package export smoke tests also cover ESM/CommonJS root, `/express`, and `/nest` paths,
including the status-observer and runtime-watcher exports. TypeScript consumer compilation checks both ESM declarations
and a TypeScript 4.6 CommonJS consumer using `moduleResolution: "node"` with ordinary static
imports, including `WotchiModule`, `withWotchiNestFilter`, and
`registerWotchiNest` from `@futurewindai/wotchi/nest`. The legacy fallback declarations are
supplied through `typesVersions`; root and Express imports are checked not to load NestJS runtime
modules.

For application TypeScript projects, prefer `module` and `moduleResolution` set together to
`Node16` or `NodeNext`; that follows the package's ESM/CommonJS export conditions. Runtime
CommonJS `require()` works independently of that compiler setting. The legacy fallback keeps
static subpath imports working for older CommonJS projects, but an application should still upgrade
very old TypeScript releases rather than add application-wide path aliases.

## CI matrix harness

`scripts/run-compatibility-matrix.mjs` builds a packed tarball, installs it into a temporary consumer project, installs the requested framework major, and runs small CommonJS/ESM export assertions. Every supported runtime runs the same combinations:

- Core, Express 4/5, and NestJS 10/11/12 in both module formats.

Run one combination locally with:

```bash
npm run build
node scripts/run-compatibility-matrix.mjs --framework core --module commonjs
```

The hosted CI workflow runs the full matrix on Node.js 22.14.0, the latest Node.js 22 patch, Node.js 24, and Node.js 26. A local registry or DNS failure is inconclusive and must not be recorded as a compatibility failure or a pass.

## RC1 candidate evidence

The `1.0.0-rc.1` candidate passed the local packed-tarball matrix on Node.js 22.14.0 for core,
Express 4/5, and NestJS 10/11/12 in both ESM and CommonJS. The full integration, unit, and security
suite also passed against the root NestJS 12.0.1 development installation. The hosted workflow is
configured to repeat the packed matrix across every advertised Node.js line; use the workflow status
for the tag-specific hosted result after the candidate commit is pushed.
