import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client, v2 } from "@datadog/datadog-api-client";
import { getSecret } from "@jaypie/aws";
import { cloneDeep } from "@jaypie/core";

import { DATADOG } from "../constants.js";

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

vi.mock("@datadog/datadog-api-client");

vi.mock("@jaypie/aws");

const mockSubmitMetrics = vi.fn();

beforeEach(() => {
  // Clear environment variables
  delete process.env.PROJECT_ENV;
  delete process.env.PROJECT_KEY;
  delete process.env.PROJECT_SERVICE;
  delete process.env.PROJECT_SPONSOR;
  delete process.env.PROJECT_VERSION;
  
  getSecret.mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
  mockSubmitMetrics.mockResolvedValue({ errors: [] });
  // eslint-disable-next-line import-x/namespace
  v2.MetricsApi = vi.fn(() => {
    return {
      submitMetrics: mockSubmitMetrics,
    };
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
  it("Creates a client configuration", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetric(MOCK.SUBMISSION);
    // Assert
    expect(client.createConfiguration).toHaveBeenCalled();
    expect(client.createConfiguration).toHaveBeenCalledTimes(1);
    expect(
      client.createConfiguration.mock.calls[0][0].authMethods.apiKeyAuth,
    ).toBe(MOCK.SUBMISSION.apiKey);
    // Done
  });
  it("Creates a metrics API instance", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetric(MOCK.SUBMISSION);
    // Assert
    expect(v2.MetricsApi).toHaveBeenCalled();
    expect(v2.MetricsApi).toHaveBeenCalledTimes(1);
    // Done
  });
  it("Submits a metric", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetric(MOCK.SUBMISSION);
    // Assert
    expect(v2.MetricsApi().submitMetrics).toHaveBeenCalled();
    expect(v2.MetricsApi().submitMetrics).toHaveBeenCalledTimes(1);
    const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
    expect(submitMetricsArgs).toBeObject();
    expect(submitMetricsArgs).toHaveProperty("body");
    expect(submitMetricsArgs.body).toBeObject();
    expect(submitMetricsArgs.body).toHaveProperty("series");
    expect(submitMetricsArgs.body.series).toBeArray();
    expect(submitMetricsArgs.body.series).not.toBeEmpty();
    expect(submitMetricsArgs.body.series).toHaveLength(1);
    expect(submitMetricsArgs.body.series[0]).toBeObject();
    expect(submitMetricsArgs.body.series[0]).toHaveProperty("metric");
    expect(submitMetricsArgs.body.series[0].metric).toBe(MOCK.SUBMISSION.name);
    expect(submitMetricsArgs.body.series[0]).toHaveProperty("type");
    expect(submitMetricsArgs.body.series[0].type).toBe(MOCK.SUBMISSION.type);
    expect(submitMetricsArgs.body.series[0]).toHaveProperty("points");
    expect(submitMetricsArgs.body.series[0].points).toBeArray();
    expect(submitMetricsArgs.body.series[0].points).not.toBeEmpty();
    expect(submitMetricsArgs.body.series[0].points).toHaveLength(1);
    expect(submitMetricsArgs.body.series[0].points[0]).toBeObject();
    expect(submitMetricsArgs.body.series[0].points[0]).toHaveProperty(
      "timestamp",
    );
    expect(submitMetricsArgs.body.series[0].points[0].timestamp).toBeNumber();
    expect(submitMetricsArgs.body.series[0].points[0]).toHaveProperty("value");
    expect(submitMetricsArgs.body.series[0].points[0].value).toBeNumber();
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
      getSecret.mockRejectedValue(new Error("Secret retrieval failed"));
      const submission = { ...MOCK.SUBMISSION, apiKey: undefined, apiSecret: "secret-name" };
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
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs).toHaveProperty("body");
      expect(submitMetricsArgs.body).toHaveProperty("series");
      expect(submitMetricsArgs.body.series).toHaveLength(1);
      expect(submitMetricsArgs.body.series[0]).toHaveProperty("tags");
      expect(submitMetricsArgs.body.series[0].tags).toBeArray();
      expect(submitMetricsArgs.body.series[0].tags).not.toBeEmpty();
      expect(submitMetricsArgs.body.series[0].tags).toEqual(tags);
      // Done
    });
    it("Tags submitted as an object are converted to an array", async () => {
      // Arrange
      const tags = { project: "mayhem" };
      // Act
      await submitMetric({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs).toHaveProperty("body");
      expect(submitMetricsArgs.body).toHaveProperty("series");
      expect(submitMetricsArgs.body.series).toHaveLength(1);
      expect(submitMetricsArgs.body.series[0]).toHaveProperty("tags");
      expect(submitMetricsArgs.body.series[0].tags).toBeArray();
      expect(submitMetricsArgs.body.series[0].tags).not.toBeEmpty();
      expect(submitMetricsArgs.body.series[0].tags).toHaveLength(1);
      expect(submitMetricsArgs.body.series[0].tags[0]).toBe("project:mayhem");
      // Done
    });
    it("Will use apiSecret if provided", async () => {
      // Arrange
      const submission = cloneDeep(MOCK.SUBMISSION);
      delete submission.apiKey;
      const apiSecretName = "MOCK_DD_API_SECRET_NAME";
      submission.apiSecret = apiSecretName;
      getSecret.mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
      // Act
      await submitMetric(submission);
      // Assert
      expect(getSecret).toHaveBeenCalled();
      expect(getSecret).toHaveBeenCalledTimes(1);
      expect(getSecret).toHaveBeenCalledWith(apiSecretName);
      expect(client.createConfiguration).toHaveBeenCalled();
      expect(client.createConfiguration).toHaveBeenCalledTimes(1);
      expect(
        client.createConfiguration.mock.calls[0][0].authMethods.apiKeyAuth,
      ).toBe(MOCK.SECRET_DATADOG_API_KEY);
    });
    it("Will use apiSecret over apiKey if both are provided", async () => {
      // Arrange
      const submission = cloneDeep(MOCK.SUBMISSION);
      const apiSecretName = "MOCK_DD_API_SECRET_NAME";
      submission.apiSecret = apiSecretName;
      getSecret.mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
      // Act
      await submitMetric(submission);
      // Assert
      expect(getSecret).toHaveBeenCalled();
      expect(getSecret).toHaveBeenCalledTimes(1);
      expect(getSecret).toHaveBeenCalledWith(apiSecretName);
      expect(client.createConfiguration).toHaveBeenCalled();
      expect(client.createConfiguration).toHaveBeenCalledTimes(1);
      expect(
        client.createConfiguration.mock.calls[0][0].authMethods.apiKeyAuth,
      ).toBe(MOCK.SECRET_DATADOG_API_KEY);
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
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs.body.series[0].tags).toContain("env:test");
      expect(submitMetricsArgs.body.series[0].tags).toContain("project:jaypie");
      expect(submitMetricsArgs.body.series[0].tags).toContain(
        "service:datadog",
      );
      expect(submitMetricsArgs.body.series[0].tags).toContain("sponsor:acme");
      expect(submitMetricsArgs.body.series[0].tags).toContain("version:1.0.0");
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
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs.body.series[0].tags).toContain("env:production");
      expect(submitMetricsArgs.body.series[0].tags).toContain("project:custom");
      expect(submitMetricsArgs.body.series[0].tags).not.toContain(
        "env:default",
      );
      expect(submitMetricsArgs.body.series[0].tags).not.toContain(
        "project:default",
      );
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
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      expect(submitMetricsArgs.body.series[0].tags).toContain("env:false");
      expect(submitMetricsArgs.body.series[0].tags).toContain("project:");
      expect(submitMetricsArgs.body.series[0].tags).not.toContain("env:test");
      expect(submitMetricsArgs.body.series[0].tags).not.toContain(
        "project:jaypie",
      );
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
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      const finalTags = submitMetricsArgs.body.series[0].tags;
      expect(finalTags).toContain("taco:beef");
      expect(finalTags).toContain("cheese:extra");
      expect(finalTags).toContain("double");
      expect(finalTags).not.toContain("cheese:false");
      expect(finalTags.filter((tag) => tag === "double")).toHaveLength(1);
      expect(finalTags.filter((tag) => tag.startsWith("cheese:"))).toHaveLength(
        1,
      );
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
      const submitMetricsArgs = v2.MetricsApi().submitMetrics.mock.calls[0][0];
      const finalTags = submitMetricsArgs.body.series[0].tags;
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
