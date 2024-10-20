import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spyLog, restoreLog } from "@jaypie/testkit";

import { log } from "../core.js";
import { ProjectError } from "../lib/errors.lib.js";
import HTTP from "../lib/http.lib.js";

// Subject
import jaypieHandler from "../jaypieHandler.module.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

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
    it("Logs debug if a Jaypie error is caught", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new ProjectError("Sorpresa!");
      });
      // Act
      try {
        await handler();
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        // Assert
        expect(log.debug).toHaveBeenCalledTimes(1);
      }
      expect.assertions(1);
    });
    it("Logs fatal if a non-Jaypie error is caught", async () => {
      // Arrange
      const handler = jaypieHandler(() => {
        throw new Error("Sorpresa!");
      });
      // Act
      try {
        await handler();
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
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
                throw new ProjectError("Sorpresa!");
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
            // eslint-disable-next-line no-unused-vars
          } catch (error) {
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
            // eslint-disable-next-line no-unused-vars
          } catch (error) {
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
            // eslint-disable-next-line no-unused-vars
          } catch (error) {
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
