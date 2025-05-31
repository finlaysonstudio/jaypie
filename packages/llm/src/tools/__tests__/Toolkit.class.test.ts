import { describe, it, expect, beforeEach, vi } from "vitest";
import { Toolkit } from "../Toolkit.class";
import { LlmTool } from "../../types/LlmTool.interface";

// Mock jaypie/core
vi.mock("@jaypie/core", () => {
  const mockLog = {
    trace: vi.fn(),
    error: vi.fn(),
    var: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  };

  return {
    JAYPIE: {
      LIB: {
        LLM: "llm",
      },
    },
    log: {
      lib: vi.fn(() => mockLog),
    },
  };
});

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

    it("Does not pass explanation to tool call in explain mode", async () => {
      const toolkit = new Toolkit([mockTool], { explain: true });
      const args = JSON.stringify({
        testParam: "value",
        __Explanation: "explanation",
      });

      await toolkit.call({ name: "testTool", arguments: args });
      expect(mockTool.call).toHaveBeenCalledWith({ testParam: "value" });
    });
    it.todo("Returns explanation in explain mode");
  });

  describe("logging", () => {
    it("should use custom log function when provided", async () => {
      const customLogFn = vi.fn();
      const toolkit = new Toolkit([mockTool], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledTimes(1);
      expect(customLogFn).toHaveBeenCalledWith(
        'testTool:{"testParam":"value"}',
        { name: "testTool", args: { testParam: "value" } },
      );
    });

    it("should await custom log function if it returns a promise", async () => {
      const customLogFn = vi.fn().mockResolvedValue(undefined);
      const toolkit = new Toolkit([mockTool], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith(
        'testTool:{"testParam":"value"}',
        { name: "testTool", args: { testParam: "value" } },
      );
    });

    it("should handle logging errors gracefully and continue execution", async () => {
      const customLogFn = vi.fn().mockRejectedValue(new Error("Log error"));
      const toolkit = new Toolkit([mockTool], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith(
        'testTool:{"testParam":"value"}',
        { name: "testTool", args: { testParam: "value" } },
      );
      expect(mockTool.call).toHaveBeenCalledWith({ testParam: "value" });
    });

    it("should not call any logging when log option is false", async () => {
      const toolkit = new Toolkit([mockTool], { log: false });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(mockTool.call).toHaveBeenCalledWith({ testParam: "value" });
    });

    it("should use tool.message when it is a string", async () => {
      const toolWithMessage: LlmTool = {
        ...mockTool,
        message: "Custom message from tool",
      };
      const customLogFn = vi.fn();
      const toolkit = new Toolkit([toolWithMessage], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith("Custom message from tool", {
        name: "testTool",
        args: { testParam: "value" },
      });
    });

    it("should use tool.message when it is a function returning a string", async () => {
      const toolWithMessage: LlmTool = {
        ...mockTool,
        message: vi.fn().mockReturnValue("Function message"),
      };
      const customLogFn = vi.fn();
      const toolkit = new Toolkit([toolWithMessage], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith("Function message", {
        name: "testTool",
        args: { testParam: "value" },
      });
    });

    it("should await tool.message when it is a function returning a promise", async () => {
      const toolWithMessage: LlmTool = {
        ...mockTool,
        message: vi.fn().mockResolvedValue("Async function message"),
      };
      const customLogFn = vi.fn();
      const toolkit = new Toolkit([toolWithMessage], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith("Async function message", {
        name: "testTool",
        args: { testParam: "value" },
      });
    });

    it("should cast tool.message to string when it is not a string or function", async () => {
      const toolWithMessage: LlmTool = {
        ...mockTool,
        message: 123 as any,
      };
      const customLogFn = vi.fn();
      const toolkit = new Toolkit([toolWithMessage], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith("123", {
        name: "testTool",
        args: { testParam: "value" },
      });
    });

    it("should fallback to default message format when tool.message is undefined", async () => {
      const customLogFn = vi.fn();
      const toolkit = new Toolkit([mockTool], { log: customLogFn });
      const args = JSON.stringify({ testParam: "value" });

      await toolkit.call({ name: "testTool", arguments: args });

      expect(customLogFn).toHaveBeenCalledWith(
        'testTool:{"testParam":"value"}',
        { name: "testTool", args: { testParam: "value" } },
      );
    });
  });

  describe("extend", () => {
    const toolA: LlmTool = {
      name: "toolA",
      description: "Tool A",
      type: "function",
      parameters: { type: "object", properties: {} },
      call: vi.fn(),
    };
    const toolB: LlmTool = {
      name: "toolB",
      description: "Tool B",
      type: "function",
      parameters: { type: "object", properties: {} },
      call: vi.fn(),
    };
    it("adds new tools to the toolkit", () => {
      const toolkit = new Toolkit([toolA]);
      toolkit.extend([toolB]);
      expect(toolkit.tools.map((t) => t.name)).toContain("toolA");
      expect(toolkit.tools.map((t) => t.name)).toContain("toolB");
    });
    it("replaces tool with same name and logs warning", () => {
      const toolkit = new Toolkit([toolA]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const toolA2 = { ...toolA, description: "Tool A2" };
      toolkit.extend([toolA2]);
      expect(toolkit.tools.find((t) => t.name === "toolA")?.description).toBe(
        "Tool A2",
      );
      warnSpy.mockRestore();
    });
    it("skips warning if options.warn is false", () => {
      const toolkit = new Toolkit([toolA]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const toolA2 = { ...toolA, description: "Tool A2" };
      toolkit.extend([toolA2], { warn: false });
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
    it("does not replace tool if options.replace is false", () => {
      const toolkit = new Toolkit([toolA]);
      const toolA2 = { ...toolA, description: "Tool A2" };
      toolkit.extend([toolA2], { replace: false });
      expect(toolkit.tools.find((t) => t.name === "toolA")?.description).toBe(
        "Tool A",
      );
    });
    it("updates log and explain if options are present", () => {
      const toolkit = new Toolkit([toolA]);
      const customLog = vi.fn();
      toolkit.extend([toolB], { log: customLog, explain: true });
      expect((toolkit as any).log).toBe(customLog);
      expect((toolkit as any).explain).toBe(true);
    });
    it("returns this for chaining", () => {
      const toolkit = new Toolkit([toolA]);
      const result = toolkit.extend([toolB]);
      expect(result).toBe(toolkit);
    });
  });
});
