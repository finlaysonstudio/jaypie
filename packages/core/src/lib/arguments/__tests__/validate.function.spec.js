import { describe, expect, it } from "vitest";

import HTTP from "../../http.lib.js";
import { TYPE } from "../constants.js";
import validate from "../validate.function.js";

//
//
// Mock constants
//

const TEST = {
  CLASS: class {},
  FUNCTION: () => true,
};

//
//
// Run tests
//

describe("Validate function", () => {
  it("Works", () => {
    const value = "hello";
    const response = validate(value);
    expect(response).toBeTrue();
  });

  describe("Return true", () => {
    it("Checks array", () => {
      const value = ["hello"];
      const response = validate(value, { type: Array });
      expect(response).toBeTrue();
    });
    it("Checks boolean", () => {
      const value = true;
      const response = validate(value, { type: Boolean });
      expect(response).toBeTrue();
    });
    it("Checks class", () => {
      const response = validate(TEST.CLASS, { type: TYPE.CLASS });
      expect(response).toBeTrue();
    });
    it("Checks function", () => {
      const response = validate(TEST.FUNCTION, { type: Function });
      expect(response).toBeTrue();
    });
    it("Checks number", () => {
      const value = 12;
      const response = validate(value, { type: Number });
      expect(response).toBeTrue();
    });
    it("Checks null", () => {
      const value = null;
      const response = validate(value, { type: null });
      expect(response).toBeTrue();
    });
    it("Checks object", () => {
      const value = {};
      const response = validate(value, { type: Object });
      expect(response).toBeTrue();
    });
    it("Checks string", () => {
      const value = "hello";
      const response = validate(value, { type: String });
      expect(response).toBeTrue();
    });
    it("Checks undefined", () => {
      const response = validate(undefined, { type: TYPE.UNDEFINED });
      expect(response).toBeTrue();
    });
  });
  describe("Exclude cases", () => {
    it("Check class excludes function", () => {
      const response = validate(TEST.FUNCTION, {
        type: TYPE.CLASS,
        throws: false,
      });
      expect(response).toBe(false);
    });
    it("Check function excludes class", () => {
      const response = validate(TEST.CLASS, { type: Function, throws: false });
      expect(response).toBe(false);
    });
    it("Check number excludes strings of numbers", () => {
      const value = "12";
      const response = validate(value, { type: Number, throws: false });
      expect(response).toBe(false);
    });
    it("Check object excludes array", () => {
      const value = [];
      const response = validate(value, { type: Object, throws: false });
      expect(response).toBe(false);
    });
    it("Check object excludes null", () => {
      const value = null;
      const response = validate(value, { type: Object, throws: false });
      expect(response).toBe(false);
    });
  });
  describe("Return false", () => {
    it("Checks array", () => {
      const response = validate(undefined, { type: Array, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks class", () => {
      const response = validate(undefined, { type: TYPE.CLASS, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks function", () => {
      const response = validate(undefined, { type: Function, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks number", () => {
      const response = validate(undefined, { type: Number, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks null", () => {
      const response = validate(undefined, { type: null, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks object", () => {
      const response = validate(undefined, { type: Object, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks string", () => {
      const response = validate(undefined, { type: String, throws: false });
      expect(response).toBeFalse();
    });
    it("Checks undefined", () => {
      const response = validate(null, { type: TYPE.UNDEFINED, throws: false });
      expect(response).toBeFalse();
    });
  });
  describe("Additional features", () => {
    it("Throws errors by default", () => {
      try {
        validate(null);
      } catch (error) {
        expect(error.isProjectError).toBeTrue();
        expect(error.status).toBe(HTTP.CODE.BAD_REQUEST);
      }
    });
    it("Accepts when not required", () => {
      const response = validate(undefined, { type: String, required: false });
      expect(response).toBeTrue();
    });
    describe("Validating booleans", () => {
      it("Boolean true => true", () => {
        const value = true;
        const response = validate(value, { type: Boolean });
        expect(response).toBeTrue();
      });
      it("Boolean false => true", () => {
        const value = false;
        const response = validate(value, { type: Boolean });
        expect(response).toBeTrue();
      });
      it("String 'true' => false", () => {
        const value = "true";
        const response = validate(value, { type: Boolean, throws: false });
        expect(response).toBeFalse();
      });
      it("False => false", () => {
        const response = validate(null, { type: Boolean, throws: false });
        expect(response).toBeFalse();
      });
      it("Truthy => false", () => {
        const response = validate(1, { type: Boolean, throws: false });
        expect(response).toBeFalse();
      });
    });
    describe("Falsy cases", () => {
      describe("Number", () => {
        it("Rejects falsy", () => {
          const value = 0;
          const response = validate(value, {
            falsy: false,
            type: Number,
            throws: false,
          });
          expect(response).toBeFalse();
        });
        it("Allows falsy by default", () => {
          const value = 0;
          const response = validate(value, { type: Number });
          expect(response).toBeTrue();
        });
      });
      describe("String", () => {
        it("Rejects falsy by param", () => {
          const value = "";
          const response = validate(value, {
            falsy: false,
            type: String,
            throws: false,
          });
          expect(response).toBeFalse();
        });
        it("Allows falsy by default", () => {
          const value = "";
          const response = validate(value, { type: String });
          expect(response).toBeTrue();
        });
      });
    });
    describe("Number", () => {
      it("Rejects NaN", () => {
        const value = NaN;
        const response = validate(value, {
          type: Number,
          throws: false,
        });
        expect(response).toBeFalse();
      });
    });
  });
  describe("Error cases", () => {
    it("Throws if type is bogus", () => {
      try {
        validate(null, { type: "tacos" });
      } catch (error) {
        expect(error.isProjectError).toBeTrue();
        expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
      }
      expect.assertions(2);
    });
  });
  describe("Convenience Functions", () => {
    it("Provides expected functions", () => {
      expect(validate.array).toBeFunction();
      expect(validate.boolean).toBeFunction();
      expect(validate.class).toBeFunction();
      expect(validate.function).toBeFunction();
      expect(validate.null).toBeFunction();
      expect(validate.number).toBeFunction();
      expect(validate.object).toBeFunction();
      expect(validate.string).toBeFunction();
      expect(validate.undefined).toBeFunction();
    });
    it("Validates arrays", () => {
      const value = ["hello"];
      const response = validate.array(value);
      expect(response).toBeTrue();
      expect(() => validate.array(12)).toThrow();
    });
    it("Validates booleans", () => {
      const response = validate.boolean(true);
      expect(response).toBeTrue();
      expect(() => validate.boolean(12)).toThrow();
    });
    it("Validates classes", () => {
      const response = validate.class(TEST.CLASS);
      expect(response).toBeTrue();
      expect(() => validate.class(12)).toThrow();
    });
    it("Validates functions", () => {
      const response = validate.function(TEST.FUNCTION);
      expect(response).toBeTrue();
      expect(() => validate.function(12)).toThrow();
    });
    it("Validates null", () => {
      const response = validate.null(null);
      expect(response).toBeTrue();
      expect(() => validate.null(12)).toThrow();
    });
    it("Validates numbers", () => {
      const response = validate.number(12);
      expect(response).toBeTrue();
      expect(() => validate.number("12")).toThrow();
    });
    it("Validates objects", () => {
      const response = validate.object({});
      expect(response).toBeTrue();
      expect(() => validate.object(12)).toThrow();
    });
    it("Validates strings", () => {
      const response = validate.string("hello");
      expect(response).toBeTrue();
      expect(() => validate.string(12)).toThrow();
    });
    it("Validates undefined", () => {
      const response = validate.undefined(undefined);
      expect(response).toBeTrue();
      expect(() => validate.undefined(12)).toThrow();
    });
    it("Provides optional variants", () => {
      expect(validate.optional.array).toBeFunction();
      expect(validate.optional.boolean).toBeFunction();
      expect(validate.optional.class).toBeFunction();
      expect(validate.optional.function).toBeFunction();
      expect(validate.optional.null).toBeFunction();
      expect(validate.optional.number).toBeFunction();
      expect(validate.optional.object).toBeFunction();
      expect(validate.optional.string).toBeFunction();
      expect(validate.optional.undefined).toBeUndefined();
    });
    it("Validates optional arrays", () => {
      const response = validate.optional.array(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.array(12)).toThrow();
    });
    it("Validates optional booleans", () => {
      const response = validate.optional.boolean(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.boolean(12)).toThrow();
    });
    it("Validates optional classes", () => {
      const response = validate.optional.class(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.class(12)).toThrow();
    });
    it("Validates optional functions", () => {
      const response = validate.optional.function(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.function(12)).toThrow();
    });
    it("Validates optional null", () => {
      const response = validate.optional.null(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.null(12)).toThrow();
    });
    it("Validates optional numbers", () => {
      const response = validate.optional.number(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.number("12")).toThrow();
    });
    it("Validates optional objects", () => {
      const response = validate.optional.object(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.object(12)).toThrow();
    });
    it("Validates optional strings", () => {
      const response = validate.optional.string(undefined);
      expect(response).toBeTrue();
      expect(() => validate.optional.string(12)).toThrow();
    });
  });
});
