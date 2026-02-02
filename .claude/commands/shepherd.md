# 🐑 Shepherd

Guide the Jaypie merge process.

1. Run a clean NPM Check workflow
2. Create PR
3. Merge once checks pass (use `--merge`, not `--squash`)
4. Run a clean NPM Deploy workflow

## Prepare the Release

- Follow `/prepare` if this command did not immediately follow prepare
- Prepare confirms dependencies, documentation, and versions are up to date

## Clean NPM Check

- Push the branch
- Monitor the workflow in GitHub Actions
- Fix any errors including lint, test, and typecheck
- Commit and push

## Clean NPM Deploy

- Monitor the workflow in GitHub Actions
- If there is an NPM publish error, especially around a pre-1.0 package, request the operator publish manually
- Once the operator publishes, restart the failed workflow and monitor
- Report once NPM Deploy finishes successfully
- Report errors in other jobs but do not resolve unless asked

## Prune Branches

- Return to main, fetch, and pull
- Delete the local and remote feature branches
- Delete local branches orphaned during this session (e.g., changing branch name)
- Propose and confirm with operator additional local branches without a remote tracking branch (orphans) to delete

## Known Issues

Do not worry about Build Stacks to Development, Build Stacks to Sandbox, or Deploy Documentation Stack. These stacks are still in beta.

## User Input

<input>
$ARGUMENTS
</input>