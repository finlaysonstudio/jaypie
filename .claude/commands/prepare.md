# 📋 Prepare Release

1. Version

Check all subpackages edited on this branch had their version numbers patched. Patch any edited packages without version changes. If a dependency of `jaypie` is versioned, `jaypie`'s version should be updated. If `@jaypie/mcp` skills or release-notes are updated, patch `@jaypie/mcp`.

2. Documentation and Skills

Be sure to update impacted documentation for anything changed in this branch:

* README.md at the top-level
* CLAUDE.md at the top- and package-levels
* Any relevant skills in packages/mcp/skills/
* Release notes in packages/mcp/release-notes/ for version bumps
* Any relevant documentation in stacks/documentation/docs/

3. Request to Shepard Deploy

If approved, follow `/shepherd` process to merge and monitor