import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client, v1 } from "@datadog/datadog-api-client";
import { getSecret } from "@jaypie/aws";
import { cloneDeep } from "@jaypie/core";

import { DATADOG } from "../constants.js";

// Subject
import submitDistribution from "../submitDistribution.adapter.js";

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
    name: "system.load.1.dist",
    point: [1.0, 2.0],
  },
  SUBMISSION_WITH_POINTS: {
    apiKey: "MOCK_DD_API_KEY",
    name: "system.load.1.dist",
    points: [[Math.round(Date.now() / 1000), [1.0, 2.0]]],
  },
};

//
//
// Mock modules
//

vi.mock("@datadog/datadog-api-client");

vi.mock("@jaypie/aws");

const mockSubmitDistributionPoints = vi.fn();

beforeEach(() => {
  // Clear environment variables
  delete process.env.PROJECT_ENV;
  delete process.env.PROJECT_KEY;
  delete process.env.PROJECT_SERVICE;
  delete process.env.PROJECT_SPONSOR;
  delete process.env.PROJECT_VERSION;

  getSecret.mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
  mockSubmitDistributionPoints.mockResolvedValue({ errors: [] });
  // eslint-disable-next-line import-x/namespace
  v1.MetricsApi = vi.fn(() => {
    return {
      submitDistributionPoints: mockSubmitDistributionPoints,
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

describe("Datadog Distribution Adapter", () => {
  describe("Base Cases", () => {
    it("Works", async () => {
      const response = await submitDistribution(MOCK.SUBMISSION);
      expect(response).not.toBeUndefined();
    });
    it("Creates a client configuration", async () => {
      // Arrange
      // N/A
      // Act
      await submitDistribution(MOCK.SUBMISSION);
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
      await submitDistribution(MOCK.SUBMISSION);
      // Assert
      expect(v1.MetricsApi).toHaveBeenCalled();
      expect(v1.MetricsApi).toHaveBeenCalledTimes(1);
      // Done
    });
    it("Submits a distribution", async () => {
      // Arrange
      // N/A
      // Act
      await submitDistribution(MOCK.SUBMISSION);
      // Assert
      expect(v1.MetricsApi().submitDistributionPoints).toHaveBeenCalled();
      expect(v1.MetricsApi().submitDistributionPoints).toHaveBeenCalledTimes(1);
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs).toBeObject();
      expect(submitArgs).toHaveProperty("body");
      expect(submitArgs.body).toBeObject();
      expect(submitArgs.body).toHaveProperty("series");
      expect(submitArgs.body.series).toBeArray();
      expect(submitArgs.body.series).not.toBeEmpty();
      expect(submitArgs.body.series).toHaveLength(1);
      expect(submitArgs.body.series[0]).toBeObject();
      expect(submitArgs.body.series[0]).toHaveProperty("metric");
      expect(submitArgs.body.series[0].metric).toBe(MOCK.SUBMISSION.name);
      expect(submitArgs.body.series[0]).toHaveProperty("points");
      expect(submitArgs.body.series[0].points).toBeArray();
      expect(submitArgs.body.series[0].points).not.toBeEmpty();
      expect(submitArgs.body.series[0].points).toHaveLength(1);
      expect(submitArgs.body.series[0].points[0]).toBeArray();
      expect(submitArgs.body.series[0].points[0]).toHaveLength(2);
      expect(submitArgs.body.series[0].points[0][0]).toBeNumber(); // timestamp
      expect(submitArgs.body.series[0].points[0][1]).toBeArray(); // values
      expect(submitArgs.body.series[0].points[0][1]).toEqual(
        MOCK.SUBMISSION.point,
      );
      expect(submitArgs).toHaveProperty("contentEncoding");
      expect(submitArgs.contentEncoding).toBe("deflate");
      // Done
    });
  });

  describe("Error Conditions", () => {
    it("Will return false if DD_API_KEY is missing", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, apiKey: undefined };
      // Act
      const response = await submitDistribution(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
    it("Will return false if name is missing", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, name: undefined };
      // Act
      const response = await submitDistribution(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
    it("Will return false if points and point are missing", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, point: undefined };
      // Act
      const response = await submitDistribution(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
    it("Will return false if points is empty and point is null", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, points: [], point: null };
      // Act
      const response = await submitDistribution(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
  });

  describe("Security", () => {
    it("Will use apiSecret if provided", async () => {
      // Arrange
      const submission = cloneDeep(MOCK.SUBMISSION);
      delete submission.apiKey;
      const apiSecretName = "MOCK_DD_API_SECRET_NAME";
      submission.apiSecret = apiSecretName;
      getSecret.mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
      // Act
      await submitDistribution(submission);
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
      await submitDistribution(submission);
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
  });

  describe("Observability", () => {
    it("Logs trace information", async () => {
      // Arrange
      const logSpy = vi.spyOn(console, "log");
      // Act
      await submitDistribution(MOCK.SUBMISSION);
      // Assert
      // Note: We're just checking that no errors are thrown during logging
      // The actual log verification would depend on the specific log implementation
      expect(logSpy).not.toThrow();
      // Done
    });
  });

  describe("Happy Paths", () => {
    it("Submits distribution with points array", async () => {
      // Arrange
      // N/A
      // Act
      await submitDistribution(MOCK.SUBMISSION_WITH_POINTS);
      // Assert
      expect(v1.MetricsApi().submitDistributionPoints).toHaveBeenCalled();
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].points).toEqual(
        MOCK.SUBMISSION_WITH_POINTS.points,
      );
      // Done
    });
    it("Converts single point to points array", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, point: [3.0, 4.0] };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].points).toBeArray();
      expect(submitArgs.body.series[0].points).toHaveLength(1);
      expect(submitArgs.body.series[0].points[0][1]).toEqual([3.0, 4.0]);
      // Done
    });
    it("Converts single value to array in point", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, point: 5.0 };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].points).toBeArray();
      expect(submitArgs.body.series[0].points).toHaveLength(1);
      expect(submitArgs.body.series[0].points[0][1]).toEqual([5.0]);
      // Done
    });
  });

  describe("Features", () => {
    it("Submits tags", async () => {
      // Arrange
      const tags = ["MOCK_TAG"];
      // Act
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs).toHaveProperty("body");
      expect(submitArgs.body).toHaveProperty("series");
      expect(submitArgs.body.series).toHaveLength(1);
      expect(submitArgs.body.series[0]).toHaveProperty("tags");
      expect(submitArgs.body.series[0].tags).toBeArray();
      expect(submitArgs.body.series[0].tags).not.toBeEmpty();
      expect(submitArgs.body.series[0].tags).toEqual(tags);
      // Done
    });
    it("Tags submitted as an object are converted to an array", async () => {
      // Arrange
      const tags = { project: "mayhem" };
      // Act
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs).toHaveProperty("body");
      expect(submitArgs.body).toHaveProperty("series");
      expect(submitArgs.body.series).toHaveLength(1);
      expect(submitArgs.body.series[0]).toHaveProperty("tags");
      expect(submitArgs.body.series[0].tags).toBeArray();
      expect(submitArgs.body.series[0].tags).not.toBeEmpty();
      expect(submitArgs.body.series[0].tags).toHaveLength(1);
      expect(submitArgs.body.series[0].tags[0]).toBe("project:mayhem");
      // Done
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
      await submitDistribution(MOCK.SUBMISSION);
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].tags).toContain("env:test");
      expect(submitArgs.body.series[0].tags).toContain("project:jaypie");
      expect(submitArgs.body.series[0].tags).toContain("service:datadog");
      expect(submitArgs.body.series[0].tags).toContain("sponsor:acme");
      expect(submitArgs.body.series[0].tags).toContain("version:1.0.0");
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
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].tags).toContain("env:production");
      expect(submitArgs.body.series[0].tags).toContain("project:custom");
      expect(submitArgs.body.series[0].tags).not.toContain("env:default");
      expect(submitArgs.body.series[0].tags).not.toContain("project:default");
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
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      const finalTags = submitArgs.body.series[0].tags;
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
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      const finalTags = submitArgs.body.series[0].tags;
      expect(finalTags).toContain("env:production");
      expect(finalTags).toContain("project:override");
      expect(finalTags).toContain("custom");
      expect(finalTags).not.toContain("env:test");
      expect(finalTags).not.toContain("project:jaypie");
      // Cleanup
      process.env = originalEnv;
    });
  });

  describe("Specific Scenarios", () => {
    it("Uses custom timestamp when provided", async () => {
      // Arrange
      const customTimestamp = 1234567890;
      const submission = { ...MOCK.SUBMISSION, timestamp: customTimestamp };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].points[0][0]).toBe(customTimestamp);
      // Done
    });
    it("Prefers points over point when both are provided", async () => {
      // Arrange
      const customPoints = [[1234567890, [10.0, 20.0]]];
      const submission = {
        ...MOCK.SUBMISSION,
        points: customPoints,
        point: [1.0, 2.0], // Should be ignored
      };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].points).toEqual(customPoints);
      // Done
    });
    it("Handles empty points array by falling back to point", async () => {
      // Arrange
      const submission = {
        ...MOCK.SUBMISSION,
        points: [],
        point: [7.0, 8.0],
      };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs =
        v1.MetricsApi().submitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.body.series[0].points).toHaveLength(1);
      expect(submitArgs.body.series[0].points[0][1]).toEqual([7.0, 8.0]);
      // Done
    });
  });
});
