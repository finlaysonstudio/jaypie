// Consumer-perspective typecheck fixture.
//
// Only the PUBLISHED types of @jaypie/testkit are in scope here: this
// directory sits outside the package tsconfig `include`, so src/types/*.d.ts
// cannot leak in and mask a missing augmentation in dist.
//
// Every statement below must typecheck. See publishedTypes.spec.ts.

import { matchers } from "@jaypie/testkit";
import { expect } from "vitest";

expect.extend(matchers);

class Example {}

// Absorbed extended matchers
expect(Example).toBeFunction();
expect([1]).toBeArray();
expect([1]).toBeArrayOfSize(1);
expect({}).toBeObject();
expect("jaypie").toBeString();
expect("jaypie").toStartWith("jay");
expect("jaypie").toEndWith("pie");

// Custom Jaypie matchers
expect(Example).toBeClass();
expect(() => {
  throw new Error("nope");
}).toThrowJaypieError();
expect("00000000-0000-4000-8000-000000000000").toMatchUuid4();

// Negated form
expect("jaypie").not.toBeArray();

// Asymmetric forms
expect({ a: "x" }).toEqual({ a: expect.toBeString() });
expect({ a: 1 }).toEqual({ a: expect.not.toBeString() });
