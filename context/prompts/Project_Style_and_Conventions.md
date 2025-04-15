# Jaypie Project Style and Conventions 🐦‍⬛📙

## Linting

* TypeScript with ES module syntax.
* Disallow CommonJS require.
* ESLint uses Prettier with double-quotes.

## Monorepos

* Add new packages to vitest.workspace.js on the top-level if it is not using the glob syntax.

## Scripts

* Local utilities should be written in TypeScript, executable with tsx
* Scripts may be added to package.json named "bin:<utility>"

## Testing

* If a test produces an artifact, clean up by deleting artifacts
* See [Add Vitest Tests](./Add_Vitest_Tests.md)

## Writing

* Clear, direct, punchy, and terse.
* Focus on clarity.
* Remove ~~unnecessary~~ words.
