---
description: Development workflow, required reading for coding tasks (always read)
---

# Development Process

## Baseline Conditions

Check package.json scripts for available commands: build, format, lint, test, and typecheck.
Run each available script to establish baseline state.
Document all errors and warnings from the baseline run.
Do not fix baseline errors or warnings.
Use this baseline to identify new issues introduced by development work.

## Development

Implement the requested feature or fix.
Write tests to validate the work whenever possible.
Run tests to verify functionality (do not run lint or typecheck yet).
When development is complete, commit changes using conventional commit format.
Conventional commit format: `type: scope: description` (examples: `feat: api: add user endpoint`, `fix: auth: handle expired tokens`, `chore: config: update dependencies`).

## Validation

Check package.json for available scripts before running validation steps.
Skip any step that does not have a corresponding npm script.
If a npm script produces errors or warnings, note them for context in subsequent steps.
Include any pre-existing build, lint, test, and type warnings in instructions to disregard when fixing new issues.
Skip any step that cannot be passed due to pre-existing failures.
Commit after each successful validation step to create restore points.

### Scrub

Follow code style rules in packages/mcp/prompts/Jaypie_Scrub.md.
Repository-specific style guides (CLAUDE.md, .cursorrules) override Jaypie_Scrub.md when they conflict.
Applying scrub rules can prevent errors in subsequent validation steps, especially testing.
If no errors are found, no commit is needed for this step.

### Test

Run `npm run test` to execute the test suite.
Compare results to baseline: only fix failures introduced by your changes.
Determine root cause of each new failure:
- Unchanged test failing: implementation likely broke existing functionality
- Test covering intentionally modified behavior: test needs updating
- New test failing: fix the test or implementation as appropriate
Fix identified issues and re-run tests until only baseline failures remain.
Commit fixes with message describing what was corrected.

### Type Check

Run `npm run typecheck` (runs typecheck across all workspace packages).
Note: Some packages output `[TODO] Convert @jaypie/package to TypeScript` - this is expected and should be ignored.
Compare results to baseline: only fix type errors introduced by your changes.
Fix new type errors and re-run typecheck until only baseline errors remain.
Commit fixes with message describing type corrections.

### Format and Lint

Run `npm run format` (runs package.json sorting and auto-fixes linting issues).
Check git status to see if format updated any files.
If files were modified by format, review changes and commit them.
Run `npm run lint` to check for remaining lint errors.
Fix any new lint errors introduced by your changes (compare to baseline).
Commit lint fixes with appropriate message.

### Build

Run `npm run build` (uses Lerna to build all packages in dependency order).
Compare results to baseline: only fix build errors introduced by your changes.
Fix new build errors and re-run build until only baseline errors remain.
Commit build fixes with appropriate message.
Verify dist/ directories were created/updated for modified packages.

## Documentation

Check if README.md updates are needed:
- Public API changes (function signatures, exports, parameters)
- New features that users need to know about
- Breaking changes to existing functionality
- Changes to installation or setup procedures

Do NOT update README.md for:
- Internal refactoring
- Test updates
- Bug fixes that don't change behavior
- Dependency updates

If updates are needed, modify README.md to reflect changes and commit with message `docs: update README`.
