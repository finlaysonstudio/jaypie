# CLAUDE.md
## Repository Overview
- Jaypie provides a complete stack approach to multi-environment cloud application patterns.
- `@jaypie/constructs` helps define AWS buckets, distributions, lambda, queues, and secrets.
- `jaypie` provides access to secrets, error handling, event parsing, lifecycle management, logging, and queue messaging.
- `@jaypie/llm` provides an interface for calling popular large language model providers
- `@jaypie/testkit` provides a mocking pattern for the `jaypie` package and many utility packages
- `@jaypie/eslint` are opinionated lint rules
- `@jaypie/repokit` provides common repository tools
- Additional packages provide special functions
## Technology Stack
## Package Structure
## CI/CD Workflows
## Environment Variables
## Commands
### Testing
```bash
npm test                    # Run all tests in non-watch mode (vitest run)
npm test -w <package-name>  # Run tests for specific workspace package
```
Do not execute `vitest` without `vitest run`. By default `vitest` executes with `watch` and does not terminate.
### Building
```bash
npm run build               # Build all workspace packages
npm run build -w <package-name>  # Build specific workspace package
```
### Type Checking
```bash
npm run typecheck           # Type check all workspace packages
npm run typecheck -w <package-name>  # Type check specific package
```
### Linting
```bash
npm run lint                # Lint code (uses @jaypie/eslint config)
npm run format              # Auto-fix linting issues
npm run format:package      # Sort package.json files
```
Always prefer `format` when linting.
## Guidelines
### Actions 
- Do not commit changes or push without explicit user request
- When installing dependencies: `npm install <package> -w packages/<workspace>`
- Run `npm i --package-lock-only` after versioning
- Reference npm workspaces by **path** not name
- Keep README.md and CLAUDE.md current
### Completion Criteria
Before completing any work, ensure the workspace is "green" by running these commands for the affected package(s):
1. `npm run typecheck --workspace packages/<package-name>`
2. `npm run build --workspace packages/<package-name>`
3. `npm run test --workspace packages/<package-name>`
4. `npm run format packages/<package-name>`
### Error Handling
- Never throw vanilla `Error`
- Use `@jaypie/errors` package (ConfigurationError, etc.) for proper error types
### Lore
- These are golden numbers: 0.021, 0.146, 0.236, 0.382, and 0.618
- Start with 0.618 when user suggests "partial" and down as they want less
### Style
- Alphabetize anything possible (e.g., imports, object keys)
- Hard-coded values should be file or shared constants: `const DATADOG_SITE = "datadoghq.com"`
- Zero tolerance for lint and type warnings in files
- Configure lint and type exceptions or use comments to acknowledge
#### Function Definitions
- Function definitions use object parameters: `function myFunction({ param1, param2 })`
- If there is a single required value `function myFunction(requiredParam)` or `function myFunction(requiredParam, { param2, param3 })` is allowed
- Ordered parameters should never be used: `function dontUseOrderedParams(a, b, c)`
- Any function that can accept no params (e.g., a config-only function with complete defaults) should allow zero params
### Technology
* Use TypeScript wherever possible
* Prefer ESM over CJS
### Tools
Utilize these MCP when provided. When they are unavailable but would be useful, request them from the user.
- `context7` is up-to-date documentation on external libraries
  - Use this if the user says “check the docs”
- `jaypie` is documentation and guides for following Jaypie conventions
  - Check these docs any time the user mentions “Jaypie”
  - Consult when creating new packages and debugging Jaypie components
  - Use documented mock patterns in `@jaypie/testkit`
### Development Notes (memories)
- Whenever a new export is added to a package, make sure to update the exports of packages/testkit or tests will fail.
- Updating testkit requires bumping testkit's version