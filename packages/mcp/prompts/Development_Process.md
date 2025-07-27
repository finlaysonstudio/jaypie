---
description: Development workflow, required reading for coding tasks (always read)
---

# Development Process

## Baseline Conditions

Check package.json scripts for build, format, lint, test, and typecheck commands.
Build, lint, test, and typecheck the repository before continuing.
Note but do not attempt to fix errors and warnings.

## Development

Start a subagent for actual feature implementation.
Include any build, lint, test, and type warnings to disregard.
Have the subagent write a test to validate work whenever possible.
Have the subagent run tests but not worry about lint and types.
Commit the changes when complete.
Follow conventional commits.

## Validation

Use a subagent for each step, if applicable.
Skip any step that does not have a corresponding npm script.
If the npm script produces no errors or warnings, 
Include any build, lint, test, and type warnings to disregard.
Skip any step that cannot be passed.
Commit after each step to ensure changes can be discarded.

### Scrub

Follow prompts/Jaypie_Scrub.md.
If provided, allow repo instructions to override Jaypie scrub.
Scrub can prevent errors in further steps, especially testing.

### Test

Test the repository.
Have a subagent correct any new errors in the test
Be clear whether the error is in the test or in the implementation.
If the failure is an unchanged test, likely the new implementation is to blame.
If the new implementation intentionally changed code covered by the test triggering the failure, the test may be incorrect.
Commit the changes when complete.

### Type Check

Run `npm run typecheck`.
Have a subagent correct any new type errors.
Commit the changes when complete.

### Format and lint

Run the format, when available, or lint commands.
Check status to see if format updated any files.
Call a subagent for any remaining lint errors introduced by this branch.
Commit the changes when complete.

### Build

Run `npm run build`.
Have a subagent correct any new build errors.
Commit the changes when complete.

## Documentation

Have a subagent update README.md, if any already-documented features were changed or new features introduced.
