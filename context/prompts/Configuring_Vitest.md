# Configuring Vitest

## Front Matter

This guide assumes TypeScript.
JavaScript projects should use the js extension

## Typical Package

`package.json`
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest watch",
}
```

`vitest.config.ts`
```typescript
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`vitest.setup.ts`
```typescript
// This file left intentionally blank
```

* `vitest.setup.ts` can be used to extend the jest matchers, for example, or setting up other mocks
  ```typescript
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
  ```
* Before creating a `vitest.setup.ts`, check if `testSetup.js` exists.

## NPM Workspaces (monorepos)

* Configure sub-packages following the above
* Usually only sub-packages have `vitest.config.ts` and `vitest.setup.ts`
* Configure the root package as follows, iterating for each `<package>` below

`package.json`
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest watch",
  "test:<package>": "npm run test --workspace packages/<package>"
  "test:<package>:watch": "npm run test:watch --workspace packages/<package>"
}
```

`vitest.workspace.js`
```javascript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/<package>",
]);
```
