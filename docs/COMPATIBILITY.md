# Wotchi compatibility evidence

The package declares Node.js `>=16.20.0` and keeps framework dependencies optional peers. The declaration is a compatibility target; each combination must be verified before it is advertised as supported.

## Verified locally

The ignored `.test_stands/` matrix uses the packed build output and exercised the public adapters with real loopback requests:

| Runtime family                           | Framework | Result                                                            |
| ---------------------------------------- | --------- | ----------------------------------------------------------------- |
| Current development runtime (`v22.14.0`) | Express 4 | passed: response pass-through and grouped console alert           |
| Current development runtime (`v22.14.0`) | Express 5 | passed: response pass-through and grouped console alert           |
| Current development runtime (`v22.14.0`) | NestJS 10 | passed: framework response preservation and grouped console alert |
| Current development runtime (`v22.14.0`) | NestJS 11 | passed: framework response preservation and grouped console alert |

The package export smoke tests also cover ESM/CommonJS root, `/express`, and `/nest` paths. Root and Express imports are checked not to load NestJS runtime modules.

## CI matrix harness

`scripts/run-compatibility-matrix.mjs` builds a packed tarball, installs it into a temporary consumer project, installs the requested framework major, and runs small CommonJS/ESM export assertions. The matrix selects the combinations required by the Node.js major:

- Node.js 16: core/CommonJS, Express 4/CommonJS, NestJS 10/CommonJS.
- Node.js 18: core, Express 4/5, and NestJS 10 in both module formats.
- Node.js 20 and later: core, Express 4/5, and NestJS 10/11 in both module formats.

Run one combination locally with:

```bash
npm run build
node scripts/run-compatibility-matrix.mjs --framework core --module commonjs
```

The hosted CI workflow runs the full matrix on Node.js 16, 18, 20, 22, 24, and 26. A local registry or DNS failure is inconclusive and must not be recorded as a compatibility failure or a pass.

## Not yet claimed

Node.js 16, 18, 20, 22, 24, and 26 jobs, plus every ESM/CommonJS and framework-major combination, still require clean packed-tarball CI verification. Until those jobs pass, documentation and release material must describe them as targets or compatibility-only checks rather than certified support.
