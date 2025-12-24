import { describe, expect, it, vi } from "vitest";

import {
  createExpressStream,
  createJaypieStream,
  createLambdaStream,
  formatSSE,
  JaypieStream,
  streamToSSE,
  StreamChunk,
} from "../streaming/JaypieStream.js";

//
//
// Mock Data
//

const mockChunk: StreamChunk = {
  type: "text",
  content: "Hello world",
};

const mockChunks: StreamChunk[] = [
  { type: "text", content: "Hello" },
  { type: "text", content: " world" },
  { type: "done" },
];

async function* createMockStream(): AsyncIterable<StreamChunk> {
  for (const chunk of mockChunks) {
    yield chunk;
  }
}

//
//
// Tests
//

describe("JaypieStream", () => {
  //
  // formatSSE
  //
  describe("formatSSE", () => {
    it("formats a chunk as SSE event", () => {
      const result = formatSSE(mockChunk);
      expect(result).toBe('event: text\ndata: {"type":"text","content":"Hello world"}\n\n');
    });

    it("uses chunk.type as the event name", () => {
      const chunk: StreamChunk = { type: "custom_event", value: 42 };
      const result = formatSSE(chunk);
      expect(result).toContain("event: custom_event");
    });

    it("includes the full chunk as JSON in data", () => {
      const chunk: StreamChunk = { type: "test", nested: { foo: "bar" } };
      const result = formatSSE(chunk);
      expect(result).toContain('data: {"type":"test","nested":{"foo":"bar"}}');
    });
  });

  //
  // streamToSSE
  //
  describe("streamToSSE", () => {
    it("converts async iterable to SSE strings", async () => {
      const results: string[] = [];
      for await (const sse of streamToSSE(createMockStream())) {
        results.push(sse);
      }
      expect(results).toHaveLength(3);
      expect(results[0]).toContain("event: text");
      expect(results[2]).toContain("event: done");
    });
  });

  //
  // createLambdaStream
  //
  describe("createLambdaStream", () => {
    it("writes SSE data to the writer", async () => {
      const write = vi.fn();
      const end = vi.fn();
      const writer = { write, end };

      await createLambdaStream(createMockStream(), writer);

      expect(write).toHaveBeenCalledTimes(3);
      expect(end).toHaveBeenCalledTimes(1);
    });

    it("always calls end even if stream throws", async () => {
      const write = vi.fn();
      const end = vi.fn();
      const writer = { write, end };

      async function* errorStream(): AsyncIterable<StreamChunk> {
        yield { type: "text" };
        throw new Error("Stream error");
      }

      await expect(createLambdaStream(errorStream(), writer)).rejects.toThrow("Stream error");
      expect(end).toHaveBeenCalledTimes(1);
    });
  });

  //
  // createExpressStream
  //
  describe("createExpressStream", () => {
    it("sets appropriate SSE headers", async () => {
      const setHeader = vi.fn();
      const write = vi.fn();
      const end = vi.fn();
      const flushHeaders = vi.fn();
      const res = { setHeader, write, end, flushHeaders };

      await createExpressStream(createMockStream(), res);

      expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    });

    it("flushes headers before streaming", async () => {
      const setHeader = vi.fn();
      const write = vi.fn();
      const end = vi.fn();
      const flushHeaders = vi.fn();
      const res = { setHeader, write, end, flushHeaders };

      await createExpressStream(createMockStream(), res);

      expect(flushHeaders).toHaveBeenCalled();
    });

    it("writes SSE data to response", async () => {
      const setHeader = vi.fn();
      const write = vi.fn();
      const end = vi.fn();
      const flushHeaders = vi.fn();
      const res = { setHeader, write, end, flushHeaders };

      await createExpressStream(createMockStream(), res);

      expect(write).toHaveBeenCalledTimes(3);
      expect(end).toHaveBeenCalledTimes(1);
    });
  });

  //
  // JaypieStream class
  //
  describe("JaypieStream class", () => {
    it("is async iterable", async () => {
      const stream = new JaypieStream(createMockStream());
      const results: StreamChunk[] = [];

      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3);
    });

    it("has toSSE method", async () => {
      const stream = new JaypieStream(createMockStream());
      const results: string[] = [];

      for await (const sse of stream.toSSE()) {
        results.push(sse);
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toContain("event:");
    });

    it("has toLambda method", async () => {
      const stream = new JaypieStream(createMockStream());
      const write = vi.fn();
      const end = vi.fn();
      const writer = { write, end };

      await stream.toLambda(writer);

      expect(write).toHaveBeenCalledTimes(3);
      expect(end).toHaveBeenCalledTimes(1);
    });

    it("has toExpress method", async () => {
      const stream = new JaypieStream(createMockStream());
      const setHeader = vi.fn();
      const write = vi.fn();
      const end = vi.fn();
      const flushHeaders = vi.fn();
      const res = { setHeader, write, end, flushHeaders };

      await stream.toExpress(res);

      expect(write).toHaveBeenCalledTimes(3);
      expect(end).toHaveBeenCalledTimes(1);
    });
  });

  //
  // createJaypieStream factory
  //
  describe("createJaypieStream", () => {
    it("creates a JaypieStream instance", () => {
      const stream = createJaypieStream(createMockStream());
      expect(stream).toBeInstanceOf(JaypieStream);
    });
  });
});
