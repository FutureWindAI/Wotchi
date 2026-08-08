# Wotchi release process

Wotchi releases use semantic versioning, reviewed artifacts, and explicit maintainer approval. CI
builds and audits do not publish automatically.

## 1) Release checklist

On a clean checkout, update the version and changelog, then run:

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
```

Then produce and inspect:

```bash
npm pack --pack-destination /tmp/wotchi-release
cat /tmp/wotchi-release/*.tgz
```

Do not use a dirty checkout for release commands.

### 1.1 Tarball and changelog review

- Verify tarball contains only approved compiled output and docs.
- Verify changelog entry exists for the release version.
- Verify package metadata:
  - `name`, `version`, `license`, `repository`, `homepage`, `bugs`, `exports`
  - `engines.node` supports runtime promise
  - files allowlist

## 2) Trusted publishing

Use npm trusted publishing/OIDC from GitHub Actions for releases:

- Workflow reads from the tagged commit only.
- Build/test checks remain in place.
- Workflow produces and stages artifacts.
- Maintainers review the staged artifact before approval.
- Publication occurs only after maintainer approval.

Required workflow permissions:

- `contents: read`
- `id-token: write`
- release-protection environment with required reviewer

## 2.1) GitHub Actions workflow

The repository workflow is `.github/workflows/release.yml`. It is deliberately manual:

```bash
gh workflow run release.yml \
  --ref main \
  -f tag=vX.Y.Z \
  -f dist_tag=beta
```

Configure the GitHub `release` environment with a required maintainer reviewer and configure npm
trusted publishing for:

- GitHub organization: `FutureWindAI`
- repository: `Wotchi`
- workflow filename: `release.yml`
- environment: `release`
- allowed action: `npm stage publish` only

The workflow checks out the exact tag, verifies its version and clean state, runs the release gates,
uploads the packed tarball for review, and stages the package through npm OIDC. It does not run
`npm publish` or `npm stage approve`.

After a successful staging run, the maintainer reviews and approves outside GitHub Actions:

```bash
npm stage list @futurewindai/wotchi
npm stage view <stage-id>
npm stage download <stage-id>
npm stage approve <stage-id>
```

The final command is a public registry mutation and requires explicit maintainer approval.

## 3) Provenance, versions, tags, and rollbacks

- Use semantic versioning with clear prerelease tags:
  - Beta: `0.1.0-beta.1` with `beta`
  - Stable: release version with `latest`
- Every release uses a protected tag and changelog entry.
- Verify provenance badge/logs after trusted publish.
- Rollback/deprecation (same process for bad release):
  - `npm deprecate @futurewindai/wotchi@<version> "replaced by <next version>"`
  - publish fixed version with notes
  - post GitHub release note and changelog correction

## 4) Release notes and compatibility artifacts

Attach to each release:

- compatibility matrix snapshot
- benchmark summary for the exact release commit
- redaction/security notes
- known limitations and upgrade notes

## 5) Approval gates and safety policy

- Any npm publication command is maintainer approval-only.
- No long-lived npm write token in files or CI secrets.
- No publication from a dirty tree.
- No staged artifact publication without maintainer review and explicit approval.

## 6) Dist-tags

| Release type | Dist tag | Example version |
| ------------ | -------- | --------------- |
| Beta         | `beta`   | `0.1.0-beta.1`  |
| Stable       | `latest` | `0.1.0`         |

The first npm publication also exposed `latest` at the beta version because no stable version
existed. Install the prerelease explicitly with `@beta` until a stable release moves `latest`.

## 7) Release hygiene

- No Telegram tokens, passwords, database credentials, or customer data in release tooling.
- No source push or publication from a dirty checkout.
- Do not use production credentials or customer data during release validation.
