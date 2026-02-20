---
name: ticket
description: Work a GitHub issue -- validate, test, plan, implement, report
---

# Ticket

Work a GitHub issue end-to-end.

1. **Fetch** the issue using GitHub MCP
2. **Validate** it's not already fixed or invalid
3. **Test** write a failing test to confirm the report (discuss limitations if not possible)
4. **Plan** investigate and propose before implementing (skip if operator says "just fix it"); suggest a better approach if the issue seems misguided
5. **Branch** _only if starting from main_ `fix/issue-NNN` or `feat/issue-NNN`. If the working branch is not main, continue without creating a new branch
6. **Implement** and verify
7. **Report** results, propose running `/prepare` unless directed to run prepare
8. If the user says "shepherd" they want `/prepare` and `/shepherd` run

Do not commit or push unless told.

## User Input

<input>
$ARGUMENTS
</input>
