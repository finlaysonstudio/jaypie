import { describe, it, expect, vi } from "vitest";
import {
  mockRequest,
  mockResponse,
  mockNext,
  mockRouter,
  expressHandler,
  echoRoute,
  badRequestRoute,
  notFoundRoute,
  noContentRoute,
  expressHttpCodeHandler,
} from "../express";

describe("Express Mocks", () => {
  describe("Base Cases", () => {
    it("mockRequest is a function", () => {
      expect(typeof mockRequest).toBe("function");
    });

    it("mockResponse is a function", () => {
      expect(typeof mockResponse).toBe("function");
    });

    it("mockNext is a function", () => {
      expect(typeof mockNext).toBe("function");
    });

    it("mockRouter is a function", () => {
      expect(typeof mockRouter).toBe("function");
    });

    it("expressHandler is a function", () => {
      expect(typeof expressHandler).toBe("function");
    });

    it("echoRoute is a function", () => {
      expect(typeof echoRoute).toBe("function");
    });

    it("badRequestRoute is a function", () => {
      expect(typeof badRequestRoute).toBe("function");
    });

    it("notFoundRoute is a function", () => {
      expect(typeof notFoundRoute).toBe("function");
    });

    it("noContentRoute is a function", () => {
      expect(typeof noContentRoute).toBe("function");
    });

    it("expressHttpCodeHandler is a function", () => {
      expect(typeof expressHttpCodeHandler).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("mockRequest creates a default request object with expected properties", () => {
      const req = mockRequest();

      expect(req.params).toEqual({});
      expect(req.query).toEqual({});
      expect(req.body).toEqual({});
      expect(req.headers).toEqual({});
      expect(req.cookies).toEqual({});
      expect(req.session).toEqual({});
      expect(req.path).toBe("/mock-path");
      expect(req.method).toBe("GET");
    });

    it("mockResponse creates a response object with chainable methods", () => {
      const res = mockResponse();

      expect(typeof res.status).toBe("function");
      expect(typeof res.json).toBe("function");
      expect(typeof res.send).toBe("function");
      expect(typeof res.end).toBe("function");
      expect(typeof res.setHeader).toBe("function");
      expect(typeof res.redirect).toBe("function");
      expect(typeof res.render).toBe("function");
      expect(typeof res.cookie).toBe("function");
      expect(typeof res.clearCookie).toBe("function");
      expect(typeof res.sendStatus).toBe("function");
    });

    it("mockRouter creates a router with HTTP method functions", () => {
      const router = mockRouter();

      expect(typeof router.get).toBe("function");
      expect(typeof router.post).toBe("function");
      expect(typeof router.put).toBe("function");
      expect(typeof router.delete).toBe("function");
      expect(typeof router.patch).toBe("function");
      expect(typeof router.use).toBe("function");
      expect(typeof router.all).toBe("function");
      expect(typeof router.options).toBe("function");
      expect(typeof router.head).toBe("function");
      expect(typeof router.param).toBe("function");
    });
  });

  describe("Error Conditions", () => {
    it("expressHandler throws error when handler is not a function", async () => {
      const notAFunction = {} as any;
      try {
        expressHandler(notAFunction);
        fail("Expected error not thrown");
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain(
          "handler must be a function",
        );
      }
    });
  });

  describe("Features", () => {
    it("mockRequest allows overriding properties", () => {
      const req = mockRequest({
        params: { id: "123" },
        query: { filter: "active" },
        method: "POST",
        body: { name: "test" },
      });

      expect(req.params).toEqual({ id: "123" });
      expect(req.query).toEqual({ filter: "active" });
      expect(req.method).toBe("POST");
      expect(req.body).toEqual({ name: "test" });
      expect(req.path).toBe("/mock-path"); // Not overridden
    });

    it("mockResponse allows method chaining", () => {
      const res = mockResponse();

      const result = res.status(200).json({ success: true });

      expect(result).toBe(res);
      expect(res.status.mock.calls[0][0]).toBe(200);
      expect(res.json.mock.calls[0][0]).toEqual({ success: true });
    });

    it("mockNext tracks calls and arguments", () => {
      mockNext();
      expect(mockNext.mock.calls.length).toBe(1);

      const error = new Error("Test error");
      mockNext(error);
      expect(mockNext.mock.calls.length).toBe(2);
      expect(mockNext.mock.calls[1][0]).toBe(error);
    });

    it("mockResponse tracks method calls", () => {
      const res = mockResponse();

      res.send("Hello, world!");
      res.status(404);

      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls[0][0]).toBe("Hello, world!");
      expect(res.status.mock.calls.length).toBe(1);
      expect(res.status.mock.calls[0][0]).toBe(404);
    });

    it("mockRouter allows tracking route handlers", () => {
      const router = mockRouter();
      const handler = () => {};

      router.get("/users", handler);

      expect(router.get.mock.calls.length).toBe(1);
      expect(router.get.mock.calls[0][0]).toBe("/users");
      expect(router.get.mock.calls[0][1]).toBe(handler);
    });

    it("expressHandler executes the handler with request and response", async () => {
      const handlerFn = vi.fn().mockReturnValue({ success: true });
      const wrapped = expressHandler(handlerFn);
      const req = mockRequest();
      const res = mockResponse();

      const result = await wrapped(req, res);

      expect(handlerFn).toHaveBeenCalledWith(req, res);
      expect(result).toEqual({ success: true });
    });

    it("expressHandler supports both handler-first and options-first signatures", async () => {
      const handlerFn = vi.fn().mockReturnValue({ success: true });
      const options = { locals: { user: { id: 123 } } };

      // Options-first signature
      const wrapped1 = expressHandler(options, handlerFn);
      // Handler-first signature
      const wrapped2 = expressHandler(handlerFn, options);

      const req = mockRequest();
      const res = mockResponse();

      await wrapped1(req, res);
      await wrapped2(req, res);

      expect(handlerFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Specific Scenarios", () => {
    it("echoRoute returns request information in the response", () => {
      const req = mockRequest({
        method: "POST",
        path: "/echo",
        body: { data: "test" },
      });
      const res = mockResponse();

      echoRoute(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: "/echo",
          body: { data: "test" },
        }),
      );
    });

    it("badRequestRoute returns a 400 status with error information", () => {
      const req = mockRequest();
      const res = mockResponse();

      badRequestRoute(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: "BadRequestError",
            message: "Bad request",
          }),
        }),
      );
    });

    it("noContentRoute returns a 204 status with empty response", () => {
      const req = mockRequest();
      const res = mockResponse();

      noContentRoute(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("expressHttpCodeHandler creates a handler that returns the specified status code", () => {
      const handler = expressHttpCodeHandler(418); // I'm a teapot
      const req = mockRequest();
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(418);
    });
  });
});
