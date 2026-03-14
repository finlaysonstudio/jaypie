---
name: prepare
description: Prepare a release by committing, versioning, updating docs and skills
---

# Prepare Release

1. **Commit** current changes

2. **Version** edited packages. Patch any edited subpackages without version changes. If a `jaypie` dependency is versioned, bump `jaypie` too. If `@jaypie/mcp` skills or release-notes change, patch `@jaypie/mcp`.

   ⚠️ **CRITICAL: Update `packages/jaypie/package.json` dependency versions** — When bumping any `@jaypie/*` subpackage, update the corresponding version range in `packages/jaypie/package.json` dependencies to match the new version (e.g., `"^1.2.1"` → `"^1.2.4"`). Failure to do this means consumers of `jaypie` won't pull the latest subpackage versions.

3. **Documentation and Skills** -- update anything impacted:
   - README.md (top-level)
   - CLAUDE.md (top- and package-level)
   - `packages/mcp/skills/`
   - `packages/mcp/release-notes/` for version bumps
   - `workspaces/documentation/docs/`

4. **Request to Shepherd** -- if approved, follow `/shepherd`
