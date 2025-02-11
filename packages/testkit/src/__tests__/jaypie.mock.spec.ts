import { afterEach, describe, expect, it, vi } from "vitest";

import { TextractPageAdaptable } from "@jaypie/textract";
import { mongoose as expectedMongoose } from "@jaypie/mongoose";

import matchers from "../matchers.module";
import sqsTestRecords from "../sqsTestRecords.function";

// Subject
import {
  ConfigurationError,
  connect,
  connectFromSecretEnv,
  disconnect,
  envBoolean,
  expressHandler,
  getMessages,
  getSecret,
  HTTP,
  jaypieHandler,
  lambdaHandler,
  log,
  MarkdownPage,
  mongoose,
  sendBatchMessages,
  sendMessage,
  sleep,
  SQSMessage,
  submitMetric,
  submitMetricSet,
  textractJsonToMarkdown,
  uuid,
} from "../jaypie.mock";

import { isJaypieError, ProjectError } from "@jaypie/core";
import { JsonReturn } from "@jaypie/types";

// Add custom matchers
expect.extend(matchers);

//
//
// Mock modules
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Jaypie Mock", () => {
  it("Exports constants we expect", async () => {
    expect(HTTP).toBeObject();
    expect(HTTP.CODE.INTERNAL_ERROR).toBe(500);
  });
  describe("Jaypie Packages", () => {
    describe("Jaypie AWS", () => {
      it("Mocks expected function", () => {
        expect(getMessages).not.toHaveBeenCalled();
        expect(getSecret).not.toHaveBeenCalled();
        expect(sendBatchMessages).not.toHaveBeenCalled();
        expect(sendMessage).not.toHaveBeenCalled();
      });
      it("Mocks return appropriate values", () => {
        expect(getSecret()).toBeString();
        expect(sendBatchMessages()).toBeObject();
        expect(sendMessage()).toBeObject();
      });
      it("sqsTestRecords mock returns appropriate values", () => {
        // Arrange
        const testRecords = sqsTestRecords(
          { MessageId: 1, Body: "Hello, World!" },
          { MessageId: 2, Body: "Goodbye, World!" },
        );
        // Assure
        expect(getMessages).not.toHaveBeenCalled();
        expect(testRecords).toBeObject();
        expect(testRecords.Records).toBeArray();
        expect(testRecords.Records[0].body).toBeString();
        // Act
        const messages = getMessages(testRecords) as Array<SQSMessage>;
        // Assert
        expect(getMessages).toHaveBeenCalled();
        expect(messages).toBeArray();
        expect(messages).toHaveLength(2);
        expect(messages[0].Body).toBe("Hello, World!");
        expect(messages[1].MessageId).toBe(2);
      });
    });
    describe("Jaypie Core Utilities", () => {
      it("Mocks expected function", () => {
        expect(vi.isMockFunction(envBoolean)).toBeTrue();
        expect(vi.isMockFunction(sleep)).toBeTrue();
        expect(vi.isMockFunction(uuid)).toBeTrue();
      });
      it("Mocks return appropriate values", () => {
        expect(envBoolean()).toBeTrue();
        expect(sleep()).toBeTrue();
        expect(uuid()).toBeString();
        expect(uuid()).toMatchUuid();
        uuid.mockReturnValueOnce("1234");
        expect(uuid()).not.toMatchUuid();
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
                    expect(error.isProjectError).toBeTrue();
                    expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
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
                    expect(error.isProjectError).toBeTrue();
                    expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
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
                  expect(
                    (error as ProjectError).isProjectError,
                  ).toBeUndefined();
                  expect((error as ProjectError).status).toBeUndefined();
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
                    expect(error.isProjectError).toBeTrue();
                    expect(error.status).toBe(HTTP.CODE.BAD_REQUEST);
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
                  expect(
                    (error as ProjectError).isProjectError,
                  ).toBeUndefined();
                  expect((error as ProjectError).status).toBeUndefined();
                  expect((error as ProjectError).message).toBe("Sorpresa!");
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
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
              expect((error as ProjectError).isProjectError).toBeUndefined();
            }
            expect.assertions(1);
          });
        });
      });
    });
    describe("Jaypie Datadog", () => {
      it("Mocks expected function", () => {
        expect(vi.isMockFunction(submitMetric)).toBeTrue();
        expect(vi.isMockFunction(submitMetricSet)).toBeTrue();
      });
      it("Mocks return appropriate values", () => {
        expect(submitMetric()).toBeTrue();
        expect(submitMetricSet()).toBeTrue();
      });
    });
    describe("Jaypie Errors", () => {
      it("Mocks errors", () => {
        expect(ConfigurationError).toBeDefined();
        expect(ConfigurationError).toBeFunction();
        expect(ConfigurationError.mock).toBeDefined();
        try {
          throw new ConfigurationError("Sorpresa!");
        } catch (error) {
          if (isJaypieError(error)) {
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBeNumber();
            expect(error.message).toBeString();
            expect(error.detail).toBeString();
            expect(error.detail).toBe("Sorpresa!");
          }
        }
        try {
          throw ConfigurationError("Sorpresa!");
        } catch (error) {
          if (isJaypieError(error)) {
            expect(error.isProjectError).toBeTrue();
            expect(error.status).toBeNumber();
            expect(error.message).toBeString();
            expect(error.detail).toBeString();
            expect(error.detail).toBe("Sorpresa!");
          }
        }
        expect.assertions(13);
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
              // @ts-expect-error intentionally passing invalid inputs
              expressHandler(mockFunction, { locals: [] });
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
            try {
              await handler(req);
            } catch (error) {
              expect((error as ProjectError).isProjectError).not.toBeTrue();
            }
            expect.assertions(1);
          });
          it("Will throw async errors", async () => {
            const mockFunction = vi
              .fn()
              .mockRejectedValueOnce(new Error("Sorpresa!"));
            const handler = expressHandler(mockFunction);
            const req = {};
            try {
              await handler(req);
            } catch (error) {
              expect((error as ProjectError).isProjectError).not.toBeTrue();
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
              expect((error as ProjectError).isProjectError).not.toBeTrue();
              expect((error as ProjectError).message).toBe("Sorpresa!");
            }
            expect.assertions(2);
          });
        });
        describe("Happy Path", () => {
          it("Calls a function I pass it", async () => {
            // Arrange
            const mockFunction = vi.fn(() => 12);
            const handler = expressHandler(mockFunction);
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
            const handler = expressHandler(mockFunction);
            // Act
            try {
              await handler();
            } catch (error) {
              expect((error as ProjectError).message).toBe("Sorpresa!");
            }
            expect.assertions(1);
          });
          it("Works if async/await is used", async () => {
            // Arrange
            const mockFunction = vi.fn(async () => 12);
            const handler = expressHandler(mockFunction);
            // Act
            await handler();
            // Assert
            expect(mockFunction).toHaveBeenCalledTimes(1);
          });
          it("Returns what the function returns", async () => {
            // Arrange
            const mockFunction = vi.fn(() => 42);
            const handler = expressHandler(mockFunction);
            // Act
            const result = await handler();
            // Assert
            expect(result).toBe(42);
          });
          it("Returns what async functions resolve", async () => {
            // Arrange
            const mockFunction = vi.fn(async () => 42);
            const handler = expressHandler(mockFunction);
            // Act
            const result = await handler();
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
              expect(mockSetupFunction).toHaveBeenCalledBefore(
                mockLocalFunction,
              );
            });
          });
          describe("Swap expressHandler Parameter Order", () => {
            it("Works with the options object first", async () => {
              // Arrange
              const mockFunction = vi.fn();
              const handler = expressHandler(
                { unavailable: true },
                mockFunction,
              );
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
                  expect(error.isProjectError).toBeTrue();
                  expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
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
                await handler();
              } catch (error) {
                if (isJaypieError(error)) {
                  expect(error.isProjectError).toBeTrue();
                  expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
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
                await handler();
              } catch (error) {
                if (isJaypieError(error)) {
                  expect(error.isProjectError).toBeTrue();
                  expect(error.status).toBe(HTTP.CODE.UNAVAILABLE);
                }
              }
              expect.assertions(2);
            });
          });
        });
      });
    });
    describe("Jaypie Lambda", () => {
      it("Mocks expected function", () => {
        expect(vi.isMockFunction(lambdaHandler)).toBeTrue();
      });
      describe("Lambda Handler", () => {
        describe("Base Cases", () => {
          it("Works", async () => {
            expect(lambdaHandler).toBeDefined();
            expect(lambdaHandler).toBeFunction();
          });
          it("Will call a function I pass it", async () => {
            const mockFunction = vi.fn();
            const handler = lambdaHandler(mockFunction);
            const event = {};
            const context = {};
            const callback = vi.fn();
            await handler(event, context, callback);
            expect(mockFunction).toHaveBeenCalledTimes(1);
          });
          it("Passes event, context, and anything else to the handler", async () => {
            // Set up four mock variables
            const event = {};
            const context = {};
            const three = "THREE";
            const four = "FOUR";
            // Set up our mock function
            const mockFunction = vi.fn();
            const handler = lambdaHandler(mockFunction);
            // Call the handler with our mock variables
            await handler(event, context, three, four);
            // Expect the mock function to have been called with our mock variables
            expect(mockFunction).toHaveBeenCalledTimes(1);
            expect(mockFunction).toHaveBeenCalledWith(
              event,
              context,
              three,
              four,
            );
          });
          it("As a mock, returns what was sent", async () => {
            // Arrange
            const mockFunction = vi.fn(() => 42);
            const handler = lambdaHandler(mockFunction);
            const event = {};
            const context = {};
            // Act
            const result = await handler(event, context);
            // Assert
            expect(result).toBe(42);
          });
        });
        describe("Error Conditions", () => {
          it("Will throw out errors", async () => {
            const mockFunction = vi.fn(() => {
              throw new Error("Sorpresa!");
            });
            const handler = lambdaHandler(mockFunction);
            const event = {};
            const context = {};
            try {
              await handler(event, context);
            } catch (error) {
              expect((error as ProjectError).isProjectError).not.toBeTrue();
            }
            expect.assertions(1);
          });
          it("Will throw async errors", async () => {
            const mockFunction = vi
              .fn()
              .mockRejectedValueOnce(new Error("Sorpresa!"));
            const handler = lambdaHandler(mockFunction);
            const event = {};
            const context = {};
            try {
              await handler(event, context);
            } catch (error) {
              expect((error as ProjectError).isProjectError).not.toBeTrue();
            }
            expect.assertions(1);
          });
        });
        describe("Features", () => {
          describe("Swap lambdaHandler Parameter Order", () => {
            it("Works with the options object first", async () => {
              // Arrange
              const mockFunction = vi.fn();
              const handler = lambdaHandler(
                { unavailable: true },
                mockFunction,
              );
              const event = {};
              const context = {};
              // Act
              try {
                await handler(event, context);
              } catch (error) {
                expect((error as ProjectError).isProjectError).toBeTrue();
                expect((error as ProjectError).status).toBe(
                  HTTP.CODE.UNAVAILABLE,
                );
              }
              expect.assertions(2);
            });
          });
        });
      });
    });
    describe("Jaypie Logger", () => {
      it("Provides mock functions we expect", () => {
        expect(log).toBeObject();
        expect(vi.isMockFunction(log)).toBeFalse();
        expect(vi.isMockFunction(log.debug)).toBeTrue();
        expect(vi.isMockFunction(log.error)).toBeTrue();
        expect(vi.isMockFunction(log.fatal)).toBeTrue();
        expect(vi.isMockFunction(log.info)).toBeTrue();
        expect(vi.isMockFunction(log.init)).toBeTrue();
        expect(vi.isMockFunction(log.lib)).toBeTrue();
        expect(vi.isMockFunction(log.tag)).toBeTrue();
        expect(vi.isMockFunction(log.trace)).toBeTrue();
        expect(vi.isMockFunction(log.untag)).toBeTrue();
        expect(vi.isMockFunction(log.var)).toBeTrue();
        expect(vi.isMockFunction(log.warn)).toBeTrue();
        expect(vi.isMockFunction(log.with)).toBeTrue();
      });
    });
    describe("Jaypie Mongoose", () => {
      it("Mocks expected function", () => {
        expect(connect).not.toHaveBeenCalled();
        expect(connectFromSecretEnv).not.toHaveBeenCalled();
        expect(disconnect).not.toHaveBeenCalled();
      });
      it("Mocks return appropriate values", () => {
        expect(connect()).toBeTrue();
        expect(connectFromSecretEnv()).toBeTrue();
        expect(disconnect()).toBeTrue();
      });
      it("Mongoose is unaltered (for now)", () => {
        expect(mongoose).toBe(expectedMongoose);
      });
      it.todo("Mocks mongoose", () => {
        expect(vi.isMockFunction(mongoose)).toBeTrue();
        expect(vi.isMockFunction(mongoose.connect)).toBeTrue();
      });
    });
    describe("Jaypie Textract", () => {
      it("Mocks expected functions", () => {
        expect(vi.isMockFunction(MarkdownPage)).toBeTrue();
        expect(vi.isMockFunction(textractJsonToMarkdown)).toBeTrue();
      });
      it("Mocks return string values", () => {
        expect(MarkdownPage({} as TextractPageAdaptable)).toBeString();
        expect(textractJsonToMarkdown({} as JsonReturn)).toBeString();
      });
    });
  }); // END describe Jaypie Packages
});
