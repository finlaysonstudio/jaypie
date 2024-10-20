import { matchers as jaypieMatchers } from "@jaypie/testkit";
import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import required from "../required.function.js";

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

describe("Required Function", () => {
  it("Works", async () => {
    const response = await required(12, Number);
    expect(response).not.toBeUndefined();
  });
  describe("Features", () => {
    describe("Obvious success cases", () => {
      it("Passes arrays", () => {
        const response = required.array([]);
        expect(response).toBeTrue();
      });
      it("Passes booleans", () => {
        const response = required.boolean(true);
        expect(response).toBeTrue();
      });
      it("Passes numbers", () => {
        const response = required.number(12);
        expect(response).toBeTrue();
      });
      it("Passes negative", () => {
        const response = required.number(-12);
        expect(response).toBeTrue();
      });
      it("Passes positive", () => {
        const response = required.positive(12);
        expect(response).toBeTrue();
      });
      it("Passes objects", () => {
        const response = required.object({});
        expect(response).toBeTrue();
      });
      it("Passes strings", () => {
        const response = required.string("taco");
        expect(response).toBeTrue();
      });
    });
    describe("Obvious fail cases", () => {
      it("Fails non-arrays", () => {
        expect(() => required.array(null)).toThrowJaypieError();
      });
      it("Fails non-booleans", () => {
        expect(() => required.boolean(null)).toThrowJaypieError();
      });
      it("Fails non-numbers", () => {
        expect(() => required.number(null)).toThrowJaypieError();
      });
      it("Fails non-positives", () => {
        expect(() => required.positive(-1)).toThrowJaypieError();
      });
      it("Fails non-objects", () => {
        expect(() => required.object(null)).toThrowJaypieError();
      });
      it("Fails non-strings", () => {
        expect(() => required.string(null)).toThrowJaypieError();
      });
    });
    describe("Tricky fail cases", () => {
      // False fails
      it("Fails on false", () => {
        expect(() => required.boolean(false)).toThrowJaypieError();
      });
      // NaN fails
      it("Fails on NaN", () => {
        expect(() => required.number(NaN)).toThrowJaypieError();
      });
      // null fails
      it("Fails on null", () => {
        expect(() => required.number(null)).toThrowJaypieError();
      });
      // Zero fails (then you want to validate it is a number)
      it("Fails on zero", () => {
        expect(() => required.number(0)).toThrowJaypieError();
      });
      // Empty string fails
      it("Fails on empty string", () => {
        expect(() => required.string("")).toThrowJaypieError();
      });
      // Positive fails zero
      it("Fails non-positives", () => {
        expect(() => required.positive(0)).toThrowJaypieError();
      });
    });
  });
});
