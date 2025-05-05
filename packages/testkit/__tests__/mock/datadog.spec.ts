import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordMetric, startSpan } from "../../src/mock/datadog";

describe("Datadog Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordMetric", () => {
    it("should be a mock function", () => {
      expect(typeof recordMetric).toBe("function");
      expect(recordMetric.mock).toBeDefined();
    });

    it("should track calls with metric name, value and tags", () => {
      recordMetric("api.request.count", 1, ["endpoint:users", "method:GET"]);

      expect(recordMetric.mock.calls.length).toBe(1);
      expect(recordMetric.mock.calls[0][0]).toBe("api.request.count");
      expect(recordMetric.mock.calls[0][1]).toBe(1);
      expect(recordMetric.mock.calls[0][2]).toEqual([
        "endpoint:users",
        "method:GET",
      ]);
    });
  });

  describe("startSpan", () => {
    it("should return an object with finish method", () => {
      const span = startSpan("db.query");

      expect(span).toBeDefined();
      expect(typeof span.finish).toBe("function");
    });

    it("should track calls with span name and options", () => {
      const options = { resource: "getUserById" };
      startSpan("db.query", options);

      expect(startSpan.mock.calls.length).toBe(1);
      expect(startSpan.mock.calls[0][0]).toBe("db.query");
      expect(startSpan.mock.calls[0][1]).toBe(options);
    });

    it("should track finish method calls", () => {
      const span = startSpan("db.query");
      span.finish();

      expect(span.finish.mock.calls.length).toBe(1);
    });
  });
});
