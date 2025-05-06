import { describe, it, expect, vi } from "vitest";
import {
  expressHandler,
  echoRoute,
  badRequestRoute,
  notFoundRoute,
  noContentRoute,
  expressHttpCodeHandler,
} from "../express";
import { BadRequestError } from "../core";

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

  describe("Error Conditions", () => {
    it("expressHandler throws BadRequestError when handler is not a function", () => {
      expect(() => expressHandler({}, {} as any)).toThrow(BadRequestError);
    });

    it("expressHandler validates props.locals is an object", () => {
      // @ts-expect-error - Testing with invalid locals
      expect(() => expressHandler(() => {}, { locals: 123 })).toThrow(
        BadRequestError,
      );
    });

    it("expressHandler validates props.locals is not an array", () => {
      // @ts-expect-error - Testing with invalid locals
      expect(() => expressHandler(() => {}, { locals: [] })).toThrow(
        BadRequestError,
      );
    });

    it("expressHandler validates props.locals is not null", () => {
      // @ts-expect-error - Testing with invalid locals
      expect(() => expressHandler(() => {}, { locals: null })).toThrow(
        BadRequestError,
      );
    });
  });

  describe("Happy Paths", () => {
    it("echoRoute returns request details", async () => {
      const req = {
        method: "GET",
        path: "/test",
        params: { id: "123" },
        query: { filter: "active" },
        headers: { "content-type": "application/json" },
        body: { name: "test" },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      echoRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        method: "GET",
        path: "/test",
        params: { id: "123" },
        query: { filter: "active" },
        headers: { "content-type": "application/json" },
        body: { name: "test" },
      });
    });

    it("badRequestRoute returns 400 error response", () => {
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      badRequestRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          name: "BadRequestError",
          message: "Bad request",
        },
      });
    });

    it("notFoundRoute returns 404 error response", () => {
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      notFoundRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          name: "NotFoundError",
          message: "Not found",
        },
      });
    });

    it("noContentRoute returns 204 with no content", () => {
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        end: vi.fn(),
      };
      const next = vi.fn();

      noContentRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("expressHttpCodeHandler creates a handler for a specific status code", () => {
      const statusHandler = expressHttpCodeHandler(201);
      expect(typeof statusHandler).toBe("function");

      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      statusHandler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({});
    });

    it("expressHttpCodeHandler handles 204 No Content", () => {
      const noContentHandler = expressHttpCodeHandler(204);
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        end: vi.fn(),
      };
      const next = vi.fn();

      noContentHandler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("expressHttpCodeHandler creates error response for error status codes", () => {
      const errorHandler = expressHttpCodeHandler(404, {
        message: "Custom not found message",
      });
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      errorHandler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: "NotFoundError",
            message: "Custom not found message",
          }),
        }),
      );
    });
  });

  describe("Features", () => {
    it("expressHandler accepts options as first parameter and handler as second", async () => {
      const handler = vi.fn();
      const wrapper = expressHandler({ locals: { test: "value" } }, handler);

      const req = { locals: {} };
      await wrapper(req, {});

      expect(handler).toHaveBeenCalled();
      expect(req.locals.test).toBe("value");
    });

    it("expressHandler accepts handler as first parameter and options as second", async () => {
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { locals: { test: "value" } });

      const req = { locals: {} };
      await wrapper(req, {});

      expect(handler).toHaveBeenCalled();
      expect(req.locals.test).toBe("value");
    });

    it("expressHandler runs setup functions", async () => {
      const setupFn = vi.fn();
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { setup: setupFn });

      await wrapper({}, {});

      expect(setupFn).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it("expressHandler runs validate functions", async () => {
      const validateFn = vi.fn(() => true);
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { validate: validateFn });

      await wrapper({}, {});

      expect(validateFn).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it("expressHandler fails when validation returns false", async () => {
      const validateFn = vi.fn(() => false);
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { validate: validateFn });

      // Using try/catch instead of toThrow because of async behavior
      let error;
      try {
        await wrapper({}, {});
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(BadRequestError);
      expect(validateFn).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it("expressHandler runs teardown functions even when handler throws", async () => {
      const teardownFn = vi.fn();
      const handler = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      const wrapper = expressHandler(handler, { teardown: teardownFn });

      // Using try/catch instead of toThrow because of async behavior
      let error;
      try {
        await wrapper({}, {});
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Test error");
      expect(handler).toHaveBeenCalled();
      expect(teardownFn).toHaveBeenCalled();
    });

    it("expressHandler handles locals property", async () => {
      const handler = vi.fn();
      const wrapper = expressHandler(handler, {
        locals: {
          staticValue: "test",
          dynamicValue: () => "dynamic",
        },
      });

      const req = { locals: {} };
      await wrapper(req, {});

      expect(req.locals.staticValue).toBe("test");
      expect(req.locals.dynamicValue).toBe("dynamic");
    });

    it("expressHandler handles supertest mode with non-object response", async () => {
      const handler = vi.fn().mockResolvedValue("string response");
      const wrapper = expressHandler(handler);

      const res = {
        socket: {},
        constructor: { name: "ServerResponse" },
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await wrapper({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("string response");
    });

    it("expressHandler handles supertest mode with null response", async () => {
      const handler = vi.fn().mockResolvedValue(null);
      const wrapper = expressHandler(handler);

      const res = {
        socket: {},
        constructor: { name: "ServerResponse" },
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await wrapper({}, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("expressHandler handles array of setup functions", async () => {
      const setup1 = vi.fn();
      const setup2 = vi.fn();
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { setup: [setup1, setup2] });

      await wrapper({}, {});

      expect(setup1).toHaveBeenCalled();
      expect(setup2).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it("expressHandler handles array of validate functions", async () => {
      const validate1 = vi.fn(() => true);
      const validate2 = vi.fn(() => true);
      const handler = vi.fn();
      const wrapper = expressHandler(handler, {
        validate: [validate1, validate2],
      });

      await wrapper({}, {});

      expect(validate1).toHaveBeenCalled();
      expect(validate2).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it("expressHandler handles array of teardown functions", async () => {
      const teardown1 = vi.fn();
      const teardown2 = vi.fn();
      const handler = vi.fn();
      const wrapper = expressHandler(handler, {
        teardown: [teardown1, teardown2],
      });

      await wrapper({}, {});

      expect(teardown1).toHaveBeenCalled();
      expect(teardown2).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Specific Scenarios", () => {
    it("expressHandler creates req.locals if it doesn't exist", async () => {
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { locals: { test: "value" } });

      const req = {};
      await wrapper(req, {});

      expect(handler).toHaveBeenCalled();
      // @ts-expect-error - Testing runtime behavior
      expect(req.locals.test).toBe("value");
    });

    it("expressHandler handles invalid req.locals", async () => {
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { locals: { test: "value" } });

      const req = { locals: "not an object" };

      // Using try/catch instead of toThrow because of async behavior
      let error;
      try {
        await wrapper(req, {});
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(BadRequestError);
      expect(handler).not.toHaveBeenCalled();
    });

    it("expressHandler initializes req.locals._jaypie if it doesn't exist", async () => {
      const handler = vi.fn();
      const wrapper = expressHandler(handler, { locals: { test: "value" } });

      const req = { locals: {} };
      await wrapper(req, {});

      expect(handler).toHaveBeenCalled();
      expect(req.locals._jaypie).toBeDefined();
    });

    it("expressHandler handles supertest error scenario", async () => {
      const errorMessage = "Test error";
      const handler = vi.fn().mockImplementation(() => {
        // The implementation converts errors to UnhandledError in supertest mode
        // So we need to verify what res.json is actually called with
        throw new BadRequestError(errorMessage);
      });
      const wrapper = expressHandler(handler);

      const res = {
        socket: {},
        constructor: { name: "ServerResponse" },
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await wrapper({}, res);

      expect(res.status).toHaveBeenCalledWith(500); // Default is internal error (500)
      expect(res.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          name: "UnhandledError", // The mock converts it to an UnhandledError
          message: "Unhandled error",
        }),
      });
    });
  });
});
