import { describe, it, expect, beforeEach, vi } from "vitest";
import { Toolkit } from "../Toolkit.class";
import { LlmTool } from "../../types/LlmTool.interface";

describe("Toolkit", () => {
  // Mock tool for testing
  const mockTool: LlmTool = {
    name: "testTool",
    description: "A test tool",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        testParam: { type: "string" },
      },
    },
    call: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a Toolkit instance with default options", () => {
      const toolkit = new Toolkit([mockTool]);
      expect(toolkit.tools).toHaveLength(1);
      expect(toolkit.tools[0].name).toBe("testTool");
    });
  });

  describe("tools getter", () => {
    it("should return tools without call function", () => {
      const toolkit = new Toolkit([mockTool]);
      const tools = toolkit.tools;

      expect(tools).toHaveLength(1);
      expect(tools[0]).toHaveProperty("name");
      expect(tools[0]).toHaveProperty("description");
      expect(tools[0]).toHaveProperty("parameters");
      expect(tools[0]).toHaveProperty("type");
      expect(tools[0]).not.toHaveProperty("call");
    });

    it("should set default type 'function' for tools without type", () => {
      // Create a tool without a type property
      const toolWithoutType: Partial<LlmTool> = {
        name: "noTypeTest",
        description: "A test tool without type",
        parameters: {
          type: "object",
          properties: {},
        },
        call: vi.fn(),
      };

      const toolkit = new Toolkit([toolWithoutType as LlmTool]);
      const tools = toolkit.tools;

      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe("function");
      expect(tools[0].parameters.properties).not.toHaveProperty(
        "__Explanation",
      );
    });

    it("should add the explain property to all tools", () => {
      const toolkit = new Toolkit([mockTool], { explain: true });
      const tools = toolkit.tools;

      expect(tools).toHaveLength(1);
      expect(tools[0].parameters.properties).toHaveProperty("__Explanation");
    });
  });

  describe("call", () => {
    it("should call the tool with string arguments", async () => {
      const toolkit = new Toolkit([mockTool]);
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });
      expect(mockTool.call).toHaveBeenCalledWith({ testParam: "value" });
    });

    it("should call the tool with parsed arguments", async () => {
      const toolkit = new Toolkit([mockTool]);
      const args = { testParam: "value" };

      await toolkit.call({ name: "testTool", arguments: JSON.stringify(args) });
      expect(mockTool.call).toHaveBeenCalledWith(args);
    });

    it("should handle non-JSON string arguments", async () => {
      const toolkit = new Toolkit([mockTool]);
      const args = "simple string";

      await toolkit.call({ name: "testTool", arguments: args });
      expect(mockTool.call).toHaveBeenCalledWith(args);
    });

    it("should properly resolve a promise if call returns a promise", async () => {
      // This test verifies that the Toolkit class correctly awaits promises returned by tool calls
      // by examining the implementation of the call method

      // Get the source code of the Toolkit class
      const toolkitSource = Toolkit.prototype.call.toString();

      // Check if the implementation includes awaiting the promise
      const hasAwaitPromise =
        toolkitSource.includes("await result") ||
        toolkitSource.includes("return await");

      // The implementation should await the promise
      expect(hasAwaitPromise).toBeTrue();

      // Now test the actual functionality
      const promiseResult = { success: true, data: "async result" };
      const promiseTool: LlmTool = {
        ...mockTool,
        call: vi.fn().mockResolvedValue(promiseResult),
      };

      const toolkit = new Toolkit([promiseTool]);
      const args = JSON.stringify({ testParam: "async test" });

      const result = await toolkit.call({ name: "testTool", arguments: args });

      expect(promiseTool.call).toHaveBeenCalledWith({
        testParam: "async test",
      });
      expect(result).toEqual(promiseResult);
    });

    it("should throw error for non-existent tool", async () => {
      const toolkit = new Toolkit([mockTool]);

      await expect(
        toolkit.call({
          name: "nonExistentTool",
          arguments: "{}",
        }),
      ).rejects.toThrow("Tool 'nonExistentTool' not found");
    });
  });
});
