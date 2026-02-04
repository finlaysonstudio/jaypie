import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AwsLambdaGlobal,
  FunctionUrlEvent,
  LambdaContext,
  ResponseStream,
} from "../types.js";

//
//
// Mock awslambda global for streaming tests
//

const mockWrappedStream: ResponseStream = {
  end: vi.fn(),
  write: vi.fn(),
};

// Declare the global type
declare const awslambda: AwsLambdaGlobal;

vi.stubGlobal("awslambda", {
  HttpResponseStream: {
    from: vi.fn(() => mockWrappedStream),
  },
  // The streamifyResponse mock should pass through the handler unchanged
  // since we want to test the actual handler behavior
  streamifyResponse: vi.fn(
    <TEvent>(
      handler: (
        event: TEvent,
        responseStream: ResponseStream,
        context: LambdaContext,
      ) => Promise<void>,
    ) =>
      async (event: TEvent, context: LambdaContext): Promise<void> => {
        // Create a mock response stream for testing
        const mockStream: ResponseStream = { end: vi.fn(), write: vi.fn() };
        await handler(event, mockStream, context);
      },
  ),
});

// Import after mocking
import {
  createLambdaHandler,
  createLambdaStreamHandler,
  getCurrentInvoke,
} from "../index.js";
import cors from "../../cors.helper.js";
import expressHandler from "../../expressHandler.js";

//
//
// Test Fixtures
//

const mockContext: LambdaContext = {
  awsRequestId: "integration-test-request-id",
  functionName: "test-function",
  functionVersion: "$LATEST",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789:function:test",
  logGroupName: "/aws/lambda/test",
  logStreamName: "2024/01/01/[$LATEST]abc123",
  memoryLimitInMB: "128",
};

const createMockEvent = (
  overrides: Partial<FunctionUrlEvent> = {},
): FunctionUrlEvent => ({
  body: undefined,
  cookies: undefined,
  headers: {
    "content-type": "application/json",
    host: "test.lambda-url.us-east-1.on.aws",
  },
  isBase64Encoded: false,
  rawPath: "/",
  rawQueryString: "",
  requestContext: {
    accountId: "123456789",
    apiId: "abc123",
    domainName: "test.lambda-url.us-east-1.on.aws",
    domainPrefix: "test",
    http: {
      method: "GET",
      path: "/",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "test",
    },
    requestId: "req-integration",
    routeKey: "$default",
    stage: "$default",
    time: "01/Jan/2024:00:00:00 +0000",
    timeEpoch: 1704067200000,
  },
  routeKey: "$default",
  version: "2.0",
  ...overrides,
});

//
//
// Tests
//

