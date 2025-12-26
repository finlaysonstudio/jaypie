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
- **Language**: TypeScript with ESM modules
- **Runtime**: Node.js 20, 22, 24, 25 (tested across all versions)
- **Package Manager**: npm with workspaces (monorepo)
- **Testing**: Vitest
- **Building**: Rollup with vite-plugin-dts for type declarations
- **Linting**: ESLint 9 with custom `@jaypie/eslint` config
- **Formatting**: Prettier, sort-package-json

## Package Structure
| Package | Description |
|---------|-------------|
| `jaypie` | Main package: secrets, error handling, event parsing, lifecycle, logging, queues |
| `@jaypie/aws` | AWS SDK utilities (SQS, Secrets Manager, Textract) |
| `@jaypie/constructs` | CDK constructs for AWS infrastructure |
| `@jaypie/core` | Core utilities (deprecated, migrating to kit) |
| `@jaypie/datadog` | Datadog integration utilities |
| `@jaypie/errors` | Error types (ConfigurationError, etc.) |
| `@jaypie/eslint` | Opinionated ESLint configuration |
| `@jaypie/express` | Express.js handler utilities |
| `@jaypie/fabricator` | Data fabrication utilities |
| `@jaypie/kit` | Utility functions for Jaypie applications |
| `@jaypie/lambda` | AWS Lambda handler utilities |
| `@jaypie/llm` | LLM provider interface (Anthropic, OpenAI) |
| `@jaypie/logger` | Logging utilities |
| `@jaypie/magpie` | Open source utility collection |
| `@jaypie/mcp` | Model Context Protocol server |
| `@jaypie/mongoose` | MongoDB/Mongoose connection utilities |
| `@jaypie/repokit` | Repository development tools |
| `@jaypie/testkit` | Testing mocks and utilities |
| `@jaypie/textract` | AWS Textract utilities |
| `@jaypie/types` | Core TypeScript type definitions |
| `@jaypie/documentation` | Documentation site (private) |

## CI/CD Workflows
- **npm-check.yml**: Runs on `feat/*`, `fix/*`, `devin/*` branches
  - Lint, typecheck, and unit tests in parallel
  - Tests across Node.js 20, 22, 24, 25
  - Optional Datadog test tracing
  - Conditional LLM client tests when `packages/llm` changes
- **npm-deploy.yml**: Runs on `main` branch and `deploy-*`/`rc-*` tags
  - Publishes packages to npm with provenance
  - RC tags publish with `--tag rc`
  - Skips already-published versions

## Environment Variables
| Variable | Description |
|----------|-------------|
| `PROJECT_ENV` | Environment identifier (local, meta, production) |
| `PROJECT_KEY` | Project identifier for logging |
| `PROJECT_NONCE` | Unique identifier for resources |
| `PROJECT_CHAOS` | Chaos engineering mode (none, partial, full) |
| `NODE_ENV` | Node environment (development, production) |
| `LOG_LEVEL` | Logging level (trace, debug, info, warn, error) |
| `CDK_ENV_BUCKET` | AWS S3 bucket name |
| `CDK_ENV_QUEUE_URL` | AWS SQS queue URL |
| `CDK_ENV_SNS_ROLE_ARN` | SNS role ARN for notifications |
| `CDK_ENV_SNS_TOPIC_ARN` | SNS topic ARN |
| `CDK_ENV_DATADOG_API_KEY_ARN` | Datadog API key ARN in Secrets Manager |
| `SECRET_MONGODB_URI` | MongoDB URI secret name |
| `MONGODB_URI` | Direct MongoDB connection URI |
| `ANTHROPIC_API_KEY` | Anthropic API key for LLM |
| `OPENAI_API_KEY` | OpenAI API key for LLM |
| `AWS_SESSION_TOKEN` | AWS session token (set by Lambda runtime) |
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
- Avoid default exports
- Do not preserve backwards compatibility in unreleased changes or pre-1.0 codebases