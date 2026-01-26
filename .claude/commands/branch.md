# 🪾 Branch

Branch naming philosophy.

- Make sure the repo is clean
- Use a `(branch|feat|fix)/` prefix defaulting to `branch`
- End the branch with the first 8 chars of the current commit
- After the prefix use `wip` (default), `issue-NNN`, the package being worked on, or a url-compatible description of the work being done
- If there is no specific user input, use defaults or infer from the current work

"Start a branch" => user just wants a default branch
Good: `branch/wip-abcd5678`, uses defaults and hash
Bad: `feat/new-feature`, assumes feature, no defaults or hash

"Create a branch for constructs" => user wants to work on construct features
Good: `feat/constructs-abcd5678`, uses feat, constructs, hash
Bad: `constructs/wip-abcd5678`, non-standard prefix

"Work 144" => user wants to work on GitHub issue #144
Good: `fix/issue-144`, uses fix, issue, number
Bad: `github-144`, no prefix, uses `github` instead of `issue`

_No input but previous requests dealt with express and lambda packages_ => feature branch for both packages
Good: `feat/express-lambda-abcd5678`, both mentioned alphabetically
Bad: `branch/wip-abcd5678`, missed opportunity to extract value from context

## User Input

<input>
$ARGUMENTS
</input>