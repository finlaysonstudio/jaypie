import express from "express";
import type { Application } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@jaypie/errors";

vi.mock("@jaypie/datadog", async () => {
  const actual = await vi.importActual("@jaypie/datadog");
  return {
    ...actual,
    flushLlmObs: vi.fn(),
    loadDatadogApiKey: vi.fn(),
  };
});

import type {
  FunctionUrlEvent,
  LambdaContext,
  ResponseStream,
} from "../types.js";
import { createLambdaHandler, createLambdaStreamHandler } from "../index.js";

//
//
// Types
//

type UnwrappedStreamHandler = (
  event: FunctionUrlEvent,
  responseStream: ResponseStream,
  context: LambdaContext,
) => Promise<void>;

//
//
// Fixtures
//

const mockContext: LambdaContext = {
  awsRequestId: "stream-handler-request-id",
};

const createMockEvent = (): FunctionUrlEvent => ({
  headers: { host: "test.lambda-url.us-east-1.on.aws" },
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
    requestId: "req-stream-handler",
    routeKey: "$default",
    stage: "$default",
    time: "01/Jan/2024:00:00:00 +0000",
    timeEpoch: 1704067200000,
  },
  routeKey: "$default",
  version: "2.0",
});

const createMockStream = (): ResponseStream => ({
  end: vi.fn(),
  write: vi.fn(),
});

// An "app" that fails before Express handles the request
const createThrowingApp = (): Application =>
  (() => {
    throw new ConfigurationError("Adapter failure");
  }) as unknown as Application;

//
//
// Tests
//

describe("createLambdaStreamHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("without the awslambda global", () => {
    beforeEach(() => {
      vi.stubGlobal("awslambda", undefined);
    });

    it("has no awslambda global", () => {
      expect((globalThis as { awslambda?: unknown }).awslambda).toBeUndefined();
    });

    it("does not throw at factory time", () => {
      const app = express();
      expect(() => createLambdaStreamHandler(app)).not.toThrow();
    });

    it("does not throw when the global lacks streamifyResponse", () => {
      vi.stubGlobal("awslambda", {});
      const app = express();
      expect(() => createLambdaStreamHandler(app)).not.toThrow();
    });

    it("returns the unwrapped handler that accepts a response stream", async () => {
      const app = express();
      app.get("/", (_req, res) => {
        res.write("data: hello\n\n");
        res.end();
      });

      const handler = createLambdaStreamHandler(
        app,
      ) as unknown as UnwrappedStreamHandler;
      const stream = createMockStream();
      await handler(createMockEvent(), stream, mockContext);

      expect(stream.write).toHaveBeenCalledWith(expect.anything());
      expect(stream.end).toHaveBeenCalled();
    });
  });

  describe("with the awslambda global", () => {
    it("wraps with awslambda.streamifyResponse", () => {
      const streamifyResponse = vi.fn((handler: unknown) => handler);
      vi.stubGlobal("awslambda", {
        HttpResponseStream: { from: vi.fn((stream: unknown) => stream) },
        streamifyResponse,
      });

      createLambdaStreamHandler(express());

      expect(streamifyResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe("options", () => {
    it("labels unhandled errors with the default name", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const handler = createLambdaStreamHandler(
        createThrowingApp(),
      ) as unknown as UnwrappedStreamHandler;

      await expect(
        handler(createMockEvent(), createMockStream(), mockContext),
      ).rejects.toThrow("Adapter failure");
      expect(consoleError).toHaveBeenCalledWith(
        "[createLambdaStreamHandler] Unhandled error:",
        expect.any(ConfigurationError),
      );
    });

    it("labels unhandled errors with options.name", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const handler = createLambdaStreamHandler(createThrowingApp(), {
        name: "streamApi",
      }) as unknown as UnwrappedStreamHandler;

      await expect(
        handler(createMockEvent(), createMockStream(), mockContext),
      ).rejects.toThrow("Adapter failure");
      expect(consoleError).toHaveBeenCalledWith(
        "[streamApi] Unhandled error:",
        expect.any(ConfigurationError),
      );
    });
  });
});

describe("createLambdaHandler options", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("labels unhandled errors with the default name", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const handler = createLambdaHandler(createThrowingApp());
    const result = await handler(createMockEvent(), mockContext);

    expect(result.statusCode).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "[createLambdaHandler] Unhandled error:",
      expect.any(ConfigurationError),
    );
  });

  it("labels unhandled errors with options.name", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const handler = createLambdaHandler(createThrowingApp(), { name: "api" });
    const result = await handler(createMockEvent(), mockContext);

    expect(result.statusCode).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "[api] Unhandled error:",
      expect.any(ConfigurationError),
    );
  });
});
