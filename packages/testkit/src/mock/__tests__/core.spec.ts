import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validate,
  getConfig,
  log,
  cloneDeep,
  envBoolean,
  envsKey,
  errorFromStatusCode,
  formatError,
  getHeaderFrom,
  getObjectKeyCaseInsensitive,
  isClass,
  isJaypieError,
  optional,
  required,
  safeParseFloat,
  placeholders,
  force,
  jaypieHandler,
  sleep,
  uuid,
  BadRequestError,
  UnavailableError,
  ProjectError,
} from "../core";
import { MockValidationError } from "../utils";

afterEach(() => {
  vi.clearAllMocks();
});

describe("Core Mocks", () => {
  // 1. Base Cases
  describe("Base Cases", () => {
    it("validate is a function", () => {
      expect(validate).toBeMockFunction();
    });

    it("getConfig is a function", () => {
      expect(getConfig).toBeMockFunction();
    });

    it("log has expected methods", () => {
      expect(log.debug).toBeMockFunction();
      expect(log.info).toBeMockFunction();
      expect(log.warn).toBeMockFunction();
      expect(log.error).toBeMockFunction();
      expect(log.var).toBeMockFunction();
    });

    it("cloneDeep is a function", () => {
      expect(cloneDeep).toBeMockFunction();
    });
  });

  // 2. Error Conditions
  describe("Error Conditions", () => {
    it("required.string throws on invalid input", () => {
      expect(() => required.string(123)).toThrow(MockValidationError);
      expect(() => required.string(123)).toThrow("string must be a string");
    });

    it("required.number throws on invalid input", () => {
      expect(() => required.number("123")).toThrow(MockValidationError);
      expect(() => required.number("123")).toThrow("number must be a number");
    });

    it("required.boolean throws on invalid input", () => {
      expect(() => required.boolean("true")).toThrow(MockValidationError);
      expect(() => required.boolean("true")).toThrow(
        "boolean must be a boolean",
      );
    });

    it("required.array throws on invalid input", () => {
      expect(() => required.array({})).toThrow(MockValidationError);
      expect(() => required.array({})).toThrow("array must be an array");
    });

    it("required.object throws on invalid input", () => {
      expect(() => required.object("not an object")).toThrow(
        MockValidationError,
      );
      expect(() => required.object("not an object")).toThrow(
        "object must be an object",
      );
    });

    it("jaypieHandler throws UnavailableError when unavailable is true", async () => {
      const handler = jaypieHandler(() => "result", { unavailable: true });
      await expect(handler()).rejects.toThrow("Service unavailable");
    });

    it("errorFromStatusCode returns error objects for status codes", () => {
      const badRequestError = errorFromStatusCode(400);
      expect(badRequestError.detail).toMatch(/Mock error for status code 400/);

      // This is returning ProjectError in the implementation rather than NotFoundError
      const notFoundError = errorFromStatusCode(404);
      expect(notFoundError.detail).toMatch(/Mock error for status code 404/);
    });
  });

  // 3. Security (not applicable for this module)

  // 4. Observability
  describe("Observability", () => {
    it("log methods track calls", () => {
      log.debug("Debug message", { extra: "data" });
      log.info("Info message");
      log.warn("Warning message");
      log.error("Error message");

      expect(log.debug.mock.calls.length).toBe(1);
      expect(log.info.mock.calls.length).toBe(1);
      expect(log.warn.mock.calls.length).toBe(1);
      expect(log.error.mock.calls.length).toBe(1);
    });
  });

  // 5. Happy Paths
  describe("Happy Paths", () => {
    it("validate returns true by default", () => {
      const result = validate({ name: "test" }, { type: "object" });
      expect(result).toBe(true);
    });

    it("getConfig returns default test environment", () => {
      const config = getConfig();
      expect(config).toEqual({ environment: "test" });
    });

    it("cloneDeep creates deep copy of object", () => {
      const original = { a: 1, b: { c: 2 } };
      const clone = cloneDeep(original);
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
    });

    it("envBoolean returns true by default", () => {
      expect(envBoolean("ANY_KEY")).toBe(true);
    });

    it("optional.string converts input to string", () => {
      expect(optional.string(123)).toBe("123");
      expect(optional.string(null)).toBe("");
      expect(optional.string(undefined)).toBe("");
    });

    it("optional.number converts input to number", () => {
      expect(optional.number("123")).toBe(123);
      expect(optional.number("abc")).toBe(0);
      expect(optional.number(null)).toBe(0);
    });

    it("optional.boolean converts input to boolean", () => {
      expect(optional.boolean(1)).toBe(true);
      expect(optional.boolean(0)).toBe(false);
      expect(optional.boolean("")).toBe(false);
    });

    it("optional.array returns array or empty array", () => {
      expect(optional.array([1, 2, 3])).toEqual([1, 2, 3]);
      expect(optional.array("not array")).toEqual([]);
    });

    it("optional.object returns object or empty object", () => {
      expect(optional.object({ a: 1 })).toEqual({ a: 1 });
      expect(optional.object("not object")).toEqual({});
    });

    it("safeParseFloat converts input to number", () => {
      expect(safeParseFloat("123.45")).toBe(123.45);
      expect(safeParseFloat(123.45)).toBe(123.45);
      expect(safeParseFloat("not a number")).toBe(0);
    });

    it("placeholders replaces placeholders in template", () => {
      const template = "Hello, {name}!";
      const values = { name: "World" };
      expect(placeholders(template, values)).toBe("Hello, World!");
    });

    it("uuid generates a valid UUID", () => {
      const id = uuid();
      expect(typeof id).toBe("string");
      expect(id.length).toBe(36);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("sleep resolves with true", async () => {
      const result = await sleep(100);
      expect(result).toBe(true);
    });

    it("isClass correctly identifies class definitions", () => {
      class TestClass {}
      function TestFunction() {}

      expect(isClass(TestClass)).toBe(true);
      expect(isClass(TestFunction)).toBe(false);
    });

    it("getHeaderFrom finds header case-insensitively", () => {
      const headers = {
        "Content-Type": "application/json",
        "X-Test": "test-value",
      };

      expect(getHeaderFrom(headers, "content-type")).toBe("application/json");
      expect(getHeaderFrom(headers, "x-test")).toBe("test-value");
      expect(getHeaderFrom(headers, "not-exist")).toBeUndefined();
    });

    it("getObjectKeyCaseInsensitive finds object key case-insensitively", () => {
      const obj = {
        Name: "test",
        Value: 123,
      };

      expect(getObjectKeyCaseInsensitive(obj, "name")).toBe("test");
      expect(getObjectKeyCaseInsensitive(obj, "value")).toBe(123);
      expect(getObjectKeyCaseInsensitive(obj, "not-exist")).toBeUndefined();
    });

    it("force.array converts to array or empty array", () => {
      expect(force.array([1, 2, 3])).toEqual([1, 2, 3]);
      expect(force.array("not array")).toEqual([]);
    });

    it("force.boolean converts to boolean", () => {
      expect(force.boolean(1)).toBe(true);
      expect(force.boolean(0)).toBe(false);
    });

    it("force.object converts to object or empty object", () => {
      expect(force.object({ a: 1 })).toEqual({ a: 1 });
      expect(force.object("not object")).toEqual({});
    });
  });

  // 6. Features
  describe("Features", () => {
    it("jaypieHandler executes the handler function", async () => {
      // We can't directly test the validate, setup, or teardown functions
      // since the mock implementation doesn't actually call them
      const handlerFn = vi.fn().mockReturnValue("test result");
      const handler = jaypieHandler(handlerFn);

      const result = await handler();

      expect(handlerFn).toHaveBeenCalled();
      expect(result).toBe("test result");
    });

    it("jaypieHandler propagates errors from handler", async () => {
      const handlerFn = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });

      const handler = jaypieHandler(handlerFn);

      await expect(handler()).rejects.toThrow("Handler error");
      expect(handlerFn).toHaveBeenCalled();
    });

    it("formatError formats error object", () => {
      const error = new Error("test error");
      const formatted = formatError(error);

      expect(formatted).toHaveProperty("name", "Error");
      expect(formatted).toHaveProperty("message", "test error");
      expect(formatted).toHaveProperty("stack");
    });
  });

  // 7. Specific Scenarios
  describe("Specific Scenarios", () => {
    it("errorFromStatusCode handles edge cases", () => {
      // Non-standard status code
      const error = errorFromStatusCode(499);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("499");

      // Invalid input should still return some kind of error
      const errorWithNaN = errorFromStatusCode(NaN);
      expect(errorWithNaN).toBeInstanceOf(Error);
    });
  });

  // Additional describe blocks for tracking calls
  describe("Track function calls", () => {
    it("validate tracks calls", () => {
      const data = { name: "test" };
      const schema = { type: "object" };

      validate(data, schema);

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0][0]).toBe(data);
      expect(validate.mock.calls[0][1]).toBe(schema);
    });

    it("getConfig tracks calls", () => {
      getConfig();
      expect(getConfig.mock.calls.length).toBe(1);
    });
  });
});
