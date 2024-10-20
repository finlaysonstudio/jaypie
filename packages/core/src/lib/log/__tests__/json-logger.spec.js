import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Logger from "../Logger.js";
import { FORMAT, LEVEL } from "../util/constants.js";

import mockOut from "../util/out.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

vi.mock("../util/out.js");

//
//
// Mock environment
//

let log;

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  log = new Logger({ format: FORMAT.JSON, level: LEVEL.TRACE });
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Logger", () => {
  describe("JSON Format", () => {
    it("Works", async () => {
      expect(log).toBeObject();
      expect(log.trace).toBeFunction();
      log.trace("log.trace");
      expect(mockOut).toBeCalled();
    });
    it("Logs JSON", () => {
      log.trace("log.trace");
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toBeObject();
    });
    it("Includes message and log keys", () => {
      log.trace("log.trace");
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("message");
      expect(logObject).toContainKey("log");
    });
  });
  describe("Data field", () => {
    it("Is available when log.var() is called", () => {
      // Arrange
      // N/A
      // Act
      log.var("key", "value");
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("data");
    });
    it("Is available when a JSON string is given to the message", () => {
      // Arrange
      // N/A
      // Act
      log.trace(`{"hello":"world"}`);
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("data");
      expect(logObject.data).toEqual({ hello: "world" });
      expect(logObject.data.hello).toEqual("world");
    });
    it.todo("Future: is available when log.data() is called");
    it.todo("Future: is available when log.val() is called");
  });
  describe("Message", () => {
    it("Will stringify the message if it is an object", () => {
      // Arrange
      // N/A
      // Act
      log.trace({ hello: "world" });
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("message");
      expect(logObject.message).toBeString();
      expect(JSON.parse(logObject.message)).toEqual({ hello: "world" });
      // expect(logObject.message).toBe(`{"hello":"world"}`);
    });
    it("Will minify when stringify takes place", () => {
      // Arrange
      // N/A
      // Act
      log.trace({ hello: "world" });
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject.message).toBe(JSON.stringify({ hello: "world" }));
    });
    it("Will toString anything else", () => {
      // Arrange
      // N/A
      // Act
      log.trace(123);
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject.message).toBe("123");
    });
  });
  describe("Tags", () => {
    it("Allows setting global tags in the constructor", () => {
      // Arrange
      log = new Logger({
        format: FORMAT.JSON,
        level: LEVEL.TRACE,
        tags: { key: "value" },
      });
      // Act
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("key");
      expect(logObject.key).toBe("value");
      // Done
    });
    it("Allows setting global tags in the constructor (will force string)", () => {
      // Arrange
      log = new Logger({
        format: FORMAT.JSON,
        level: LEVEL.TRACE,
        tags: { key: ["value"] },
      });
      // Act
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("key");
      expect(logObject.key).toBe(`["value"]`);
      // Done
    });
    it("Allows setting global tags in the constructor (when passed null)", () => {
      // Arrange
      log = new Logger({
        format: FORMAT.JSON,
        level: LEVEL.TRACE,
        tags: { key: null },
      });
      // Act
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("key");
      expect(logObject.key).toBe("null");
      // Done
    });
    it("Allows setting global tags individually", () => {
      // Arrange
      // N/A
      // Act
      log.tag("key", "value");
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("key");
      expect(logObject.key).toBe("value");
    });
    it("Allows setting global tags with an object", () => {
      // Arrange
      // N/A
      // Act
      log.tag({ hello: "world", key: "value" });
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("hello");
      expect(logObject).toContainKey("key");
      expect(logObject.hello).toBe("world");
      expect(logObject.key).toBe("value");
    });
    it("Allows setting global tags with an object (will force string)", () => {
      // Arrange
      // N/A
      // Act
      log.tag({ hello: "world", key: ["value"] });
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("hello");
      expect(logObject).toContainKey("key");
      expect(logObject.hello).toBe("world");
      expect(logObject.key).toBe(`["value"]`);
    });
    it("Responds rationally if key doesn't have a value", () => {
      // Arrange
      // N/A
      // Act
      log.tag({ key: undefined });
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("key");
      expect(logObject.key).toBe(``);
    });
    it("Allows removing global tags", () => {
      // Arrange
      log = new Logger({
        format: FORMAT.JSON,
        level: LEVEL.TRACE,
        tags: { key: "value" },
      });
      // Act
      log.untag("key");
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).not.toContainKey("key");
    });
    it("Allows removing tags by array", () => {
      // Arrange
      log = new Logger({
        format: FORMAT.JSON,
        level: LEVEL.TRACE,
        tags: { key: "value", hello: "world" },
      });
      // Act
      log.untag(["key", "hello"]);
      log.trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).not.toContainKey("key");
      expect(logObject).not.toContainKey("hello");
    });
    it("Allows tagging a single message (key:value)", () => {
      // Arrange
      // N/A
      // Act
      log.with("key", "value").trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("key");
      expect(logObject.key).toBe("value");
    });
    it("Allows tagging a single message (object)", () => {
      // Arrange
      // N/A
      // Act
      log.with({ hello: "world", key: ["value"] }).trace("log.trace");
      // Assert
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("hello");
      expect(logObject).toContainKey("key");
      expect(logObject.hello).toBe("world");
      expect(logObject.key).toBe(`["value"]`);
    });
    it("Does not tag the second message after with()", () => {
      // Arrange
      log = new Logger({
        format: FORMAT.JSON,
        level: LEVEL.TRACE,
        tags: { hello: "world" },
      });
      // Act
      log.with("key", "value").info("log.info");
      log.trace("log.trace");
      // Assert
      const taggedLogObject = mockOut.mock.calls[0][0];
      expect(taggedLogObject).toContainKey("hello");
      expect(taggedLogObject).toContainKey("key");
      expect(taggedLogObject.hello).toBe("world");
      expect(taggedLogObject.key).toBe("value");
      const untaggedLogObject = mockOut.mock.calls[1][0];
      expect(untaggedLogObject).toContainKey("hello");
      expect(taggedLogObject.hello).toBe("world");
      expect(untaggedLogObject).not.toContainKey("key");
    });
  });
  describe("log.var()", () => {
    it("Logs the value as the message", () => {
      // Arrange
      // N/A
      // Act
      log.var("key", "value");
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("message");
      expect(logObject.message).toBe("value");
      // Done
    });
    it("Logs the key as var", () => {
      // Arrange
      // N/A
      // Act
      log.var("key", "value");
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("var");
      expect(logObject.var).toBe("key");
    });
    it("Logs the value as data", () => {
      // Arrange
      // N/A
      // Act
      log.var("number", 12);
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("message");
      expect(logObject.message).toBe("12");
      expect(logObject).toContainKey("var");
      expect(logObject.var).toBe("number");
      expect(logObject).toContainKey("data");
      expect(logObject.data).toBe(12);
    });
    it("Stringifies the message if value is an object", () => {
      // Arrange
      // N/A
      // Act
      log.var("object", { hello: "world" });
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("message");
      expect(logObject.message).toBe(`{"hello":"world"}`);
      expect(logObject).toContainKey("var");
      expect(logObject.var).toBe("object");
      expect(logObject).toContainKey("data");
      expect(logObject.data).toEqual({ hello: "world" });
      expect(logObject.data.hello).toEqual("world");
    });
    it("Parses the data if value is a JSON string", () => {
      // Arrange
      // N/A
      // Act
      log.var("object", `{"hello":"world"}`);
      // Assert
      expect(mockOut).toBeCalled();
      const logObject = mockOut.mock.calls[0][0];
      expect(logObject).toContainKey("message");
      expect(logObject.message).toBe(`{"hello":"world"}`);
      expect(logObject).toContainKey("var");
      expect(logObject.var).toBe("object");
      expect(logObject).toContainKey("data");
      expect(logObject.data).toEqual({ hello: "world" });
      expect(logObject.data.hello).toEqual("world");
    });
  });
});
