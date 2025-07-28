---
description: Process for creating, merging branches (always read)
---

# Branch Management

## Naming Conventions

Name branches after the ticket or use a generic naming scheme.

### Ticket Naming

If the issue is from a ticketing system such as GitHub, Jira, or Linear, use `feat/{{ ticket }}`.
Jira and Linear usually include a keyword like `DEV-12`.
For GitHub tickets use `GITHUB-#`.

### Generic Naming

Check the first eight characters of the latest commit hash with `git -C workspace rev-parse --short=8 HEAD`
Create a new branch prefixed with `feat/`.
Make the branch name a concise two- or three-word summary of the ticket.
Lead with the most important word.
Use dashes, for example `feat/readme-update-abcd5678`.

## Development

Refer to [Development_Process.md](./Development_Process.md) for details on process, scripts, and tests expected in the development step.

## Completion

Push the completed branch.
Start a new pull request.
Describe the changes and any failing validation steps.
Mark it closing the issue.