import * as cdk from "aws-cdk-lib";
import { describe, expect, it } from "vitest";
import { resolveDatadogForwarderFunction } from "../resolveDatadogForwarderFunction.js";

describe("resolveDatadogForwarderFunction", () => {
  describe("Base Cases", () => {
    it("should return a function with default values when no options provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result = resolveDatadogForwarderFunction(stack);

      expect(result).toBeDefined();
      expect(result.functionArn).toBeDefined();
    });

    it("should return a function when called with empty options object", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result = resolveDatadogForwarderFunction(stack, {});

      expect(result).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("should use custom name when provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const customName = "CustomDatadogForwarder";

      const result = resolveDatadogForwarderFunction(stack, {
        name: customName,
      });

      expect(result).toBeDefined();
      // Verify the construct was created with the custom name
      const node = stack.node.tryFindChild(customName);
      expect(node).toBeDefined();
    });

    it("should use custom import value when provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const customImport = "custom-import-value";

      const result = resolveDatadogForwarderFunction(stack, {
        import: customImport,
      });

      expect(result).toBeDefined();
    });

    it("should use both custom name and import when provided", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const customName = "CustomForwarder";
      const customImport = "custom-import";

      const result = resolveDatadogForwarderFunction(stack, {
        import: customImport,
        name: customName,
      });

      expect(result).toBeDefined();
      const node = stack.node.tryFindChild(customName);
      expect(node).toBeDefined();
    });
  });

  describe("Specific Scenarios", () => {
    it("should create unique constructs for different names in the same stack", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result1 = resolveDatadogForwarderFunction(stack, {
        name: "Forwarder1",
      });
      const result2 = resolveDatadogForwarderFunction(stack, {
        name: "Forwarder2",
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(stack.node.tryFindChild("Forwarder1")).toBeDefined();
      expect(stack.node.tryFindChild("Forwarder2")).toBeDefined();
    });

    it("should handle undefined options parameter", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result = resolveDatadogForwarderFunction(stack, undefined);

      expect(result).toBeDefined();
    });

    it("should return cached function when called multiple times with same options", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      const result1 = resolveDatadogForwarderFunction(stack, {
        name: "CachedForwarder",
      });
      const result2 = resolveDatadogForwarderFunction(stack, {
        name: "CachedForwarder",
      });

      expect(result1).toBe(result2);
      // Should only create one child construct
      const children = stack.node.children.filter(
        (child) => child.node.id === "CachedForwarder",
      );
      expect(children).toHaveLength(1);
    });

    it("should return cached function when called with default options", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack2");

      const result1 = resolveDatadogForwarderFunction(stack);
      const result2 = resolveDatadogForwarderFunction(stack);
      const result3 = resolveDatadogForwarderFunction(stack, {});

      expect(result1).toBe(result2);
      expect(result1).toBe(result3);
      // Should only create one child construct
      const children = stack.node.children.filter(
        (child) => child.node.id === "DatadogForwarderFunction",
      );
      expect(children).toHaveLength(1);
    });

    it("should cache separately for different import values with different names", () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack3");

      const result1 = resolveDatadogForwarderFunction(stack, {
        import: "import-1",
        name: "Forwarder1",
      });
      const result2 = resolveDatadogForwarderFunction(stack, {
        import: "import-2",
        name: "Forwarder2",
      });

      // These should be different because they have different import values and names
      expect(result1).not.toBe(result2);
      expect(stack.node.tryFindChild("Forwarder1")).toBeDefined();
      expect(stack.node.tryFindChild("Forwarder2")).toBeDefined();
    });
  });
});
