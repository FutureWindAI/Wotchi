# Wotchi release and GitHub Actions → npm flow

Wotchi is pre-release. Phase 7 verifies the package; publication remains a separate, owner-approved phase.

## What happens after Phase 7

1. Confirm the package name, GitHub repository, Apache-2.0 license, and npm scope.
2. Review the packed tarball from a clean checkout.
3. Create the npm organization/scope and enable two-factor authentication.
4. Publish the first beta manually with owner approval. This bootstraps the package.
5. Configure npm trusted publishing for the exact GitHub repository and release workflow.
6. Use protected tags/environments for later beta and stable releases.
7. Let GitHub Actions build, test, pack, and stage the package; a maintainer reviews and approves the staged artifact.
8. Verify the npm install, provenance, GitHub release, changelog, and rollback instructions.

The normal CI workflow must never publish to npm automatically. Publication is a registry mutation and requires an explicit release approval.

## Recommended later release workflow

```text
pull request
  -> quality, security, compatibility, package, and performance gates
  -> approved release pull request
  -> protected tag (for example v0.1.0-beta.2)
  -> GitHub Actions uses Node.js 24 and packs the exact checkout
  -> npm trusted publishing stages the package with the beta tag
  -> maintainer reviews the staged tarball and approves it with npm 2FA
  -> clean consumer install and provenance verification
  -> GitHub release notes and announcement
```

## Credentials and permissions

- Prefer npm trusted publishing/OIDC for later releases; do not create a long-lived npm write token unless npm's current bootstrap rules require it.
- The release workflow needs `contents: read` and `id-token: write`; a protected release environment supplies the human approval.
- Keep repository administration, npm ownership, and release approval limited to maintainers.
- Never put npm passwords, recovery codes, Telegram tokens, or customer data in GitHub variables, source files, fixtures, or logs.

## First beta bootstrap

The first beta may require one manual publication because the npm package does not exist yet. Recheck npm's current trusted-publisher and staged-publishing rules before acting.

The owner must separately approve the exact command:

```bash
npm publish --access public --tag beta
```

Do not run it from CI until the repository, scope, version, tarball contents, and release owner are explicitly approved.

## Dist-tags

| Release | Example        | Tag      | Install                                 |
| ------- | -------------- | -------- | --------------------------------------- |
| Beta    | `0.1.0-beta.1` | `beta`   | `npm install @futurewindai/wotchi@beta` |
| Stable  | `0.1.0`        | `latest` | `npm install @futurewindai/wotchi`      |

The package must be built and tested from the same commit that is tagged and staged. A release workflow must not rebuild from an uncommitted or mutable workspace.
