# reorganize jaypie mock

packages/testkit/src/jaypie.mock.ts

The Jaypie mock is one of the best things about the Jaypie library but it is a mess.

Create a plan in a new markdown file, /plan.md, outlining steps to refactor it.

I would like to create a new mock structure in packages/testkit/src/mock/
I would like each jaypie package mocked in its own package and all brought together in an index.ts

index.ts
aws.ts
core.ts
datadog.ts
…

Each file should provide the correct mock based on jaypie.mock.ts.
Constants can be exported as-is.

Ideally, in addition to handling the known mocks, I would like to future-proof all the mocks.
Is it possible to import each package as an object, iterate over the elements, and export constants while wrapping functions?
`import * as core from "@jaypie/core";`
`for each item in core, if function, else`

Do not replace or edit packages/testkit/src/jaypie.mock.ts

As the final step, replace the new index.ts as the input in packages/testkit/rollup.config.js
and the ./mock export in packages/testkit/package.json

The objective of this task is to export plan.md in the top-level.