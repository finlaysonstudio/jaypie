---
sidebar_position: 2
---

# Branch Management


**Prerequisites:** Git

## Overview

Jaypie uses a simple branch workflow with `main` as the primary branch and feature branches for development.

## Branch Naming

### Ticket-Based

```
feat/TICKET-ID
feat/DEV-123
feat/GITHUB-456
```

### Description-Based

```
feat/short-description-abc12345

# Pattern: feat/{2-3 word description}-{first 8 chars of commit hash}
```

### Naming Guidelines

- Lead with most important word
- 2-3 words maximum
- Use hyphens, not underscores
- Lowercase

### Examples

| Good | Bad |
|------|-----|
| `feat/streaming-handler` | `feat/add_new_streaming_handler_for_sse` |
| `fix/lambda-timeout` | `fix/FixTheLambdaTimeoutBug` |
| `feat/DEV-123` | `feature/DEV-123-implement-user-auth` |

## Workflow

### 1. Create Branch

```bash
git checkout main
git pull
git checkout -b feat/description-abc12345
```

### 2. Make Commits

```bash
# After each validated change
git add .
git commit -m "type: scope: description"
```

### 3. Push Branch

```bash
git push -u origin feat/description-abc12345
```

### 4. Create PR

Create pull request via GitHub CLI or web interface.

## Pull Request Process

### PR Title

Same format as commit:

```
feat: express: add streaming handler
```

### PR Description

```markdown
## Summary

- Added expressStreamHandler for SSE responses
- Added createExpressStream helper

## Test plan

- [ ] Run `npm test -w packages/express`
- [ ] Test streaming locally with `npm run dev`
```

### Creating PR

```bash
gh pr create --title "feat: express: add streaming handler" --body "..."
```

## Branch Protection

`main` branch is protected:

- Requires PR review
- Requires passing CI
- No direct pushes

## CI Triggers

| Branch Pattern | Workflow |
|----------------|----------|
| `feat/*` | npm-check.yml |
| `fix/*` | npm-check.yml |
| `main` | npm-deploy.yml |
| `deploy-*` | npm-deploy.yml |

## Keeping Branch Updated

### Rebase (Preferred)

```bash
git fetch origin
git rebase origin/main
```

### Merge (If Conflicts Complex)

```bash
git fetch origin
git merge origin/main
```

## Cleaning Up

### After PR Merged

```bash
git checkout main
git pull
git branch -d feat/old-branch
```

### Delete Remote Branch

GitHub auto-deletes after merge, or manually:

```bash
git push origin --delete feat/old-branch
```

## Commit Best Practices

### Small Commits

Each commit should be:
- Single logical change
- Independently buildable
- Self-contained (tests pass)

### Commit Often

Commit after each successful validation step. Creates restore points.

### Don't Commit

- Broken code
- Failing tests
- Unfinished changes

## Related

- [Development Process](/docs/contributing/development-process) - Development workflow
- [CI/CD](/docs/guides/cicd) - CI/CD configuration
