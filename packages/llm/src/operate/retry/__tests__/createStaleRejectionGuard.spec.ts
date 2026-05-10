import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStaleRejectionGuard } from "../createStaleRejectionGuard.js";

const traceMock = vi.fn();

vi.mock("../../../util/index.js", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    trace: traceMock,
    var: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("createStaleRejectionGuard", () => {
  beforeEach(() => {
    traceMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof createStaleRejectionGuard).toBe("function");
    });

    it("returns install/remove/recordCaught controls", () => {
      const guard = createStaleRejectionGuard();
      expect(typeof guard.install).toBe("function");
      expect(typeof guard.remove).toBe("function");
      expect(typeof guard.recordCaught).toBe("function");
    });
  });

  describe("install / remove", () => {
    it("registers a single listener even if install called twice", () => {
      const onSpy = vi.spyOn(process, "on");
      const guard = createStaleRejectionGuard();
      guard.install();
      guard.install();

      const calls = onSpy.mock.calls.filter(
        (c) => c[0] === "unhandledRejection",
      );
      expect(calls.length).toBe(1);

      guard.remove();
      onSpy.mockRestore();
    });

    it("removes the listener it installed", () => {
      const removeSpy = vi.spyOn(process, "removeListener");
      const guard = createStaleRejectionGuard();
      guard.install();
      guard.remove();

      const calls = removeSpy.mock.calls.filter(
        (c) => c[0] === "unhandledRejection",
      );
      expect(calls.length).toBe(1);
      removeSpy.mockRestore();
    });
  });

  describe("Suppression", () => {
    it("suppresses transient socket errors (e.g. TypeError: terminated)", () => {
      const guard = createStaleRejectionGuard();
      guard.install();

      const terminated = new TypeError("terminated");
      const rejected = Promise.reject(terminated);
      rejected.catch(() => {});

      process.emit("unhandledRejection", terminated, rejected);

      expect(traceMock).toHaveBeenCalledWith(
        "Suppressed stale socket error during retry",
      );
      guard.remove();
    });

    it("suppresses sibling rejection that is the same error instance (issue #336)", () => {
      const guard = createStaleRejectionGuard();
      guard.install();

      const upstream = new SyntaxError("Unexpected end of JSON input");
      guard.recordCaught(upstream);

      const rejected = Promise.reject(upstream);
      rejected.catch(() => {});
      process.emit("unhandledRejection", upstream, rejected);

      expect(traceMock).toHaveBeenCalledWith(
        "Suppressed sibling rejection of already-handled error",
      );
      guard.remove();
    });

    it("suppresses sibling rejection that is a fresh Error with matching name+message (issue #336)", () => {
      const guard = createStaleRejectionGuard();
      guard.install();

      const upstream = new SyntaxError("Unexpected end of JSON input");
      guard.recordCaught(upstream);

      const sibling = new SyntaxError("Unexpected end of JSON input");
      const rejected = Promise.reject(sibling);
      rejected.catch(() => {});
      process.emit("unhandledRejection", sibling, rejected);

      expect(traceMock).toHaveBeenCalledWith(
        "Suppressed sibling rejection of already-handled error",
      );
      guard.remove();
    });

    it("does not suppress unrelated rejections", () => {
      const guard = createStaleRejectionGuard();
      guard.install();

      const upstream = new SyntaxError("Unexpected end of JSON input");
      guard.recordCaught(upstream);

      const unrelated = new Error("totally unrelated");
      const rejected = Promise.reject(unrelated);
      rejected.catch(() => {});
      process.emit("unhandledRejection", unrelated, rejected);

      expect(traceMock).not.toHaveBeenCalled();
      guard.remove();
    });

    it("forgets recorded errors after remove()", () => {
      const guard = createStaleRejectionGuard();
      guard.install();

      const upstream = new SyntaxError("Unexpected end of JSON input");
      guard.recordCaught(upstream);
      guard.remove();

      guard.install();
      const rejected = Promise.reject(upstream);
      rejected.catch(() => {});
      process.emit("unhandledRejection", upstream, rejected);

      expect(traceMock).not.toHaveBeenCalled();
      guard.remove();
    });
  });
});
