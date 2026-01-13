import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AwsLambdaGlobal, ResponseStream } from "../types.js";

//
//
// Mock awslambda global
//

const mockResponseStream: ResponseStream = {
  end: vi.fn(),
  write: vi.fn(),
};

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
});

// Import after mocking
import LambdaResponseStreaming from "../LambdaResponseStreaming.js";

//
//
// Tests
//

describe("LambdaResponseStreaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates response with default status", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      expect(res.statusCode).toBe(200);
      expect(res.statusMessage).toBe("OK");
    });
  });

  describe("status management", () => {
    it("status() sets statusCode", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.status(404);

      expect(res.statusCode).toBe(404);
    });

    it("status() returns this for chaining", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      const result = res.status(201);

      expect(result).toBe(res);
    });
  });

  describe("header management", () => {
    it("setHeader() stores header before flush", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("Content-Type", "text/event-stream");

      expect(res.getHeader("content-type")).toBe("text/event-stream");
    });

    it("setHeader() normalizes header name to lowercase", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("X-Custom-Header", "value");

      expect(res.getHeader("x-custom-header")).toBe("value");
    });

    it("getHeaders() returns all headers", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("content-type", "text/plain");
      res.setHeader("x-custom", "value");

      const headers = res.getHeaders();

      expect(headers["content-type"]).toBe("text/plain");
      expect(headers["x-custom"]).toBe("value");
    });

    it("hasHeader() returns true for existing header", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("content-type", "text/plain");

      expect(res.hasHeader("content-type")).toBe(true);
    });

    it("removeHeader() removes header before flush", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("x-custom", "value");
      res.removeHeader("x-custom");

      expect(res.hasHeader("x-custom")).toBe(false);
    });
  });

  describe("writeHead()", () => {
    it("sets status code", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.writeHead(201);

      expect(res.statusCode).toBe(201);
    });

    it("sets headers from object", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.writeHead(200, { "content-type": "text/plain" });

      expect(res.getHeader("content-type")).toBe("text/plain");
    });

    it("flushes headers immediately", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.writeHead(200, { "content-type": "text/event-stream" });

      expect(res.headersSent).toBe(true);

      expect(awslambda.HttpResponseStream.from).toHaveBeenCalledWith(
        mockResponseStream,
        {
          headers: { "content-type": "text/event-stream" },
          statusCode: 200,
        },
      );
    });
  });

  describe("flushHeaders()", () => {
    it("wraps stream with HttpResponseStream.from", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("content-type", "text/event-stream");
      res.flushHeaders();

      expect(awslambda.HttpResponseStream.from).toHaveBeenCalledWith(
        mockResponseStream,
        {
          headers: { "content-type": "text/event-stream" },
          statusCode: 200,
        },
      );
    });

    it("only flushes once", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.flushHeaders();
      res.flushHeaders();

      expect(awslambda.HttpResponseStream.from).toHaveBeenCalledTimes(1);
    });

    it("marks headers as sent", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      expect(res.headersSent).toBe(false);
      res.flushHeaders();
      expect(res.headersSent).toBe(true);
    });
  });

  describe("write()", () => {
    it("auto-flushes headers on first write", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("content-type", "text/event-stream");

      await new Promise<void>((resolve) => {
        res.write("data: hello\n\n", "utf8", () => {
          expect(res.headersSent).toBe(true);
          resolve();
        });
      });
    });

    it("writes to wrapped stream after flush", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      await new Promise<void>((resolve) => {
        res.write("data: test\n\n", "utf8", () => {
          expect(mockWrappedStream.write).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it("handles Buffer writes", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      const buffer = Buffer.from("data: buffer\n\n");

      await new Promise<void>((resolve) => {
        res.write(buffer, "utf8", () => {
          expect(mockWrappedStream.write).toHaveBeenCalledWith(buffer);
          resolve();
        });
      });
    });
  });

  describe("end()", () => {
    it("flushes headers if not sent", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      await new Promise<void>((resolve) => {
        res.end(() => {
          expect(res.headersSent).toBe(true);
          resolve();
        });
      });
    });

    it("ends the wrapped stream", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      await new Promise<void>((resolve) => {
        res.end(() => {
          expect(mockWrappedStream.end).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it("writes final chunk before ending", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      await new Promise<void>((resolve) => {
        res.end("final data", () => {
          expect(mockWrappedStream.write).toHaveBeenCalled();
          expect(mockWrappedStream.end).toHaveBeenCalled();
          resolve();
        });
      });
    });
  });

  describe("json()", () => {
    it("sets content-type and sends JSON", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      const finishPromise = new Promise<void>((resolve) => {
        res.on("finish", () => {
          expect(res.getHeader("content-type")).toBe("application/json");
          expect(mockWrappedStream.write).toHaveBeenCalled();
          resolve();
        });
      });

      res.json({ message: "Hello" });
      await finishPromise;
    });
  });

  describe("send()", () => {
    it("sends string body", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      const finishPromise = new Promise<void>((resolve) => {
        res.on("finish", () => {
          expect(mockWrappedStream.write).toHaveBeenCalled();
          resolve();
        });
      });

      res.send("Hello World");
      await finishPromise;
    });

    it("sends object as JSON", async () => {
      const res = new LambdaResponseStreaming(mockResponseStream);

      const finishPromise = new Promise<void>((resolve) => {
        res.on("finish", () => {
          expect(res.getHeader("content-type")).toBe("application/json");
          resolve();
        });
      });

      res.send({ message: "Hello" });
      await finishPromise;
    });
  });

  describe("ignored operations after headers sent", () => {
    it("ignores setHeader after flush", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.flushHeaders();
      res.setHeader("x-late", "value");

      // Header should not be set after flush
      expect(res.getHeader("x-late")).toBeUndefined();
    });

    it("ignores removeHeader after flush", () => {
      const res = new LambdaResponseStreaming(mockResponseStream);
      res.setHeader("x-custom", "value");
      res.flushHeaders();
      res.removeHeader("x-custom");

      // Header should still exist
      expect(res.getHeader("x-custom")).toBe("value");
    });
  });
});
