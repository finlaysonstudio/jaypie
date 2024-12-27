import { describe, expect, it } from "vitest";
import {
  BadRequestError,
  ConfigurationError,
  InternalError,
  ProjectError
} from "@jaypie/core";

// Subject
import toThrowJaypieError, {
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowInternalError
} from "../matchers/toThrowJaypieError.matcher";

describe("toThrowJaypieError Matcher", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("Is a Function", () => {
      expect(toThrowJaypieError).toBeFunction();
    });

    it("Works", async () => {
      const result = await toThrowJaypieError(() => {
        throw new InternalError();
      });
      expect(result.pass).toBe(true);
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("Fails when no error is thrown", async () => {
      const result = await toThrowJaypieError(() => {});
      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        "Expected function to throw a JaypieError, but it did not throw."
      );
    });

    it("Fails when non-Jaypie error is thrown", async () => {
      const result = await toThrowJaypieError(() => {
        throw new Error("Regular error");
      });
      expect(result.pass).toBe(false);
      expect(result.message()).toInclude("Expected function to throw a JaypieError");
    });

    it("Fails when wrong type of Jaypie error is thrown", async () => {
      const result = await toThrowJaypieError(() => {
        throw new BadRequestError();
      }, ConfigurationError);
      expect(result.pass).toBe(false);
      expect(result.message()).toInclude("Expected function to throw \"CONFIGURATION_ERROR\"");
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("Matches error thrown with constructor", async () => {
      const result = await toThrowJaypieError(() => {
        throw new BadRequestError();
      }, BadRequestError);
      expect(result.pass).toBe(true);
    });

    it("Matches error thrown with instance", async () => {
      const error = new BadRequestError();
      const result = await toThrowJaypieError(() => {
        throw new BadRequestError();
      }, error);
      expect(result.pass).toBe(true);
    });

    it("Matches error thrown with function", async () => {
      const errorFn = () => new BadRequestError();
      const result = await toThrowJaypieError(() => {
        throw new BadRequestError();
      }, errorFn);
      expect(result.pass).toBe(true);
    });
  });

  // Features
  describe("Features", () => {
    it("Handles async functions", async () => {
      const result = await toThrowJaypieError(async () => {
        throw new InternalError();
      });
      expect(result.pass).toBe(true);
    });

    it("Handles promises", async () => {
      const result = await toThrowJaypieError(() => 
        Promise.reject(new InternalError())
      );
      expect(result.pass).toBe(true);
    });
  });

  // Convenience Methods
  describe("Convenience Methods", () => {
    it("toThrowBadRequestError works", async () => {
      const result = await toThrowBadRequestError(() => {
        throw new BadRequestError();
      });
      expect(result.pass).toBe(true);
    });

    it("toThrowConfigurationError works", async () => {
      const result = await toThrowConfigurationError(() => {
        throw new ConfigurationError();
      });
      expect(result.pass).toBe(true);
    });

    it("toThrowInternalError works", async () => {
      const result = await toThrowInternalError(() => {
        throw new InternalError();
      });
      expect(result.pass).toBe(true);
    });
  });
}); 