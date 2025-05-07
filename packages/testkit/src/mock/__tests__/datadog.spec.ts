import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitMetric, submitMetricSet } from "../datadog";

describe("Datadog Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("submitMetric is a mock function", () => {
      expect(typeof submitMetric).toBe("function");
      expect(submitMetric.mock).toBeDefined();
    });

    it("submitMetricSet is a mock function", () => {
      expect(typeof submitMetricSet).toBe("function");
      expect(submitMetricSet.mock).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("submitMetric returns true by default", async () => {
      const result = await submitMetric({});
      expect(result).toBe(true);
    });

    it("submitMetricSet returns true by default", async () => {
      const result = await submitMetricSet({});
      expect(result).toBe(true);
    });
  });

  describe("Features", () => {
    it("submitMetric tracks calls with options", () => {
      const options = {
        metric: "api.request.count",
        value: 1,
        tags: ["endpoint:users", "method:GET"],
      };
      submitMetric(options);

      expect(submitMetric).toHaveBeenCalledTimes(1);
      expect(submitMetric).toHaveBeenCalledWith(options);
    });

    it("submitMetricSet tracks calls with options", () => {
      const options = {
        metrics: [
          { name: "api.request.count", value: 1 },
          { name: "api.response.time", value: 150 },
        ],
        tags: ["endpoint:users", "method:GET"],
      };
      submitMetricSet(options);

      expect(submitMetricSet).toHaveBeenCalledTimes(1);
      expect(submitMetricSet).toHaveBeenCalledWith(options);
    });

    it("submitMetric can have custom return value", () => {
      submitMetric.mockReturnValueOnce(false);
      const result = submitMetric({});
      expect(result).toBe(false);
    });

    it("submitMetricSet can have custom return value", () => {
      submitMetricSet.mockReturnValueOnce(false);
      const result = submitMetricSet({});
      expect(result).toBe(false);
    });
  });
});
