import { describe, it, expect, vi } from "vitest";
import {
  expressHandler,
  echoRoute,
  badRequestRoute,
  notFoundRoute,
  noContentRoute,
  expressHttpCodeHandler,
} from "../express";
import { HTTP, isJaypieError } from "../core";

describe("Express Mocks", () => {
  describe("Base Cases", () => {
    it("expressHandler is a Function", () => {
      expect(typeof expressHandler).toBe("function");
    });

    it("echoRoute is a Function", () => {
      expect(typeof echoRoute).toBe("function");
    });

    it("badRequestRoute is a Function", () => {
      expect(typeof badRequestRoute).toBe("function");
    });

    it("notFoundRoute is a Function", () => {
      expect(typeof notFoundRoute).toBe("function");
    });

    it("noContentRoute is a Function", () => {
      expect(typeof noContentRoute).toBe("function");
    });

    it("expressHttpCodeHandler is a Function", () => {
      expect(typeof expressHttpCodeHandler).toBe("function");
    });
  });

  describe("Jaypie Express", () => {
    it("Mocks expected function", () => {
      expect(vi.isMockFunction(expressHandler)).toBeTrue();
    });
    describe("Express Handler", () => {
      describe("Base Cases", () => {
        it("Works", async () => {
          expect(expressHandler).toBeDefined();
          expect(expressHandler).toBeFunction();
        });
        it("Will call a function I pass it", async () => {
          const mockFunction = vi.fn();
          const handler = expressHandler(mockFunction);
          const req = {};
          const res = {
            on: vi.fn(),
          };
          const next = () => {};
          await handler(req, res, next);
          expect(mockFunction).toHaveBeenCalledTimes(1);
        });
        it("Passes req, res, and anything else to the handler", async () => {
          // Set up four mock variables
          const req = {};
          const res = {
            on: vi.fn(),
          };
          const three = "THREE";
          const four = "FOUR";
          // Set up our mock function
          const mockFunction = vi.fn();
          const handler = expressHandler(mockFunction);
          // Call the handler with our mock variables
          await handler(req, res, three, four);
          // Expect the mock function to have been called with our mock variables
          expect(mockFunction).toHaveBeenCalledTimes(1);
          expect(mockFunction).toHaveBeenCalledWith(req, res, three, four);
        });
        it.todo("As a mock, returns what was sent", async () => {
          //
        });
      });
      describe("Error Conditions", () => {
        it("Throws if not passed a function", () => {
          // Arrange
          // Act
          // Assert
          expect(() => expressHandler({})).toThrow();
          // @ts-expect-error intentionally passing invalid inputs
          expect(() => expressHandler()).toThrow();
          // @ts-expect-error intentionally passing invalid inputs
          expect(() => expressHandler(42)).toThrow();
          // @ts-expect-error intentionally passing invalid inputs
          expect(() => expressHandler("string")).toThrow();
          // @ts-expect-error intentionally passing invalid inputs
          expect(() => expressHandler([])).toThrow();
          // @ts-expect-error intentionally passing invalid inputs
          expect(() => expressHandler(null)).toThrow();
          // @ts-expect-error intentionally passing invalid inputs
          expect(() => expressHandler(undefined)).toThrow();
        });
        it("Throws if passed an invalid locals object", async () => {
          // Arrange
          const mockFunction = vi.fn();
          // Act
          expect(async () => {
            // @ts-expect-error intentionally passing invalid inputs
            expressHandler(mockFunction, { locals: true });
          }).toThrowJaypieError();
          expect(async () => {
            // @ts-expect-error intentionally passing invalid inputs
            expressHandler(mockFunction, { locals: 42 });
          }).toThrowJaypieError();
          expect(async () => {
            // @ts-expect-error intentionally passing invalid inputs
            expressHandler(mockFunction, { locals: "string" });
          }).toThrowJaypieError();
          expect(async () => {
            expressHandler(mockFunction, { locals: [] as any });
          }).toThrowJaypieError();
          expect(async () => {
            // @ts-expect-error intentionally passing invalid inputs
            expressHandler(mockFunction, { locals: null });
          }).toThrowJaypieError();
        });
        it("Will throw out errors", async () => {
          const mockFunction = vi.fn(() => {
            throw new Error("Sorpresa!");
          });
          const handler = expressHandler(mockFunction);
          const req = {};
          const res = {};
          try {
            await handler(req, res);
          } catch (error) {
            expect((error as any).isProjectError).not.toBeTrue();
          }
          expect.assertions(1);
        });
        it("Will throw async errors", async () => {
          const mockFunction = vi
            .fn()
            .mockRejectedValueOnce(new Error("Sorpresa!"));
          const handler = expressHandler(mockFunction);
          const req = {};
          const res = {};
          try {
            await handler(req, res);
          } catch (error) {
            expect((error as any).isProjectError).not.toBeTrue();
          }
          expect.assertions(1);
        });
        it("Will not be tricked by fake res objects", async () => {
          const mockFunction = vi.fn(() => {
            throw new Error("Sorpresa!");
          });
          const handler = expressHandler(mockFunction);
          const req = {};
          const res = {
            status: () => {},
          };
          try {
            await handler(req, res);
          } catch (error) {
            expect((error as any).isProjectError).not.toBeTrue();
            expect((error as Error).message).toBe("Sorpresa!");
          }
          expect.assertions(2);
        });
      });
      describe("Happy Path", () => {
        it("Calls a function I pass it", async () => {
          // Arrange
          const mockFunction = vi.fn(() => 12);
          const handler = expressHandler(mockFunction);
          const args = [1, 2, 3] as [any, any, ...any[]];
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
          const handler = expressHandler(mockFunction);
          // Act
          try {
            await handler({}, {});
          } catch (error) {
            expect((error as Error).message).toBe("Sorpresa!");
          }
          expect.assertions(1);
        });
        it("Works if async/await is used", async () => {
          // Arrange
          const mockFunction = vi.fn(async () => 12);
          const handler = expressHandler(mockFunction);
          // Act
          await handler({}, {});
          // Assert
          expect(mockFunction).toHaveBeenCalledTimes(1);
        });
        it("Returns what the function returns", async () => {
          // Arrange
          const mockFunction = vi.fn(() => 42);
          const handler = expressHandler(mockFunction);
          // Act
          const result = await handler({}, {});
          // Assert
          expect(result).toBe(42);
        });
        it("Returns what async functions resolve", async () => {
          // Arrange
          const mockFunction = vi.fn(async () => 42);
          const handler = expressHandler(mockFunction);
          // Act
          const result = await handler({}, {});
          // Assert
          expect(result).toBe(42);
        });
      });
      describe("Features", () => {
        describe("Locals", () => {
          it("Sets values in req.locals by running functions during setup", async () => {
            // Arrange
            const mockFunction = vi.fn();
            const mockLocalFunction = vi.fn(() => "function");
            const mockLocalAsyncFunction = vi.fn(() =>
              Promise.resolve("async/await"),
            );
            const handler = expressHandler(mockFunction, {
              locals: {
                key: "value",
                fn: mockLocalFunction,
                asyncFn: mockLocalAsyncFunction,
              },
            });
            const req = {} as {
              locals: {
                key: string;
                fn: () => string;
                asyncFn: () => Promise<string>;
              };
            };
            const res = {
              on: vi.fn(),
            };
            const next = () => {};
            // Act
            await handler(req, res, next);
            // Assert
            expect(req.locals).toBeDefined();
            expect(req.locals).toBeObject();
            expect(req.locals.key).toBe("value");
            expect(req.locals.fn).toBe("function");
            expect(req.locals.asyncFn).toBe("async/await");
          });
          it("Sets locals after setup functions are called", async () => {
            // Arrange
            const mockFunction = vi.fn();
            const mockLocalFunction = vi.fn(() => "function");
            const mockSetupFunction = vi.fn();
            const handler = expressHandler(mockFunction, {
              locals: {
                key: "value",
                fn: mockLocalFunction,
              },
              setup: mockSetupFunction,
            });
            const req = {};
            const res = {
              on: vi.fn(),
            };
            const next = () => {};
            // Act
            await handler(req, res, next);
            // Assert
            expect(mockFunction).toHaveBeenCalledTimes(1);
            expect(mockLocalFunction).toHaveBeenCalledTimes(1);
            expect(mockSetupFunction).toHaveBeenCalledTimes(1);
            expect(mockSetupFunction).toHaveBeenCalledBefore(mockLocalFunction);
          });
        });
        describe("Swap expressHandler Parameter Order", () => {
          it("Works with the options object first", async () => {
            // Arrange
            const mockFunction = vi.fn();
            const handler = expressHandler({ unavailable: true }, mockFunction);
            const req = {};
            const res = {
              on: vi.fn(),
            };
            const next = () => {};
            // Act
            try {
              await handler(req, res, next);
            } catch (error) {
              if (isJaypieError(error)) {
                expect((error as any).isProjectError).toBeTrue();
                expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
              }
            }
            expect.assertions(2);
          });
        });
        describe("Unavailable mode", () => {
          it("Works as normal when process.env.PROJECT_UNAVAILABLE is set to false", async () => {
            process.env.PROJECT_UNAVAILABLE = "false";
            const mockFunction = vi.fn();
            const handler = expressHandler(mockFunction);
            const req = {};
            const mockResJson = vi.fn();
            const res = {
              json: mockResJson,
              on: vi.fn(),
              status: vi.fn(() => res),
              send: vi.fn(),
            };
            const next = () => {};
            await expect(async () => handler(req, res, next)).not.toThrow();
          });
          it("Will respond with a 503 if process.env.PROJECT_UNAVAILABLE is set to true", async () => {
            // Arrange
            process.env.PROJECT_UNAVAILABLE = "true";
            const handler = expressHandler(() => {});
            // Act
            try {
              await handler({}, {});
            } catch (error) {
              if (isJaypieError(error)) {
                expect((error as any).isProjectError).toBeTrue();
                expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
              }
            }
            expect.assertions(2);
            delete process.env.PROJECT_UNAVAILABLE;
          });
          it("Will respond with a 503 if unavailable=true is passed to the handler", async () => {
            // Arrange
            const handler = expressHandler(() => {}, { unavailable: true });
            // Act
            try {
              await handler({}, {});
            } catch (error) {
              if (isJaypieError(error)) {
                expect((error as any).isProjectError).toBeTrue();
                expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
              }
            }
            expect.assertions(2);
          });
        });
      });
    });
  });
});
