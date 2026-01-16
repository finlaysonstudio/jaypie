// Tests for Express adapter

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fabricHttp } from "../http/fabricHttp.js";
import { fabricService } from "../service.js";
import {
  fabricExpress,
  FabricRouter,
  isFabricExpressMiddleware,
  isFabricExpressRouter,
} from "../express/index.js";

// Mock Express request
function createMockRequest(
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
    path?: string;
    query?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
): {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
  query: Record<string, string>;
  params: Record<string, string>;
  get: (name: string) => string | undefined;
} {
  const headers = options.headers ?? {};
  return {
    body: options.body ?? {},
    headers,
    method: options.method ?? "GET",
    path: options.path ?? "/",
    query: options.query ?? {},
    params: options.params ?? {},
    get: (name: string) => {
      const lowerName = name.toLowerCase();
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
          return value;
        }
      }
      return undefined;
    },
  };
}

// Mock Express response
function createMockResponse(): {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  statusCode: number;
  headersSent: boolean;
} {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    set: vi.fn(),
    statusCode: 200,
    headersSent: false,
  };
  // Chain methods
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
}

describe("Express Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // #region fabricExpress

  describe("fabricExpress", () => {
    it("is a function", () => {
      expect(fabricExpress).toBeFunction();
    });

    describe("Basic Functionality", () => {
      it("creates middleware from FabricHttpService", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const middleware = fabricExpress({ service: httpService });

        expect(middleware).toBeFunction();
        expect(middleware.service).toBe(httpService);
        expect(middleware.path).toBe("/test");
        expect(middleware.methods).toEqual(["GET", "POST", "DELETE"]);
      });

      it("throws if service is not a FabricHttpService", () => {
        const plainService = fabricService({
          alias: "plain",
          service: () => "result",
        });

        expect(() => fabricExpress({ service: plainService as never })).toThrow(
          "fabricExpress requires a FabricHttpService",
        );
      });

      it("uses custom path when provided", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const middleware = fabricExpress({
          service: httpService,
          path: "/custom/path/:id",
        });

        expect(middleware.path).toBe("/custom/path/:id");
      });

      it("uses custom methods when provided", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const middleware = fabricExpress({
          service: httpService,
          methods: ["GET", "PUT"],
        });

        expect(middleware.methods).toEqual(["GET", "PUT"]);
      });

      it("defaults to empty path for service without alias", () => {
        const httpService = fabricHttp({
          service: () => "result",
        });

        const middleware = fabricExpress({ service: httpService });

        expect(middleware.path).toBe("/");
      });
    });

    describe("Request Handling", () => {
      it("calls service with transformed input", async () => {
        const serviceFn = vi.fn().mockReturnValue({ greeting: "Hello" });
        const httpService = fabricHttp({
          alias: "greet",
          input: {
            name: { type: String },
          },
          service: serviceFn,
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({
          method: "POST",
          body: { name: "Alice" },
        });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(serviceFn).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Alice" }),
          expect.any(Object),
        );
      });

      it("sends JSON:API success response", async () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => ({ id: "123", name: "Test" }),
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({ method: "GET" });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          data: { id: "123", name: "Test" },
        });
      });

      it("sends 204 No Content for null/undefined response", async () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => null,
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({ method: "DELETE" });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
      });

      it("sends JSON:API error response on error", async () => {
        const error = new Error("Something went wrong");
        (error as Error & { status: number }).status = 400;
        (error as Error & { title: string }).title = "Bad Request";

        const httpService = fabricHttp({
          alias: "test",
          service: () => {
            throw error;
          },
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({ method: "GET" });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          errors: [
            {
              detail: "Something went wrong",
              status: 400,
              title: "Bad Request",
            },
          ],
        });
      });

      it("defaults to 500 status for errors without status", async () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => {
            throw new Error("Unknown error");
          },
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({ method: "GET" });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("CORS Handling", () => {
      it("sets CORS headers on response", async () => {
        const httpService = fabricHttp({
          alias: "test",
          cors: true,
          service: () => "result",
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({
          method: "GET",
          headers: { origin: "https://example.com" },
        });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.set).toHaveBeenCalledWith(
          "Access-Control-Allow-Origin",
          "*",
        );
        expect(res.set).toHaveBeenCalledWith(
          "Access-Control-Allow-Methods",
          expect.any(String),
        );
      });

      it("handles CORS preflight request", async () => {
        const httpService = fabricHttp({
          alias: "test",
          cors: true,
          service: () => "result",
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({
          method: "OPTIONS",
          headers: {
            origin: "https://example.com",
            "access-control-request-method": "POST",
          },
        });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
      });

      it("skips CORS when disabled", async () => {
        const httpService = fabricHttp({
          alias: "test",
          cors: false,
          service: () => "result",
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({ method: "GET" });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.set).not.toHaveBeenCalledWith(
          "Access-Control-Allow-Origin",
          expect.any(String),
        );
      });
    });

    describe("Method Validation", () => {
      it("returns 405 for disallowed method", async () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const middleware = fabricExpress({
          service: httpService,
          methods: ["GET", "POST"],
        });

        const req = createMockRequest({ method: "PUT" });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
          errors: [
            {
              detail: "Method PUT not allowed",
              status: 405,
              title: "Method Not Allowed",
            },
          ],
        });
      });
    });

    describe("Input Transformation", () => {
      it("merges query and body by default", async () => {
        const serviceFn = vi.fn().mockReturnValue("result");
        const httpService = fabricHttp({
          alias: "test",
          input: {
            page: { type: Number, default: 1 },
            name: { type: String },
          },
          service: serviceFn,
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({
          method: "POST",
          query: { page: "2" },
          body: { name: "Alice" },
        });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(serviceFn).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, name: "Alice" }),
          expect.any(Object),
        );
      });

      it("uses custom http transform", async () => {
        const serviceFn = vi.fn().mockReturnValue("result");
        const httpService = fabricHttp({
          alias: "test",
          input: {
            userId: { type: String },
          },
          http: ({ params }) => ({
            userId: params.id,
          }),
          service: serviceFn,
        });

        const middleware = fabricExpress({ service: httpService });

        const req = createMockRequest({
          method: "GET",
          params: { id: "user-123" },
        });
        const res = createMockResponse();
        const next = vi.fn();

        await middleware(req as never, res as never, next);

        expect(serviceFn).toHaveBeenCalledWith(
          expect.objectContaining({ userId: "user-123" }),
          expect.any(Object),
        );
      });
    });

    describe("isFabricExpressMiddleware", () => {
      it("is a function", () => {
        expect(isFabricExpressMiddleware).toBeFunction();
      });

      it("returns true for fabricExpress middleware", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const middleware = fabricExpress({ service: httpService });

        expect(isFabricExpressMiddleware(middleware)).toBe(true);
      });

      it("returns false for plain function", () => {
        const fn = () => {};
        expect(isFabricExpressMiddleware(fn)).toBe(false);
      });

      it("returns false for null", () => {
        expect(isFabricExpressMiddleware(null)).toBe(false);
      });
    });
  });

  // #endregion

  // #region FabricRouter

  describe("FabricRouter", () => {
    it("is a function", () => {
      expect(FabricRouter).toBeFunction();
    });

    describe("Basic Functionality", () => {
      it("creates router with services", () => {
        const service1 = fabricHttp({
          alias: "users",
          service: () => [],
        });
        const service2 = fabricHttp({
          alias: "products",
          service: () => [],
        });

        const router = FabricRouter({
          services: [service1, service2],
        });

        expect(router).toBeFunction();
        expect(router.services).toHaveLength(2);
        expect(router.services).toContain(service1);
        expect(router.services).toContain(service2);
      });

      it("accepts service config objects", () => {
        const service = fabricHttp({
          alias: "custom",
          service: () => "result",
        });

        const router = FabricRouter({
          services: [
            {
              service,
              path: "/custom/:id",
              methods: ["POST"],
            },
          ],
        });

        expect(router.services).toHaveLength(1);
      });

      it("stores prefix", () => {
        const service = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const router = FabricRouter({
          services: [service],
          prefix: "/api/v1",
        });

        expect(router.prefix).toBe("/api/v1");
      });

      it("throws for invalid service entry", () => {
        expect(() =>
          FabricRouter({
            services: [{ notAService: true } as never],
          }),
        ).toThrow("Each service entry must be a FabricHttpService");
      });
    });

    describe("isFabricExpressRouter", () => {
      it("is a function", () => {
        expect(isFabricExpressRouter).toBeFunction();
      });

      it("returns true for FabricRouter", () => {
        const service = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        const router = FabricRouter({ services: [service] });

        expect(isFabricExpressRouter(router)).toBe(true);
      });

      it("returns false for plain object", () => {
        expect(isFabricExpressRouter({ services: [] })).toBe(false);
      });

      it("returns false for null", () => {
        expect(isFabricExpressRouter(null)).toBe(false);
      });
    });
  });

  // #endregion
});
