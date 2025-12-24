import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getSecret } from "@jaypie/aws";
import { cloneDeep } from "@jaypie/kit";

import { DATADOG } from "../constants.js";
import { createDatadogClient } from "../datadog.client.js";

// Subject
import submitMetric from "../submitMetric.adapter.js";

//
//
// Mock constants
//

const MOCK = {
  [DATADOG.ENV.DATADOG_API_KEY]: "MOCK_DD_API_KEY",
  [DATADOG.ENV.DD_SITE]: "MOCK_DATADOG_HQ_COM",
  SECRET_DATADOG_API_KEY: "MOCK_SECRET_DATADOG_API_KEY",
  SUBMISSION: {
    apiKey: "MOCK_DD_API_KEY",
    name: "MOCK.METRIC.NAME",
    type: DATADOG.METRIC.TYPE.GAUGE,
    value: 12,
  },
};

//
//
// Mock modules
//

vi.mock("../datadog.client.js");

vi.mock("@jaypie/aws");

const mockSubmitMetrics = vi.fn();

beforeEach(() => {
  // Clear environment variables
  delete process.env.PROJECT_ENV;
  delete process.env.PROJECT_KEY;
  delete process.env.PROJECT_SERVICE;
  delete process.env.PROJECT_SPONSOR;
  delete process.env.PROJECT_VERSION;

  (getSecret as Mock).mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
  mockSubmitMetrics.mockResolvedValue({ status: "ok" });

  (createDatadogClient as Mock).mockReturnValue({
    submitMetrics: mockSubmitMetrics,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Datadog Metric Adapter", () => {
  it("Works", async () => {
    const response = await submitMetric(MOCK.SUBMISSION);
    expect(response).not.toBeUndefined();
  });
  it("Creates a datadog client", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetric(MOCK.SUBMISSION);
    // Assert
    expect(createDatadogClient).toHaveBeenCalled();
    expect(createDatadogClient).toHaveBeenCalledTimes(1);
    expect((createDatadogClient as Mock).mock.calls[0][0].apiKey).toBe(
      MOCK.SUBMISSION.apiKey,
    );
    // Done
  });
  it("Submits a metric", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetric(MOCK.SUBMISSION);
    // Assert
    expect(mockSubmitMetrics).toHaveBeenCalled();
    expect(mockSubmitMetrics).toHaveBeenCalledTimes(1);
    const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
    expect(submitMetricsArgs).toBeObject();
    expect(submitMetricsArgs).toHaveProperty("series");
    expect(submitMetricsArgs.series).toBeArray();
    expect(submitMetricsArgs.series).not.toBeEmpty();
    expect(submitMetricsArgs.series).toHaveLength(1);
    expect(submitMetricsArgs.series[0]).toBeObject();
    expect(submitMetricsArgs.series[0]).toHaveProperty("metric");
    expect(submitMetricsArgs.series[0].metric).toBe(MOCK.SUBMISSION.name);
    expect(submitMetricsArgs.series[0]).toHaveProperty("type");
    expect(submitMetricsArgs.series[0].type).toBe(MOCK.SUBMISSION.type);
    expect(submitMetricsArgs.series[0]).toHaveProperty("points");
    expect(submitMetricsArgs.series[0].points).toBeArray();
    expect(submitMetricsArgs.series[0].points).not.toBeEmpty();
    expect(submitMetricsArgs.series[0].points).toHaveLength(1);
    expect(submitMetricsArgs.series[0].points[0]).toBeObject();
    expect(submitMetricsArgs.series[0].points[0]).toHaveProperty("timestamp");
    expect(submitMetricsArgs.series[0].points[0].timestamp).toBeNumber();
    expect(submitMetricsArgs.series[0].points[0]).toHaveProperty("value");
    expect(submitMetricsArgs.series[0].points[0].value).toBeNumber();
    // Done
  });
  describe("Error cases", () => {
    it("Will return false if DD_API_KEY is missing", async () => {
      // Arrange
      const submission = cloneDeep(MOCK.SUBMISSION);
      delete submission.apiKey;
      // Act
      const response = await submitMetric(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
    it("Does not throw when API call fails", async () => {
      // Arrange
      mockSubmitMetrics.mockRejectedValue(new Error("API Error"));
      // Act & Assert
      await expect(async () => {
        const response = await submitMetric(MOCK.SUBMISSION);
        expect(response).toBeFalse();
      }).not.toThrow();
      // Done
    });
    it("Does not throw when getSecret fails", async () => {
      // Arrange
      (getSecret as Mock).mockRejectedValue(
        new Error("Secret retrieval failed"),
      );
      const submission = {
        ...MOCK.SUBMISSION,
        apiKey: undefined,
        apiSecret: "secret-name",
      };
      // Act & Assert
      await expect(async () => {
        const response = await submitMetric(submission);
        expect(response).toBeFalse();
      }).not.toThrow();
      // Done
    });
  });
  describe("Features", () => {
    it("Submits tags", async () => {
      // Arrange
      const tags = ["MOCK_TAG"];
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs).toHaveProperty("series");
      expect(submitMetricsArgs.series).toHaveLength(1);
      expect(submitMetricsArgs.series[0]).toHaveProperty("tags");
      expect(submitMetricsArgs.series[0].tags).toBeArray();
      expect(submitMetricsArgs.series[0].tags).not.toBeEmpty();
      expect(submitMetricsArgs.series[0].tags).toEqual(tags);
      // Done
    });
    it("Tags submitted as an object are converted to an array", async () => {
      // Arrange
      const tags = { project: "mayhem" };
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs).toHaveProperty("series");
      expect(submitMetricsArgs.series).toHaveLength(1);
      expect(submitMetricsArgs.series[0]).toHaveProperty("tags");
      expect(submitMetricsArgs.series[0].tags).toBeArray();
      expect(submitMetricsArgs.series[0].tags).not.toBeEmpty();
      expect(submitMetricsArgs.series[0].tags).toHaveLength(1);
      expect(submitMetricsArgs.series[0].tags[0]).toBe("project:mayhem");
      // Done
    });
    it("Will use apiSecret if provided", async () => {
      // Arrange
      const submission = cloneDeep(MOCK.SUBMISSION);
      delete submission.apiKey;
      const apiSecretName = "MOCK_DD_API_SECRET_NAME";
      submission.apiSecret = apiSecretName;
      (getSecret as Mock).mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
      // Act
      await submitMetric(submission);
      // Assert
      expect(getSecret).toHaveBeenCalled();
      expect(getSecret).toHaveBeenCalledTimes(1);
      expect(getSecret).toHaveBeenCalledWith(apiSecretName);
      expect(createDatadogClient).toHaveBeenCalled();
      expect(createDatadogClient).toHaveBeenCalledTimes(1);
      expect((createDatadogClient as Mock).mock.calls[0][0].apiKey).toBe(
        MOCK.SECRET_DATADOG_API_KEY,
      );
    });
    it("Will use apiSecret over apiKey if both are provided", async () => {
      // Arrange
      const submission = cloneDeep(MOCK.SUBMISSION);
      const apiSecretName = "MOCK_DD_API_SECRET_NAME";
      submission.apiSecret = apiSecretName;
      (getSecret as Mock).mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
      // Act
      await submitMetric(submission);
      // Assert
      expect(getSecret).toHaveBeenCalled();
      expect(getSecret).toHaveBeenCalledTimes(1);
      expect(getSecret).toHaveBeenCalledWith(apiSecretName);
      expect(createDatadogClient).toHaveBeenCalled();
      expect(createDatadogClient).toHaveBeenCalledTimes(1);
      expect((createDatadogClient as Mock).mock.calls[0][0].apiKey).toBe(
        MOCK.SECRET_DATADOG_API_KEY,
      );
    });
    it("Includes environment tags when present", async () => {
      // Arrange
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PROJECT_ENV: "test",
        PROJECT_KEY: "jaypie",
        PROJECT_SERVICE: "datadog",
        PROJECT_SPONSOR: "acme",
        PROJECT_VERSION: "1.0.0",
      };
      // Act
      await submitMetric(MOCK.SUBMISSION);
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs.series[0].tags).toContain("env:test");
      expect(submitMetricsArgs.series[0].tags).toContain("project:jaypie");
      expect(submitMetricsArgs.series[0].tags).toContain("service:datadog");
      expect(submitMetricsArgs.series[0].tags).toContain("sponsor:acme");
      expect(submitMetricsArgs.series[0].tags).toContain("version:1.0.0");
      // Cleanup
      process.env = originalEnv;
    });
    it("User tags override environment tags", async () => {
      // Arrange
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PROJECT_ENV: "default",
        PROJECT_KEY: "default",
      };
      const tags = { env: "production", project: "custom" };
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs.series[0].tags).toContain("env:production");
      expect(submitMetricsArgs.series[0].tags).toContain("project:custom");
      expect(submitMetricsArgs.series[0].tags).not.toContain("env:default");
      expect(submitMetricsArgs.series[0].tags).not.toContain("project:default");
      // Cleanup
      process.env = originalEnv;
    });
    it("Falsy user tags suppress environment tags", async () => {
      // Arrange
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PROJECT_ENV: "test",
        PROJECT_KEY: "jaypie",
      };
      const tags = { env: false, project: "" };
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs.series[0].tags).toContain("env:false");
      expect(submitMetricsArgs.series[0].tags).toContain("project:");
      expect(submitMetricsArgs.series[0].tags).not.toContain("env:test");
      expect(submitMetricsArgs.series[0].tags).not.toContain("project:jaypie");
      // Cleanup
      process.env = originalEnv;
    });
    it("Resolves duplicate tags correctly", async () => {
      // Arrange
      const tags = [
        "taco:beef",
        "cheese:false",
        "double",
        "cheese:extra",
        "double",
      ];
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      const finalTags = submitMetricsArgs.series[0].tags;
      expect(finalTags).toContain("taco:beef");
      expect(finalTags).toContain("cheese:extra");
      expect(finalTags).toContain("double");
      expect(finalTags).not.toContain("cheese:false");
      expect(finalTags.filter((tag: string) => tag === "double")).toHaveLength(
        1,
      );
      expect(
        finalTags.filter((tag: string) => tag.startsWith("cheese:")),
      ).toHaveLength(1);
    });
    it("Mixed array and environment tags resolve duplicates correctly", async () => {
      // Arrange
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PROJECT_ENV: "test",
        PROJECT_KEY: "jaypie",
      };
      const tags = ["env:production", "custom", "project:override"];
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = mockSubmitMetrics.mock.calls[0][0];
      const finalTags = submitMetricsArgs.series[0].tags;
      expect(finalTags).toContain("env:production");
      expect(finalTags).toContain("project:override");
      expect(finalTags).toContain("custom");
      expect(finalTags).not.toContain("env:test");
      expect(finalTags).not.toContain("project:jaypie");
      // Cleanup
      process.env = originalEnv;
    });
  });
});
