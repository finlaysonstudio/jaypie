---
sidebar_position: 1
---

# Development Process

**Use this page when:** contributing to Jaypie packages, understanding the development workflow, or preparing changes for review.

**Prerequisites:** Git, Node.js 20+, npm

## Overview

Jaypie development follows a baseline-driven workflow: establish baseline state, make changes, validate against baseline, commit incrementally.

## Workflow

### 1. Establish Baseline

Before making changes, run all validation:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Record any existing issues. You're only responsible for issues you introduce.

### 2. Make Changes

Implement your changes in small, testable increments.

### 3. Validate

After each logical change:

```bash
npm run typecheck -w packages/changed-package
npm run build -w packages/changed-package
npm test -w packages/changed-package
npm run format -w packages/changed-package
```

### 4. Commit

Commit after each successful validation:

```bash
git add .
git commit -m "type: scope: description"
```

This creates restore points if later changes break things.

### 5. Repeat

Continue until feature is complete.

## Validation Order

1. **Typecheck** - Catch type errors first
2. **Build** - Ensure it compiles
3. **Test** - Verify behavior
4. **Format** - Fix lint issues

Run in this order because:
- Type errors can cause build failures
- Build failures can cause test failures
- Format should be last (auto-fixes)

## Commit Messages

### Format

```
type: scope: description
```

### Types

| Type | Use Case |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change (no behavior change) |
| `docs` | Documentation |
| `test` | Tests only |
| `chore` | Tooling, dependencies |
| `build` | Build configuration |

### Examples

```
feat: express: add streaming handler
fix: lambda: handle empty event records
refactor: kit: extract force utilities
test: testkit: add error matchers
chore: deps: update vitest
```

## Test-Driven Development

### Red-Green-Refactor

1. **Red** - Write failing test
2. **Green** - Make test pass (minimal code)
3. **Refactor** - Clean up

### Test First Benefits

- Clarifies requirements
- Ensures testability
- Documents behavior
- Prevents over-engineering

## Code Review Checklist

Before submitting PR:

- [ ] All tests pass
- [ ] No type errors
- [ ] Build succeeds
- [ ] Lint passes
- [ ] Tests added for new code
- [ ] Documentation updated (if public API changed)

## Handling Failures

### Test Failure

1. Read error message carefully
2. Check if test expectation is wrong
3. Check if implementation is wrong
4. Fix the root cause

### Type Error

1. Don't use `any` to silence
2. Fix the type definition
3. Use type guards if needed

### Lint Error

```bash
npm run format  # Auto-fix most issues
```

For remaining issues, fix manually or add exception comment with reason.

## Working with Tests

### Run Specific Test

```bash
npm test -w packages/api -- --grep "health route"
```

### Watch Mode

```bash
npx vitest -w packages/api
```

### Coverage

```bash
npm test -w packages/api -- --coverage
```

## Updating Dependencies

```bash
# Update specific package
npm install express@latest -w packages/api

# Update all
npm update

# Check outdated
npm outdated
```

## Version Bumping

Don't bump versions in feature branches. Versions are bumped when merging to main.

If you need to bump for testing:

```bash
npm version patch -w packages/changed-package
npm i --package-lock-only  # Update lock file
```

## Related

- [Branch Management](/docs/contributing/branch-management) - Git workflow
- [Testing](/docs/guides/testing) - Testing guide
- [Patterns](/docs/architecture/patterns) - Code patterns
