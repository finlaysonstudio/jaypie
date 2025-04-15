# Jest

## Expect

Excerpt from [Jest Expect Documentation](https://jestjs.io/docs/expect#expectextendmatchers)

### `expect.extend(matchers)`

Use `expect.extend` to add custom matchers to Jest. When asserting numeric range conditions, define a `toBeWithinRange` matcher:

⠀toBeWithinRange.ts

```
import {expect} from '@jest/globals';import type {MatcherFunction} from 'expect';const toBeWithinRange: MatcherFunction<[floor: unknown, ceiling: unknown]> =  // `floor` and `ceiling` get types from the line above  // it is recommended to type them as `unknown` and to validate the values  function (actual, floor, ceiling) {    if (      typeof actual !== 'number' ||      typeof floor !== 'number' ||      typeof ceiling !== 'number'    ) {      throw new TypeError('These must be of type number!');    }    const pass = actual >= floor && actual <= ceiling;    if (pass) {      return {        message: () =>          // `this` context will have correct typings          `expected ${this.utils.printReceived(            actual,          )} not to be within range ${this.utils.printExpected(            `${floor} - ${ceiling}`,          )}`,        pass: true,      };    } else {      return {        message: () =>          `expected ${this.utils.printReceived(            actual,          )} to be within range ${this.utils.printExpected(            `${floor} - ${ceiling}`,          )}`,        pass: false,      };    }  };expect.extend({  toBeWithinRange,});declare module 'expect' {  interface AsymmetricMatchers {    toBeWithinRange(floor: number, ceiling: number): void;  }  interface Matchers<R> {    toBeWithinRange(floor: number, ceiling: number): R;  }}
```

__tests__/ranges.test.ts

```
import {expect, test} from '@jest/globals';import '../toBeWithinRange';test('is within range', () => expect(100).toBeWithinRange(90, 110));test('is NOT within range', () => expect(101).not.toBeWithinRange(0, 100));test('asymmetric ranges', () => {  expect({apples: 6, bananas: 3}).toEqual({    apples: expect.toBeWithinRange(1, 10),    bananas: expect.not.toBeWithinRange(11, 20),  });});
```

tip
Place the type declaration in a `.d.ts` or `.ts` file. Ensure it is included in the program and is a valid module.

tip
Enable the matcher for all tests by moving the `expect.extend` call to a [`setupFilesAfterEnv`](https://jestjs.io/docs/configuration#setupfilesafterenv-array) script:

```
import {expect} from '@jest/globals';
import {toBeWithinRange} from './toBeWithinRange';

expect.extend({
  toBeWithinRange,
});
```

#### Async Matchers

`expect.extend` supports async matchers. They return a Promise and must be awaited. Implement a matcher named `toBeDivisibleByExternalValue`. The divisor is fetched from a remote source.

```
expect.extend({  async toBeDivisibleByExternalValue(received) {    const externalValue = await getExternalValueFromRemoteSource();    const pass = received % externalValue === 0;    if (pass) {      return {        message: () =>          `expected ${received} not to be divisible by ${externalValue}`,        pass: true,      };    } else {      return {        message: () =>          `expected ${received} to be divisible by ${externalValue}`,        pass: false,      };    }  },});test('is divisible by external value', async () => {  await expect(100).toBeDivisibleByExternalValue();  await expect(101).not.toBeDivisibleByExternalValue();});
```

#### Custom Matchers API

Matchers should return an object (or a Promise of an object) with two keys. `pass` indicates whether there was a match or not, and `message` provides a function with no arguments that returns an error message in case of failure. Thus, when `pass` is false, `message` should return the error message for when `expect(x).yourMatcher()` fails. And when `pass` is true, `message` should return the error message for when `expect(x).not.yourMatcher()` fails.

Matchers are called with the argument passed to `expect(x)` followed by the arguments passed to `.yourMatcher(y, z)`:

```
expect.extend({  yourMatcher(x, y, z) {    return {      pass: true,      message: () => '',    };  },});
```

These helper functions and properties can be found on `this` inside a custom matcher:

#### `this.isNot`

A boolean indicating the matcher was called with the `.not` modifier. Use it to display an appropriate matcher hint.

#### `this.promise`

A string indicating whether the matcher was called with `.rejects`, `.resolves`, or no promise modifier.

⠀
#### `this.equals(a, b, customTesters?)`

This is a deep-equality function that will return `true` if two objects have the same values (recursively). It optionally takes a list of custom equality testers to apply to the deep equality checks (see `this.customTesters` below).

#### `this.expand`

A boolean to let you know this matcher was called with an `expand` option. When Jest is called with the `--expand` flag, `this.expand` can be used to determine if Jest is expected to show full diffs and errors.

#### `this.utils`

There are a number of helpful tools exposed on `this.utils` primarily consisting of the exports from [`jest-matcher-utils`](https://github.com/jestjs/jest/tree/main/packages/jest-matcher-utils).

The most useful ones are `matcherHint`, `printExpected` and `printReceived` to format the error messages nicely. For example, take a look at the implementation for the `toBe` matcher:

```
const {diff} = require('jest-diff');expect.extend({  toBe(received, expected) {    const options = {      comment: 'Object.is equality',      isNot: this.isNot,      promise: this.promise,    };    const pass = Object.is(received, expected);    const message = pass      ? () =>          // eslint-disable-next-line prefer-template          this.utils.matcherHint('toBe', undefined, undefined, options) +          '\n\n' +          `Expected: not ${this.utils.printExpected(expected)}\n` +          `Received: ${this.utils.printReceived(received)}`      : () => {          const diffString = diff(expected, received, {            expand: this.expand,          });          return (            // eslint-disable-next-line prefer-template            this.utils.matcherHint('toBe', undefined, undefined, options) +            '\n\n' +            (diffString && diffString.includes('- Expect')              ? `Difference:\n\n${diffString}`              : `Expected: ${this.utils.printExpected(expected)}\n` +                `Received: ${this.utils.printReceived(received)}`)          );        };    return {actual: received, message, pass};  },});
```

This will print something like this:

```
expect(received).toBe(expected)    Expected value to be (using Object.is):      "banana"    Received:      "apple"
```

When an assertion fails, provide thorough error messages for clarity. Craft precise failure messages for an improved experience.

#### `this.customTesters`

If your matcher does a deep equality check using `this.equals`, you may want to pass user-provided custom testers to `this.equals`. The custom equality testers the user has provided using the `addEqualityTesters` API are available on this property. The built-in Jest matchers pass `this.customTesters` (along with other built-in testers) to `this.equals` to do deep equality, and your custom matchers may want to do the same.
