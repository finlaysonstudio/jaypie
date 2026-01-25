// Tests for HTTP adapter

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fabricService } from "../service.js";
import {
  buildCorsHeaders,
  buildPreflightHeaders,
  collectStreamEvents,
  createCompleteEvent,
  createDataEvent,
  createErrorEvent,
  createHttpContext,
  createMessageEvent,
  createNoopEvent,
  createStreamContext,
  createTextEvent,
  createToolCallEvent,
  createToolResultEvent,
  DEFAULT_CORS_CONFIG,
  DEFAULT_CORS_METHODS,
  DEFAULT_STREAM_CONFIG,
  defaultHttpTransform,
  extractToken,
  fabricHttp,
  formatNdjsonEvent,
  formatSseEvent,
  formatStreamEvent,
  getAllowedOrigin,
  getAuthHeader,
  getStreamContentType,
  HttpStreamEventType,
  isAsyncIterable,
  isAuthorizationRequired,
  isFabricHttpService,
  isPreflightRequest,
  isStreamingEnabled,
  llmChunkToHttpEvent,
  normalizeCorsConfig,
  normalizeStreamConfig,
  parseBody,
  parsePathParams,
  parseQueryString,
  pipeLlmStream,
  pipeLlmStreamToWriter,
  transformHttpToInput,
  validateAuthorization,
  wrapServiceForStreaming,
} from "../http/index.js";
import type { HttpStreamEvent, LlmStreamChunk } from "../http/index.js";

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

  // #region Streaming

  describe("Streaming", () => {
    describe("DEFAULT_STREAM_CONFIG", () => {
      it("has correct default values", () => {
        expect(DEFAULT_STREAM_CONFIG).toEqual({
          format: "ndjson",
          heartbeat: 15000,
          includeTools: true,
        });
      });
    });

    describe("HttpStreamEventType", () => {
      it("has correct enum values", () => {
        expect(HttpStreamEventType.Message).toBe("message");
        expect(HttpStreamEventType.Text).toBe("text");
        expect(HttpStreamEventType.ToolCall).toBe("tool_call");
        expect(HttpStreamEventType.ToolResult).toBe("tool_result");
        expect(HttpStreamEventType.Data).toBe("data");
        expect(HttpStreamEventType.Error).toBe("error");
        expect(HttpStreamEventType.Complete).toBe("complete");
      });
    });

    describe("normalizeStreamConfig", () => {
      it("is a function", () => {
        expect(normalizeStreamConfig).toBeFunction();
      });

      it("returns undefined for undefined", () => {
        expect(normalizeStreamConfig(undefined)).toBeUndefined();
      });

      it("returns undefined for false", () => {
        expect(normalizeStreamConfig(false)).toBeUndefined();
      });

      it("returns defaults for true", () => {
        expect(normalizeStreamConfig(true)).toEqual(DEFAULT_STREAM_CONFIG);
      });
    });

    describe("isStreamingEnabled", () => {
      it("is a function", () => {
        expect(isStreamingEnabled).toBeFunction();
      });

      it("returns false for undefined", () => {
        expect(isStreamingEnabled(undefined)).toBe(false);
      });

      it("returns false for false", () => {
        expect(isStreamingEnabled(false)).toBe(false);
      });

      it("returns true for true", () => {
        expect(isStreamingEnabled(true)).toBe(true);
      });
    });

    describe("Event Formatting", () => {
      describe("formatSseEvent", () => {
        it("is a function", () => {
          expect(formatSseEvent).toBeFunction();
        });

        it("formats text event as SSE", () => {
          const event = createTextEvent("Hello");
          const result = formatSseEvent(event);
          expect(result).toBe(
            'event: text\ndata: {"stream":"text","content":"Hello"}\n\n',
          );
        });

        it("formats message event as SSE", () => {
          const event = createMessageEvent("Processing...", "info");
          const result = formatSseEvent(event);
          expect(result).toContain("event: message\n");
          expect(result).toContain('"stream":"message"');
          expect(result).toContain('"content":"Processing..."');
          expect(result).toContain('"level":"info"');
        });

        it("formats complete event as SSE", () => {
          const event = createCompleteEvent();
          const result = formatSseEvent(event);
          expect(result).toBe(
            'event: complete\ndata: {"stream":"complete"}\n\n',
          );
        });
      });

      describe("formatNdjsonEvent", () => {
        it("is a function", () => {
          expect(formatNdjsonEvent).toBeFunction();
        });

        it("formats event as NDJSON", () => {
          const event = createTextEvent("Hello");
          const result = formatNdjsonEvent(event);
          expect(result).toBe('{"stream":"text","content":"Hello"}\n');
        });
      });

      describe("formatStreamEvent", () => {
        it("is a function", () => {
          expect(formatStreamEvent).toBeFunction();
        });

        it("uses NDJSON format by default", () => {
          const event = createTextEvent("Hello");
          const config = normalizeStreamConfig(true)!;
          const result = formatStreamEvent(event, config);
          expect(result).toBe('{"stream":"text","content":"Hello"}\n');
        });

        it("uses SSE format when specified", () => {
          const event = createTextEvent("Hello");
          const config = { format: "sse" as const };
          const result = formatStreamEvent(event, config);
          expect(result).toContain("event: text\n");
        });
      });

      describe("getStreamContentType", () => {
        it("is a function", () => {
          expect(getStreamContentType).toBeFunction();
        });

        it("returns application/x-ndjson by default", () => {
          const config = normalizeStreamConfig(true)!;
          expect(getStreamContentType(config)).toBe("application/x-ndjson");
        });

        it("returns text/event-stream for SSE", () => {
          const config = { format: "sse" as const };
          expect(getStreamContentType(config)).toBe("text/event-stream");
        });
      });
    });

    describe("Event Creators", () => {
      describe("createMessageEvent", () => {
        it("creates message event without level", () => {
          const event = createMessageEvent("Processing");
          expect(event).toEqual({
            stream: HttpStreamEventType.Message,
            content: "Processing",
          });
        });

        it("creates message event with level", () => {
          const event = createMessageEvent("Warning", "warn");
          expect(event).toEqual({
            stream: HttpStreamEventType.Message,
            content: "Warning",
            level: "warn",
          });
        });
      });

      describe("createTextEvent", () => {
        it("creates text event", () => {
          const event = createTextEvent("Hello");
          expect(event).toEqual({
            stream: HttpStreamEventType.Text,
            content: "Hello",
          });
        });
      });

      describe("createToolCallEvent", () => {
        it("creates tool call event", () => {
          const event = createToolCallEvent({
            id: "call-123",
            name: "get_weather",
            arguments: '{"city":"NYC"}',
          });
          expect(event).toEqual({
            stream: HttpStreamEventType.ToolCall,
            toolCall: {
              id: "call-123",
              name: "get_weather",
              arguments: '{"city":"NYC"}',
            },
          });
        });
      });

      describe("createToolResultEvent", () => {
        it("creates tool result event", () => {
          const event = createToolResultEvent({
            id: "call-123",
            name: "get_weather",
            result: { temp: 72 },
          });
          expect(event).toEqual({
            stream: HttpStreamEventType.ToolResult,
            toolResult: {
              id: "call-123",
              name: "get_weather",
              result: { temp: 72 },
            },
          });
        });
      });

      describe("createDataEvent", () => {
        it("creates data event with any data", () => {
          const event = createDataEvent({ name: "Alice", age: 30 });
          expect(event).toEqual({
            stream: HttpStreamEventType.Data,
            data: { name: "Alice", age: 30 },
          });
        });

        it("creates data event with primitive", () => {
          const event = createDataEvent("result");
          expect(event).toEqual({
            stream: HttpStreamEventType.Data,
            data: "result",
          });
        });
      });

      describe("createErrorEvent", () => {
        it("creates error event", () => {
          const event = createErrorEvent({
            status: 400,
            title: "Bad Request",
            detail: "Invalid input",
          });
          expect(event).toEqual({
            stream: HttpStreamEventType.Error,
            error: {
              status: 400,
              title: "Bad Request",
              detail: "Invalid input",
            },
          });
        });

        it("creates error event without detail", () => {
          const event = createErrorEvent({
            status: 500,
            title: "Internal Error",
          });
          expect(event.error.detail).toBeUndefined();
        });
      });

      describe("createCompleteEvent", () => {
        it("creates complete event", () => {
          const event = createCompleteEvent();
          expect(event).toEqual({
            stream: HttpStreamEventType.Complete,
          });
        });
      });

      describe("createNoopEvent", () => {
        it("creates noop event", () => {
          const event = createNoopEvent();
          expect(event).toEqual({
            stream: HttpStreamEventType.Noop,
          });
        });
      });
    });

    describe("Stream Context", () => {
      describe("createStreamContext", () => {
        it("is a function", () => {
          expect(createStreamContext).toBeFunction();
        });

        it("creates context with streamText method", () => {
          const writer = vi.fn();
          const context = createStreamContext(writer);

          context.streamText("Hello");

          expect(writer).toHaveBeenCalledWith({
            stream: HttpStreamEventType.Text,
            content: "Hello",
          });
        });

        it("creates context with streamEvent method", () => {
          const writer = vi.fn();
          const context = createStreamContext(writer);
          const event = createDataEvent({ foo: "bar" });

          context.streamEvent(event);

          expect(writer).toHaveBeenCalledWith(event);
        });

        it("creates context with sendMessage that streams", () => {
          const writer = vi.fn();
          const context = createStreamContext(writer);

          context.sendMessage!({ content: "Processing...", level: "info" });

          expect(writer).toHaveBeenCalledWith({
            stream: HttpStreamEventType.Message,
            content: "Processing...",
            level: "info",
          });
        });

        it("preserves base context properties", () => {
          const writer = vi.fn();
          const context = createStreamContext(writer, {
            auth: { userId: "123" },
          });

          expect(context.auth).toEqual({ userId: "123" });
        });

        it("swallows writer errors in streamText", () => {
          const writer = vi.fn().mockImplementation(() => {
            throw new Error("Connection closed");
          });
          const context = createStreamContext(writer);

          // Should not throw
          expect(() => context.streamText("Hello")).not.toThrow();
        });

        it("swallows writer errors in streamEvent", () => {
          const writer = vi.fn().mockImplementation(() => {
            throw new Error("Connection closed");
          });
          const context = createStreamContext(writer);

          // Should not throw
          expect(() =>
            context.streamEvent(createCompleteEvent()),
          ).not.toThrow();
        });
      });
    });

    describe("Async Generator Utilities", () => {
      describe("isAsyncIterable", () => {
        it("is a function", () => {
          expect(isAsyncIterable).toBeFunction();
        });

        it("returns true for async generator", () => {
          async function* gen() {
            yield 1;
          }
          expect(isAsyncIterable(gen())).toBe(true);
        });

        it("returns true for object with Symbol.asyncIterator", () => {
          const iterable = {
            async *[Symbol.asyncIterator]() {
              yield 1;
            },
          };
          expect(isAsyncIterable(iterable)).toBe(true);
        });

        it("returns false for plain object", () => {
          expect(isAsyncIterable({ foo: "bar" })).toBe(false);
        });

        it("returns false for null", () => {
          expect(isAsyncIterable(null)).toBe(false);
        });

        it("returns false for array", () => {
          expect(isAsyncIterable([1, 2, 3])).toBe(false);
        });
      });

      describe("collectStreamEvents", () => {
        it("is a function", () => {
          expect(collectStreamEvents).toBeFunction();
        });

        it("collects all events from async iterable", async () => {
          async function* gen(): AsyncIterable<HttpStreamEvent> {
            yield createTextEvent("Hello");
            yield createTextEvent("World");
            yield createCompleteEvent();
          }

          const events = await collectStreamEvents(gen());

          expect(events).toHaveLength(3);
          expect(events[0]).toEqual(createTextEvent("Hello"));
          expect(events[1]).toEqual(createTextEvent("World"));
          expect(events[2]).toEqual(createCompleteEvent());
        });
      });

      describe("wrapServiceForStreaming", () => {
        it("is a function", () => {
          expect(wrapServiceForStreaming).toBeFunction();
        });

        it("wraps non-async-iterable as data + complete events", async () => {
          const result = { name: "Alice" };
          const events = await collectStreamEvents(
            wrapServiceForStreaming(result),
          );

          expect(events).toHaveLength(2);
          expect(events[0]).toEqual(createDataEvent(result));
          expect(events[1]).toEqual(createCompleteEvent());
        });

        it("passes through async iterable", async () => {
          async function* gen(): AsyncIterable<HttpStreamEvent> {
            yield createTextEvent("Hello");
            yield createCompleteEvent();
          }

          const events = await collectStreamEvents(
            wrapServiceForStreaming(gen()),
          );

          expect(events).toHaveLength(2);
          expect(events[0]).toEqual(createTextEvent("Hello"));
          expect(events[1]).toEqual(createCompleteEvent());
        });
      });
    });

    describe("LLM Stream Integration", () => {
      describe("llmChunkToHttpEvent", () => {
        it("is a function", () => {
          expect(llmChunkToHttpEvent).toBeFunction();
        });

        it("converts text chunk", () => {
          const chunk: LlmStreamChunk = {
            type: "text",
            content: "Hello",
          };
          const event = llmChunkToHttpEvent(chunk);
          expect(event).toEqual(createTextEvent("Hello"));
        });

        it("converts done chunk", () => {
          const chunk: LlmStreamChunk = {
            type: "done",
            usage: { inputTokens: 10, outputTokens: 20 },
          };
          const event = llmChunkToHttpEvent(chunk);
          expect(event).toEqual(createCompleteEvent());
        });

        it("converts error chunk", () => {
          const chunk: LlmStreamChunk = {
            type: "error",
            error: {
              status: 500,
              title: "Server Error",
              detail: "Something went wrong",
            },
          };
          const event = llmChunkToHttpEvent(chunk);
          expect(event).toEqual(
            createErrorEvent({
              status: 500,
              title: "Server Error",
              detail: "Something went wrong",
            }),
          );
        });

        it("filters out tool_call by default", () => {
          const chunk: LlmStreamChunk = {
            type: "tool_call",
            toolCall: {
              id: "call-123",
              name: "get_weather",
              arguments: "{}",
            },
          };
          const event = llmChunkToHttpEvent(chunk);
          expect(event).toBeUndefined();
        });

        it("includes tool_call when includeTools is true", () => {
          const chunk: LlmStreamChunk = {
            type: "tool_call",
            toolCall: {
              id: "call-123",
              name: "get_weather",
              arguments: "{}",
            },
          };
          const event = llmChunkToHttpEvent(chunk, { includeTools: true });
          expect(event).toEqual(
            createToolCallEvent({
              id: "call-123",
              name: "get_weather",
              arguments: "{}",
            }),
          );
        });

        it("filters out tool_result by default", () => {
          const chunk: LlmStreamChunk = {
            type: "tool_result",
            toolResult: {
              id: "call-123",
              name: "get_weather",
              result: { temp: 72 },
            },
          };
          const event = llmChunkToHttpEvent(chunk);
          expect(event).toBeUndefined();
        });

        it("includes tool_result when includeTools is true", () => {
          const chunk: LlmStreamChunk = {
            type: "tool_result",
            toolResult: {
              id: "call-123",
              name: "get_weather",
              result: { temp: 72 },
            },
          };
          const event = llmChunkToHttpEvent(chunk, { includeTools: true });
          expect(event).toEqual(
            createToolResultEvent({
              id: "call-123",
              name: "get_weather",
              result: { temp: 72 },
            }),
          );
        });

        it("returns undefined for unknown chunk type", () => {
          const chunk: LlmStreamChunk = {
            type: "unknown" as string,
          };
          const event = llmChunkToHttpEvent(chunk);
          expect(event).toBeUndefined();
        });
      });

      describe("pipeLlmStream", () => {
        it("is a function", () => {
          expect(pipeLlmStream).toBeFunction();
        });

        it("converts LLM stream to HTTP stream events", async () => {
          async function* llmStream(): AsyncIterable<LlmStreamChunk> {
            yield { type: "text", content: "Hello" };
            yield { type: "text", content: " World" };
            yield { type: "done", usage: {} };
          }

          const events = await collectStreamEvents(pipeLlmStream(llmStream()));

          expect(events).toHaveLength(3);
          expect(events[0]).toEqual(createTextEvent("Hello"));
          expect(events[1]).toEqual(createTextEvent(" World"));
          expect(events[2]).toEqual(createCompleteEvent());
        });

        it("filters tool events by default", async () => {
          async function* llmStream(): AsyncIterable<LlmStreamChunk> {
            yield { type: "text", content: "Hello" };
            yield {
              type: "tool_call",
              toolCall: { id: "1", name: "test", arguments: "{}" },
            };
            yield {
              type: "tool_result",
              toolResult: { id: "1", name: "test", result: {} },
            };
            yield { type: "text", content: " World" };
            yield { type: "done", usage: {} };
          }

          const events = await collectStreamEvents(pipeLlmStream(llmStream()));

          expect(events).toHaveLength(3);
          expect(events[0]).toEqual(createTextEvent("Hello"));
          expect(events[1]).toEqual(createTextEvent(" World"));
          expect(events[2]).toEqual(createCompleteEvent());
        });

        it("includes tool events when includeTools is true", async () => {
          async function* llmStream(): AsyncIterable<LlmStreamChunk> {
            yield { type: "text", content: "Hello" };
            yield {
              type: "tool_call",
              toolCall: { id: "1", name: "test", arguments: "{}" },
            };
            yield {
              type: "tool_result",
              toolResult: { id: "1", name: "test", result: {} },
            };
            yield { type: "done", usage: {} };
          }

          const events = await collectStreamEvents(
            pipeLlmStream(llmStream(), { includeTools: true }),
          );

          expect(events).toHaveLength(4);
          expect(events[0]).toEqual(createTextEvent("Hello"));
          expect(events[1].stream).toBe(HttpStreamEventType.ToolCall);
          expect(events[2].stream).toBe(HttpStreamEventType.ToolResult);
          expect(events[3]).toEqual(createCompleteEvent());
        });
      });

      describe("pipeLlmStreamToWriter", () => {
        it("is a function", () => {
          expect(pipeLlmStreamToWriter).toBeFunction();
        });

        it("writes events to writer function", async () => {
          const writer = vi.fn();

          async function* llmStream(): AsyncIterable<LlmStreamChunk> {
            yield { type: "text", content: "Hello" };
            yield { type: "done", usage: {} };
          }

          await pipeLlmStreamToWriter(llmStream(), writer);

          expect(writer).toHaveBeenCalledTimes(2);
          expect(writer).toHaveBeenNthCalledWith(1, createTextEvent("Hello"));
          expect(writer).toHaveBeenNthCalledWith(2, createCompleteEvent());
        });

        it("awaits async writer", async () => {
          const order: string[] = [];
          const writer = vi.fn().mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            order.push("written");
          });

          async function* llmStream(): AsyncIterable<LlmStreamChunk> {
            yield { type: "text", content: "Hello" };
            order.push("yielded");
          }

          await pipeLlmStreamToWriter(llmStream(), writer);

          // Writer await completes before generator resumes after yield
          expect(order).toEqual(["written", "yielded"]);
        });
      });
    });

    describe("fabricHttp with stream", () => {
      it("attaches stream: true", () => {
        const httpService = fabricHttp({
          alias: "test",
          stream: true,
          service: () => "result",
        });

        expect(httpService.stream).toBe(true);
      });

      it("defaults stream to false", () => {
        const httpService = fabricHttp({
          alias: "test",
          service: () => "result",
        });

        expect(httpService.stream).toBe(false);
      });

      it("isFabricHttpService checks for stream property", () => {
        const httpService = fabricHttp({
          alias: "test",
          stream: true,
          service: () => "result",
        });

        expect(isFabricHttpService(httpService)).toBe(true);
      });
    });
  });

  // #endregion

  // #region FabricHttpServer

  describe("FabricHttpServer", () => {
    // Import dynamically to avoid hoisting issues
    let FabricHttpServer: typeof import("../http/index.js").FabricHttpServer;
    let isFabricHttpServer: typeof import("../http/index.js").isFabricHttpServer;

    beforeEach(async () => {
      const httpModule = await import("../http/index.js");
      FabricHttpServer = httpModule.FabricHttpServer;
      isFabricHttpServer = httpModule.isFabricHttpServer;
    });

    describe("FabricHttpServer factory", () => {
      it("is a function", () => {
        expect(FabricHttpServer).toBeFunction();
      });

      it("creates a handler function", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "test" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        expect(server).toBeFunction();
      });

      it("attaches services metadata", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "test" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        expect(server.services).toEqual([userService]);
      });

      it("attaches routes metadata", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "test" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        expect(server.routes).toHaveLength(1);
        expect(server.routes[0].path).toBe("/users");
      });

      it("attaches prefix metadata", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "test" }),
        });

        const server = FabricHttpServer({
          services: [userService],
          prefix: "/api",
        });

        expect(server.prefix).toBe("/api");
      });
    });

    describe("API Gateway v1 event handling", () => {
      it("handles GET request", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "Alice" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const event = {
          httpMethod: "GET",
          path: "/users",
          headers: {},
          body: null,
          queryStringParameters: null,
        };

        const response = await server(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          data: { name: "Alice" },
        });
      });

      it("handles POST request with body", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: (input) => ({ received: input }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const event = {
          httpMethod: "POST",
          path: "/users",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Bob" }),
          queryStringParameters: null,
        };

        const response = await server(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          data: { received: { name: "Bob" } },
        });
      });

      it("handles query parameters", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: (input) => ({ received: input }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const event = {
          httpMethod: "GET",
          path: "/users",
          headers: {},
          body: null,
          queryStringParameters: { page: "1", limit: "10" },
        };

        const response = await server(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.data.received.page).toBe("1");
        expect(body.data.received.limit).toBe("10");
      });
    });

    describe("API Gateway v2 event handling", () => {
      it("handles GET request", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "Alice" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const event = {
          rawPath: "/users",
          rawQueryString: "",
          headers: {},
          requestContext: {
            http: {
              method: "GET",
              path: "/users",
            },
          },
        };

        const response = await server(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          data: { name: "Alice" },
        });
      });

      it("handles POST request with body", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: (input) => ({ received: input }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const event = {
          rawPath: "/users",
          rawQueryString: "",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Bob" }),
          requestContext: {
            http: {
              method: "POST",
              path: "/users",
            },
          },
        };

        const response = await server(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          data: { received: { name: "Bob" } },
        });
      });

      it("handles query string", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: (input) => ({ received: input }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const event = {
          rawPath: "/users",
          rawQueryString: "page=1&limit=10",
          headers: {},
          requestContext: {
            http: {
              method: "GET",
              path: "/users",
            },
          },
        };

        const response = await server(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.data.received.page).toBe("1");
        expect(body.data.received.limit).toBe("10");
      });
    });

    describe("route matching", () => {
      it("matches path by alias", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ type: "users" }),
        });
        const productService = fabricHttp({
          alias: "products",
          service: () => ({ type: "products" }),
        });

        const server = FabricHttpServer({
          services: [userService, productService],
        });

        const userResponse = await server({
          httpMethod: "GET",
          path: "/users",
          headers: {},
          body: null,
        });
        const productResponse = await server({
          httpMethod: "GET",
          path: "/products",
          headers: {},
          body: null,
        });

        expect(JSON.parse(userResponse.body).data.type).toBe("users");
        expect(JSON.parse(productResponse.body).data.type).toBe("products");
      });

      it("matches path with custom path", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ found: true }),
        });

        const server = FabricHttpServer({
          services: [{ service: userService, path: "/api/v1/users" }],
        });

        const response = await server({
          httpMethod: "GET",
          path: "/api/v1/users",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(200);
      });

      it("extracts path parameters", async () => {
        const userService = fabricHttp({
          alias: "users",
          http: ({ params }) => ({ id: params.id }),
          service: (input) => ({ userId: input.id }),
        });

        const server = FabricHttpServer({
          services: [{ service: userService, path: "/users/:id" }],
        });

        const response = await server({
          httpMethod: "GET",
          path: "/users/123",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          data: { userId: "123" },
        });
      });

      it("respects prefix", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ found: true }),
        });

        const server = FabricHttpServer({
          services: [userService],
          prefix: "/api",
        });

        const response = await server({
          httpMethod: "GET",
          path: "/api/users",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(200);
      });

      it("returns 404 for unmatched path", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({}),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const response = await server({
          httpMethod: "GET",
          path: "/unknown",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body).errors[0].title).toBe("Not Found");
      });

      it("returns 405 for unmatched method", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({}),
        });

        const server = FabricHttpServer({
          services: [{ service: userService, methods: ["GET"] }],
        });

        const response = await server({
          httpMethod: "PUT",
          path: "/users",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(405);
        expect(JSON.parse(response.body).errors[0].title).toBe(
          "Method Not Allowed",
        );
        expect(response.headers["Allow"]).toBe("GET");
      });
    });

    describe("CORS handling", () => {
      it("handles preflight request", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({}),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const response = await server({
          httpMethod: "OPTIONS",
          path: "/users",
          headers: {
            origin: "https://example.com",
            "access-control-request-method": "POST",
          },
          body: null,
        });

        expect(response.statusCode).toBe(204);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
        expect(response.headers["Access-Control-Allow-Methods"]).toBeDefined();
      });

      it("adds CORS headers to response", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "test" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        const response = await server({
          httpMethod: "GET",
          path: "/users",
          headers: { origin: "https://example.com" },
          body: null,
        });

        expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
      });

      it("disables CORS when cors: false", async () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ name: "test" }),
        });

        const server = FabricHttpServer({
          services: [userService],
          cors: false,
        });

        const response = await server({
          httpMethod: "GET",
          path: "/users",
          headers: { origin: "https://example.com" },
          body: null,
        });

        expect(response.headers["Access-Control-Allow-Origin"]).toBeUndefined();
      });
    });

    describe("error handling", () => {
      it("returns 500 for service errors", async () => {
        const errorService = fabricHttp({
          alias: "error",
          service: () => {
            throw new Error("Something went wrong");
          },
        });

        const server = FabricHttpServer({
          services: [errorService],
        });

        const response = await server({
          httpMethod: "GET",
          path: "/error",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body).errors[0].title).toBe(
          "Internal Server Error",
        );
        // Detail should be hidden for 500 errors
        expect(JSON.parse(response.body).errors[0].detail).toBeUndefined();
      });

      it("returns correct status for JaypieError", async () => {
        const { BadRequestError } = await import("@jaypie/errors");

        const errorService = fabricHttp({
          alias: "error",
          service: () => {
            throw new BadRequestError("Invalid input");
          },
        });

        const server = FabricHttpServer({
          services: [errorService],
        });

        const response = await server({
          httpMethod: "GET",
          path: "/error",
          headers: {},
          body: null,
        });

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body).errors[0].title).toBe("Bad Request");
        expect(JSON.parse(response.body).errors[0].detail).toBe(
          "Invalid input",
        );
      });
    });

    describe("isFabricHttpServer", () => {
      it("is a function", () => {
        expect(isFabricHttpServer).toBeFunction();
      });

      it("returns true for FabricHttpServer", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({}),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        expect(isFabricHttpServer(server)).toBe(true);
      });

      it("returns false for plain function", () => {
        expect(isFabricHttpServer(() => {})).toBe(false);
      });

      it("returns false for object with services but no routes", () => {
        const obj = { services: [] };
        expect(isFabricHttpServer(obj)).toBe(false);
      });

      it("returns false for null", () => {
        expect(isFabricHttpServer(null)).toBe(false);
      });
    });

    describe("service configuration", () => {
      it("accepts direct service", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ type: "direct" }),
        });

        const server = FabricHttpServer({
          services: [userService],
        });

        expect(server.services).toHaveLength(1);
      });

      it("accepts service config object", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({ type: "config" }),
        });

        const server = FabricHttpServer({
          services: [{ service: userService, path: "/custom" }],
        });

        expect(server.routes[0].path).toBe("/custom");
      });

      it("accepts mixed service types", () => {
        const userService = fabricHttp({
          alias: "users",
          service: () => ({}),
        });
        const productService = fabricHttp({
          alias: "products",
          service: () => ({}),
        });

        const server = FabricHttpServer({
          services: [
            userService,
            { service: productService, path: "/custom-products" },
          ],
        });

        expect(server.services).toHaveLength(2);
        expect(server.routes[0].path).toBe("/users");
        expect(server.routes[1].path).toBe("/custom-products");
      });

      it("throws for invalid service entry", () => {
        expect(() => {
          FabricHttpServer({
            services: [{ invalid: true } as any],
          });
        }).toThrow("Each service entry must be a FabricHttpService");
      });
    });
  });

  // #endregion
});
