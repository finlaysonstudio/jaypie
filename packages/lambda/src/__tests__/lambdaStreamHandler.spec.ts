import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, BadRequestError } from "@jaypie/errors";
import { jaypieHandler } from "@jaypie/kit";
import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";

import lambdaStreamHandler from "../lambdaStreamHandler.js";
import type {
  AwsStreamingHandler,
  ResponseStream,
  StreamHandlerContext,
} from "../lambdaStreamHandler.js";

//
//
// Mock Setup
//

vi.mock("@jaypie/kit", async () => {
  const actual = await vi.importActual("@jaypie/kit");
  const module = {
    ...actual,
    jaypieHandler: vi.fn(
      (
        handler: (...args: unknown[]) => unknown,
        options: Record<string, unknown>,
      ) => {
        return (
          actual as { jaypieHandler: typeof jaypieHandler }
        ).jaypieHandler(handler, options);
      },
    ),
  };
  return module;
});

//
//
// Mock Environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  restoreLog(log);
  vi.clearAllMocks();
});

//
//
// Helpers
//

function createMockResponseStream(): ResponseStream & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
    }),
    end: vi.fn(),
    setContentType: vi.fn(),
  };
}

//
//
// Tests
//

describe("lambdaStreamHandler", () => {
  //
  // Base Cases
  //
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof lambdaStreamHandler).toBe("function");
    });

    it("returns a function", () => {
      const handler = lambdaStreamHandler(async () => {});
      expect(typeof handler).toBe("function");
    });
  });

  //
  // Error Conditions
  //
  describe("Error Conditions", () => {
    it("throws ConfigurationError when handler is not a function", () => {
      expect(() => {
        // @ts-expect-error - testing invalid input
        lambdaStreamHandler("not a function");
      }).toThrow(ConfigurationError);
    });

    it("writes error as SSE event when handler throws Jaypie error", async () => {
      const handler = lambdaStreamHandler(async () => {
        throw new BadRequestError("Test error");
      });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.write).toHaveBeenCalled();
      const errorChunk = responseStream.chunks.find((c) =>
        c.includes("event: error"),
      );
      expect(errorChunk).toBeDefined();
      expect(responseStream.end).toHaveBeenCalled();
    });

    it("writes unhandled error as SSE event", async () => {
      const handler = lambdaStreamHandler(async () => {
        throw new Error("Unhandled error");
      });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.write).toHaveBeenCalled();
      const errorChunk = responseStream.chunks.find((c) =>
        c.includes("event: error"),
      );
      expect(errorChunk).toBeDefined();
      expect(responseStream.end).toHaveBeenCalled();
    });
  });

  //
  // Happy Paths
  //
  describe("Happy Paths", () => {
    it("calls the handler with event and extended context", async () => {
      const mockHandler = vi.fn();
      const handler = lambdaStreamHandler(mockHandler);
      const responseStream = createMockResponseStream();
      const event = { test: "event" };
      const context = { awsRequestId: "123" };

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)(
        event,
        responseStream,
        context,
      );

      expect(mockHandler).toHaveBeenCalled();
      const [receivedEvent, receivedContext] = mockHandler.mock.calls[0];
      expect(receivedEvent).toEqual(event);
      expect(receivedContext.responseStream).toBe(responseStream);
      expect(receivedContext.awsRequestId).toBe("123");
    });

    it("always ends the response stream", async () => {
      const handler = lambdaStreamHandler(async () => {});
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.end).toHaveBeenCalled();
    });

    it("sets content type when setContentType is available", async () => {
      const handler = lambdaStreamHandler(async () => {});
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.setContentType).toHaveBeenCalledWith(
        "text/event-stream",
      );
    });

    it("supports custom content type", async () => {
      const handler = lambdaStreamHandler(async () => {}, {
        contentType: "application/json",
      });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.setContentType).toHaveBeenCalledWith(
        "application/json",
      );
    });
  });

  //
  // Options
  //
  describe("Options", () => {
    it("accepts handler as first argument and options as second", () => {
      const handler = lambdaStreamHandler(async () => {}, { name: "test" });
      expect(typeof handler).toBe("function");
    });

    it("accepts options as first argument and handler as second", () => {
      const handler = lambdaStreamHandler({ name: "test" }, async () => {});
      expect(typeof handler).toBe("function");
    });

    it("supports setup lifecycle", async () => {
      const setup = vi.fn();
      const handler = lambdaStreamHandler(async () => {}, { setup: [setup] });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(setup).toHaveBeenCalled();
    });

    it("supports teardown lifecycle", async () => {
      const teardown = vi.fn();
      const handler = lambdaStreamHandler(async () => {}, {
        teardown: [teardown],
      });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(teardown).toHaveBeenCalled();
    });
  });

  //
  // Streaming Integration
  //
  describe("Streaming Integration", () => {
    it("allows handler to write to responseStream", async () => {
      const handler = lambdaStreamHandler(
        async (_event: unknown, context: StreamHandlerContext) => {
          context.responseStream.write("event: test\ndata: {}\n\n");
        },
      );
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.chunks).toContain("event: test\ndata: {}\n\n");
    });

    it("allows streaming multiple chunks", async () => {
      const handler = lambdaStreamHandler(
        async (_event: unknown, context: StreamHandlerContext) => {
          context.responseStream.write("event: chunk1\ndata: {}\n\n");
          context.responseStream.write("event: chunk2\ndata: {}\n\n");
          context.responseStream.write("event: chunk3\ndata: {}\n\n");
        },
      );
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing (without awslambda.streamifyResponse)
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.chunks).toHaveLength(3);
    });
  });

  //
  // Format Options
  //
  describe("Format Options", () => {
    it("uses SSE format by default", async () => {
      const handler = lambdaStreamHandler(async () => {
        throw new BadRequestError("Test error");
      });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      const errorChunk = responseStream.chunks.find((c) =>
        c.includes("event: error"),
      );
      expect(errorChunk).toBeDefined();
      expect(errorChunk).toContain("event: error\ndata:");
    });

    it("uses NLJSON format when specified", async () => {
      const handler = lambdaStreamHandler(
        async () => {
          throw new BadRequestError("Test error");
        },
        { format: "nljson" },
      );
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      // NLJSON format wraps the error body in an { error: ... } object
      const errorChunk = responseStream.chunks.find((c) =>
        c.includes('"error"'),
      );
      expect(errorChunk).toBeDefined();
      expect(errorChunk).not.toContain("event:");
      expect(errorChunk).toEndWith("\n");
    });

    it("sets application/x-ndjson content type for NLJSON format", async () => {
      const handler = lambdaStreamHandler(async () => {}, { format: "nljson" });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.setContentType).toHaveBeenCalledWith(
        "application/x-ndjson",
      );
    });

    it("sets text/event-stream content type for SSE format", async () => {
      const handler = lambdaStreamHandler(async () => {}, { format: "sse" });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.setContentType).toHaveBeenCalledWith(
        "text/event-stream",
      );
    });

    it("allows custom content type to override format default", async () => {
      const handler = lambdaStreamHandler(async () => {}, {
        format: "nljson",
        contentType: "application/json",
      });
      const responseStream = createMockResponseStream();

      // Cast to raw streaming handler for testing
      await (handler as unknown as AwsStreamingHandler)({}, responseStream, {});

      expect(responseStream.setContentType).toHaveBeenCalledWith(
        "application/json",
      );
    });
  });
});
