import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetLlmObs,
  _setLlmObs,
  annotateLlmObs,
  isLlmObsEnabled,
  openLlmObsSpan,
  usageToLlmObsMetrics,
  withLlmObsSpan,
} from "../llmobs.js";

//
//
// Mock Logger
//

vi.mock("../../util/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../util/index.js")>();
  return {
    ...actual,
    getLogger: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
      var: vi.fn(),
      warn: vi.fn(),
    }),
  };
});

//
//
// Helpers
//

interface FakeSpan {
  annotations: unknown[];
  finished: boolean;
  options: unknown;
}

function makeFakeSdk() {
  const spans: FakeSpan[] = [];
  const traceOptions: unknown[] = [];
  const annotateCalls: Array<{ annotation: unknown; span: unknown }> = [];
  const sdk = {
    annotate(span: unknown, annotation: unknown) {
      annotateCalls.push({ annotation, span });
      if (span) {
        (span as FakeSpan).annotations.push(annotation);
      }
    },
    trace(options: unknown, fn: (span: unknown) => unknown) {
      const span: FakeSpan = { annotations: [], finished: false, options };
      spans.push(span);
      traceOptions.push(options);
      const result = fn(span);
      // Mimic dd-trace: the span finishes when the returned value settles.
      Promise.resolve(result).then(
        () => {
          span.finished = true;
        },
        () => {
          span.finished = true;
        },
      );
      return result;
    },
  };
  return { annotateCalls, sdk, spans, traceOptions };
}

//
//
// Setup
//

const ORIGINAL = process.env.DD_LLMOBS_ENABLED;

beforeEach(() => {
  _resetLlmObs();
  delete process.env.DD_LLMOBS_ENABLED;
});

afterEach(() => {
  _resetLlmObs();
  if (ORIGINAL === undefined) {
    delete process.env.DD_LLMOBS_ENABLED;
  } else {
    process.env.DD_LLMOBS_ENABLED = ORIGINAL;
  }
});

//
//
// Tests
//

describe("llmobs", () => {
  describe("isLlmObsEnabled", () => {
    it("Is false when unset", () => {
      expect(isLlmObsEnabled()).toBe(false);
    });

    it.each(["true", "1", "yes", "on"])("Is true for %s", (value) => {
      process.env.DD_LLMOBS_ENABLED = value;
      expect(isLlmObsEnabled()).toBe(true);
    });

    it.each(["", "false", "0"])("Is false for %s", (value) => {
      process.env.DD_LLMOBS_ENABLED = value;
      expect(isLlmObsEnabled()).toBe(false);
    });
  });

  describe("usageToLlmObsMetrics", () => {
    it("Returns undefined for empty or missing usage", () => {
      expect(usageToLlmObsMetrics()).toBeUndefined();
      expect(usageToLlmObsMetrics([])).toBeUndefined();
    });

    it("Sums usage items into metric keys", () => {
      const metrics = usageToLlmObsMetrics([
        { input: 10, output: 5, total: 15 },
        { input: 2, output: 3, total: 5 },
      ]);
      expect(metrics).toEqual({
        input_tokens: 12,
        output_tokens: 8,
        total_tokens: 20,
      });
    });
  });

  describe("withLlmObsSpan (disabled)", () => {
    it("Invokes fn directly and returns its result with no SDK", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const result = await withLlmObsSpan({ kind: "llm", name: "test" }, fn);
      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledOnce();
    });

    it("Passes through when enabled but dd-trace is absent", async () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      const fn = vi.fn().mockResolvedValue(42);
      const result = await withLlmObsSpan({ kind: "llm", name: "test" }, fn);
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe("withLlmObsSpan (enabled)", () => {
    beforeEach(() => {
      process.env.DD_LLMOBS_ENABLED = "true";
    });

    it("Wraps fn in an llmobs span and returns its result", async () => {
      const { sdk, spans, traceOptions } = makeFakeSdk();
      _setLlmObs(sdk);
      const result = await withLlmObsSpan(
        { kind: "agent", modelName: "m", modelProvider: "p", name: "op" },
        async () => "value",
      );
      expect(result).toBe("value");
      expect(traceOptions).toEqual([
        { kind: "agent", modelName: "m", modelProvider: "p", name: "op" },
      ]);
      expect(spans).toHaveLength(1);
    });

    it("Propagates fn errors without re-running fn", async () => {
      const { sdk } = makeFakeSdk();
      _setLlmObs(sdk);
      const fn = vi.fn().mockRejectedValue(new Error("boom"));
      await expect(
        withLlmObsSpan({ kind: "llm", name: "op" }, fn),
      ).rejects.toThrow("boom");
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe("annotateLlmObs", () => {
    it("Is a no-op when disabled", () => {
      expect(() => annotateLlmObs({ outputData: "x" })).not.toThrow();
    });

    it("Annotates the active span when enabled", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      const { annotateCalls, sdk } = makeFakeSdk();
      _setLlmObs(sdk);
      annotateLlmObs({ inputData: "in", outputData: "out" });
      expect(annotateCalls).toHaveLength(1);
      expect(annotateCalls[0].span).toBeUndefined();
      expect(annotateCalls[0].annotation).toEqual({
        inputData: "in",
        outputData: "out",
      });
    });
  });

  describe("openLlmObsSpan", () => {
    it("Returns null when disabled", () => {
      expect(openLlmObsSpan({ kind: "llm", name: "op" })).toBeNull();
    });

    it("Opens a span that stays open until finish()", async () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      const { sdk, spans } = makeFakeSdk();
      _setLlmObs(sdk);

      const handle = openLlmObsSpan({ kind: "llm", name: "op" });
      expect(handle).not.toBeNull();
      expect(spans).toHaveLength(1);

      // Span remains open before finish
      await Promise.resolve();
      expect(spans[0].finished).toBe(false);

      handle!.annotate({ outputData: "streamed" });
      expect(spans[0].annotations).toEqual([{ outputData: "streamed" }]);

      handle!.finish();
      await Promise.resolve();
      expect(spans[0].finished).toBe(true);
    });

    it("finish() is idempotent", async () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      const { sdk, spans } = makeFakeSdk();
      _setLlmObs(sdk);
      const handle = openLlmObsSpan({ kind: "llm", name: "op" });
      handle!.finish();
      handle!.finish();
      await Promise.resolve();
      expect(spans[0].finished).toBe(true);
    });
  });
});
