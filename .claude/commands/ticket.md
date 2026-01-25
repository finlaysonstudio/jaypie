# 🎟️ Ticket

Work on GitHub issue $ARGUMENTS

1. Fetch the issue using GitHub MCP
2. Validate: check it's not already fixed or invalid
3. Test: write a failing test to confirm the report
   - If not possible, discuss limitations in plan
3. Investigate and propose a plan before implementing (skip plan if operator says "just fix it")
   - If the issue seems misguided or there's a better approach, say so
4. Create branch `fix/issue-$ARGUMENTS` or `feat/issue-$ARGUMENTS` (skip on branches other than main)
5. Implement and verify
6. Report results, propose running `/prepare`

Do not commit or push unless told.