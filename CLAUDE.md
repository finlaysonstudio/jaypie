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
- Monorepo with Vitest for testing, ESLint with Prettier
- When installing dependencies: `npm install <package> -w packages/<workspace>`
- Never remove "TODO" or "// ~" comments

## Guidelines
- Whenever a new export is added to a package, make sure to update the exports of packages/testkit or tests will fail.
- Updating testkit requires bumping testkit's version
- Run `npm i --package-lock-only` after versioning