import { describe, it, expect, vi } from "vitest";
import {
  mockRequest,
  mockResponse,
  mockNext,
  mockRouter,
} from "../express";

describe("Express Mocks", () => {
  describe("mockRequest", () => {
    it("should create a default request object", () => {
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

    it("should allow overriding properties", () => {
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
  });

  describe("mockResponse", () => {
    it("should create a response object with chainable methods", () => {
      const res = mockResponse();

      expect(typeof res.status).toBe("function");
      expect(typeof res.json).toBe("function");
      expect(typeof res.send).toBe("function");
      expect(typeof res.end).toBe("function");
      expect(typeof res.setHeader).toBe("function");
      expect(typeof res.redirect).toBe("function");
      expect(typeof res.render).toBe("function");
    });

    it("should allow method chaining", () => {
      const res = mockResponse();

      const result = res.status(200).json({ success: true });

      expect(result).toBe(res);
      expect(res.status.mock.calls[0][0]).toBe(200);
      expect(res.json.mock.calls[0][0]).toEqual({ success: true });
    });

    it("should track method calls", () => {
      const res = mockResponse();

      res.send("Hello, world!");
      res.status(404);

      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls[0][0]).toBe("Hello, world!");
      expect(res.status.mock.calls.length).toBe(1);
      expect(res.status.mock.calls[0][0]).toBe(404);
    });
  });

  describe("mockNext", () => {
    it("should create a mock next function", () => {
      expect(typeof mockNext).toBe("function");
    });

    it("should track calls", () => {
      mockNext();
      expect(mockNext.mock.calls.length).toBe(1);

      const error = new Error("Test error");
      mockNext(error);
      expect(mockNext.mock.calls.length).toBe(2);
      expect(mockNext.mock.calls[1][0]).toBe(error);
    });
  });

  describe("mockRouter", () => {
    it("should create a router with HTTP method functions", () => {
      const router = mockRouter();

      expect(typeof router.get).toBe("function");
      expect(typeof router.post).toBe("function");
      expect(typeof router.put).toBe("function");
      expect(typeof router.delete).toBe("function");
      expect(typeof router.patch).toBe("function");
      expect(typeof router.use).toBe("function");
    });

    it("should allow tracking route handlers", () => {
      const router = mockRouter();
      const handler = () => {};

      router.get("/users", handler);

      expect(router.get.mock.calls.length).toBe(1);
      expect(router.get.mock.calls[0][0]).toBe("/users");
      expect(router.get.mock.calls[0][1]).toBe(handler);
    });
  });
});
