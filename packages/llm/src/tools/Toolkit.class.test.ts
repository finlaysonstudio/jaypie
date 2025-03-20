import { describe, it, expect, beforeEach, vi } from "vitest";
import { Toolkit } from "./Toolkit.class";
import { LlmTool } from "../types/LlmTool.interface";

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

    it("should create a Toolkit instance with custom options", () => {
      const toolkit = new Toolkit([mockTool], { strict: false });
      expect(toolkit.tools).toHaveLength(1);
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
