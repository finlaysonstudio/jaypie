/* eslint-disable no-console */
import { describe, it, expect, vi } from "vitest";
import {
  createMockFunction,
  createMockResolvedFunction,
  MockValidationError,
  MockNotFoundError,
  createMockError,
  createMockWrappedObject,
  createMockWrappedFunction,
  createMockReturnedFunction,
  createMockTool,
} from "../utils";
import { Toolkit } from "@jaypie/llm";

describe("Mock Utils", () => {
  describe("Base Cases", () => {
    it("adds _jaypie: true property to mock function", () => {
      const mock = createMockFunction();
      expect(mock).toHaveProperty("_jaypie", true);
    });

    it("adds _jaypie: true property to resolved mock function", () => {
      const mock = createMockResolvedFunction("test");
      expect(mock).toHaveProperty("_jaypie", true);
    });

    it("adds _jaypie: true property to returned mock function", () => {
      const mock = createMockReturnedFunction("test");
      expect(mock).toHaveProperty("_jaypie", true);
    });

    it("adds _jaypie: true property to wrapped mock function", () => {
      const mock = createMockWrappedFunction(() => "test");
      expect(mock).toHaveProperty("_jaypie", true);
    });

    it("adds _jaypie: true property to mock error constructor", () => {
      class TestError extends Error {}
      const mock = createMockError(TestError);
      expect(mock).toHaveProperty("_jaypie", true);
    });

    it("adds _jaypie: true property to wrapped object function", () => {
      const testObj = {
        method: () => "test",
      };
      const mock = createMockWrappedObject(testObj);
      expect(mock.method).toHaveProperty("_jaypie", true);
    });
  });

  describe("Error Classes", () => {
    it("should create MockValidationError with correct name", () => {
      const error = new MockValidationError("Invalid data");
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Invalid data");
      expect(error instanceof Error).toBe(true);
    });

    it("should create MockNotFoundError with correct name", () => {
      const error = new MockNotFoundError("Resource not found");
      expect(error.name).toBe("NotFoundError");
      expect(error.message).toBe("Resource not found");
      expect(error instanceof Error).toBe(true);
    });

    it("should create a mock error constructor that is new-able and a vi.fn", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const MockCustomError = createMockError(CustomError);
      expect(typeof MockCustomError).toBe("function");
      const error = new MockCustomError("custom message");
      expect(error).toBeInstanceOf(CustomError);
      expect(error.name).toBe("CustomError");
      expect(error.message).toBe("custom message");
      expect((MockCustomError as any).mock).toBeDefined();
    });

    it("should work with built-in Error using createMockError", () => {
      const MockError = createMockError(Error);
      const error = new MockError("built-in error");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("built-in error");
      expect((MockError as any).mock).toBeDefined();
    });
  });

  describe("createMockFunction", () => {
    it("should create a mock function with the implementation", () => {
      const mockFn = createMockFunction<(a: number, b: number) => number>(
        (a, b) => a + b,
      );
      expect(mockFn(2, 3)).toBe(5);
      expect(mockFn.mock.calls.length).toBe(1);
    });

    it("should create a mock function without implementation", () => {
      const mockFn = createMockFunction<(a: string) => number>();
      mockFn("test");
      expect(mockFn.mock.calls.length).toBe(1);
      expect(mockFn.mock.calls[0][0]).toBe("test");
    });
  });

  describe("createMockResolvedFunction", () => {
    it("should resolve to the provided value when awaited", async () => {
      const mockFn = createMockResolvedFunction("test value");
      const result = await mockFn();
      expect(result).toBe("test value");
    });

    it("should allow changing the resolved value", async () => {
      const mockFn = createMockResolvedFunction("initial value");
      (
        mockFn as unknown as { mockResolvedValue: (val: any) => void }
      ).mockResolvedValue("new value");
      const result = await mockFn();
      expect(result).toBe("new value");
    });
  });

  describe("createMockWrappedFunction", () => {
    it("should wrap a function and call the original implementation", async () => {
      const original = (x: number) => x * 2;
      const wrapped = createMockWrappedFunction<number>((...args: unknown[]) =>
        original(args[0] as number),
      );

      const result = await wrapped(5);

      expect(result).toBe(10);
      expect((wrapped as unknown as { mock: any }).mock).toBeDefined();
      expect(
        (wrapped as unknown as { mock: { calls: any[] } }).mock.calls.length,
      ).toBe(1);
    });

    it("should return fallback value when original throws", async () => {
      const original = () => {
        throw new Error("Test error");
      };
      const fallback = "fallback value";
      const wrapped = createMockWrappedFunction(original, fallback);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      const result = await wrapped();

      // Restore console
      console.warn = consoleWarn;

      expect(result).toBe(fallback);
    });

    it("should accept options object with fallback", async () => {
      const original = () => {
        throw new Error("Test error");
      };
      const options = { fallback: "option fallback" };
      const wrapped = createMockWrappedFunction(original, options);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      const result = await wrapped();

      // Restore console
      console.warn = consoleWarn;

      expect(result).toBe("option fallback");
    });

    it("should rethrow when throws option is true", () => {
      const errorMessage = "Test error for rethrow";
      const original = () => {
        throw new Error(errorMessage);
      };
      const wrapped = createMockWrappedFunction(original, { throws: true });

      try {
        wrapped();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }
      expect.assertions(2);
    });

    it("should create a new instance when class option is true", async () => {
      // Define a class constructor function
      function TestClass(this: any, name: string) {
        this.name = name;
        this.getValue = () => `Hello ${this.name}`;
      }

      const wrapped = createMockWrappedFunction<any>(TestClass as any, {
        class: true,
      });
      const instance = (await wrapped("World")) as {
        name: string;
        getValue: () => string;
      };

      expect(instance).toHaveProperty("name", "World");
      expect(instance.getValue()).toBe("Hello World");
      expect(wrapped).toHaveProperty("mock");
    });

    it("should execute fallback function and return its result when original throws", async () => {
      const original = () => {
        throw new Error("Test error");
      };
      const fallbackFn = vi.fn().mockReturnValue("fallback function result");
      const wrapped = createMockWrappedFunction(original, fallbackFn);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      const result = await wrapped();

      // Restore console
      console.warn = consoleWarn;

      expect(fallbackFn).toHaveBeenCalled();
      expect(result).toBe("fallback function result");
    });

    it("should pass original args to fallback function", async () => {
      const original = () => {
        throw new Error("Test error");
      };
      const fallbackFn = vi.fn().mockReturnValue("args passed correctly");
      const wrapped = createMockWrappedFunction(original, fallbackFn);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      await wrapped("test", 123);

      // Restore console
      console.warn = consoleWarn;

      expect(fallbackFn).toHaveBeenCalledWith("test", 123);
    });

    it("should await fallback function's promise and return resolved value", async () => {
      const original = () => {
        throw new Error("Test error");
      };
      const fallbackFn = vi.fn().mockResolvedValue("async fallback result");
      const wrapped = createMockWrappedFunction(original, fallbackFn);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      const result = await wrapped();

      // Restore console
      console.warn = consoleWarn;

      expect(fallbackFn).toHaveBeenCalled();
      expect(result).toBe("async fallback result");
    });

    it("should handle fallback function that throws by returning default value", async () => {
      const original = () => {
        throw new Error("Original error");
      };
      const fallbackFn = vi.fn().mockImplementation(() => {
        throw new Error("Fallback error");
      });
      const wrapped = createMockWrappedFunction(original, fallbackFn);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      const warnSpy = vi.fn();
      console.warn = warnSpy;

      const result = await wrapped();

      // Restore console
      console.warn = consoleWarn;

      expect(fallbackFn).toHaveBeenCalled();
      expect(result).toBe("_MOCK_WRAPPED_RESULT");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Fallback function failed"),
      );
    });
  });

  describe("createMockWrappedObject", () => {
    it("should create mock functions for all methods in an object", async () => {
      const original = {
        method1: (x: number) => x * 2,
        method2: (s: string) => s.toUpperCase(),
        prop: "value",
        nested: {
          nestedMethod: (x: number) => x * 3,
          nestedProp: 42,
        },
      };

      const mock = createMockWrappedObject(original);

      // Test method mocking
      expect(await mock.method1(5)).toBe(10);
      expect(await mock.method2("hello")).toBe("HELLO");
      expect(mock.method1).toHaveProperty("mock");
      expect(mock.method2).toHaveProperty("mock");

      // Test property preservation
      expect(mock.prop).toBe("value");

      // Test nested objects
      expect(await mock.nested.nestedMethod(5)).toBe(15);
      expect(mock.nested.nestedProp).toBe(42);
      expect(mock.nested.nestedMethod).toHaveProperty("mock");
    });

    it("should return fallback value when wrapped function throws", async () => {
      const original = {
        method: () => {
          throw new Error("Original implementation error");
        },
      };

      const fallback = "fallback value";
      const mock = createMockWrappedObject(original, fallback);

      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      const result = await mock.method();

      // Restore console
      console.warn = consoleWarn;

      expect(result).toBe(fallback);
      expect(mock.method).toHaveProperty("mock");
    });

    it("should instantiate class methods when class option is true", async () => {
      // Define an object with class constructor methods
      function UserClass(this: any, name: string) {
        this.name = name;
        this.greeting = "Hello";
      }

      function ProductClass(this: any, id: number) {
        this.id = id;
        this.type = "product";
      }

      const original = {
        createUser: UserClass,
        createProduct: ProductClass,
        nested: {
          createNestedUser: UserClass,
        },
      };

      const mock = createMockWrappedObject(original, { class: true });

      // Test class instantiation at top level
      const user = await mock.createUser("John");
      expect(user).toHaveProperty("name", "John");
      expect(user).toHaveProperty("greeting", "Hello");

      const product = await mock.createProduct(123);
      expect(product).toHaveProperty("id", 123);
      expect(product).toHaveProperty("type", "product");

      // Test that nested functions don't get the class option passed down
      // Test for fallback value since nested constructors are not called with new
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      const nestedUser = await mock.nested.createNestedUser("Jane");
      expect(nestedUser).toBe("_MOCK_WRAPPED_RESULT");

      console.warn = consoleWarn;
    });
  });

  describe("createMockTool", () => {
    describe("Base Cases", () => {
      it("should create a mock tool with default values when no parameters provided", () => {
        const tool = createMockTool();

        expect(tool.name).toBe("mockTool");
        expect(tool.description).toBe("Mock tool for testing");
        expect(tool.parameters).toEqual({});
        expect(tool.type).toBe("function");
        expect(typeof tool.call).toBe("function");
        expect(tool.message).toBe("MOCK_TOOL_MESSAGE");
      });

      it("should create a mock tool with only name provided", () => {
        const tool = createMockTool("customTool");

        expect(tool.name).toBe("customTool");
        expect(tool.description).toBe("Mock tool for testing");
        expect(tool.parameters).toEqual({});
        expect(tool.type).toBe("function");
        expect(typeof tool.call).toBe("function");
        expect(tool.message).toBe("MOCK_TOOL_MESSAGE");
      });

      it("should create a mock tool with name and call function", () => {
        const customCall = vi.fn().mockReturnValue("custom result");
        const tool = createMockTool("namedTool", customCall);

        expect(tool.name).toBe("namedTool");
        expect(tool.call).toBe(customCall);
        expect(tool.description).toBe("Mock tool for testing");
        expect(tool.type).toBe("function");
        expect(tool.message).toBe("MOCK_TOOL_MESSAGE");
      });

      it("should create a mock tool with only call function provided", () => {
        const customCall = vi.fn().mockReturnValue("function result");
        const tool = createMockTool(customCall);

        expect(tool.name).toBe("mockTool");
        expect(tool.call).toBe(customCall);
        expect(tool.description).toBe("Mock tool for testing");
        expect(tool.type).toBe("function");
        expect(tool.message).toBe("MOCK_TOOL_MESSAGE");
      });
    });

    describe("Error Conditions", () => {
      it("should handle null parameters gracefully", () => {
        const tool = createMockTool(null as any);

        expect(tool.name).toBe("mockTool");
        expect(tool.description).toBe("Mock tool for testing");
        expect(typeof tool.call).toBe("function");
      });

      it("should handle undefined parameters gracefully", () => {
        const tool = createMockTool(undefined as any);

        expect(tool.name).toBe("mockTool");
        expect(tool.description).toBe("Mock tool for testing");
        expect(typeof tool.call).toBe("function");
      });
    });

    describe("Happy Paths", () => {
      it("should create a mock tool with name and options object", () => {
        const options = {
          description: "Custom description",
          parameters: { param1: "value1" },
          type: "custom" as const,
          message: "Custom message",
        };
        const tool = createMockTool("optionsTool", options);

        expect(tool.name).toBe("optionsTool");
        expect(tool.description).toBe("Custom description");
        expect(tool.parameters).toEqual({ param1: "value1" });
        expect(tool.type).toBe("custom");
        expect(tool.message).toBe("Custom message");
      });

      it("should create a mock tool with full options object", () => {
        const customCall = vi.fn().mockReturnValue("options result");
        const options = {
          name: "fullOptionsTool",
          description: "Full options description",
          parameters: { param1: "value1", param2: 42 },
          type: "function" as const,
          call: customCall,
          message: "Full options message",
        };
        const tool = createMockTool(options);

        expect(tool.name).toBe("fullOptionsTool");
        expect(tool.description).toBe("Full options description");
        expect(tool.parameters).toEqual({ param1: "value1", param2: 42 });
        expect(tool.type).toBe("function");
        expect(tool.call).toBe(customCall);
        expect(tool.message).toBe("Full options message");
      });

      it("should create a mock tool with partial options object", () => {
        const partialOptions = {
          description: "Partial description",
          parameters: { test: true },
        };
        const tool = createMockTool(partialOptions);

        expect(tool.name).toBe("mockTool");
        expect(tool.description).toBe("Partial description");
        expect(tool.parameters).toEqual({ test: true });
        expect(tool.type).toBe("function");
        expect(typeof tool.call).toBe("function");
        expect(tool.message).toBe("MOCK_TOOL_MESSAGE");
      });
    });

    describe("Features", () => {
      it("should have a working default call function that resolves to expected value", async () => {
        const tool = createMockTool();

        const result = await tool.call();
        expect(result).toEqual({ result: "MOCK_TOOL" });
      });

      it("should support custom call function execution", async () => {
        const customCall = vi.fn().mockResolvedValue("custom async result");
        const tool = createMockTool("asyncTool", customCall);

        const result = await tool.call({ arg1: "test" });
        expect(result).toBe("custom async result");
        expect(customCall).toHaveBeenCalledWith({ arg1: "test" });
      });

      it("should support message as function", () => {
        const messageFunction = vi.fn().mockReturnValue("dynamic message");
        const tool = createMockTool({
          name: "messageTool",
          message: messageFunction,
        });

        expect(typeof tool.message).toBe("function");
        if (typeof tool.message === "function") {
          const result = tool.message(
            { param: "value" },
            { name: "messageTool" },
          );
          expect(result).toBe("dynamic message");
          expect(messageFunction).toHaveBeenCalledWith(
            { param: "value" },
            { name: "messageTool" },
          );
        }
      });
    });

    describe("Specific Scenarios", () => {
      it("should override defaults when options are provided", () => {
        const customCall = vi.fn();
        const tool = createMockTool("overrideTool", {
          description: "Override description",
          parameters: { override: true },
          type: "override",
          call: customCall,
          message: "Override message",
        });

        expect(tool.name).toBe("overrideTool");
        expect(tool.description).toBe("Override description");
        expect(tool.parameters).toEqual({ override: true });
        expect(tool.type).toBe("override");
        expect(tool.call).toBe(customCall);
        expect(tool.message).toBe("Override message");
      });

      it("should maintain jaypie mock properties on the call function", () => {
        const tool = createMockTool();

        expect(tool.call).toHaveProperty("_jaypie", true);
      });

      it("should support both sync and async call functions", async () => {
        const syncCall = vi.fn().mockReturnValue("sync result");
        const asyncCall = vi.fn().mockResolvedValue("async result");

        const syncTool = createMockTool("syncTool", syncCall);
        const asyncTool = createMockTool("asyncTool", asyncCall);

        expect(syncTool.call()).toBe("sync result");
        expect(await asyncTool.call()).toBe("async result");
      });

      it("should work with Toolkit when calling tool by name with arguments", async () => {
        const mockCall = vi.fn().mockResolvedValue("toolkit result");
        const tool = createMockTool("testTool", mockCall);
        const toolkit = new Toolkit([tool], { log: false });

        const testArguments = { param1: "value1", param2: 42 };

        await toolkit.call({
          name: tool.name,
          arguments: JSON.stringify(testArguments),
        });

        expect(mockCall).toHaveBeenCalledWith(testArguments);
        expect(mockCall).toHaveBeenCalledTimes(1);
      });
    });
  });
});
