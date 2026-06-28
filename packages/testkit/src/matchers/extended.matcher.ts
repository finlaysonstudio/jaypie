import type { MatcherResult } from "../types/jaypie-testkit";

//
//
// Types
//

// Minimal shape of the matcher context Vitest binds as `this`.
interface MatcherContext {
  equals: (a: unknown, b: unknown) => boolean;
  utils?: {
    printReceived?: (value: unknown) => string;
  };
}

//
//
// Helpers
//

const print = (context: MatcherContext, value: unknown): string =>
  context.utils?.printReceived
    ? context.utils.printReceived(value)
    : String(value);

// Mirrors jest-get-type's `getType(value) === "object"`: plain objects and
// class instances, but not arrays, null, RegExp, Map, Set, or Date.
const isObjectType = (value: unknown): boolean => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const constructor = (value as object).constructor;
  return (
    constructor !== RegExp &&
    constructor !== Map &&
    constructor !== Set &&
    constructor !== Date
  );
};

const isEmptyIterable = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  const iterator = (value as { [Symbol.iterator]?: unknown })[Symbol.iterator];
  if (typeof iterator !== "function") {
    return false;
  }
  return (value as Iterable<unknown>)[Symbol.iterator]().next().done === true;
};

//
//
// Matchers
//

export function toBeArray(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = Array.isArray(received);
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be an array`,
  };
}

export function toBeArrayOfSize(
  this: MatcherContext,
  received: unknown,
  size: number,
): MatcherResult {
  const pass = Array.isArray(received) && received.length === size;
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be an array of size ${size}`,
  };
}

export function toBeBoolean(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = typeof received === "boolean" || received instanceof Boolean;
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be a boolean`,
  };
}

export function toBeEmpty(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = this.equals({}, received) || isEmptyIterable(received);
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be empty`,
  };
}

export function toBeFalse(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = received === false;
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be false`,
  };
}

export function toBeFunction(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = typeof received === "function";
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be a function`,
  };
}

export function toBeNumber(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = typeof received === "number";
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be a number`,
  };
}

export function toBeObject(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = isObjectType(received);
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be an object`,
  };
}

export function toBeString(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = typeof received === "string" || received instanceof String;
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be a string`,
  };
}

export function toBeTrue(
  this: MatcherContext,
  received: unknown,
): MatcherResult {
  const pass = received === true;
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to be true`,
  };
}

export function toContainAllKeys(
  this: MatcherContext,
  received: unknown,
  keys: string[],
): MatcherResult {
  const objectKeys =
    received === null || typeof received !== "object"
      ? []
      : Object.keys(received as object);
  const pass =
    objectKeys.length === keys.length &&
    keys.every((key) => objectKeys.includes(key));
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to contain all keys ${print(this, keys)}`,
  };
}

export function toContainKeys(
  this: MatcherContext,
  received: unknown,
  keys: string[],
): MatcherResult {
  const pass = keys.every(
    (key) =>
      received !== null &&
      received !== undefined &&
      Object.prototype.hasOwnProperty.call(received, key),
  );
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to contain keys ${print(this, keys)}`,
  };
}

export function toEndWith(
  this: MatcherContext,
  received: unknown,
  suffix: string,
): MatcherResult {
  const pass = typeof received === "string" && received.endsWith(suffix);
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to end with ${print(this, suffix)}`,
  };
}

export function toInclude(
  this: MatcherContext,
  received: unknown,
  substring: unknown,
): MatcherResult {
  const pass =
    received !== null &&
    received !== undefined &&
    typeof (received as { includes?: unknown }).includes === "function" &&
    (received as { includes: (value: unknown) => boolean }).includes(substring);
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to include ${print(this, substring)}`,
  };
}

export function toStartWith(
  this: MatcherContext,
  received: unknown,
  prefix: string,
): MatcherResult {
  const pass = typeof received === "string" && received.startsWith(prefix);
  return {
    pass,
    message: () =>
      `expected ${print(this, received)} ${pass ? "not " : ""}to start with ${print(this, prefix)}`,
  };
}
