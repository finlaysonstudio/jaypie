# 🐑 Shepherd

Guide the Jaypie merge process.

1. Run a clean NPM Check workflow
2. Create PR
3. Merge once checks pass
4. Run a clean NPM Deploy workflow

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

## Known Issues

Do not worry about Build Stacks to Development, Build Stacks to Sandbox, or Deploy Documentation Stack. These stacks are still in beta.

## User Input

<input>
$ARGUMENTS
</input>