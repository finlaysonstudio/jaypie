# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build`
- Run single test: `vitest run packages/<package>/src/**/__tests__/<file>.spec.ts`
- Run tests for package: `npm run test --workspace packages/<package>`
- Lint (always format): `eslint --fix <file>`

Do not `cd packages/<package> && npm <command>` to run commands.
Run `npm --workspace packages/<package> <command>`.

## Code Style
- TypeScript with ES modules, double quotes, trailing commas, semicolons
- Tests in `__tests__/<subject>.spec.ts` with sections: Base Cases, Error Conditions, Security, Observability, Happy Paths, Features, Specific Scenarios
- Function definitions with object parameters: `function myFunction({ param1, param2 })`
- Define constants for hard-coded values at file top
- Alphabetize imports, properties
- Monorepo with Lerna, Vitest for testing, ESLint with Prettier
- When installing dependencies: `npm install <package> -w packages/<workspace>`
- Never remove "TODO" or "// ~" comments

# Repository Agent Rules
"Jaypie" is an "event-driven fullstack architecture centered around JavaScript, AWS, and the JSON:API specification."

## Technology
Monorepo with Lerna using `packages/*`.
Most code in ES6 module format.
Eslint 9 "flat config" with Prettier.
Rollup for bundling.
Vitest for testing.

## Commands
`eslint --fix <file>` to fix correctable linting errors. This will be more reliable than a model call.
`vitest run <file>` to run tests. `run` is required to prevent the default `watch` mode from hanging the agent process.

## Organization
`packages/jaypie` is the main package, published to npm and imported by clients.
The main package imports aws, core, datadog, express, lambda, and mongoose
`packages/cdk` is maintained in CommonJS and published separately for client infrastructure.
`packages/testkit` is published separately for client testing.
`packages/webkit` is published separately for browser utilities.
### Installing Dependencies
Only use npm. Do not suggest yarn or pnpm.
Always pass `-w` and specify the workspace directory.

## Testing
Tests are named `./__tests__/<subject>.spec.<js|ts>`.
Each file should have one top-level `describe` block.
Organize tests in one of seven second-level describe block sections in this order:
1. Base Cases - it is the type we expect ("It is a Function"). For functions, the simplest possible call works and returns not undefined ("It Works"). For objects, the expected shape.
2. Error Conditions - any error handling the code performs
3. Security - any security checks the code performs
4. Observability - any logging the code performs
5. Happy Paths - The most common use case
6. Features - Features in addition to the happy path
7. Specific Scenarios - Special cases
Omit describe blocks for sections that are not applicable or empty.
Whenever possible, especially when refactoring, write the test first so the user can confirm the expected behavior passes/fails.
### Completing Tests
If there are multiple tests marked .todo and you are asked to complete them, only complete the first test in a describe block before moving on to sibling tests. Use the same logic traversing down describe blocks. Complete the first test in a describe block before moving on to sibling tests.
### Resolving Errors in Tests
If multiple tests fail, apply `.only` to the first failing test and resolve that error. Run all tests again and isolate errors from the top down.

## Style
Use double quotes, trailing commas, and semicolons.
Whenever a hard-coded value like `site: "datadoghq.com"` is used, define a constant at the top of the file, `const DATADOG_SITE = "datadoghq.com"`, and reference that throughout.
Alphabetize as much as possible.
### Function Definitions
Prefer functions with a single object parameter (e.g., `function myFunction({ param1, param2 })`).
If a function takes only one required parameter, make it the first parameter and the remaining parameters object as the second parameter (e.g., `function myFunction(param1, { param2 })`).
### Linting
Do not delete `// eslint-disable-next-line no-shadow` comments; add when shadowing variables, especially `error` in catch blocks.
