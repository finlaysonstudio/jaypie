# 🎟️ Ticket

Work GitHub issue

1. Fetch the issue using GitHub MCP
2. Validate: check it's not already fixed or invalid
3. Test: write a failing test to confirm the report
   - If not possible, discuss limitations in plan
3. Investigate and propose a plan before implementing (skip plan if operator says "just fix it")
   - If the issue seems misguided or there's a better approach, say so
4. Create branch `fix/issue-NNN` or `feat/issue-NNN` (skip on branches other than main)
5. Implement and verify
6. Report results, propose running `/prepare` unless directed to run prepare
7. If the user says "shepherd" they want `/prepare` and `shepherd` run

Do not commit or push unless told.

## User Input

<input>
$ARGUMENTS
</input>