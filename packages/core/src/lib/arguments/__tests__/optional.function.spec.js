import { matchers as jaypieMatchers } from "@jaypie/testkit";
import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import optional from "../optional.function.js";

expect.extend(jaypieMatchers);

//
//
// Mock modules
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Optional Function", () => {
  it("Works", async () => {
    const response = await optional(undefined, Number);
    expect(response).not.toBeUndefined();
    expect(response).toBeBoolean();
    expect(response).toBeTrue();
  });
  describe("Features", () => {
    it("Always passes undefined", () => {
      expect(optional(undefined)).toBeTrue();
      expect(optional(undefined, Array)).toBeTrue();
      expect(optional(undefined, Boolean)).toBeTrue();
      expect(optional(undefined, Number)).toBeTrue();
      expect(optional(undefined, Object)).toBeTrue();
      expect(optional(undefined, String)).toBeTrue();
    });
    describe("Obvious success cases", () => {
      it("Passes arrays", () => {
        const response = optional.array([]);
        expect(response).toBeTrue();
      });
      it("Passes booleans", () => {
        const response = optional.boolean(true);
        expect(response).toBeTrue();
      });
      it("Passes numbers", () => {
        const response = optional.number(12);
        expect(response).toBeTrue();
      });
      it("Passes negative", () => {
        const response = optional.number(-12);
        expect(response).toBeTrue();
      });
      it("Passes positive", () => {
        const response = optional.positive(12);
        expect(response).toBeTrue();
      });
      it("Passes objects", () => {
        const response = optional.object({});
        expect(response).toBeTrue();
      });
      it("Passes strings", () => {
        const response = optional.string("taco");
        expect(response).toBeTrue();
      });
    });
    describe("Obvious fail cases", () => {
      it("Fails non-arrays", () => {
        expect(() => optional.array(null)).toThrowJaypieError();
      });
      it("Fails non-booleans", () => {
        expect(() => optional.boolean(null)).toThrowJaypieError();
      });
      it("Fails non-numbers", () => {
        expect(() => optional.number(null)).toThrowJaypieError();
      });
      it("Fails non-objects", () => {
        expect(() => optional.object(null)).toThrowJaypieError();
      });
      it("Fails non-strings", () => {
        expect(() => optional.string(null)).toThrowJaypieError();
      });
    });
  });
});
