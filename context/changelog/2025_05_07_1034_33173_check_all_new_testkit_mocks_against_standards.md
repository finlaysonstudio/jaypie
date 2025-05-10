# Check all new testkit mocks against standards

New mocks refactor the packages/testkit/src/jaypie.mock.ts behemoth.
New mocks are in packages/testkit/src/mock by mocked package.
packages/testkit/src/mock/utils.ts contains utility functions.

## Checklist

Implementation

* Each package makes full use of createMock utility functions
* Only use complex logic in special cases, prefer a wrap or fixed response

Tests

* All test files follow guidance
* All exported functions are confirmed with `expect(newMockFunction).toBeMockFunction();`

## Guidance

### Mock Utils

createMockWrappedFunction wraps the original implementation in a try-catch.
createMockWrappedFunction is the preferred initial solution.
createMockResolvedFunction is preferred for most async calls, especially non-deterministic.
createMockReturnedFunction is preferred for non-deterministic synchronous functions or where the original implementation should not be used.
createMockFunction allows custom implementations and is needed when the mock has logic custom to the testing environment.

### Out of Scope

Do not lint.
Do not enforce types.

### Tests

Follow context/prompts/Add_Vitest_Tests.md.
In "Base Cases" use `expect(newMockFunction).toBeMockFunction();` for all exported mocks.

## Context

```
import {
  createMockFunction,
  createMockReturnedFunction,
  createMockResolvedFunction,
  createMockWrappedFunction,
} from "./utils";
```

Original implementations:
packages/testkit/src/jaypie.mock.ts