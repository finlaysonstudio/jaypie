# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build`
- Run single test: `vitest run packages/<package>/__tests__/<test-file>.spec.ts`
- Run tests for package: `npm run test --workspace packages/<package>`
- Lint: `npm run lint` or `eslint --fix <file>`
- Format: `npm run format`

## Code Style
- TypeScript with ES modules, double quotes, trailing commas, semicolons
- Tests in `__tests__/<subject>.spec.ts` with sections: Base Cases, Error Conditions, Security, Observability, Happy Paths, Features, Specific Scenarios
- Function definitions with object parameters: `function myFunction({ param1, param2 })`
- Define constants for hard-coded values at file top
- Alphabetize imports, properties
- Monorepo with Lerna, Vitest for testing, ESLint with Prettier
- When installing dependencies: `npm install <package> -w packages/<workspace>`
- Never remove "TODO" or "// ~" comments