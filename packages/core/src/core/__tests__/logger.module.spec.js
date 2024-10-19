import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import logger from "../logger.module.js";

//
//
// Mock environment
//

beforeEach(() => {
  process.env.PROJECT_ENV = "";
  process.env.PROJECT_SERVICE = "";
  process.env.PROJECT_VERSION = "1.0.0";
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Custom Matchers
//

const LOG_METHOD_NAMES = [
  "debug",
  "error",
  "fatal",
  "info",
  "lib",
  "tag",
  "trace",
  "untag",
  "var",
  "warn",
  "with",
];

expect.extend({
  toBeJaypieLogger(received) {
    const isObject = typeof received === "object" && received !== null;
    const hasLoggerMethods = LOG_METHOD_NAMES.every(
      (method) => typeof received[method] === "function",
    );

    if (isObject && hasLoggerMethods) {
      return {
        message: () => `expected ${received} to be a JaypieLogger`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a JaypieLogger with all required logger methods`,
        pass: false,
      };
    }
  },
});

//
//
// Run tests
//

describe("Logger Module", () => {
  it("Is a function", () => {
    expect(logger).toBeFunction();
  });
  it("Works", () => {
    const response = logger();
    expect(response).not.toBeUndefined();
  });
  describe("Features", () => {
    it("Returns a logger", () => {
      const response = logger();
      expect(response).toBeObject();
      expect(response).toBeJaypieLogger();
    });
    it("The logger logs", () => {
      const log = logger();
      const nothing = log.debug("Hello, world!");
      expect(nothing).toBeUndefined();
    });
    it("Can be forked with `lib`", () => {
      // Arrange
      const log = logger();
      // Act
      const fork = log.lib({
        layer: "MOCK_LAYER",
        lib: "MOCK_LIB",
        tags: { project: "mayhem" },
      });
      // Assert
      expect(fork).toBeJaypieLogger();
      expect(fork).not.toBe(log);
    });
    it("Calls to `tag` push down to children", () => {
      // Arrange
      const log = logger();
      const fork = log.lib({ lib: "babel" });
      vi.spyOn(log, "tag");
      vi.spyOn(fork, "tag");
      // Assure
      expect(log.tag).not.toHaveBeenCalled();
      expect(fork.tag).not.toHaveBeenCalled();
      // Act
      log.tag({ project: "mayhem" });
      // Assert
      expect(log.tag).toHaveBeenCalled();
      expect(fork.tag).toHaveBeenCalled();
    });
    it("Calls to `untag` push down to children", () => {
      // Arrange
      const log = logger();
      const fork = log.lib({ lib: "babel" });
      vi.spyOn(log, "untag");
      vi.spyOn(fork, "untag");
      // Assure
      expect(log.untag).not.toHaveBeenCalled();
      expect(fork.untag).not.toHaveBeenCalled();
      // Act
      log.untag("project");
      // Assert
      expect(log.untag).toHaveBeenCalled();
      expect(fork.untag).toHaveBeenCalled();
    });
    it("Tagging a child logger does not affect the parent", () => {
      // Arrange
      const log = logger();
      const fork = log.lib({ lib: "babel" });
      vi.spyOn(log, "tag");
      vi.spyOn(fork, "tag");
      // Assure
      expect(log.tag).not.toHaveBeenCalled();
      expect(fork.tag).not.toHaveBeenCalled();
      // Act
      fork.tag({ project: "mayhem" });
      // Assert
      expect(log.tag).not.toHaveBeenCalled();
      expect(fork.tag).toHaveBeenCalled();
    });
    it("Untagging a child logger does not affect the parent", () => {
      // Arrange
      const log = logger();
      const fork = log.lib({ lib: "babel" });
      vi.spyOn(log, "untag");
      vi.spyOn(fork, "untag");
      // Assure
      expect(log.untag).not.toHaveBeenCalled();
      expect(fork.untag).not.toHaveBeenCalled();
      // Act
      fork.untag("project");
      // Assert
      expect(log.untag).not.toHaveBeenCalled();
      expect(fork.untag).toHaveBeenCalled();
    });
    it("Calling log.lib({tags}) presents the lib logger", () => {
      // Arrange
      const log = logger();
      // Act
      const libLogger = log.lib({ tags: { project: "mayhem" } });
      // Assert
      expect(libLogger).toBeJaypieLogger();
    });
    it("lib logger responds to tags of the original logger", () => {
      // Arrange
      const log = logger();
      const libLogger = log.lib({ project: "mayhem" });
      vi.spyOn(libLogger, "tag");
      // Act
      log.tag({ street: "paper" });
      // Assert
      expect(libLogger.tag).toHaveBeenCalled();
    });
    describe("log.with", () => {
      it("Can be forked with `with`", () => {
        // Arrange
        const log = logger();
        // Act
        const fork = log.with({ project: "mayhem" });
        // Assert
        expect(fork).toBeJaypieLogger();
        expect(fork).not.toBe(log);
      });
      describe("Under the hood", () => {
        // These are Bad Tests (tm)
        it("Forks from with are kept in the with loggers", () => {
          // Arrange
          const log = logger();
          // Act
          log.with({ project: "mayhem" });
          // Assert
          expect(log._withLoggers).toBeObject();
          expect(log._withLoggers).toHaveProperty(`[{"project":"mayhem"}]`);
        });
        it("Forks from with are kept with the main loggers", () => {
          // Arrange
          const log = logger();
          // Assure
          expect(log._loggers).toBeArrayOfSize(1);
          expect(log._loggers[0]).toBe(log._logger);
          // Act
          const fork = log.with({ project: "mayhem" });
          // Assert
          expect(log._loggers).toBeArrayOfSize(2);
          expect(log._loggers[0]).toBe(log._logger);
          expect(log._loggers[1]).toBe(fork._logger);
        });
      });
    });
    describe("Long-living log", () => {
      it("We establish a baseline of what a clean log looks like", () => {
        // Arrange
        const log = logger();
        // Assert
        expect(log._tags).toBeObject();
        expect(log._tags).toContainKeys(["version"]);
        expect(log._logger).toBeObject();
        expect(log._logger.constructor.name).toBe("Logger");
        expect(log._loggers).toBeArrayOfSize(1);
        expect(log._loggers[0]).toBe(log._logger);
        expect(log._withLoggers).toBeObject();
        expect(Object.keys(log._withLoggers)).toBeArrayOfSize(0);
      });
      it("Offers ability to re-init and restores to new defaults", () => {
        // Arrange
        const log = logger();
        const fork = log.lib({ lib: "babel" });
        expect(Object.keys(log._tags)).toIncludeSameMembers(["version"]);
        log.tag({ project: "mayhem" });
        fork.tag({ layer: "MOCK_LAYER" });
        // Assure
        expect(Object.keys(log._tags)).toIncludeSameMembers([
          "project",
          "version",
        ]);
        expect(Object.keys(fork._tags)).toIncludeSameMembers([
          "layer",
          "lib",
          "project",
          "version",
        ]);
        expect(log._loggers).toBeArrayOfSize(2);
        // Act
        log.debug("Hello, log!");
        fork.debug("Hello, lib!");
        log.init();
        // Assert
        expect(log._tags).toBeObject();
        expect(log._tags).toContainKeys(["version"]);
        expect(log._logger).toBeObject();
        expect(log._logger.constructor.name).toBe("Logger");
        expect(log._loggers).toBeArrayOfSize(1);
        expect(log._loggers[0]).toBe(log._logger);
        expect(log._withLoggers).toBeObject();
        expect(Object.keys(log._withLoggers)).toBeArrayOfSize(0);
      });
      it("Calls init down to children", () => {
        // Arrange
        const log = logger();
        const fork = log.lib({ lib: "babel" });
        vi.spyOn(log, "init");
        vi.spyOn(fork, "init");
        // Assure
        expect(log.init).not.toHaveBeenCalled();
        expect(fork.init).not.toHaveBeenCalled();
        // Act
        log.init();
        // Assert
        expect(log.init).toHaveBeenCalled();
        expect(fork.init).toHaveBeenCalled();
      });
    });
  });
});
