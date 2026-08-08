# Wotchi release and npm publication procedure (no auto-publication)

Wotchi remains a pre-release beta candidate until the exact source snapshot and package
publication are verified. The founder accepted the documented Wotchi trademark risk on
2026-08-08; this is not legal clearance.
All npm mutation steps require explicit owner approval. CI builds and audits must never publish automatically.

## 0) Ownership preconditions

Before any release workflow is prepared or run:

- Confirm package identity:
  - npm scope ownership: `@futurewindai`
  - package: `@futurewindai/wotchi`
  - repository: dedicated public `wotchi` repo inside the approved GitHub organization
  - license: `Apache-2.0`
- Confirm `PROJECT STATUS`: `npm`/`name`/`license`/`repo` references are consistent with
  `docs/NPM_AND_OPEN_SOURCE_RELEASE_FLOW.md`.
- Confirm npm organization ownership from an approved npm account before proceeding.
- Confirm `npm` two-factor authentication (2FA) is enabled for human owners.
- Confirm the documented name/trademark risk acceptance is up to date; do not describe it as legal clearance.

## 1) Step-8 release procedure artifact checks (before publishing)

### 1.1 Pre-release gates (required and repeatable)

On a clean checkout, run:

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

### 1.2 Tarball and changelog evidence

- Verify tarball contains only approved compiled output and docs.
- Verify changelog entry exists for the release version.
- Verify package metadata:
  - `name`, `version`, `license`, `repository`, `homepage`, `bugs`, `exports`
  - `engines.node` supports runtime promise
  - files allowlist

## 2) First-public-beta bootstrap path (manual, one-time)

The first public release may require owner-driven manual publish because trusted publisher requires existing package metadata.

Required before execution:

- All gates in section 1 complete on the exact intended commit.
- Tag points to the exact checked-out tree: `v0.1.0-beta.1` (example).

Mutating command (owner-approved):

```bash
npm publish --access public --tag beta
```

After bootstrap, record:

- npm package page URL
- first public install proof (`npm view @futurewindai/wotchi` and clean install test)

No CI step may run this command without explicit release approval.

## 3) Later release path: stage-only trusted publishing

After bootstrap, use trusted publishing/OIDC from GitHub Actions:

- Workflow reads from the tagged commit only.
- Build/test checks remain in place.
- Workflow produces and stages artifacts.
- Maintainers review staged artifact before approval.
- Publication occurs only after maintainer approval with npm 2FA.

Required workflow permissions:

- `contents: read`
- `id-token: write`
- release-protection environment with required reviewer

## 3.1) Phase 9 stage-only GitHub Actions workflow

The repository workflow is `.github/workflows/release.yml`. It is deliberately manual:

```bash
gh workflow run release.yml \
  --ref main \
  -f tag=v0.1.0-beta.1 \
  -f dist_tag=beta
```

Before using it, the owner must configure the GitHub `release` environment with a required
maintainer reviewer and configure npm trusted publishing for:

- GitHub organization: `FutureWindAI`
- repository: `Wotchi`
- workflow filename: `release.yml`
- environment: `release`
- allowed action: `npm stage publish` only

The workflow checks out the exact tag, verifies its version and clean state, runs the release gates,
uploads the packed tarball for review, and then stages the package through npm OIDC. It does not run
`npm publish` or `npm stage approve`. Staging is unavailable until the first beta package has been
bootstrapped manually through the separate owner-approved procedure above.

After a successful staging run, the maintainer reviews and approves outside GitHub Actions:

```bash
npm stage list @futurewindai/wotchi
npm stage view <stage-id>
npm stage download <stage-id>
npm stage approve <stage-id>
```

The final command is a public registry mutation and requires explicit owner approval with 2FA.

## 4) Provenance, versions, tags, and rollbacks

- Use semantic versioning with clear prerelease tags:
  - Beta: `0.1.0-beta.1` with `beta`
  - Stable: release version with `latest`
- Every release uses a protected tag and changelog entry.
- Verify provenance badge/logs after trusted publish.
- Rollback/deprecation (same process for bad release):
  - `npm deprecate @futurewindai/wotchi@<version> "replaced by <next version>"`
  - publish fixed version with notes
  - post GitHub release note and changelog correction

## 5) Release notes and compatibility artifacts

Attach to each release:

- compatibility matrix snapshot
- benchmark summary for the exact release commit
- redaction/security notes
- known limitations and upgrade notes

## 6) Approval gates and safety policy (hard requirements)

- Any npm publication command is owner approval-only.
- No long-lived npm write token in files or CI secrets.
- No publication from a dirty tree.
- No staged artifact publication without:
  - maintainer review
  - owner confirmation
  - npm 2FA check for publish action

## 7) Dist-tags

| Release type | Dist tag | Example version |
| ------------ | -------- | --------------- |
| Beta         | `beta`   | `0.1.0-beta.1`  |
| Stable       | `latest` | `0.1.0`         |

## 8) Non-goals for pre-release preparation

- No Telegram tokens, passwords, database credentials, or customer data in release tooling.
- No public-source push or publication without the recorded owner approval for the exact snapshot and package version.
- No production installs during pre-release approval.
