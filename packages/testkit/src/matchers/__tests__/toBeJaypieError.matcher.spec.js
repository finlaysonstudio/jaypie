// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@jaypie/core";

// Subject
import toBeJaypieError from "../toBeJaypieError.matcher.js";

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("To Be Jaypie Error Matcher", () => {
  it("Is a function", () => {
    expect(toBeJaypieError).toBeFunction();
  });
  describe("Error Conditions", () => {
    it("Rejects instances of plain error objects", () => {
      const error = new Error(
        "If this is your first night at Fight Club, you have to fight",
      );
      const result = toBeJaypieError(error);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if nothing passed", () => {
      const result = toBeJaypieError();
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if non-object passed", () => {
      const result = toBeJaypieError(12);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if no errors array", () => {
      const result = toBeJaypieError({});
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if errors array is empty", () => {
      const result = toBeJaypieError({ errors: [] });
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Must match the entire json:api error schema", () => {
      const result = toBeJaypieError({ errors: ["taco"] });
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
  });
  describe("Happy Path", () => {
    it("Matches instances of Jaypie error objects", () => {
      const error = new ConfigurationError();
      const result = toBeJaypieError(error);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeTrue();
    });
    it("Matches plain old json errors", () => {
      const error = new ConfigurationError(
        "If this is your first night at Fight Club, you have to fight",
      ).json();
      const result = toBeJaypieError(error);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeTrue();
    });
  });
});
