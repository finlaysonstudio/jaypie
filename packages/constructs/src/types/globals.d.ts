import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toBeArray(): T;
    toBeArrayOfSize(size: number): T;
    toBeBoolean(): T;
    toBeEmpty(): T;
    toBeFalse(): T;
    toBeFunction(): T;
    toBeNumber(): T;
    toBeObject(): T;
    toBeString(): T;
    toBeTrue(): T;
    toContainAllKeys(keys: string[]): T;
    toContainKeys(keys: string[]): T;
    toEndWith(suffix: string): T;
    toInclude(substring: unknown): T;
    toStartWith(prefix: string): T;
  }
}
