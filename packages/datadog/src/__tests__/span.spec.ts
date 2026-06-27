import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import { tagSpan, traceSpan } from "../span.js";
import { _resetTracer, _setTracer } from "../tracer.client.js";

//
//
// Mock modules
//

/** Build a fake dd-trace tracer whose active span records its tags. */
function fakeTracer() {
  const span = {
    tags: {} as Record<string, unknown>,
    setTag: vi.fn(function (this: void, key: string, value: unknown) {
      span.tags[key] = value;
    }),
    finish: vi.fn(),
  };
  return {
    span,
    scope: vi.fn(() => ({ active: () => span })),
    trace: vi.fn((_name: string, fn: (s?: typeof span) => unknown) => fn(span)),
  };
}

//
//
// Setup
//

beforeEach(() => {
  _resetTracer();
});

afterEach(() => {
  _resetTracer();
  vi.restoreAllMocks();
});

//
//
// Run tests
//

describe("span", () => {
  describe("Base Cases", () => {
    it("exports functions", () => {
      expect(typeof tagSpan).toBe("function");
      expect(typeof traceSpan).toBe("function");
    });

    it("no-ops without a tracer and never throws", () => {
      _setTracer(null);
      expect(() => tagSpan("order.id", "abc")).not.toThrow();
      expect(traceSpan("region", () => 42)).toBe(42);
    });
  });

  describe("tagSpan", () => {
    it("sets a tag on the active span (key/value form)", () => {
      const tracer = fakeTracer();
      _setTracer(tracer);
      tagSpan("order.id", "abc-123");
      expect(tracer.span.setTag).toHaveBeenCalledWith("order.id", "abc-123");
      expect(tracer.span.tags).toEqual({ "order.id": "abc-123" });
    });

    it("sets multiple tags (object form)", () => {
      const tracer = fakeTracer();
      _setTracer(tracer);
      tagSpan({ "order.id": "abc-123", "order.tier": "gold", pages: 12 });
      expect(tracer.span.tags).toEqual({
        "order.id": "abc-123",
        "order.tier": "gold",
        pages: 12,
      });
    });

    it("no-ops when there is no active span", () => {
      const tracer = fakeTracer();
      tracer.scope.mockReturnValue({ active: () => null });
      _setTracer(tracer);
      expect(() => tagSpan("order.id", "abc")).not.toThrow();
      expect(tracer.span.setTag).not.toHaveBeenCalled();
    });

    it("never throws when setTag throws", () => {
      const tracer = fakeTracer();
      tracer.span.setTag.mockImplementation(() => {
        throw new Error("boom");
      });
      _setTracer(tracer);
      expect(() => tagSpan("order.id", "abc")).not.toThrow();
    });
  });

  describe("traceSpan", () => {
    it("runs fn within a child span and returns its result", () => {
      const tracer = fakeTracer();
      _setTracer(tracer);
      const result = traceSpan("ocr", () => "done");
      expect(tracer.trace).toHaveBeenCalledWith("ocr", expect.any(Function));
      expect(result).toBe("done");
    });

    it("nested tagSpan attaches to the active child span", () => {
      const tracer = fakeTracer();
      _setTracer(tracer);
      traceSpan("ocr", () => {
        tagSpan("pages", 12);
      });
      expect(tracer.span.tags).toEqual({ pages: 12 });
    });

    it("awaits async fn and returns the resolved value", async () => {
      const tracer = fakeTracer();
      _setTracer(tracer);
      const result = await traceSpan("ocr", async () => "async-done");
      expect(result).toBe("async-done");
    });

    it("propagates a thrown error from fn", () => {
      const tracer = fakeTracer();
      _setTracer(tracer);
      expect(() =>
        traceSpan("ocr", () => {
          throw new Error("region failed");
        }),
      ).toThrow("region failed");
    });

    it("runs fn directly when no tracer is present", () => {
      _setTracer(null);
      const fn = vi.fn(() => "ran");
      expect(traceSpan("ocr", fn)).toBe("ran");
      expect(fn).toHaveBeenCalledOnce();
    });
  });
});
