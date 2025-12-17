import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { resolveEnvironment } from "../resolveEnvironment";

describe("resolveEnvironment", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set up some test environment variables
    process.env.TEST_VAR_1 = "value1";
    process.env.TEST_VAR_2 = "value2";
    process.env.AUTH0_DOMAIN = "my-domain.auth0.com";
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(resolveEnvironment).toBeTypeOf("function");
    });

    it("returns empty object when undefined", () => {
      const result = resolveEnvironment(undefined);
      expect(result).toEqual({});
    });
  });

  describe("Happy Paths", () => {
    describe("Legacy object syntax", () => {
      it("returns object as-is", () => {
        const input = { FOO: "bar", BAZ: "qux" };
        const result = resolveEnvironment(input);
        expect(result).toEqual(input);
      });

      it("handles empty object", () => {
        const result = resolveEnvironment({});
        expect(result).toEqual({});
      });
    });

    describe("Array syntax with strings", () => {
      it("looks up single string in process.env", () => {
        const result = resolveEnvironment(["TEST_VAR_1"]);
        expect(result).toEqual({ TEST_VAR_1: "value1" });
      });

      it("looks up multiple strings in process.env", () => {
        const result = resolveEnvironment(["TEST_VAR_1", "TEST_VAR_2"]);
        expect(result).toEqual({
          TEST_VAR_1: "value1",
          TEST_VAR_2: "value2",
        });
      });

      it("skips strings not found in process.env", () => {
        const result = resolveEnvironment([
          "TEST_VAR_1",
          "NONEXISTENT_VAR",
          "TEST_VAR_2",
        ]);
        expect(result).toEqual({
          TEST_VAR_1: "value1",
          TEST_VAR_2: "value2",
        });
      });

      it("returns empty object when no strings are found", () => {
        const result = resolveEnvironment(["NONEXISTENT_VAR"]);
        expect(result).toEqual({});
      });
    });

    describe("Array syntax with objects", () => {
      it("merges single object", () => {
        const result = resolveEnvironment([{ FOO: "bar" }]);
        expect(result).toEqual({ FOO: "bar" });
      });

      it("merges multiple objects", () => {
        const result = resolveEnvironment([
          { FOO: "bar" },
          { BAZ: "qux", ANOTHER: "value" },
        ]);
        expect(result).toEqual({
          FOO: "bar",
          BAZ: "qux",
          ANOTHER: "value",
        });
      });

      it("later objects override earlier ones", () => {
        const result = resolveEnvironment([
          { FOO: "first" },
          { FOO: "second" },
        ]);
        expect(result).toEqual({ FOO: "second" });
      });
    });

    describe("Mixed array syntax", () => {
      it("handles strings and objects together", () => {
        const result = resolveEnvironment([
          "TEST_VAR_1",
          { FOO: "bar" },
          "TEST_VAR_2",
        ]);
        expect(result).toEqual({
          TEST_VAR_1: "value1",
          FOO: "bar",
          TEST_VAR_2: "value2",
        });
      });

      it("objects can override env lookups", () => {
        const result = resolveEnvironment([
          "TEST_VAR_1",
          { TEST_VAR_1: "overridden" },
        ]);
        expect(result).toEqual({ TEST_VAR_1: "overridden" });
      });

      it("env lookups can override objects (order matters)", () => {
        process.env.FOO = "from_env";
        const result = resolveEnvironment([{ FOO: "from_object" }, "FOO"]);
        expect(result).toEqual({ FOO: "from_env" });
      });
    });
  });

  describe("Features", () => {
    it("uses custom env parameter", () => {
      const customEnv = {
        CUSTOM_VAR: "custom_value",
      };
      const result = resolveEnvironment(["CUSTOM_VAR"], customEnv);
      expect(result).toEqual({ CUSTOM_VAR: "custom_value" });
    });

    it("handles empty array", () => {
      const result = resolveEnvironment([]);
      expect(result).toEqual({});
    });
  });

  describe("Specific Scenarios", () => {
    it("handles the user's example use case", () => {
      // Setup
      process.env.AUTH0_ISSUER_BASE_URL = "https://issuer.example.com";
      process.env.AUTH0_DOMAIN = "domain.auth0.com";
      process.env.AUTH0_CLIENT_ID = "client123";
      process.env.AUTH0_AUDIENCE = "https://api.example.com";

      const result = resolveEnvironment([
        "AUTH0_ISSUER_BASE_URL",
        "AUTH0_DOMAIN",
        "AUTH0_CLIENT_ID",
        "AUTH0_AUDIENCE",
        { foo: "bar" },
        { ANOTHER_KEY: "ANOTHER_VALUE", YET_ANOTHER_KEY: "YET_ANOTHER_VALUE" },
      ]);

      expect(result).toEqual({
        AUTH0_ISSUER_BASE_URL: "https://issuer.example.com",
        AUTH0_DOMAIN: "domain.auth0.com",
        AUTH0_CLIENT_ID: "client123",
        AUTH0_AUDIENCE: "https://api.example.com",
        foo: "bar",
        ANOTHER_KEY: "ANOTHER_VALUE",
        YET_ANOTHER_KEY: "YET_ANOTHER_VALUE",
      });
    });
  });
});
