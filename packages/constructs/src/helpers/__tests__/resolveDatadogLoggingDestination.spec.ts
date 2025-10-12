import * as cdk from "aws-cdk-lib";
import * as logDestinations from "aws-cdk-lib/aws-logs-destinations";
import { describe, expect, it } from "vitest";
import { resolveDatadogLoggingDestination } from "../resolveDatadogLoggingDestination.js";

describe("resolveDatadogLoggingDestination", () => {
  describe("Base Cases", () => {
    it("should return a logging destination with default values when no options provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result = resolveDatadogLoggingDestination(stack);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(logDestinations.LambdaDestination);
    });

    it("should return a logging destination when called with empty options object", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result = resolveDatadogLoggingDestination(stack, {});

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(logDestinations.LambdaDestination);
    });
  });

  describe("Happy Paths", () => {
    it("should use custom name when provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const customName = "CustomDatadogForwarder";

      const result = resolveDatadogLoggingDestination(stack, {
        name: customName,
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(logDestinations.LambdaDestination);
      // Verify the underlying function was created with the custom name
      const node = stack.node.tryFindChild(customName);
      expect(node).toBeDefined();
    });

    it("should use custom import value when provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const customImport = "custom-import-value";

      const result = resolveDatadogLoggingDestination(stack, {
        import: customImport,
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(logDestinations.LambdaDestination);
    });

    it("should use both custom name and import when provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const customName = "CustomForwarder";
      const customImport = "custom-import";

      const result = resolveDatadogLoggingDestination(stack, {
        import: customImport,
        name: customName,
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(logDestinations.LambdaDestination);
      const node = stack.node.tryFindChild(customName);
      expect(node).toBeDefined();
    });
  });

  describe("Specific Scenarios", () => {
    it("should create unique destinations for different names in the same stack", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result1 = resolveDatadogLoggingDestination(stack, {
        name: "Destination1",
      });
      const result2 = resolveDatadogLoggingDestination(stack, {
        name: "Destination2",
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1).not.toBe(result2);
      expect(stack.node.tryFindChild("Destination1")).toBeDefined();
      expect(stack.node.tryFindChild("Destination2")).toBeDefined();
    });

    it("should handle undefined options parameter", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result = resolveDatadogLoggingDestination(stack, undefined);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(logDestinations.LambdaDestination);
    });

    it("should return cached destination when called multiple times with same options", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result1 = resolveDatadogLoggingDestination(stack, {
        name: "CachedDestination",
      });
      const result2 = resolveDatadogLoggingDestination(stack, {
        name: "CachedDestination",
      });

      expect(result1).toBe(result2);
      // Should only create one child construct for the underlying function
      const children = stack.node.children.filter(
        (child) => child.node.id === "CachedDestination",
      );
      expect(children).toHaveLength(1);
    });

    it("should return cached destination when called with default options", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack2");

      const result1 = resolveDatadogLoggingDestination(stack);
      const result2 = resolveDatadogLoggingDestination(stack);
      const result3 = resolveDatadogLoggingDestination(stack, {});

      expect(result1).toBe(result2);
      expect(result1).toBe(result3);
      // Should only create one child construct for the underlying function
      const children = stack.node.children.filter(
        (child) => child.node.id === "DatadogForwarderFunction",
      );
      expect(children).toHaveLength(1);
    });

    it("should cache separately for different import values with different names", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack3");

      const result1 = resolveDatadogLoggingDestination(stack, {
        import: "import-1",
        name: "Destination1",
      });
      const result2 = resolveDatadogLoggingDestination(stack, {
        import: "import-2",
        name: "Destination2",
      });

      // These should be different because they have different import values and names
      expect(result1).not.toBe(result2);
      expect(stack.node.tryFindChild("Destination1")).toBeDefined();
      expect(stack.node.tryFindChild("Destination2")).toBeDefined();
    });
  });
});
