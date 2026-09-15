// Inlined so bundled builds (esbuild, Lambda) need no shipped file

export const RELEASE_NOTES_HELP = `# Release Notes

Browse Jaypie package release notes.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| \`list\` | List available release notes | - |
| \`read\` | Read a specific release note | \`package\`, \`version\` |

## Options for \`list\`

| Option | Description |
|--------|-------------|
| \`cursor\` | Opaque cursor from a previous page's \`Next page\` footer |
| \`limit\` | Notes per page (default 50, maximum 200) |
| \`package\` | Filter by package name (e.g., "mcp", "jaypie") |
| \`since_version\` | Only versions newer than this (e.g., "1.0.0") |

## Pagination

\`list\` sorts by package ascending, then version descending, and returns one
page. When more notes exist, the last line is a footer:

\`\`\`
Next page: release_notes("list", { cursor: "..." })
\`\`\`

The cursor carries \`package\`, \`since_version\`, and \`limit\`, so the footer call
alone continues the same listing. Pass \`limit\` with a cursor to change the page
size. Passing a \`package\` or \`since_version\` that differs from the cursor is an
error.

## Examples

\`\`\`
release_notes("list")
release_notes("list", { limit: 20 })
release_notes("list", { package: "mcp" })
release_notes("list", { package: "jaypie", since_version: "2.0.0" })
release_notes("read", { package: "mcp", version: "0.4.2" })
\`\`\`

## Available Packages

Release notes are available for all Jaypie packages including:
- \`jaypie\` - Main package
- \`mcp\` - MCP server
- \`fabric\` - Service handlers and adapters
- \`llm\` - LLM provider interface
- And more...

Use \`release_notes("list")\` to see all available packages and versions.
`;
