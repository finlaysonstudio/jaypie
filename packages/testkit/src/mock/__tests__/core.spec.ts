import { describe, it, expect, vi, afterEach } from "vitest";
import {
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
  safeParseFloat,
  placeholders,
  force,
  jaypieHandler,
  sleep,
  uuid,
  BadRequestError,
  HTTP,
} from "../core";

afterEach(() => {
  vi.clearAllMocks();
});

describe("Core Mocks", () => {
  // 1. Base Cases
  describe("Base Cases", () => {
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

    it("envBoolean is a function", () => {
      expect(envBoolean).toBeMockFunction();
    });

    it("envsKey is a function", () => {
      expect(envsKey).toBeMockFunction();
    });
  });

  // 2. Error Conditions
  describe("Error Conditions", () => {
    it("jaypieHandler throws UnavailableError when unavailable is true", async () => {
      const handler = jaypieHandler(() => "result", { unavailable: true });
      await expect(handler()).rejects.toThrow("Service unavailable");
    });

    it("errorFromStatusCode returns error objects for status codes", () => {
      const badRequestError = errorFromStatusCode(400) as any;
      expect(badRequestError.detail).toMatch(/Mock error for status code 400/);

      // This is returning ProjectError in the implementation rather than NotFoundError
      const notFoundError = errorFromStatusCode(404) as any;
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

      expect((log.debug as any).mock.calls.length).toBe(1);
      expect((log.info as any).mock.calls.length).toBe(1);
      expect((log.warn as any).mock.calls.length).toBe(1);
      expect((log.error as any).mock.calls.length).toBe(1);
    });
  });

  // 5. Happy Paths
  describe("Happy Paths", () => {
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

    it("envsKey returns mock envsKey by default", () => {
      expect(envsKey).toBeMockFunction();
    });

    it("safeParseFloat converts input to number", () => {
      expect(safeParseFloat("123.45")).toBe(123.45);
      expect(safeParseFloat(123.45)).toBe(123.45);
      expect(safeParseFloat("not a number")).toBe(0);
    });

    it("placeholders replaces placeholders in template", () => {
      const template = "Hello, {{name}}!";
      const values = { name: "World" };
      expect(placeholders(template, values)).toBe("Hello, World!");
    });

    it("uuid returns a mock UUID string", () => {
      const id = uuid();
      expect(typeof id).toBe("string");
      expect(id.length).toBe(36);
      // Mock returns a fixed string "00000000-0000-0000-0000-000000000000"
      expect(id).toBe("00000000-0000-0000-0000-000000000000");
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
      expect(getHeaderFrom).toBeMockFunction();
      const headers = {
        "Content-Type": "application/json",
        "X-Test": "test-value",
      };

      expect(getHeaderFrom("content-type", headers)).toBe("application/json");
      expect(getHeaderFrom("x-test", headers)).toBe("test-value");
      expect(getHeaderFrom("not-exist", headers)).toBeUndefined();
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
      expect(force.array("not array")).toBeArray();
    });

    it("force.boolean converts to boolean", () => {
      expect(force.boolean(1)).toBe(true);
      expect(force.boolean(0)).toBe(false);
    });

    it("force.object converts to object or empty object", () => {
      expect(force.object({ a: 1 })).toEqual({ a: 1 });
      expect(force.object("not object")).toBeObject();
    });
  });

  // 6. Features
  describe("Features", () => {
    describe("Jaypie Handler", () => {
      describe("Base Cases", () => {
        it("Works", () => {
          expect(jaypieHandler).toBeDefined();
          expect(jaypieHandler).toBeFunction();
          expect(vi.isMockFunction(jaypieHandler)).toBeTrue();
        });
      });
      describe("Observability", () => {
        it("Does not log", async () => {
          // Arrange
          const handler = jaypieHandler(() => {});
          // Act
          await handler();
          // Assert
          expect(log.trace).not.toHaveBeenCalled();
          expect(log.debug).not.toHaveBeenCalled();
          expect(log.info).not.toHaveBeenCalled();
          expect(log.warn).not.toHaveBeenCalled();
          expect(log.error).not.toHaveBeenCalled();
          expect(log.fatal).not.toHaveBeenCalled();
        });
      });
      describe("Happy Paths", () => {
        it("Calls a function I pass it", async () => {
          // Arrange
          const mockFunction = vi.fn(() => 12);
          const handler = jaypieHandler(mockFunction);
          const args = [1, 2, 3];
          // Act
          await handler(...args);
          // Assert
          expect(mockFunction).toHaveBeenCalledTimes(1);
          expect(mockFunction).toHaveBeenCalledWith(...args);
        });
        it("Throws the error my function throws", async () => {
          // Arrange
          const mockFunction = vi.fn(() => {
            throw new Error("Sorpresa!");
          });
          const handler = jaypieHandler(mockFunction);
          // Act
          try {
            await handler();
          } catch (error) {
            if (error instanceof Error) {
              expect(error.message).toBe("Sorpresa!");
            }
          }
          expect.assertions(1);
        });
        it("Works if async/await is used", async () => {
          // Arrange
          const mockFunction = vi.fn(async () => 12);
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
                if (isJaypieError(error)) {
                  expect((error as any).isProjectError).toBeTrue();
                  expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
                }
              }
              expect.assertions(2);
              delete process.env.PROJECT_UNAVAILABLE;
            });
            it("Will throw 503 UnavailableError if unavailable=true is passed to the handler", async () => {
              // Arrange
              const handler = jaypieHandler(() => {}, { unavailable: true });
              // Act
              try {
                await handler();
              } catch (error) {
                if (isJaypieError(error)) {
                  expect((error as any).isProjectError).toBeTrue();
                  expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
                }
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
            it("Thrown validate errors throw out", async () => {
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
                expect((error as any).isProjectError).toBeUndefined();
                expect((error as any).status).toBeUndefined();
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
                if (isJaypieError(error)) {
                  expect((error as any).isProjectError).toBeTrue();
                  expect((error as any).status).toBe(HTTP.CODE.BAD_REQUEST);
                }
              }
              expect.assertions(2);
            });
            it("Will skip any validate functions that are not functions", async () => {
              // Arrange
              const handler = jaypieHandler(() => {}, {
                // @ts-expect-error intentionally passing invalid inputs
                validate: [null, undefined, 42, "string", {}, []],
              });
              // Act
              await expect(handler()).resolves.not.toThrow();
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
            it("Thrown setup errors throw out", async () => {
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
                expect((error as any).isProjectError).toBeUndefined();
                expect((error as any).status).toBeUndefined();
                expect((error as Error).message).toBe("Sorpresa!");
              }
              expect.assertions(3);
            });
            it("Will skip any setup functions that are not functions", async () => {
              // Arrange
              const handler = jaypieHandler(() => {}, {
                // @ts-expect-error intentionally passing invalid inputs
                setup: [null, undefined, 42, "string", {}, []],
              });
              // Act
              await expect(handler()).resolves.not.toThrow();
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
                // @ts-expect-error intentionally passing invalid inputs
                teardown: [null, undefined, 42, "string", {}, []],
              });
              // Act
              await expect(handler()).resolves.not.toThrow();
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
            expect((error as any).isProjectError).toBeUndefined();
          }
          expect.assertions(1);
        });
      });
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
    });

    it("formatError formats error object", () => {
      const error = new BadRequestError("test error");
      const formatted = formatError(error);

      expect(formatted).toBeObject();
      expect(formatted).toHaveProperty("status", 400);
      expect(formatted).toHaveProperty("data", expect.any(Object));
      expect(formatted.data).toHaveProperty("errors", expect.any(Array));
      expect(formatted.data.errors).toHaveLength(1);
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
});

describe("Jaypie Core Utilities", () => {
  it("Mocks expected function", () => {
    expect(vi.isMockFunction(cloneDeep)).toBeTrue();
    expect(vi.isMockFunction(envBoolean)).toBeTrue();
    expect(vi.isMockFunction(sleep)).toBeTrue();
    expect(vi.isMockFunction(uuid)).toBeTrue();
  });
  it("Mocks return appropriate values", async () => {
    expect(envBoolean()).toBeTrue();
    await expect(sleep()).resolves.toBeTrue();
    expect(uuid()).toBeString();
    // Mock returns a fixed mock UUID string
    expect(uuid()).toBe("00000000-0000-0000-0000-000000000000");
    uuid.mockReturnValueOnce("1234");
    expect(uuid()).toBe("1234");
  });
  describe("cloneDeep", () => {
    it("Should create a deep copy of an object", () => {
      const original = { a: 1, b: { c: 2 } };
      const copy = cloneDeep(original);

      // The copy should be a different object
      expect(copy).not.toBe(original);
      // But with the same structure
      expect(copy).toEqual(original);

      // Modifying the nested object in the copy should not affect the original
      copy.b.c = 3;
      expect(original.b.c).toBe(2);
    });

    it("Should handle arrays", () => {
      const original = [1, [2, 3]];
      const copy = cloneDeep(original);

      // The copy should be a different array
      expect(copy).not.toBe(original);
      // But with the same elements
      expect(copy).toEqual(original);

      // Modifying the nested array in the copy should not affect the original
      const nestedCopy = copy[1] as number[];
      nestedCopy[0] = 4;
      const nestedOriginal = original[1] as number[];
      expect(nestedOriginal[0]).toBe(2);
    });

    it("Should be mockable", () => {
      const mockValue = { mockResult: true };
      cloneDeep.mockReturnValueOnce(mockValue);

      const result = cloneDeep({ original: true });
      expect(result).toBe(mockValue);
      expect(cloneDeep).toHaveBeenCalledWith({ original: true });
    });
  });
  describe("Jaypie Handler", () => {
    describe("Base Cases", () => {
      it("Works", () => {
        expect(jaypieHandler).toBeDefined();
        expect(jaypieHandler).toBeFunction();
        expect(vi.isMockFunction(jaypieHandler)).toBeTrue();
      });
    });
    describe("Observability", () => {
      it("Does not log", async () => {
        // Arrange
        const handler = jaypieHandler(() => {});
        // Act
        await handler();
        // Assert
        expect(log.trace).not.toHaveBeenCalled();
        expect(log.debug).not.toHaveBeenCalled();
        expect(log.info).not.toHaveBeenCalled();
        expect(log.warn).not.toHaveBeenCalled();
        expect(log.error).not.toHaveBeenCalled();
        expect(log.fatal).not.toHaveBeenCalled();
      });
    });
    describe("Happy Paths", () => {
      it("Calls a function I pass it", async () => {
        // Arrange
        const mockFunction = vi.fn(() => 12);
        const handler = jaypieHandler(mockFunction);
        const args = [1, 2, 3];
        // Act
        await handler(...args);
        // Assert
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockFunction).toHaveBeenCalledWith(...args);
      });
      it("Throws the error my function throws", async () => {
        // Arrange
        const mockFunction = vi.fn(() => {
          throw new Error("Sorpresa!");
        });
        const handler = jaypieHandler(mockFunction);
        // Act
        try {
          await handler();
        } catch (error) {
          if (error instanceof Error) {
            expect(error.message).toBe("Sorpresa!");
          }
        }
        expect.assertions(1);
      });
      it("Works if async/await is used", async () => {
        // Arrange
        const mockFunction = vi.fn(async () => 12);
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
              if (isJaypieError(error)) {
                expect((error as any).isProjectError).toBeTrue();
                expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
              }
            }
            expect.assertions(2);
            delete process.env.PROJECT_UNAVAILABLE;
          });
          it("Will throw 503 UnavailableError if unavailable=true is passed to the handler", async () => {
            // Arrange
            const handler = jaypieHandler(() => {}, { unavailable: true });
            // Act
            try {
              await handler();
            } catch (error) {
              if (isJaypieError(error)) {
                expect((error as any).isProjectError).toBeTrue();
                expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
              }
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
          it("Thrown validate errors throw out", async () => {
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
              expect((error as any).isProjectError).toBeUndefined();
              expect((error as any).status).toBeUndefined();
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
              if (isJaypieError(error)) {
                expect((error as any).isProjectError).toBeTrue();
                expect((error as any).status).toBe(HTTP.CODE.BAD_REQUEST);
              }
            }
            expect.assertions(2);
          });
          it("Will skip any validate functions that are not functions", async () => {
            // Arrange
            const handler = jaypieHandler(() => {}, {
              // @ts-expect-error intentionally passing invalid inputs
              validate: [null, undefined, 42, "string", {}, []],
            });
            // Act
            await expect(handler()).resolves.not.toThrow();
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
          it("Thrown setup errors throw out", async () => {
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
              expect((error as any).isProjectError).toBeUndefined();
              expect((error as any).status).toBeUndefined();
              expect((error as Error).message).toBe("Sorpresa!");
            }
            expect.assertions(3);
          });
          it("Will skip any setup functions that are not functions", async () => {
            // Arrange
            const handler = jaypieHandler(() => {}, {
              // @ts-expect-error intentionally passing invalid inputs
              setup: [null, undefined, 42, "string", {}, []],
            });
            // Act
            await expect(handler()).resolves.not.toThrow();
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
              // @ts-expect-error intentionally passing invalid inputs
              teardown: [null, undefined, 42, "string", {}, []],
            });
            // Act
            await expect(handler()).resolves.not.toThrow();
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
          expect((error as any).isProjectError).toBeUndefined();
        }
        expect.assertions(1);
      });
    });
  });
});
