import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "@jaypie/errors";

import getCurrentInvokeUuid from "../getCurrentInvokeUuid.adapter.js";

// Subject
import expressStreamHandler from "../expressStreamHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");
vi.mock("@jaypie/kit", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    jaypieHandler: vi.fn((handler: (...args: unknown[]) => unknown) => {
      return handler;
    }),
  };
});
vi.mock("@jaypie/datadog", () => ({
  hasDatadogEnv: vi.fn(() => false),
  submitMetric: vi.fn(),
  DATADOG: { METRIC: { TYPE: { COUNT: "count" } } },
}));

interface MockRequest extends Partial<Request> {
  locals?: Record<string, unknown>;
  baseUrl?: string;
  url?: string;
}

interface MockResponse extends Partial<Response> {
  chunks: string[];
  end: ReturnType<typeof vi.fn>;
  flushHeaders: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  statusCode: number;
  write: ReturnType<typeof vi.fn>;
  locals?: Record<string, unknown>;
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    baseUrl: "",
    headers: {},
    method: "GET",
    query: {},
    url: "/stream",
    ...overrides,
  };
}

function createMockResponse(
  overrides: Partial<MockResponse> = {},
): MockResponse {
  const chunks: string[] = [];
  return {
    chunks,
    end: vi.fn(),
    flushHeaders: vi.fn(),
    setHeader: vi.fn(),
    statusCode: 200,
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    ...overrides,
  };
}

//
//
// Setup
//

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentInvokeUuid as ReturnType<typeof vi.fn>).mockReturnValue(
    "test-uuid",
  );
});

afterEach(() => {
  vi.resetAllMocks();
});

//
//
// Tests
//

describe("expressStreamHandler", () => {
  //
  // Base Cases
  //
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof expressStreamHandler).toBe("function");
    });

    it("returns a function", () => {
      const handler = expressStreamHandler(async () => {});
      expect(typeof handler).toBe("function");
    });
  });

  //
  // Error Conditions
  //
  describe("Error Conditions", () => {
    it("throws BadRequestError when handler is not a function", () => {
      expect(() => {
        // @ts-expect-error - testing invalid input
        expressStreamHandler("not a function");
      }).toThrow(BadRequestError);
    });

    it("throws BadRequestError when locals is not an object", () => {
      expect(() => {
        expressStreamHandler(async () => {}, {
          // @ts-expect-error - testing invalid input
          locals: "not an object",
        });
      }).toThrow(BadRequestError);
    });
  });

  //
  // Happy Paths
  //
  describe("Happy Paths", () => {
    it("sets SSE headers", async () => {
      const handler = expressStreamHandler(async () => {});
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream",
      );
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    });

    it("flushes headers before streaming", async () => {
      const handler = expressStreamHandler(async () => {});
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.flushHeaders).toHaveBeenCalled();
    });

    it("always ends the response", async () => {
      const handler = expressStreamHandler(async () => {});
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.end).toHaveBeenCalled();
    });

    it("supports custom content type", async () => {
      const handler = expressStreamHandler(async () => {}, {
        contentType: "application/json",
      });
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/json",
      );
    });
  });

  //
  // Options
  //
  describe("Options", () => {
    it("accepts handler as first argument and options as second", () => {
      const handler = expressStreamHandler(async () => {}, { name: "test" });
      expect(typeof handler).toBe("function");
    });

    it("accepts options as first argument and handler as second", () => {
      const handler = expressStreamHandler({ name: "test" }, async () => {});
      expect(typeof handler).toBe("function");
    });
  });

  //
  // Streaming Integration
  //
  describe("Streaming Integration", () => {
    it("allows handler to write to response", async () => {
      const handler = expressStreamHandler(
        async (_req: Request, res: Response) => {
          res.write("event: test\ndata: {}\n\n");
        },
      );
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.chunks).toContain("event: test\ndata: {}\n\n");
    });

    it("allows streaming multiple chunks", async () => {
      const handler = expressStreamHandler(
        async (_req: Request, res: Response) => {
          res.write("event: chunk1\ndata: {}\n\n");
          res.write("event: chunk2\ndata: {}\n\n");
          res.write("event: chunk3\ndata: {}\n\n");
        },
      );
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.chunks).toHaveLength(3);
    });
  });

  //
  // Error Handling
  //
  describe("Error Handling", () => {
    it("writes error as SSE event when handler throws", async () => {
      const handler = expressStreamHandler(async () => {
        throw new BadRequestError("Test error");
      });
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      const errorChunk = res.chunks.find((c) => c.includes("event: error"));
      expect(errorChunk).toBeDefined();
      expect(res.end).toHaveBeenCalled();
    });
  });

  //
  // Format Options
  //
  describe("Format Options", () => {
    it("uses SSE format by default", async () => {
      const handler = expressStreamHandler(async () => {
        throw new BadRequestError("Test error");
      });
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      const errorChunk = res.chunks.find((c) => c.includes("event: error"));
      expect(errorChunk).toBeDefined();
      expect(errorChunk).toContain("event: error\ndata:");
    });

    it("uses NLJSON format when specified", async () => {
      const handler = expressStreamHandler(
        async () => {
          throw new BadRequestError("Test error");
        },
        { format: "nljson" },
      );
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      // NLJSON format wraps the error body in an { error: ... } object
      const errorChunk = res.chunks.find((c) => c.includes('"error"'));
      expect(errorChunk).toBeDefined();
      expect(errorChunk).not.toContain("event:");
      expect(errorChunk).toMatch(/\n$/);
    });

    it("sets application/x-ndjson content type for NLJSON format", async () => {
      const handler = expressStreamHandler(async () => {}, {
        format: "nljson",
      });
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/x-ndjson",
      );
    });

    it("sets text/event-stream content type for SSE format", async () => {
      const handler = expressStreamHandler(async () => {}, { format: "sse" });
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream",
      );
    });

    it("allows custom content type to override format default", async () => {
      const handler = expressStreamHandler(async () => {}, {
        format: "nljson",
        contentType: "application/json",
      });
      const req = createMockRequest();
      const res = createMockResponse();

      await handler(req as Request, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/json",
      );
    });
  });
});
