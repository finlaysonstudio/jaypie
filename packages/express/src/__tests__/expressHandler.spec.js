import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP,
  InternalError,
  NotFoundError,
  jaypieHandler,
} from "@jaypie/core";

import getCurrentInvokeUuid from "../getCurrentInvokeUuid.adapter.js";
import decorateResponse from "../decorateResponse.helper.js";

// Subject
import expressHandler from "../expressHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");
vi.mock("../decorateResponse.helper.js");
vi.mock("@jaypie/core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    jaypieHandler: vi.fn(),
  };
});

beforeEach(() => {
  getCurrentInvokeUuid.mockReturnValue("MOCK_UUID");
  jaypieHandler.mockImplementation((handler, options) => {
    return async (...args) => {
      // Simulate environment variable processing for unavailable (same logic as jaypieHandler)
      let unavailable = options?.unavailable;
      if (unavailable === undefined) {
        // Simulate envBoolean("PROJECT_UNAVAILABLE", { defaultValue: false })
        const envValue = process.env.PROJECT_UNAVAILABLE;
        unavailable = envValue === "true";
      }

      // Simulate unavailable check - this should happen before anything else
      if (unavailable) {
        const { UnavailableError } = await import("@jaypie/core");
        throw new UnavailableError();
      }
      // Simulate setup functions execution for locals tests
      if (options?.setup && Array.isArray(options.setup)) {
        for (const setupFn of options.setup) {
          if (typeof setupFn === "function") {
            await setupFn(...args);
          }
        }
      }
      return await handler(...args);
    };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

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
  });
  describe("Error Conditions", () => {
    it("Throws if not passed a function", () => {
      // Arrange
      // Act
      // Assert
      expect(() => expressHandler()).toThrow();
      expect(() => expressHandler(42)).toThrow();
      expect(() => expressHandler("string")).toThrow();
      expect(() => expressHandler({})).toThrow();
      expect(() => expressHandler([])).toThrow();
      expect(() => expressHandler(null)).toThrow();
      expect(() => expressHandler(undefined)).toThrow();
    });
    it("Throws if passed an invalid locals object", () => {
      // Arrange
      const mockFunction = vi.fn();
      // Act
      // Assert
      expect(() =>
        expressHandler(mockFunction, { locals: true }),
      ).toThrowJaypieError();
      expect(() =>
        expressHandler(mockFunction, { locals: 42 }),
      ).toThrowJaypieError();
      expect(() =>
        expressHandler(mockFunction, { locals: "string" }),
      ).toThrowJaypieError();
      expect(() =>
        expressHandler(mockFunction, { locals: [] }),
      ).toThrowJaypieError();
      expect(() =>
        expressHandler(mockFunction, { locals: null }),
      ).toThrowJaypieError();
    });
    it("Will catch an unhandled thrown error", async () => {
      const mockFunction = vi.fn(() => {
        throw new Error("Sorpresa!");
      });
      const handler = expressHandler(mockFunction);
      const req = {};
      const mockResJson = vi.fn();
      const res = {
        json: mockResJson,
        on: vi.fn(),
        status: vi.fn(() => res),
      };
      const next = () => {};
      await handler(req, res, next);
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockResJson).toHaveBeenCalledTimes(1);
      const response = mockResJson.mock.calls[0][0];
      expect(response).toBeJaypieError();
      expect(response.errors[0].status).toBe(500);
      // The response title will be "Internal Application Error" but we don't want to test that here
      // expect(response.errors[0].title).toBe("Internal Application Error");
    });
    it("Will catch an unhandled thrown async error", async () => {
      const mockFunction = vi
        .fn()
        .mockRejectedValueOnce(new Error("Sorpresa!"));
      const handler = expressHandler(mockFunction);
      const req = {};
      const mockResJson = vi.fn();
      const mockResStatus = vi.fn(() => ({ json: mockResJson }));
      const res = {
        json: mockResJson,
        on: vi.fn(),
        status: mockResStatus,
      };
      const next = () => {};
      await handler(req, res, next);
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockResStatus).toHaveBeenCalledTimes(1);
      expect(mockResJson).toHaveBeenCalledTimes(1);
      // Expect mockResStatus' first call to be internal error
      expect(mockResStatus.mock.calls[0][0]).toBe(HTTP.CODE.INTERNAL_ERROR);
      const response = mockResJson.mock.calls[0][0];
      expect(response).toBeJaypieError();
      expect(response.errors[0].status).toBe(HTTP.CODE.INTERNAL_ERROR);
      // The response title will be "Internal Application Error" but we don't want to test that here
      // expect(response.errors[0].title).toBe("Internal Application Error");
    });
    it("Will catch a thrown ProjectError and respond with the correct status code", async () => {
      // Mock a function that throws NotFoundError
      const mockFunction = vi.fn(() => {
        throw new NotFoundError();
      });
      const handler = expressHandler(mockFunction);
      const req = {};
      const mockResJson = vi.fn();
      const res = {
        json: mockResJson,
        on: vi.fn(),
        status: vi.fn(() => res),
      };
      const next = () => {};
      await handler(req, res, next);
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockResJson).toHaveBeenCalledTimes(1);
      const response = mockResJson.mock.calls[0][0];
      expect(response).toBeJaypieError();
      expect(response.errors[0].status).toBe(404);
    });
  });
  describe("Features", () => {
    it.todo("Sets the name of the handler");
    it.todo("Tags the public logger with the handler name");
    describe("Automatic response", () => {
      it("Responds as JSON if the response is a pure object", async () => {
        // Arrange
        const mockFunction = vi.fn(() => ({ key: "value" }));
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        expect(decorateResponse).toBeCalledTimes(1);
      });
      it("Responds as JSON if the response is an array", async () => {
        // Arrange
        const mockFunction = vi.fn(() => ["value"]);
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        expect(decorateResponse).toBeCalledTimes(1);
      });
      it("Responds as JSON if the response is a string that casts to JSON", async () => {
        // Arrange
        const mockFunction = vi.fn(() => JSON.stringify({ key: "value" }));
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        expect(decorateResponse).toBeCalledTimes(1);
      });
      it("Responds as JSON if the response has a .json() that returns an object", async () => {
        // Arrange
        const mockFunction = vi.fn(() => ({
          json: () => ({ key: "value" }),
        }));
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        expect(decorateResponse).toBeCalledTimes(1);
      });
      it("Responds as HTML if the response is a string that starts with <", async () => {
        // Arrange
        const mockFunction = vi.fn(() => "<html></html>");
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResSend = vi.fn();
        const res = {
          send: mockResSend,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockResSend).toHaveBeenCalledTimes(1);
        expect(decorateResponse).toBeCalledTimes(1);
      });
      it("Responds as no content if the response is null", async () => {
        // Arrange
        const mockFunction = vi.fn(() => null);
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResSend = vi.fn();
        const res = {
          send: mockResSend,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.status).toBeCalled();
        expect(res.status).toBeCalledWith(HTTP.CODE.NO_CONTENT);
        expect(res.send).toBeCalled();
        expect(res.send).toBeCalledWith(); // No arguments, which is different from undefined
      });
      it("Responds as no content if the response is undefined", async () => {
        // Arrange
        const mockFunction = vi.fn(() => undefined);
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResSend = vi.fn();
        const res = {
          send: mockResSend,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.status).toBeCalled();
        expect(res.status).toBeCalledWith(HTTP.CODE.NO_CONTENT);
        expect(res.send).toBeCalled();
        expect(res.send).toBeCalledWith(); // No arguments, which is different from undefined
      });
      it("Responds as no content if the response is false", async () => {
        // Arrange
        const mockFunction = vi.fn(() => false);
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResSend = vi.fn();
        const res = {
          send: mockResSend,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.status).toBeCalled();
        expect(res.status).toBeCalledWith(HTTP.CODE.NO_CONTENT);
        expect(res.send).toBeCalled();
        expect(res.send).toBeCalledWith(); // No arguments, which is different from undefined
      });
      it("Responds as created if the response is true", async () => {
        // Arrange
        const mockFunction = vi.fn(() => true);
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResSend = vi.fn();
        const res = {
          send: mockResSend,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.status).toBeCalled();
        expect(res.status).toBeCalledWith(HTTP.CODE.CREATED);
        expect(res.send).toBeCalled();
        expect(res.send).toBeCalledWith(); // No arguments, which is different from undefined
      });
      it("Lets express handle anything else", async () => {
        // Arrange
        const mockFunction = vi.fn(() => 12);
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResSend = vi.fn();
        const res = {
          send: mockResSend,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.send).toBeCalled();
        expect(res.send).toBeCalledWith(12);
      });
      it("Will not override res.json() if it was sent", async () => {
        // Arrange
        const mockFunction = vi.fn((req, res) => {
          res.json({ key: "value" });
          return false;
        });
        const handler = expressHandler(mockFunction);
        const req = {};
        const res = {
          json: vi.fn(),
          on: vi.fn(),
          send: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.json).toHaveBeenCalledTimes(1);
        expect(res.send).toHaveBeenCalledTimes(0);
      });
      it("Will not override res.send() if it was sent", async () => {
        // Arrange
        const mockFunction = vi.fn((req, res) => {
          res.send("<html></html>");
          return { key: "value" };
        });
        const handler = expressHandler(mockFunction);
        const req = {};
        const res = {
          json: vi.fn(),
          on: vi.fn(),
          send: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.json).toHaveBeenCalledTimes(0);
        expect(res.send).toHaveBeenCalledTimes(1);
      });
      it("Will not override res.status() if it was sent", async () => {
        // Arrange
        const mockFunction = vi.fn((req, res) => {
          res.status(404).send("<html></html>");
          throw new InternalError();
        });
        const handler = expressHandler(mockFunction);
        const req = {};
        const res = {
          json: vi.fn(),
          on: vi.fn(),
          send: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(res.json).toHaveBeenCalledTimes(0);
        expect(res.send).toHaveBeenCalledTimes(1);
        expect(res.send).toHaveBeenCalledWith("<html></html>");
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
      });
    });
    describe("Locals", () => {
      it("Sets values in res.locals by running functions during setup", async () => {
        // Arrange
        const mockFunction = vi.fn();
        const mockLocalFunction = vi.fn();
        const mockLocalAsyncFunction = vi.fn();
        mockLocalFunction.mockReturnValue("function");
        mockLocalAsyncFunction.mockResolvedValue("async/await");
        const handler = expressHandler(mockFunction, {
          locals: {
            key: "value",
            fn: mockLocalFunction,
            asyncFn: mockLocalAsyncFunction,
          },
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
        expect(mockLocalAsyncFunction).toHaveBeenCalledTimes(1);
        expect(req.locals).toBeDefined();
        expect(req.locals).toBeObject();
        expect(req.locals.key).toBe("value");
        expect(req.locals.fn).toBe("function");
        expect(req.locals.asyncFn).toBe("async/await");
      });
      it("Sets locals after setup functions are called", async () => {
        // Arrange
        const mockFunction = vi.fn();
        const mockLocalFunction = vi.fn();
        const mockSetupFunction = vi.fn();
        mockLocalFunction.mockReturnValue("function");
        mockSetupFunction.mockReturnValue("setup");
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
        const mockFunction = vi.fn();
        const handler = expressHandler({ unavailable: true }, mockFunction);
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        await handler(req, res, next);
        expect(mockFunction).toHaveBeenCalledTimes(0);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        const response = mockResJson.mock.calls[0][0];
        expect(response).toBeJaypieError();
        expect(response.errors[0].status).toBe(HTTP.CODE.UNAVAILABLE);
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
        };
        const next = () => {};
        await handler(req, res, next);
        expect(mockFunction).toHaveBeenCalledTimes(1);
      });
      it("Will respond with a 503 if process.env.PROJECT_UNAVAILABLE is set to true", async () => {
        process.env.PROJECT_UNAVAILABLE = "true";
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction);
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        await handler(req, res, next);
        expect(mockFunction).toHaveBeenCalledTimes(0);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        const response = mockResJson.mock.calls[0][0];
        expect(response).toBeJaypieError();
        expect(response.errors[0].status).toBe(HTTP.CODE.UNAVAILABLE);
      });
      it("Will respond with a 503 if unavailable=true is passed to the handler", async () => {
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction, { unavailable: true });
        const req = {};
        const mockResJson = vi.fn();
        const res = {
          json: mockResJson,
          on: vi.fn(),
          status: vi.fn(() => res),
        };
        const next = () => {};
        await handler(req, res, next);
        expect(mockFunction).toHaveBeenCalledTimes(0);
        expect(mockResJson).toHaveBeenCalledTimes(1);
        const response = mockResJson.mock.calls[0][0];
        expect(response).toBeJaypieError();
        expect(response.errors[0].status).toBe(HTTP.CODE.UNAVAILABLE);
      });
    });
    describe("Chaos", () => {
      const DEFAULT_ENV = process.env;

      beforeEach(() => {
        process.env = { ...DEFAULT_ENV };
      });

      afterEach(() => {
        process.env = DEFAULT_ENV;
      });

      it("Passes default chaos from environment to jaypieHandler", async () => {
        // Arrange
        process.env.PROJECT_CHAOS = "medium";
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction);
        const req = {};
        const res = {
          on: vi.fn(),
          status: vi.fn(() => res),
          json: vi.fn(),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(jaypieHandler).toHaveBeenCalledWith(mockFunction, {
          chaos: "medium",
          name: expect.any(String),
          setup: expect.any(Array),
          teardown: expect.any(Array),
          unavailable: undefined,
          validate: undefined,
        });
      });

      it("Passes chaos from options to jaypieHandler", async () => {
        // Arrange
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction, { chaos: "high" });
        const req = {};
        const res = {
          on: vi.fn(),
          status: vi.fn(() => res),
          json: vi.fn(),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(jaypieHandler).toHaveBeenCalledWith(mockFunction, {
          chaos: "high",
          name: expect.any(String),
          setup: expect.any(Array),
          teardown: expect.any(Array),
          unavailable: undefined,
          validate: undefined,
        });
      });

      it("Passes chaos from HTTP header to jaypieHandler", async () => {
        // Arrange
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction);
        const req = {
          headers: {
            "X-Project-Chaos": "low",
          },
        };
        const res = {
          on: vi.fn(),
          status: vi.fn(() => res),
          json: vi.fn(),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(jaypieHandler).toHaveBeenCalledWith(mockFunction, {
          chaos: "low",
          name: expect.any(String),
          setup: expect.any(Array),
          teardown: expect.any(Array),
          unavailable: undefined,
          validate: undefined,
        });
      });

      it("Options override header and environment chaos", async () => {
        // Arrange
        process.env.PROJECT_CHAOS = "medium";
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction, { chaos: "high" });
        const req = {
          headers: {
            "X-Project-Chaos": "low",
          },
        };
        const res = {
          on: vi.fn(),
          status: vi.fn(() => res),
          json: vi.fn(),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(jaypieHandler).toHaveBeenCalledWith(mockFunction, {
          chaos: "high",
          name: expect.any(String),
          setup: expect.any(Array),
          teardown: expect.any(Array),
          unavailable: undefined,
          validate: undefined,
        });
      });

      it("Environment overrides header chaos when no options provided", async () => {
        // Arrange
        process.env.PROJECT_CHAOS = "medium";
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction);
        const req = {
          headers: {
            "X-Project-Chaos": "low",
          },
        };
        const res = {
          on: vi.fn(),
          status: vi.fn(() => res),
          json: vi.fn(),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(jaypieHandler).toHaveBeenCalledWith(mockFunction, {
          chaos: "medium",
          name: expect.any(String),
          setup: expect.any(Array),
          teardown: expect.any(Array),
          unavailable: undefined,
          validate: undefined,
        });
      });

      it("Uses header chaos when no environment variable set", async () => {
        // Arrange
        delete process.env.PROJECT_CHAOS;
        const mockFunction = vi.fn();
        const handler = expressHandler(mockFunction);
        const req = {
          headers: {
            "X-Project-Chaos": "low",
          },
        };
        const res = {
          on: vi.fn(),
          status: vi.fn(() => res),
          json: vi.fn(),
        };
        const next = () => {};
        // Act
        await handler(req, res, next);
        // Assert
        expect(jaypieHandler).toHaveBeenCalledWith(mockFunction, {
          chaos: "low",
          name: expect.any(String),
          setup: expect.any(Array),
          teardown: expect.any(Array),
          unavailable: undefined,
          validate: undefined,
        });
      });
    });
  });
});