// NOTE: These integration tests were previously skipped due to an issue with
// Express's async finalhandler calling methods on a real ServerResponse
// instead of our mock. Re-enabled to debug dd-trace compatibility issues.
describe("Lambda Adapter Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLambdaHandler", () => {
    it("handles basic GET request", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.json({ message: "Hello World" });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers["content-type"]).toBe("application/json");
      expect(JSON.parse(result.body)).toEqual({ message: "Hello World" });
    });

    it("handles POST request with JSON body", async () => {
      const app = express();
      app.use(express.json());
      app.post("/users", (req, res) => {
        res.status(201).json({ created: true, name: req.body.name });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        body: JSON.stringify({ name: "John" }),
        rawPath: "/users",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "POST",
            path: "/users",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toEqual({ created: true, name: "John" });
    });

    it("handles DELETE request", async () => {
      const app = express();
      app.delete("/users/:id", (req, res) => {
        res.json({ deleted: true, id: req.params.id });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        rawPath: "/users/123",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "DELETE",
            path: "/users/123",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ deleted: true, id: "123" });
    });

    it("handles PUT request with JSON body", async () => {
      const app = express();
      app.use(express.json());
      app.put("/users/:id", (req, res) => {
        res.json({ updated: true, id: req.params.id, name: req.body.name });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        body: JSON.stringify({ name: "Jane" }),
        rawPath: "/users/456",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "PUT",
            path: "/users/456",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        id: "456",
        name: "Jane",
        updated: true,
      });
    });

    it("handles PATCH request with JSON body", async () => {
      const app = express();
      app.use(express.json());
      app.patch("/users/:id", (req, res) => {
        res.json({ patched: true, id: req.params.id, field: req.body.field });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        body: JSON.stringify({ field: "email" }),
        rawPath: "/users/789",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "PATCH",
            path: "/users/789",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        field: "email",
        id: "789",
        patched: true,
      });
    });

    it("handles HEAD request (returns headers only, no body)", async () => {
      const app = express();
      app.head("/status", (_req, res) => {
        res.setHeader("X-Custom-Header", "test-value");
        res.status(200).end();
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        rawPath: "/status",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "HEAD",
            path: "/status",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers["x-custom-header"]).toBe("test-value");
      // HEAD requests should not have a body
      expect(result.body).toBe("");
    });

    it("handles OPTIONS request", async () => {
      const app = express();
      // Explicit OPTIONS handler
      app.options("/api/data", (_req, res) => {
        res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.status(204).end();
      });
      app.post("/api/data", (_req, res) => {
        res.json({ ok: true });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        rawPath: "/api/data",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "OPTIONS",
            path: "/api/data",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
      expect(result.headers["allow"]).toBe(
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
    });

    it("handles query parameters", async () => {
      const app = express();
      app.get("/search", (req, res) => {
        res.json({ query: req.query });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        rawPath: "/search",
        rawQueryString: "q=test&page=1",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            path: "/search",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.query.q).toBe("test");
      expect(body.query.page).toBe("1");
    });

    it("handles 404 not found", async () => {
      const app = express();
      app.get("/exists", (_req, res) => {
        res.json({ found: true });
      });
      app.use((_req, res) => {
        res.status(404).json({ error: "Not Found" });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        rawPath: "/not-found",
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            path: "/not-found",
          },
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({ error: "Not Found" });
    });

    it("sets Lambda context for getCurrentInvoke", async () => {
      let capturedInvoke: ReturnType<typeof getCurrentInvoke> = null;

      const app = express();
      app.get("/", (_req, res) => {
        capturedInvoke = getCurrentInvoke();
        res.json({ ok: true });
      });

      const handler = createLambdaHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(capturedInvoke).not.toBeNull();
      expect(capturedInvoke!.context.awsRequestId).toBe(
        "integration-test-request-id",
      );
    });

    it("clears Lambda context after handler completes", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.json({ ok: true });
      });

      const handler = createLambdaHandler(app);
      await handler(createMockEvent(), mockContext);

      // Context should be cleared after handler completes
      expect(getCurrentInvoke()).toBeNull();
    });

    it("clears Lambda context even on error", async () => {
      const app = express();
      app.get("/", () => {
        throw new Error("Test error");
      });
      // Error handler
      app.use(
        (
          _err: Error,
          _req: express.Request,
          res: express.Response,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _next: express.NextFunction,
        ) => {
          res.status(500).json({ error: "Internal Error" });
        },
      );

      const handler = createLambdaHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(getCurrentInvoke()).toBeNull();
    });

    it("exposes Lambda context on request object", async () => {
      let capturedAwsRequestId: string | undefined;

      const app = express();
      app.get("/", (req, res) => {
        // Access Lambda context via request
        capturedAwsRequestId = (req as any)._lambdaContext?.awsRequestId;
        res.json({ ok: true });
      });

      const handler = createLambdaHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(capturedAwsRequestId).toBe("integration-test-request-id");
    });

    it("handles cookies in request", async () => {
      let capturedCookies: string | undefined;

      const app = express();
      app.get("/", (req, res) => {
        capturedCookies = req.headers.cookie;
        res.json({ ok: true });
      });

      const handler = createLambdaHandler(app);
      const event = createMockEvent({
        cookies: ["session=abc123", "user=john"],
      });

      await handler(event, mockContext);

      expect(capturedCookies).toBe("session=abc123; user=john");
    });

    it("handles Set-Cookie in response", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.setHeader("Set-Cookie", "session=xyz789; Path=/");
        res.json({ ok: true });
      });

      const handler = createLambdaHandler(app);
      const result = await handler(createMockEvent(), mockContext);

      expect(result.cookies).toEqual(["session=xyz789; Path=/"]);
    });
  });

  describe("createLambdaStreamHandler", () => {
    it("wraps with awslambda.streamifyResponse", () => {
      const app = express();
      createLambdaStreamHandler(app);

      expect(awslambda.streamifyResponse).toHaveBeenCalled();
    });

    it("calls HttpResponseStream.from with status and headers", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.write("data: hello\n\n");
        res.end();
      });

      const handler = createLambdaStreamHandler(app);
      // Handler signature after streamifyResponse: (event, context) => Promise<void>
      await handler(createMockEvent(), mockContext);

      expect(awslambda.HttpResponseStream.from).toHaveBeenCalled();
    });

    it("writes data to wrapped stream", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.write("data: test\n\n");
        res.end();
      });

      const handler = createLambdaStreamHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(mockWrappedStream.write).toHaveBeenCalled();
    });

    it("ends wrapped stream", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.end("done");
      });

      const handler = createLambdaStreamHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(mockWrappedStream.end).toHaveBeenCalled();
    });

    it("sets Lambda context for getCurrentInvoke", async () => {
      let capturedInvoke: ReturnType<typeof getCurrentInvoke> = null;

      const app = express();
      app.get("/", (_req, res) => {
        capturedInvoke = getCurrentInvoke();
        res.end();
      });

      const handler = createLambdaStreamHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(capturedInvoke).not.toBeNull();
      expect(capturedInvoke!.context.awsRequestId).toBe(
        "integration-test-request-id",
      );
    });

    it("clears Lambda context after handler completes", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.end();
      });

      const handler = createLambdaStreamHandler(app);
      await handler(createMockEvent(), mockContext);

      expect(getCurrentInvoke()).toBeNull();
    });

    it("handles CORS OPTIONS preflight requests without hanging", async () => {
      const app = express();
      app.use(cors({ origin: "https://example.com" }));
      app.post("/api/chat", (_req, res) => {
        res.json({ message: "Hello" });
      });

      const handler = createLambdaStreamHandler(app);
      const optionsEvent = createMockEvent({
        headers: {
          ...createMockEvent().headers,
          origin: "https://example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "OPTIONS",
          },
        },
      });

      // This should complete without timing out
      // If CORS OPTIONS hangs, this test will timeout
      await handler(optionsEvent, mockContext);

      // For 204 responses (CORS preflight), the test should complete without hanging.
      // The actual stream operations happen inside the streamifyResponse mock.
      // If this test completes, the 204 response was handled correctly.
    });

    it("handles CORS OPTIONS with streaming by converting 204 to 200", async () => {
      // Track HttpResponseStream.from calls to verify 204 -> 200 conversion
      const fromCalls: Array<{
        metadata: { statusCode: number; headers: Record<string, string> };
      }> = [];
      (
        awslambda.HttpResponseStream.from as ReturnType<typeof vi.fn>
      ).mockImplementation(
        (
          stream: ResponseStream,
          metadata: { statusCode: number; headers: Record<string, string> },
        ) => {
          fromCalls.push({ metadata });
          return mockWrappedStream;
        },
      );

      const app = express();
      app.use(cors({ origin: "https://example.com" }));
      app.post("/api/stream", (_req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.write("data: hello\n\n");
        res.end();
      });

      const handler = createLambdaStreamHandler(app);
      const optionsEvent = createMockEvent({
        headers: {
          ...createMockEvent().headers,
          origin: "https://example.com",
          "access-control-request-method": "POST",
        },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "OPTIONS",
          },
        },
      });

      await handler(optionsEvent, mockContext);

      // For 204 responses, we convert to 200 with {} body (issue #178 workaround)
      expect(fromCalls.length).toBeGreaterThan(0);
      const lastCall = fromCalls[fromCalls.length - 1];
      expect(lastCall.metadata.statusCode).toBe(200); // Converted from 204
      expect(lastCall.metadata.headers["content-type"]).toBe(
        "application/json",
      );
      // Verify {} body was written
      expect(mockWrappedStream.write).toHaveBeenCalledWith("{}");
      expect(mockWrappedStream.end).toHaveBeenCalled();
    });

    it("converts 204 to 200 for OPTIONS requests (issue #178 workaround)", async () => {
      // Track HttpResponseStream.from calls
      const fromCalls: Array<{
        metadata: { statusCode: number; headers: Record<string, string> };
      }> = [];
      (
        awslambda.HttpResponseStream.from as ReturnType<typeof vi.fn>
      ).mockImplementation(
        (
          stream: ResponseStream,
          metadata: { statusCode: number; headers: Record<string, string> },
        ) => {
          fromCalls.push({ metadata });
          return mockWrappedStream;
        },
      );

      const app = express();
      app.use(cors({ origin: "https://example.com" }));
      app.post("/api/data", (_req, res) => {
        res.json({ ok: true });
      });

      const handler = createLambdaStreamHandler(app);
      const optionsEvent = createMockEvent({
        headers: {
          ...createMockEvent().headers,
          origin: "https://example.com",
          "access-control-request-method": "POST",
        },
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "OPTIONS",
          },
        },
      });

      await handler(optionsEvent, mockContext);

      // 204 responses are converted to 200 with {} body
      expect(fromCalls.length).toBeGreaterThan(0);
      const lastCall = fromCalls[fromCalls.length - 1];
      expect(lastCall.metadata.statusCode).toBe(200);
      expect(mockWrappedStream.write).toHaveBeenCalledWith("{}");
      expect(mockWrappedStream.end).toHaveBeenCalled();
    });

    it("converts 204 to 200 for NO_CONTENT responses via expressHandler (issue #178)", async () => {
      // This test verifies the fix for issue #178 where httpHandler(NO_CONTENT)
      // routes would hang because Lambda streaming requires body content.
      // The fix converts 204 to 200 with {} body.
      const fromCalls: Array<{
        metadata: { statusCode: number; headers: Record<string, string> };
      }> = [];
      (
        awslambda.HttpResponseStream.from as ReturnType<typeof vi.fn>
      ).mockImplementation(
        (
          stream: ResponseStream,
          metadata: { statusCode: number; headers: Record<string, string> },
        ) => {
          fromCalls.push({ metadata });
          return mockWrappedStream;
        },
      );

      const app = express();
      // Simulate httpHandler(HTTP.CODE.NO_CONTENT) - returns null for 204
      app.get(
        "/health",
        expressHandler(
          async () => {
            // Returning null triggers NO_CONTENT (204) response
            return null;
          },
          { name: "_noContent" },
        ),
      );

      const handler = createLambdaStreamHandler(app);
      const getEvent = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: "GET",
            path: "/health",
          },
        },
        rawPath: "/health",
      });

      await handler(getEvent, mockContext);

      // 204 responses are converted to 200 with {} body
      expect(fromCalls.length).toBeGreaterThan(0);
      const lastCall = fromCalls[fromCalls.length - 1];
      expect(lastCall.metadata.statusCode).toBe(200);
      expect(mockWrappedStream.write).toHaveBeenCalledWith("{}");
      expect(mockWrappedStream.end).toHaveBeenCalled();
    });
  });
});
