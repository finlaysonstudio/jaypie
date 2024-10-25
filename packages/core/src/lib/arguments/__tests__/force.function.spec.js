import { describe, expect, it } from "vitest";

import force from "../force.function.js";

//
//
// Run tests
//

describe("Force function", () => {
  describe("Arrays", () => {
    it("Forces arrays", () => {
      const response = force("taco", Array);
      expect(response).toBeArray();
      expect(response).toIncludeSameMembers(["taco"]);
    });
    it("Returns arrays untouched", () => {
      const tacos = ["beef", "chicken"];
      const response = force(tacos, Array);
      expect(response).toBeArray();
      expect(response).toBe(tacos);
    });
  });
  describe("Boolean", () => {
    it("Forces true", () => {
      const response = force("true", Boolean);
      expect(response).toBeTrue();
    });
    it("Forces false", () => {
      const response = force("false", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces f", () => {
      const response = force("f", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces no", () => {
      const response = force("false", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces n", () => {
      const response = force("f", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces TRUE", () => {
      const response = force("TRUE", Boolean);
      expect(response).toBeTrue();
    });
    it("Forces FALSE", () => {
      const response = force("FALSE", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces TRue", () => {
      const response = force("TRue", Boolean);
      expect(response).toBeTrue();
    });
    it("Forces FaLSe", () => {
      const response = force("FaLSe", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces 1", () => {
      const response = force(1, Boolean);
      expect(response).toBeTrue();
    });
    it("Forces 0", () => {
      const response = force(0, Boolean);
      expect(response).toBeFalse();
    });
    it("Forces '1'", () => {
      const response = force("1", Boolean);
      expect(response).toBeTrue();
    });
    it("Forces '0'", () => {
      const response = force("0", Boolean);
      expect(response).toBeFalse();
    });
    it("Forces 'anything'", () => {
      const response = force("anything", Boolean);
      expect(response).toBeTrue();
    });
    it("Forces ''", () => {
      const response = force("", Boolean);
      expect(response).toBeFalse();
    });
    it("Returns booleans untouched", () => {
      const response = force(true, Boolean);
      expect(response).toBeTrue();
    });
  });
  describe("Numbers", () => {
    it("Forces numbers", () => {
      const response = force("12", Number);
      expect(response).toBeNumber();
      expect(response).toBe(12);
    });
    it("Returns numbers untouched", () => {
      const response = force(12, Number);
      expect(response).toBeNumber();
      expect(response).toBe(12);
    });
    it("Forces NaN to zero", () => {
      const response = force("mayhem", Number);
      expect(response).toBeNumber();
      expect(response).toBe(0);
    });
    it("Allows NaN optionally", () => {
      const response = force("mayhem", Number, { nan: true });
      expect(response).toBeNaN();
    });
    it("Forces negatives", () => {
      const response = force("-12", Number);
      expect(response).toBeNumber();
      expect(response).toBe(-12);
    });
    it("Forces decimals", () => {
      const response = force("12.5", Number);
      expect(response).toBeNumber();
      expect(response).toBe(12.5);
    });
    it("Allows minimums", () => {
      const response = force("-12.5", Number, { minimum: 12 });
      expect(response).toBeNumber();
      expect(response).toBe(12);
    });
    it("Allows maximums", () => {
      const response = force("12.5", Number, { maximum: 0 });
      expect(response).toBeNumber();
      expect(response).toBe(0);
    });
    it("Ignores both in conflict", () => {
      const response = force("12.5", Number, { maximum: 0, minimum: 12 });
      expect(response).toBeNumber();
      expect(response).toBe(12.5);
    });
  });
  describe("Objects", () => {
    it("Forces objects", () => {
      const response = force("taco", Object);
      expect(response).toBeObject();
      expect(response).toEqual({ value: "taco" });
    });
    it("Forces objects with a key", () => {
      const response = force("taco", Object, "food");
      expect(response).toBeObject();
      expect(response).toEqual({ food: "taco" });
    });
    it("Returns objects untouched", () => {
      const taco = { type: "beef" };
      const response = force(taco, Object);
      expect(response).toBeObject();
      expect(response).toBe(taco);
    });
    it("Parses JSON", () => {
      const response = force("{\"taco\":\"beef\"}", Object);
      expect(response).toBeObject();
      expect(response).toEqual({ taco: "beef" });
    });
  });
  describe("Strings", () => {
    it("Converts null to 'null'", () => {
      const response = force(null, String);
      expect(response).toBeString();
    });
    it("Converts objects to JSON", () => {
      const response = force({ taco: "beef" }, String);
      expect(response).toBeString();
      expect(response).toBe("{\"taco\":\"beef\"}");
    });
    it("Runs everything else through toString()", () => {
      const response = force(42, String);
      expect(response).toBeString();
      expect(response).toBe("42");
    });
    it("Converts undefined to empty string (because this is the default)", () => {
      const response = force(undefined, String);
      expect(response).toBeString();
      expect(response).toBe("");
    });
    it("Converts undefined to default when passed", () => {
      const response = force(undefined, String, 42);
      expect(response).toBeString();
      expect(response).toBe("42");
    });
    it("Returns strings untouched", () => {
      const response = force("taco", String);
      expect(response).toBeString();
      expect(response).toBe("taco");
    });
  });

  describe("Convenience Functions", () => {
    it("Forces arrays", () => {
      expect(force.array).toBeFunction();
      expect(force.array("taco")).toBeArray();
    });
    it("Forces boolean", () => {
      expect(force.boolean).toBeFunction();
      expect(force.boolean("true")).toBeTrue();
    });
    it("Forces numbers", () => {
      expect(force.number).toBeFunction();
      expect(force.number("12")).toBeNumber();
    });
    it("Forces positive", () => {
      expect(force.positive).toBeFunction();
      expect(force.positive("-1")).toBe(0);
      expect(force.positive("taco")).toBe(0);
    });
    it("Forces objects", () => {
      expect(force.object).toBeFunction();
      expect(force.object("taco")).toBeObject();
    });
    it("Forces strings", () => {
      expect(force.string).toBeFunction();
      expect(force.string(42)).toBeString();
      expect(force.string()).toBeString();
      expect(force.string(undefined, "taco")).toBe("taco");
    });
  });
});
