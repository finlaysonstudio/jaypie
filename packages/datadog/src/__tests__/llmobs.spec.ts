import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import {
  _resetLlmObs,
  _setLlmObs,
  flushLlmObs,
  getLlmObs,
  isLlmObsEnabled,
} from "../llmobs.js";

//
//
// Setup
//

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  _resetLlmObs();
  delete process.env.DD_LLMOBS_ENABLED;
});

afterEach(() => {
  _resetLlmObs();
  process.env = { ...ORIGINAL_ENV };
});

//
//
// Run tests
//

describe("llmobs", () => {
  describe("Base Cases", () => {
    it("exports functions", () => {
      expect(typeof flushLlmObs).toBe("function");
      expect(typeof getLlmObs).toBe("function");
      expect(typeof isLlmObsEnabled).toBe("function");
    });

    it("flushLlmObs is a no-op when dd-trace is absent", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      expect(() => flushLlmObs()).not.toThrow();
    });

    it("getLlmObs returns null when the SDK is unavailable", () => {
      // Inject null rather than relying on dd-trace being absent: the traced
      // deploy job loads dd-trace, so unmocked resolution returns a real SDK.
      _setLlmObs(null);
      expect(getLlmObs()).toBeNull();
    });
  });

  describe("isLlmObsEnabled", () => {
    it("is false when unset", () => {
      expect(isLlmObsEnabled()).toBe(false);
    });

    it.each(["true", "1", "yes", "on"])("is true for %s", (value) => {
      process.env.DD_LLMOBS_ENABLED = value;
      expect(isLlmObsEnabled()).toBe(true);
    });

    it.each(["false", "0", ""])("is false for %s", (value) => {
      process.env.DD_LLMOBS_ENABLED = value;
      expect(isLlmObsEnabled()).toBe(false);
    });
  });

  describe("flushLlmObs", () => {
    it("flushes the SDK when enabled", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      const flush = vi.fn();
      _setLlmObs({ flush });

      flushLlmObs();

      expect(flush).toHaveBeenCalledOnce();
    });

    it("does not flush when disabled", () => {
      const flush = vi.fn();
      _setLlmObs({ flush });

      flushLlmObs();

      expect(flush).not.toHaveBeenCalled();
    });

    it("swallows flush errors", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      _setLlmObs({
        flush: () => {
          throw new Error("boom");
        },
      });

      expect(() => flushLlmObs()).not.toThrow();
    });

    it("no-ops when SDK is unavailable even if enabled", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      _setLlmObs(null);

      expect(() => flushLlmObs()).not.toThrow();
    });
  });

  describe("getLlmObs", () => {
    it("returns the runtime SDK singleton when available", () => {
      const sdk = { flush: vi.fn() };
      _setLlmObs(sdk);

      expect(getLlmObs()).toBe(sdk);
    });

    it("returns the SDK regardless of the enabled flag", () => {
      // getLlmObs is a raw accessor; gating belongs to flushLlmObs only
      const sdk = { flush: vi.fn() };
      _setLlmObs(sdk);

      expect(getLlmObs()).toBe(sdk);
    });
  });
});
