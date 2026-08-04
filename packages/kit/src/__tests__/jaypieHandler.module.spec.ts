import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spyLog, restoreLog } from "@jaypie/testkit";

import { log } from "../core.js";
import {
  BadRequestError,
  ConfigurationError,
  InternalError,
  JaypieError,
  NotFoundError,
} from "@jaypie/errors";
import HTTP from "../lib/http.lib.js";

// Subject
import jaypieHandler from "../jaypieHandler.module.js";
import invokeChaos from "../lib/functions/invokeChaos.function.js";

//
//
// Mock modules
//

vi.mock("../lib/functions/invokeChaos.function.js");

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  restoreLog(log);
  vi.resetAllMocks();
});

//
//
// Run tests
//

describe("Jaypie Handler Module", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(jaypieHandler).toBeDefined();
      expect(jaypieHandler).toBeFunction();
    });
  });
  describe("Error Conditions", () => {
    it("Will catch an unhandled thrown error", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new Error("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        expect(error.isProjectError).toBeTrue();
        expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
      }
      expect.assertions(2);
    });
    it("Will catch an unhandled thrown async error", async () => {
      // Arrange
      const handler = jaypieHandler(async () => {
        throw new Error("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        expect(error.isProjectError).toBeTrue();
        expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
      }
    });
  });
  describe("Observability", () => {
    it("Does not log above trace in happy path", async () => {
      // Arrange
      const handler = jaypieHandler(() => {});
      // Act
      await handler();
      // Assert
      expect(log.trace).toHaveBeenCalled();
      expect(log.debug).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
      expect(log.fatal).not.toHaveBeenCalled();
    });
    it("Logs debug if a 4xx Jaypie error is caught", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new BadRequestError("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.debug).toHaveBeenCalledTimes(1);
        expect(log.error).not.toHaveBeenCalled();
        expect(log.warn).not.toHaveBeenCalled();
      }
      expect.assertions(3);
    });
    it("Logs error if a 500-class Jaypie error is caught", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new ConfigurationError("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.debug).not.toHaveBeenCalled();
        expect(log.warn).not.toHaveBeenCalled();
      }
      expect.assertions(3);
    });
    it("Logs the error detail, status, and title of a 500-class Jaypie error", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new InternalError("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.var).toHaveBeenCalledWith({
          jaypieError: {
            detail: "Sorpresa!",
            status: HTTP.CODE.INTERNAL_ERROR,
            title: expect.any(String),
          },
        });
      }
      expect.assertions(1);
    });
    it("Logs the error detail, status, and title of a 4xx Jaypie error", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new NotFoundError("User 12345 not found");
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.var).toHaveBeenCalledWith({
          jaypieError: {
            detail: "User 12345 not found",
            status: HTTP.CODE.NOT_FOUND,
            title: "Not Found",
          },
        });
      }
      expect.assertions(1);
    });
    it("Logs error if a 500-class Jaypie error is caught during validate", async () => {
      // Arrange
      const handler = jaypieHandler(() => {}, {
        validate: [
          () => {
            throw new ConfigurationError("Sorpresa!");
          },
        ],
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.debug).not.toHaveBeenCalled();
      }
      expect.assertions(2);
    });
    it("Logs error if a 500-class Jaypie error is caught during teardown", async () => {
      // Arrange
      const handler = jaypieHandler(() => {}, {
        teardown: [
          () => {
            throw new ConfigurationError("Sorpresa!");
          },
        ],
      });
      // Act
      await handler();
      // Assert
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(log.debug).not.toHaveBeenCalled();
    });
    it("Replaces the detail and title of a caught Jaypie error with the generic strings for its status", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new ConfigurationError("Fabric model chat is not registered");
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        const jaypieError = error as InstanceType<typeof ConfigurationError>;
        expect(jaypieError.detail).toBe(
          "An unexpected error occurred and the request was unable to complete",
        );
        expect(jaypieError.title).toBe("Internal Application Error");
        expect(jaypieError.body()).toEqual({
          errors: [
            {
              detail:
                "An unexpected error occurred and the request was unable to complete",
              status: HTTP.CODE.INTERNAL_ERROR,
              title: "Internal Application Error",
            },
          ],
        });
      }
      expect.assertions(3);
    });
    it("Preserves the detail and title of a caught 4xx Jaypie error", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new NotFoundError("User 12345 not found");
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        const jaypieError = error as InstanceType<typeof NotFoundError>;
        expect(jaypieError.detail).toBe("User 12345 not found");
        expect(jaypieError.title).toBe("Not Found");
      }
      expect.assertions(2);
    });
    it("Preserves the detail of an unmapped 4xx", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new JaypieError("Field ssn failed validation", {
          status: 422,
          title: "Unprocessable Entity",
        });
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        const jaypieError = error as JaypieError;
        expect(jaypieError.status).toBe(422);
        expect(jaypieError.detail).toBe("Field ssn failed validation");
        expect(jaypieError.title).toBe("Unprocessable Entity");
      }
      expect.assertions(3);
    });
    it("Logs debug for an unmapped 4xx", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new JaypieError("Field ssn failed validation", { status: 422 });
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.debug).toHaveBeenCalledTimes(1);
        expect(log.error).not.toHaveBeenCalled();
        expect(log.warn).not.toHaveBeenCalled();
      }
      expect.assertions(3);
    });
    it("Does not scrub a status outside 4xx and 5xx", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new JaypieError("Moved along", {
          status: 302,
          title: "Found",
        });
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        const jaypieError = error as JaypieError;
        expect(jaypieError.detail).toBe("Moved along");
        expect(jaypieError.title).toBe("Found");
      }
      expect.assertions(2);
    });
    it("Preserves the status, message, and stack of a scrubbed error", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new ConfigurationError("Fabric model chat is not registered");
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        const jaypieError = error as InstanceType<typeof ConfigurationError>;
        expect(jaypieError.status).toBe(HTTP.CODE.INTERNAL_ERROR);
        expect(jaypieError.message).toBe("Fabric model chat is not registered");
        expect(jaypieError.stack).toBeString();
      }
      expect.assertions(3);
    });
    it("Scrubs an error caught during validate", async () => {
      // Arrange
      const handler = jaypieHandler(() => {}, {
        scrub: true,
        validate: [
          () => {
            throw new NotFoundError("Account 999 does not exist");
          },
        ],
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        expect((error as InstanceType<typeof NotFoundError>).detail).toBe(
          "The requested resource was not found",
        );
      }
      expect.assertions(1);
    });
    describe("Scrub option", () => {
      it("Scrubs a 4xx when scrub is true", async () => {
        // Arrange
        const handler = jaypieHandler(
          () => {
            throw new NotFoundError("User 12345 not found");
          },
          { scrub: true },
        );
        // Act
        try {
          await handler();
        } catch (error) {
          // Assert
          const jaypieError = error as InstanceType<typeof NotFoundError>;
          expect(jaypieError.detail).toBe(
            "The requested resource was not found",
          );
          expect(jaypieError.title).toBe("Not Found");
        }
        expect.assertions(2);
      });
      it("Scrubs a 4xx when scrub.client is true", async () => {
        // Arrange
        const handler = jaypieHandler(
          () => {
            throw new NotFoundError("User 12345 not found");
          },
          { scrub: { client: true } },
        );
        // Act
        try {
          await handler();
        } catch (error) {
          // Assert
          expect((error as InstanceType<typeof NotFoundError>).detail).toBe(
            "The requested resource was not found",
          );
        }
        expect.assertions(1);
      });
      it("Preserves a 5xx when scrub is false", async () => {
        // Arrange
        const handler = jaypieHandler(
          () => {
            throw new ConfigurationError("Fabric model chat is not registered");
          },
          { scrub: false },
        );
        // Act
        try {
          await handler();
        } catch (error) {
          // Assert
          const jaypieError = error as InstanceType<typeof ConfigurationError>;
          expect(jaypieError.detail).toBe(
            "Fabric model chat is not registered",
          );
          expect(jaypieError.title).toBe("Internal Configuration Error");
        }
        expect.assertions(2);
      });
      it("Preserves a 5xx when scrub.server is false", async () => {
        // Arrange
        const handler = jaypieHandler(
          () => {
            throw new ConfigurationError("Fabric model chat is not registered");
          },
          { scrub: { server: false } },
        );
        // Act
        try {
          await handler();
        } catch (error) {
          // Assert
          expect(
            (error as InstanceType<typeof ConfigurationError>).detail,
          ).toBe("Fabric model chat is not registered");
        }
        expect.assertions(1);
      });
      it("Scrubs a 5xx but not a 4xx when scrub.client is false", async () => {
        // Arrange
        const clientHandler = jaypieHandler(
          () => {
            throw new NotFoundError("User 12345 not found");
          },
          { scrub: { client: false } },
        );
        const serverHandler = jaypieHandler(
          () => {
            throw new ConfigurationError("Fabric model chat is not registered");
          },
          { scrub: { client: false } },
        );
        // Act
        try {
          await clientHandler();
        } catch (error) {
          // Assert
          expect((error as InstanceType<typeof NotFoundError>).detail).toBe(
            "User 12345 not found",
          );
        }
        try {
          await serverHandler();
        } catch (error) {
          // Assert
          expect(
            (error as InstanceType<typeof ConfigurationError>).detail,
          ).toBe(
            "An unexpected error occurred and the request was unable to complete",
          );
        }
        expect.assertions(2);
      });
      it("Still logs the error as thrown when scrub is true", async () => {
        // Arrange
        const handler = jaypieHandler(
          () => {
            throw new NotFoundError("User 12345 not found");
          },
          { scrub: true },
        );
        // Act
        try {
          await handler();
        } catch {
          // Assert
          expect(log.var).toHaveBeenCalledWith({
            jaypieError: {
              detail: "User 12345 not found",
              status: HTTP.CODE.NOT_FOUND,
              title: "Not Found",
            },
          });
        }
        expect.assertions(1);
      });
    });
    it("Logs fatal if a non-Jaypie error is caught", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new Error("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch {
        // Assert
        expect(log.fatal).toHaveBeenCalledTimes(1);
      }
      expect.assertions(1);
    });
  });
  describe("Happy Paths", () => {
    it("Calls a function I pass it", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = jaypieHandler(mockFunction);
      const args = [1, 2, 3];
      // Act
      await handler(...args);
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockFunction).toHaveBeenCalledWith(...args);
    });
    it("Awaits a function I pass it", async () => {
      // Arrange
      const mockFunction = vi.fn(async () => {});
      const handler = jaypieHandler(mockFunction);
      // Act
      await handler();
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });
    it("Returns what the function returns", async () => {
      // Arrange
      const mockFunction = vi.fn(() => 42);
      const handler = jaypieHandler(mockFunction);
      // Act
      const result = await handler();
      // Assert
      expect(result).toBe(42);
    });
    it("Returns what async functions resolve", async () => {
      // Arrange
      const mockFunction = vi.fn(async () => 42);
      const handler = jaypieHandler(mockFunction);
      // Act
      const result = await handler();
      // Assert
      expect(result).toBe(42);
    });
  });
  describe("Features", () => {
    describe("Lifecycle Functions", () => {
      describe("Unavailable mode", () => {
        it("Works as normal when process.env.PROJECT_UNAVAILABLE is set to false", async () => {
          // Arrange
          const handler = jaypieHandler(() => {});
          // Act
          await handler();
          // Assert
          expect(log.warn).not.toHaveBeenCalled();
        });
        it("Will throw 503 UnavailableError if process.env.PROJECT_UNAVAILABLE is set to true", async () => {
          // Arrange
          process.env.PROJECT_UNAVAILABLE = "true";
          const handler = jaypieHandler(() => {});
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
          }
          expect.assertions(2);
        });
        it("Will throw 503 UnavailableError if unavailable=true is passed to the handler", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, { unavailable: true });
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
          }
          expect.assertions(2);
        });
      });
      describe("Validate", () => {
        it("Calls validate functions in order", async () => {
          // Arrange
          const mockValidator1 = vi.fn(async () => {});
          const mockValidator2 = vi.fn(async () => {});
          const handler = jaypieHandler(() => {}, {
            validate: [mockValidator1, mockValidator2],
          });
          // Act
          await handler();
          // Assert
          expect(mockValidator1).toHaveBeenCalledTimes(1);
          expect(mockValidator2).toHaveBeenCalledTimes(1);
          expect(mockValidator1).toHaveBeenCalledBefore(mockValidator2);
        });
        it("Thrown errors wind up as unhandled jaypie errors", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            validate: [
              async () => {
                throw new Error("Sorpresa!");
              },
            ],
          });
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
          }
          expect.assertions(2);
        });
        it("Returning false throws a bad request error", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            validate: [
              async () => {
                return false;
              },
            ],
          });
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.BAD_REQUEST);
          }
          expect.assertions(2);
        });
        it("Will wrap unhandled validate errors in UnhandledError", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            validate: [
              async () => {
                throw new Error("Sorpresa!");
              },
            ],
          });
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
          }
          expect.assertions(2);
        });
        it("Will skip any validate functions that are not functions", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            validate: [null, undefined, 42, "string", {}, []],
          });
          // Act
          await handler();
          // Assert
          expect(log.warn).toHaveBeenCalledTimes(6);
        });
      });
      describe("Setup", () => {
        it("Calls setup functions in order", async () => {
          // Arrange
          const mockSetup1 = vi.fn(async () => {});
          const mockSetup2 = vi.fn(async () => {});
          const handler = jaypieHandler(() => {}, {
            setup: [mockSetup1, mockSetup2],
          });
          // Act
          await handler();
          // Assert
          expect(mockSetup1).toHaveBeenCalledTimes(1);
          expect(mockSetup2).toHaveBeenCalledTimes(1);
          expect(mockSetup1).toHaveBeenCalledBefore(mockSetup2);
        });
        it("Will wrap unhandled setup errors in UnhandledError", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            setup: [
              async () => {
                throw new Error("Sorpresa!");
              },
            ],
          });
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
            expect(error.message).not.toBe("Sorpresa!");
          }
          expect.assertions(3);
        });
        it("Will re-throw a Jaypie error", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            setup: [
              async () => {
                throw new InternalError("Sorpresa!");
              },
            ],
          });
          // Act
          try {
            await handler();
          } catch (error) {
            // Assert
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
            expect(error.message).toBe("Sorpresa!");
          }
          expect.assertions(3);
        });
        it("Will skip any setup functions that are not functions", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            setup: [null, undefined, 42, "string", {}, []],
          });
          // Act
          await handler();
          // Assert
          expect(log.warn).toHaveBeenCalledTimes(6);
        });
      });
      describe("Teardown", () => {
        it("Calls teardown functions in order", async () => {
          // Arrange
          const mockTeardown1 = vi.fn(async () => {});
          const mockTeardown2 = vi.fn(async () => {});
          const handler = jaypieHandler(() => {}, {
            teardown: [mockTeardown1, mockTeardown2],
          });
          // Act
          await handler();
          // Assert
          expect(mockTeardown1).toHaveBeenCalledTimes(1);
          expect(mockTeardown2).toHaveBeenCalledTimes(1);
          expect(mockTeardown1).toHaveBeenCalledBefore(mockTeardown2);
        });
        it("Calls all functions even on error", async () => {
          // Arrange
          const mockTeardown1 = vi.fn(async () => {});
          const mockTeardown2 = vi.fn(async () => {
            throw new Error("Sorpresa!");
          });
          const mockTeardown3 = vi.fn(async () => {});
          const handler = jaypieHandler(() => {}, {
            teardown: [mockTeardown1, mockTeardown2, mockTeardown3],
          });
          // Act
          await handler();
          // Assert
          expect(mockTeardown1).toHaveBeenCalledTimes(1);
          expect(mockTeardown2).toHaveBeenCalledTimes(1);
          expect(mockTeardown3).toHaveBeenCalledTimes(1);
        });
        it("Will call teardown functions even if setup throws an error", async () => {
          // Arrange
          const mockTeardown1 = vi.fn(async () => {});
          const mockTeardown2 = vi.fn(async () => {});
          const handler = jaypieHandler(() => {}, {
            setup: [
              async () => {
                throw new Error("Sorpresa!");
              },
            ],
            teardown: [mockTeardown1, mockTeardown2],
          });
          // Act
          try {
            await handler();
          } catch {
            // Assert
            expect(mockTeardown1).toHaveBeenCalledTimes(1);
            expect(mockTeardown2).toHaveBeenCalledTimes(1);
          }
          expect.assertions(2);
        });
        it("Will call teardown functions even if the handler throws an error", async () => {
          // Arrange
          const mockTeardown1 = vi.fn(async () => {});
          const mockTeardown2 = vi.fn(async () => {});
          const handler = jaypieHandler(
            () => {
              throw new Error("Sorpresa!");
            },
            {
              teardown: [mockTeardown1, mockTeardown2],
            },
          );
          // Act
          try {
            await handler();
          } catch {
            // Assert
            expect(mockTeardown1).toHaveBeenCalledTimes(1);
            expect(mockTeardown2).toHaveBeenCalledTimes(1);
          }
          expect.assertions(2);
        });
        it("Will NOT call teardown functions if validate throws an error", async () => {
          // Arrange
          const mockTeardown1 = vi.fn(async () => {});
          const mockTeardown2 = vi.fn(async () => {});
          const handler = jaypieHandler(() => {}, {
            validate: [
              async () => {
                throw new Error("Sorpresa!");
              },
            ],
            teardown: [mockTeardown1, mockTeardown2],
          });
          // Act
          try {
            await handler();
          } catch {
            // Assert
            expect(mockTeardown1).not.toHaveBeenCalled();
            expect(mockTeardown2).not.toHaveBeenCalled();
          }
          expect.assertions(2);
        });
        it("Will skip any teardown functions that are not functions", async () => {
          // Arrange
          const handler = jaypieHandler(() => {}, {
            teardown: [null, undefined, 42, "string", {}, []],
          });
          // Act
          await handler();
          // Assert
          expect(log.warn).toHaveBeenCalledTimes(6);
        });
      });
    });
    describe("Chaos", () => {
      it("Does not invoke chaos by default", async () => {
        // Arrange
        const handler = jaypieHandler(() => {});
        // Act
        await handler();
        // Assert
        expect(invokeChaos).toHaveBeenCalledTimes(1);
        expect(invokeChaos).toHaveBeenCalledWith("none", {
          log: expect.any(Object),
        });
      });
      it("Invokes chaos with specified level from options", async () => {
        // Arrange
        const handler = jaypieHandler(() => {}, { chaos: "high" });
        // Act
        await handler();
        // Assert
        expect(invokeChaos).toHaveBeenCalledTimes(1);
        expect(invokeChaos).toHaveBeenCalledWith("high", {
          log: expect.any(Object),
        });
      });
      it("Invokes chaos with level from environment variable", async () => {
        // Arrange
        process.env.PROJECT_CHAOS = "medium";
        const handler = jaypieHandler(() => {});
        // Act
        await handler();
        // Assert
        expect(invokeChaos).toHaveBeenCalledTimes(1);
        expect(invokeChaos).toHaveBeenCalledWith("medium", {
          log: expect.any(Object),
        });
      });
      it("Options override environment variable", async () => {
        // Arrange
        process.env.PROJECT_CHAOS = "medium";
        const handler = jaypieHandler(() => {}, { chaos: "low" });
        // Act
        await handler();
        // Assert
        expect(invokeChaos).toHaveBeenCalledTimes(1);
        expect(invokeChaos).toHaveBeenCalledWith("low", {
          log: expect.any(Object),
        });
      });
      it("Invokes chaos after unavailable check and before validate", async () => {
        // Arrange
        const mockValidator = vi.fn(async () => true);
        const handler = jaypieHandler(() => {}, {
          chaos: "high",
          validate: [mockValidator],
        });
        // Act
        await handler();
        // Assert
        expect(invokeChaos).toHaveBeenCalledBefore(mockValidator);
      });
      it("Does not invoke chaos when unavailable throws", async () => {
        // Arrange
        const handler = jaypieHandler(() => {}, { unavailable: true });
        // Act
        try {
          await handler();
        } catch {
          // Expected to throw
        }
        // Assert
        expect(invokeChaos).not.toHaveBeenCalled();
      });
    });
  });
  describe("Edge Cases", () => {
    it("Literally waits if I pass it a timeout", async () => {
      // Arrange
      const handler = jaypieHandler(async () => {
        // 200ms is unnoticeable to us, but will catch anything that tries to log after the fact
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
      // Act
      const start = Date.now();
      await handler();
      const end = Date.now();
      // Assert
      expect(end - start).toBeGreaterThanOrEqual(194); // Allowing a tiny amount of breathing room
    });
    it("Throws an unhandled error if async throws after a delay", async () => {
      // Arrange
      const handler = jaypieHandler(async () => {
        // 200ms is unnoticeable to us, but will catch anything that tries to log after the fact
        await new Promise((resolve) => setTimeout(resolve, 200));
        throw new Error("Sorpresa!");
      });
      // Act
      try {
        await handler();
      } catch (error) {
        // Assert
        expect(error.isProjectError).toBeTrue();
        expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
      }
      expect.assertions(2);
    });
  });
});
