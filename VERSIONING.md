# Versioning

Single source of truth for how packages in this monorepo are versioned and published. Agent-facing; keep in sync with the root `CLAUDE.md` pointer.

## Policy

- **Patch only.** NEVER update major or minor versions without explicit instructions. Even when a new feature is added, only bump the patch.
- **No back-compat pre-1.0.** Do not preserve backwards compatibility in unreleased changes or pre-1.0 packages.
- **One bump per branch.** Do not bump a package twice in a branch. Versions are published only when merged into `main`. When unsure of the current version, check npm.
- **Lockfile after versioning.** Run `npm i --package-lock-only` after any version change.

## What to bump

- **Version every edited package.** Patch any edited subpackage that has no version change yet.
- **`@jaypie/mcp` and `@jaypie/testkit` require a patch bump when edited.** Editing mcp (skills or release-notes) or testkit requires bumping that package (patch).
- **Bump `jaypie` when a `jaypie` dependency is versioned.** If a versioned change lands in a package that `jaypie` re-exports, bump `jaypie` too.

### Sync the umbrella dependency ranges (critical)

When bumping any `@jaypie/*` subpackage, update the corresponding version range in `packages/jaypie/package.json` dependencies to match the new version (e.g. `"^1.2.1"` → `"^1.2.4"`). Failure to do this means consumers of `jaypie` will not pull the latest subpackage versions.

## Release notes

Add `packages/mcp/release-notes/<package>/<version>.md` for every version bump, with YAML frontmatter:

```yaml
---
version: 1.2.3
date: 2026-07-18
summary: One-line description of the change
---
```

Rebuild `@jaypie/mcp` after editing release notes so files are copied to `dist/`.

## Publishing mechanics

Packages publish automatically when merged to `main`. The `npm-deploy.yml` workflow:

1. Iterates over all `packages/*/`.
2. Skips `private: true` packages.
3. Compares the local version to the npm registry.
4. Publishes only if the version is new (with `--provenance`).

### Pre-release

1. Bump the version to include a `-rc.0` or `-dev.0` suffix.
2. Run `npm i --package-lock-only`.
3. Push a tag: `git tag rc-<description> && git push origin rc-<description>`.

| Trigger | Effect |
|---------|--------|
| Push to `main` | Publish stable versions |
| Tag `deploy-*` | Publish stable versions |
| Tag `dev-*` | Publish with `--tag dev` (only `-dev.N` versions) |
| Tag `rc-*` | Publish with `--tag rc` (only `-rc.N` versions) |
