// Tests for HTTP adapter

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fabricService } from "../service.js";
import {
  buildCorsHeaders,
  buildPreflightHeaders,
  createHttpContext,
  DEFAULT_CORS_CONFIG,
  DEFAULT_CORS_METHODS,
  defaultHttpTransform,
  extractToken,
  fabricHttp,
  getAllowedOrigin,
  getAuthHeader,
  isAuthorizationRequired,
  isFabricHttpService,
  isPreflightRequest,
  normalizeCorsConfig,
  parseBody,
  parsePathParams,
  parseQueryString,
  transformHttpToInput,
  validateAuthorization,
} from "../http/index.js";

describe("HTTP Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // #region HTTP Transformation

  describe("HTTP Transformation", () => {
    describe("parseQueryString", () => {
      it("is a function", () => {
        expect(parseQueryString).toBeFunction();
      });

      it("parses query string into URLSearchParams", () => {
        const params = parseQueryString("foo=bar&baz=qux");
        expect(params.get("foo")).toBe("bar");
        expect(params.get("baz")).toBe("qux");
      });

      it("handles leading ? character", () => {
        const params = parseQueryString("?foo=bar");
        expect(params.get("foo")).toBe("bar");
      });

      it("handles empty string", () => {
        const params = parseQueryString("");
        expect([...params.keys()]).toHaveLength(0);
      });

      it("handles special characters", () => {
        const params = parseQueryString("name=John%20Doe&tag=foo%26bar");
        expect(params.get("name")).toBe("John Doe");
        expect(params.get("tag")).toBe("foo&bar");
      });
    });

    describe("parsePathParams", () => {
      it("is a function", () => {
        expect(parsePathParams).toBeFunction();
      });

      it("extracts single parameter", () => {
        const params = parsePathParams("/users/123", "/users/:id");
        expect(params).toEqual({ id: "123" });
      });

      it("extracts multiple parameters", () => {
        const params = parsePathParams(
          "/users/123/posts/456",
          "/users/:userId/posts/:postId",
        );
        expect(params).toEqual({ userId: "123", postId: "456" });
      });

      it("handles optional parameters when present", () => {
        const params = parsePathParams("/users/123", "/users/:id?");
        expect(params).toEqual({ id: "123" });
      });

      it("handles optional parameters when absent", () => {
        const params = parsePathParams("/users", "/users/:id?");
        expect(params).toEqual({});
      });

      it("returns empty object when no params", () => {
        const params = parsePathParams("/users/list", "/users/list");
        expect(params).toEqual({});
      });
    });

    describe("parseBody", () => {
      it("is a function", () => {
        expect(parseBody).toBeFunction();
      });

      it("parses JSON string", () => {
        const result = parseBody('{"foo":"bar"}');
        expect(result).toEqual({ foo: "bar" });
      });

      it("returns non-JSON string as-is", () => {
        const result = parseBody("plain text");
        expect(result).toBe("plain text");
      });

      it("returns object as-is", () => {
        const input = { foo: "bar" };
        const result = parseBody(input);
        expect(result).toBe(input);
      });

      it("returns null as-is", () => {
        const result = parseBody(null);
        expect(result).toBeNull();
      });

      it("returns undefined as-is", () => {
        const result = parseBody(undefined);
        expect(result).toBeUndefined();
      });
    });

    describe("createHttpContext", () => {
      it("is a function", () => {
        expect(createHttpContext).toBeFunction();
      });

      it("creates context with all options", () => {
        const context = createHttpContext({
          body: { name: "test" },
          headers: { "content-type": "application/json" },
          method: "POST",
          path: "/users",
          queryString: "page=1",
          params: { id: "123" },
        });

        expect(context.body).toEqual({ name: "test" });
        expect(context.headers.get("content-type")).toBe("application/json");
        expect(context.method).toBe("POST");
        expect(context.path).toBe("/users");
        expect(context.query.get("page")).toBe("1");
        expect(context.params).toEqual({ id: "123" });
      });

      it("creates context with defaults", () => {
        const context = createHttpContext({});

        expect(context.body).toEqual({});
        expect(context.headers).toBeInstanceOf(Headers);
        expect(context.method).toBe("GET");
        expect(context.path).toBe("/");
        expect([...context.query.keys()]).toHaveLength(0);
        expect(context.params).toEqual({});
      });

      it("accepts Headers object", () => {
        const headers = new Headers({ authorization: "Bearer token" });
        const context = createHttpContext({ headers });

        expect(context.headers.get("authorization")).toBe("Bearer token");
      });

      it("normalizes method to uppercase", () => {
        const context = createHttpContext({ method: "post" });
        expect(context.method).toBe("POST");
      });

      it("parses JSON body string", () => {
        const context = createHttpContext({ body: '{"foo":"bar"}' });
        expect(context.body).toEqual({ foo: "bar" });
      });
    });

    describe("defaultHttpTransform", () => {
      it("is a function", () => {
        expect(defaultHttpTransform).toBeFunction();
      });

      it("merges query and body", () => {
        const context = createHttpContext({
          queryString: "page=1&limit=10",
          body: { name: "test" },
        });

        const result = defaultHttpTransform(context);

        expect(result).toEqual({ page: "1", limit: "10", name: "test" });
      });

      it("body takes precedence over query", () => {
        const context = createHttpContext({
          queryString: "name=query",
          body: { name: "body" },
        });

        const result = defaultHttpTransform(context);

        expect(result).toEqual({ name: "body" });
      });

      it("handles empty body", () => {
        const context = createHttpContext({
          queryString: "foo=bar",
          body: null,
        });

        const result = defaultHttpTransform(context);

        expect(result).toEqual({ foo: "bar" });
      });

      it("handles empty query", () => {
        const context = createHttpContext({
          body: { foo: "bar" },
        });

        const result = defaultHttpTransform(context);

        expect(result).toEqual({ foo: "bar" });
      });
    });

    describe("transformHttpToInput", () => {
      it("is a function", () => {
        expect(transformHttpToInput).toBeFunction();
      });

      it("uses default transform when not provided", async () => {
        const context = createHttpContext({
          queryString: "id=123",
          body: { name: "test" },
        });

        const result = await transformHttpToInput(context);

        expect(result).toEqual({ id: "123", name: "test" });
      });

      it("uses custom transform when provided", async () => {
        const context = createHttpContext({
          params: { id: "123" },
          body: { action: "update" },
        });

        const customTransform = ({
          params,
          body,
        }: {
          params: Record<string, string>;
          body: unknown;
        }) => ({
          userId: params.id,
          operation: (body as Record<string, unknown>).action,
        });

        const result = await transformHttpToInput(context, customTransform);

        expect(result).toEqual({ userId: "123", operation: "update" });
      });

      it("supports async transform", async () => {
        const context = createHttpContext({ body: { id: "123" } });

        const asyncTransform = async ({ body }: { body: unknown }) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { processed: (body as Record<string, unknown>).id };
        };

        const result = await transformHttpToInput(context, asyncTransform);

        expect(result).toEqual({ processed: "123" });
      });
    });
  });

  // #endregion

  // #region Authorization

  describe("Authorization", () => {
    describe("extractToken", () => {
      it("is a function", () => {
        expect(extractToken).toBeFunction();
      });

      it("extracts token with Bearer prefix", () => {
        expect(extractToken("Bearer eyJhbGc")).toBe("eyJhbGc");
      });

      it("extracts token with lowercase bearer prefix", () => {
        expect(extractToken("bearer eyJhbGc")).toBe("eyJhbGc");
      });

      it("extracts token with uppercase BEARER prefix", () => {
        expect(extractToken("BEARER eyJhbGc")).toBe("eyJhbGc");
      });

      it("extracts token without prefix", () => {
        expect(extractToken("eyJhbGc")).toBe("eyJhbGc");
      });

      it("trims whitespace", () => {
        expect(extractToken("  eyJhbGc  ")).toBe("eyJhbGc");
      });

      it("handles Bearer with extra whitespace", () => {
        expect(extractToken("Bearer   eyJhbGc")).toBe("eyJhbGc");
      });

      it("returns empty string for null", () => {
        expect(extractToken(null)).toBe("");
      });

      it("returns empty string for undefined", () => {
        expect(extractToken(undefined)).toBe("");
      });

      it("returns empty string for empty string", () => {
        expect(extractToken("")).toBe("");
      });
    });

    describe("getAuthHeader", () => {
      it("is a function", () => {
        expect(getAuthHeader).toBeFunction();
      });

      it("gets authorization header", () => {
        const headers = new Headers({ authorization: "Bearer token" });
        expect(getAuthHeader(headers)).toBe("Bearer token");
      });

      it("returns null when not present", () => {
        const headers = new Headers();
        expect(getAuthHeader(headers)).toBeNull();
      });

      it("is case insensitive", () => {
        const headers = new Headers({ Authorization: "Bearer token" });
        expect(getAuthHeader(headers)).toBe("Bearer token");
      });
    });

    describe("isAuthorizationRequired", () => {
      it("is a function", () => {
        expect(isAuthorizationRequired).toBeFunction();
      });

      it("returns true for function config", () => {
        expect(isAuthorizationRequired(() => ({ user: "test" }))).toBe(true);
      });

      it("returns false for false config", () => {
        expect(isAuthorizationRequired(false)).toBe(false);
      });
    });

    describe("validateAuthorization", () => {
      it("is a function", () => {
        expect(validateAuthorization).toBeFunction();
      });

      it("returns undefined for public endpoint (config=false)", async () => {
        const headers = new Headers();
        const result = await validateAuthorization(headers, false);
        expect(result).toBeUndefined();
      });

      it("throws UnauthorizedError when no token provided", async () => {
        const headers = new Headers();
        const authFn = vi.fn();

        await expect(validateAuthorization(headers, authFn)).rejects.toThrow(
          "Authorization header required",
        );
        expect(authFn).not.toHaveBeenCalled();
      });

      it("calls auth function with extracted token", async () => {
        const headers = new Headers({ authorization: "Bearer my-token" });
        const authFn = vi.fn().mockResolvedValue({ userId: "123" });

        const result = await validateAuthorization(headers, authFn);

        expect(authFn).toHaveBeenCalledWith("my-token");
        expect(result).toEqual({ userId: "123" });
      });

      it("handles sync auth function", async () => {
        const headers = new Headers({ authorization: "token123" });
        const authFn = vi.fn().mockReturnValue({ role: "admin" });

        const result = await validateAuthorization(headers, authFn);

        expect(result).toEqual({ role: "admin" });
      });

      it("propagates auth function errors", async () => {
        const headers = new Headers({ authorization: "Bearer invalid" });
        const authFn = vi.fn().mockRejectedValue(new Error("Invalid token"));

        await expect(validateAuthorization(headers, authFn)).rejects.toThrow(
          "Invalid token",
        );
      });
    });
  });

  // #endregion

  // #region CORS

  describe("CORS", () => {
    describe("DEFAULT_CORS_CONFIG", () => {
      it("has correct default values", () => {
        expect(DEFAULT_CORS_CONFIG).toEqual({
          origin: "*",
          credentials: false,
          headers: ["Content-Type", "Authorization"],
          exposeHeaders: [],
          maxAge: 86400,
        });
      });
    });

    describe("DEFAULT_CORS_METHODS", () => {
      it("includes GET, POST, DELETE, OPTIONS", () => {
        expect(DEFAULT_CORS_METHODS).toEqual([
          "GET",
          "POST",
          "DELETE",
          "OPTIONS",
        ]);
      });
    });

    describe("normalizeCorsConfig", () => {
      it("is a function", () => {
        expect(normalizeCorsConfig).toBeFunction();
      });

      it("returns defaults for undefined", () => {
        const config = normalizeCorsConfig(undefined);
        expect(config).toEqual(DEFAULT_CORS_CONFIG);
      });

      it("returns defaults for true", () => {
        const config = normalizeCorsConfig(true);
        expect(config).toEqual(DEFAULT_CORS_CONFIG);
      });

      it("returns undefined for false", () => {
        const config = normalizeCorsConfig(false);
        expect(config).toBeUndefined();
      });

      it("merges custom config with defaults", () => {
        const config = normalizeCorsConfig({
          origin: "https://example.com",
          credentials: true,
        });

        expect(config).toEqual({
          origin: "https://example.com",
          credentials: true,
          headers: ["Content-Type", "Authorization"],
          exposeHeaders: [],
          maxAge: 86400,
        });
      });

      it("allows custom headers", () => {
        const config = normalizeCorsConfig({
          headers: ["X-Custom-Header"],
        });

        expect(config?.headers).toEqual(["X-Custom-Header"]);
      });
    });

    describe("getAllowedOrigin", () => {
      it("is a function", () => {
        expect(getAllowedOrigin).toBeFunction();
      });

      it("returns * for wildcard origin", () => {
        const result = getAllowedOrigin({ origin: "*" }, "https://example.com");
        expect(result).toBe("*");
      });

      it("returns request origin when in allowed list", () => {
        const result = getAllowedOrigin(
          { origin: ["https://example.com", "https://app.example.com"] },
          "https://example.com",
        );
        expect(result).toBe("https://example.com");
      });

      it("returns undefined when not in allowed list", () => {
        const result = getAllowedOrigin(
          { origin: ["https://other.com"] },
          "https://example.com",
        );
        expect(result).toBeUndefined();
      });

      it("returns request origin when matches single string", () => {
        const result = getAllowedOrigin(
          { origin: "https://example.com" },
          "https://example.com",
        );
        expect(result).toBe("https://example.com");
      });

      it("returns undefined when no request origin", () => {
        const result = getAllowedOrigin(
          { origin: ["https://example.com"] },
          null,
        );
        expect(result).toBeUndefined();
      });
    });

    describe("buildCorsHeaders", () => {
      it("is a function", () => {
        expect(buildCorsHeaders).toBeFunction();
      });

      it("returns empty object when config is undefined", () => {
        const headers = buildCorsHeaders(undefined, "https://example.com");
        expect(headers).toEqual({});
      });

      it("builds headers with wildcard origin", () => {
        const config = normalizeCorsConfig(true);
        const headers = buildCorsHeaders(config, "https://example.com");

        expect(headers["Access-Control-Allow-Origin"]).toBe("*");
        expect(headers["Access-Control-Allow-Methods"]).toBe(
          "GET, POST, DELETE, OPTIONS",
        );
        expect(headers["Access-Control-Allow-Headers"]).toBe(
          "Content-Type, Authorization",
        );
        expect(headers["Access-Control-Max-Age"]).toBe("86400");
      });

      it("includes credentials header when enabled", () => {
        const config = normalizeCorsConfig({ credentials: true });
        const headers = buildCorsHeaders(config, "https://example.com");

        expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      });

      it("includes expose headers when specified", () => {
        const config = normalizeCorsConfig({
          exposeHeaders: ["X-Request-Id", "X-Total-Count"],
        });
        const headers = buildCorsHeaders(config, "https://example.com");

        expect(headers["Access-Control-Expose-Headers"]).toBe(
          "X-Request-Id, X-Total-Count",
        );
      });

      it("uses custom methods", () => {
        const config = normalizeCorsConfig(true);
        const headers = buildCorsHeaders(config, "https://example.com", [
          "GET",
          "POST",
        ]);

        expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST");
      });
    });

    describe("isPreflightRequest", () => {
      it("is a function", () => {
        expect(isPreflightRequest).toBeFunction();
      });

      it("returns true for OPTIONS with Access-Control-Request-Method", () => {
        const headers = new Headers({
          "access-control-request-method": "POST",
        });
        expect(isPreflightRequest("OPTIONS", headers)).toBe(true);
      });

      it("returns false for OPTIONS without Access-Control-Request-Method", () => {
        const headers = new Headers();
        expect(isPreflightRequest("OPTIONS", headers)).toBe(false);
      });

      it("returns false for non-OPTIONS method", () => {
        const headers = new Headers({
          "access-control-request-method": "POST",
        });
        expect(isPreflightRequest("POST", headers)).toBe(false);
      });

      it("is case insensitive for method", () => {
        const headers = new Headers({
          "access-control-request-method": "POST",
        });
        expect(isPreflightRequest("options", headers)).toBe(true);
      });
    });

    describe("buildPreflightHeaders", () => {
      it("is a function", () => {
        expect(buildPreflightHeaders).toBeFunction();
      });

      it("returns empty object when config is undefined", () => {
        const headers = buildPreflightHeaders(
          undefined,
          "https://example.com",
          "POST",
          "X-Custom-Header",
        );
        expect(headers).toEqual({});
      });

      it("includes requested headers in response", () => {
        const config = normalizeCorsConfig(true);
        const headers = buildPreflightHeaders(
          config,
          "https://example.com",
          "POST",
          "X-Custom-Header, X-Another-Header",
        );

        expect(headers["Access-Control-Allow-Headers"]).toContain(
          "X-Custom-Header",
        );
        expect(headers["Access-Control-Allow-Headers"]).toContain(
          "X-Another-Header",
        );
      });

      it("combines config headers with requested headers", () => {
        const config = normalizeCorsConfig({
          headers: ["Content-Type"],
        });
        const headers = buildPreflightHeaders(
          config,
          "https://example.com",
          "POST",
          "X-Custom",
        );

        expect(headers["Access-Control-Allow-Headers"]).toContain(
          "Content-Type",
        );
        expect(headers["Access-Control-Allow-Headers"]).toContain("X-Custom");
      });
    });
  });

  // #endregion

  // #region fabricHttp

  describe("fabricHttp", () => {
    it("is a function", () => {
      expect(fabricHttp).toBeFunction();
    });

    describe("Basic Functionality", () => {
      it("creates an HTTP service with inline service", async () => {
        const httpService = fabricHttp({
          alias: "test",
          service: ({ name }: { name: string }) => `Hello, ${name}!`,
        });

        expect(httpService).toBeFunction();
        expect(httpService.$fabric).toBeString();
        expect(httpService.alias).toBe("test");
      });

      it("creates an HTTP service with pre-built fabricService", async () => {
        const coreService = fabricService({
          alias: "core",
          description: "Core service",
          input: {
            value: { type: Number },
          },
          service: ({ value }) => value * 2,
        });

        const httpService = fabricHttp({
          service: coreService,
        });

        expect(httpService).toBeFunction();
        expect(httpService.$fabric).toBeString();
        expect(httpService.alias).toBe("core");
        expect(httpService.description).toBe("Core service");
      });

      it("executes inline service correctly", async () => {
        const httpService = fabricHttp({
          alias: "greet",
          input: {
            name: { type: String },
          },
          service: ({ name }) => `Hello, ${name}!`,
        });

        const result = await httpService({ name: "Alice" });

        expect(result).toBe("Hello, Alice!");
      });

      it("executes pre-built service correctly", async () => {
        const coreService = fabricService({
          alias: "multiply",
          input: {
            value: { type: Number },
          },
          service: ({ value }) => value * 3,
        });

        const httpService = fabricHttp({ service: coreService });

        const result = await httpService({ value: 7 });

        expect(result).toBe(21);
      });
    });

    describe("HTTP-Specific Properties", () => {
      it("attaches http transform function", () => {
        const customHttp = ({ body }: { body: unknown }) =>
          body as Record<string, unknown>;

        const httpService = fabricHttp({
          alias: "test",
          http: customHttp,
          service: () => "result",
        });

        expect(httpService.http).toBe(customHttp);
      });

      it("uses default http transform when not specified", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        expect(httpService.http).toBe(defaultHttpTransform);
      });

      it("attaches authorization config", () => {
        const authFn = (token: string) => ({ token });

        const httpService = fabricHttp({
          alias: "test",
          authorization: authFn,
          service: () => "result",
        });

        expect(httpService.authorization).toBe(authFn);
      });

      it("defaults authorization to false", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        expect(httpService.authorization).toBe(false);
      });

      it("attaches cors config", () => {
        const corsConfig = { origin: "https://example.com" };

        const httpService = fabricHttp({
          alias: "test",
          cors: corsConfig,
          service: () => "result",
        });

        expect(httpService.cors).toEqual(corsConfig);
      });

      it("defaults cors to true", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        expect(httpService.cors).toBe(true);
      });
    });

    describe("Config Merging", () => {
      it("inherits alias from pre-built service", () => {
        const coreService = fabricService({
          alias: "inherited",
          service: () => "result",
        });

        const httpService = fabricHttp({ service: coreService });

        expect(httpService.alias).toBe("inherited");
        expect(httpService.$fabric).toBeString();
      });

      it("inherits description from pre-built service", () => {
        const coreService = fabricService({
          alias: "test",
          description: "Inherited description",
          service: () => "result",
        });

        const httpService = fabricHttp({ service: coreService });

        expect(httpService.description).toBe("Inherited description");
      });

      it("inherits input from pre-built service", () => {
        const coreService = fabricService({
          alias: "test",
          input: {
            name: { type: String },
          },
          service: () => "result",
        });

        const httpService = fabricHttp({ service: coreService });

        expect(httpService.input).toEqual({
          name: { type: String },
        });
      });

      it("allows overriding alias", () => {
        const coreService = fabricService({
          alias: "original",
          service: () => "result",
        });

        const httpService = fabricHttp({
          alias: "overridden",
          service: coreService,
        });

        expect(httpService.alias).toBe("overridden");
      });
    });

    describe("Authorization Handling", () => {
      it("processes authorization when http context provided", async () => {
        const authFn = vi.fn().mockResolvedValue({ userId: "123" });

        const httpService = fabricHttp({
          alias: "test",
          authorization: authFn,
          service: (_, context) => context?.auth,
        });

        const headers = new Headers({ authorization: "Bearer my-token" });
        const httpContext = createHttpContext({ headers });

        const result = await httpService({}, { http: httpContext });

        expect(authFn).toHaveBeenCalledWith("my-token");
        expect(result).toEqual({ userId: "123" });
      });

      it("skips authorization for public endpoints", async () => {
        const httpService = fabricHttp({
          alias: "public",
          authorization: false,
          service: () => "public data",
        });

        const headers = new Headers();
        const httpContext = createHttpContext({ headers });

        const result = await httpService({}, { http: httpContext });

        expect(result).toBe("public data");
      });

      it("skips authorization when no http context", async () => {
        const authFn = vi.fn();

        const httpService = fabricHttp({
          alias: "test",
          authorization: authFn,
          service: () => "result",
        });

        const result = await httpService({});

        expect(authFn).not.toHaveBeenCalled();
        expect(result).toBe("result");
      });
    });

    describe("isFabricHttpService", () => {
      it("is a function", () => {
        expect(isFabricHttpService).toBeFunction();
      });

      it("returns true for fabricHttp service", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        expect(isFabricHttpService(httpService)).toBe(true);
      });

      it("returns false for plain fabricService", () => {
        const service = fabricService({
          alias: "test",
          service: () => "result",
        });

        expect(isFabricHttpService(service)).toBe(false);
      });

      it("returns false for plain function", () => {
        const fn = () => "result";
        expect(isFabricHttpService(fn)).toBe(false);
      });

      it("returns false for object", () => {
        expect(isFabricHttpService({ $fabric: "test" })).toBe(false);
      });

      it("returns false for null", () => {
        expect(isFabricHttpService(null)).toBe(false);
      });
    });
  });

  // #endregion
});
