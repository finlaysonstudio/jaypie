import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

import { constructParameterName } from "../constructParameterName";

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  process.env.PROJECT_ENV = "sandbox";
  process.env.PROJECT_KEY = "myapp";
  process.env.PROJECT_NONCE = "a1b2";
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("constructParameterName", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(constructParameterName).toBeFunction();
    });
    it("Works", () => {
      const stack = new Stack(undefined, "TestStack");
      expect(constructParameterName(stack)).toBeString();
    });
  });

  describe("Happy Paths", () => {
    it("Scopes by env, key, and nonce", () => {
      const stack = new Stack(undefined, "TestStack");
      const scope = new Construct(stack, "Api");
      expect(constructParameterName(scope)).toBe("/sandbox/myapp/a1b2/Api");
    });
    it("Appends the name when provided", () => {
      const stack = new Stack(undefined, "TestStack");
      const scope = new Construct(stack, "Api");
      expect(constructParameterName(scope, { name: "variables" })).toBe(
        "/sandbox/myapp/a1b2/Api/variables",
      );
    });
    it("Accepts explicit overrides", () => {
      const stack = new Stack(undefined, "TestStack");
      const scope = new Construct(stack, "Api");
      expect(
        constructParameterName(scope, {
          env: "production",
          key: "other",
          nonce: "z9",
        }),
      ).toBe("/production/other/z9/Api");
    });
  });

  describe("Features", () => {
    it("Uses the path within the stack so nested ids do not collide", () => {
      const stack = new Stack(undefined, "TestStack");
      const first = new Construct(new Construct(stack, "Worker"), "Function");
      const second = new Construct(new Construct(stack, "Mailer"), "Function");
      expect(constructParameterName(first)).toBe(
        "/sandbox/myapp/a1b2/Worker/Function",
      );
      expect(constructParameterName(second)).toBe(
        "/sandbox/myapp/a1b2/Mailer/Function",
      );
    });
    it("Excludes the stack from the path", () => {
      const stack = new Stack(undefined, "TestStack");
      const scope = new Construct(stack, "Api");
      expect(constructParameterName(scope)).not.toContain("TestStack");
    });
    it("Replaces characters SSM does not allow", () => {
      const stack = new Stack(undefined, "TestStack");
      const scope = new Construct(stack, "Api Gateway");
      expect(constructParameterName(scope)).toBe(
        "/sandbox/myapp/a1b2/Api-Gateway",
      );
    });
    it("Falls back to convention defaults", () => {
      delete process.env.PROJECT_ENV;
      delete process.env.PROJECT_KEY;
      delete process.env.PROJECT_NONCE;
      const stack = new Stack(undefined, "TestStack");
      const scope = new Construct(stack, "Api");
      expect(constructParameterName(scope)).toBe("/build/project/cfe2/Api");
    });
    it("Uses the construct id when the scope is the stack", () => {
      const stack = new Stack(undefined, "TestStack");
      expect(constructParameterName(stack)).toBe(
        "/sandbox/myapp/a1b2/TestStack",
      );
    });
  });
});
