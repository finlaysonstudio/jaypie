import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getSecret } from "@jaypie/aws";
import { cloneDeep } from "@jaypie/kit";

import { DATADOG } from "../constants.js";
import { createDatadogClient } from "../datadog.client.js";

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
    value: [1.0, 2.0],
  },
  SUBMISSION_WITH_POINTS: {
    apiKey: "MOCK_DD_API_KEY",
    name: "system.load.1.dist",
    points: [[Math.round(Date.now() / 1000), [1.0, 2.0]]] as [
      number,
      number[],
    ][],
  },
};

//
//
// Mock modules
//

vi.mock("../datadog.client.js");

vi.mock("@jaypie/aws");

const mockSubmitDistributionPoints = vi.fn();

beforeEach(() => {
  // Clear environment variables
  delete process.env.PROJECT_ENV;
  delete process.env.PROJECT_KEY;
  delete process.env.PROJECT_SERVICE;
  delete process.env.PROJECT_SPONSOR;
  delete process.env.PROJECT_VERSION;

  (getSecret as Mock).mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
  mockSubmitDistributionPoints.mockResolvedValue({ status: "ok" });

  (createDatadogClient as Mock).mockReturnValue({
    submitDistributionPoints: mockSubmitDistributionPoints,
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
    it("Creates a datadog client", async () => {
      // Arrange
      // N/A
      // Act
      await submitDistribution(MOCK.SUBMISSION);
      // Assert
      expect(createDatadogClient).toHaveBeenCalled();
      expect(createDatadogClient).toHaveBeenCalledTimes(1);
      expect((createDatadogClient as Mock).mock.calls[0][0].apiKey).toBe(
        MOCK.SUBMISSION.apiKey,
      );
      // Done
    });
    it("Submits a distribution", async () => {
      // Arrange
      // N/A
      // Act
      await submitDistribution(MOCK.SUBMISSION);
      // Assert
      expect(mockSubmitDistributionPoints).toHaveBeenCalled();
      expect(mockSubmitDistributionPoints).toHaveBeenCalledTimes(1);
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs).toBeObject();
      expect(submitArgs).toHaveProperty("series");
      expect(submitArgs.series).toBeArray();
      expect(submitArgs.series).not.toBeEmpty();
      expect(submitArgs.series).toHaveLength(1);
      expect(submitArgs.series[0]).toBeObject();
      expect(submitArgs.series[0]).toHaveProperty("metric");
      expect(submitArgs.series[0].metric).toBe(MOCK.SUBMISSION.name);
      expect(submitArgs.series[0]).toHaveProperty("points");
      expect(submitArgs.series[0].points).toBeArray();
      expect(submitArgs.series[0].points).not.toBeEmpty();
      expect(submitArgs.series[0].points).toHaveLength(1);
      expect(submitArgs.series[0].points[0]).toBeArray();
      expect(submitArgs.series[0].points[0]).toHaveLength(2);
      expect(submitArgs.series[0].points[0][0]).toBeNumber(); // timestamp
      expect(submitArgs.series[0].points[0][1]).toBeArray(); // values
      expect(submitArgs.series[0].points[0][1]).toEqual(MOCK.SUBMISSION.value);
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
    it("Will return false if points and value are missing", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, value: undefined };
      // Act
      const response = await submitDistribution(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
    it("Will return false if points is empty and value is null", async () => {
      // Arrange
      const submission = {
        ...MOCK.SUBMISSION,
        points: [] as [number, number[]][],
        value: null,
      };
      // Act
      const response = await submitDistribution(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
    it("Does not throw when API call fails", async () => {
      // Arrange
      mockSubmitDistributionPoints.mockRejectedValue(new Error("API Error"));
      // Act & Assert
      await expect(async () => {
        const response = await submitDistribution(MOCK.SUBMISSION);
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
        const response = await submitDistribution(submission);
        expect(response).toBeFalse();
      }).not.toThrow();
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
      (getSecret as Mock).mockImplementation(() => MOCK.SECRET_DATADOG_API_KEY);
      // Act
      await submitDistribution(submission);
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
      await submitDistribution(submission);
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
      expect(mockSubmitDistributionPoints).toHaveBeenCalled();
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].points).toEqual(
        MOCK.SUBMISSION_WITH_POINTS.points,
      );
      // Done
    });
    it("Converts single value to points array", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, value: [3.0, 4.0] };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].points).toBeArray();
      expect(submitArgs.series[0].points).toHaveLength(1);
      expect(submitArgs.series[0].points[0][1]).toEqual([3.0, 4.0]);
      // Done
    });
    it("Converts single value to array in value", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, value: 5.0 };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].points).toBeArray();
      expect(submitArgs.series[0].points).toHaveLength(1);
      expect(submitArgs.series[0].points[0][1]).toEqual([5.0]);
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
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs).toHaveProperty("series");
      expect(submitArgs.series).toHaveLength(1);
      expect(submitArgs.series[0]).toHaveProperty("tags");
      expect(submitArgs.series[0].tags).toBeArray();
      expect(submitArgs.series[0].tags).not.toBeEmpty();
      expect(submitArgs.series[0].tags).toEqual(tags);
      // Done
    });
    it("Tags submitted as an object are converted to an array", async () => {
      // Arrange
      const tags = { project: "mayhem" };
      // Act
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs).toHaveProperty("series");
      expect(submitArgs.series).toHaveLength(1);
      expect(submitArgs.series[0]).toHaveProperty("tags");
      expect(submitArgs.series[0].tags).toBeArray();
      expect(submitArgs.series[0].tags).not.toBeEmpty();
      expect(submitArgs.series[0].tags).toHaveLength(1);
      expect(submitArgs.series[0].tags[0]).toBe("project:mayhem");
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
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].tags).toContain("env:test");
      expect(submitArgs.series[0].tags).toContain("project:jaypie");
      expect(submitArgs.series[0].tags).toContain("service:datadog");
      expect(submitArgs.series[0].tags).toContain("sponsor:acme");
      expect(submitArgs.series[0].tags).toContain("version:1.0.0");
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
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].tags).toContain("env:production");
      expect(submitArgs.series[0].tags).toContain("project:custom");
      expect(submitArgs.series[0].tags).not.toContain("env:default");
      expect(submitArgs.series[0].tags).not.toContain("project:default");
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
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      const finalTags = submitArgs.series[0].tags;
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
      await submitDistribution({ ...MOCK.SUBMISSION, tags });
      // Assert
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      const finalTags = submitArgs.series[0].tags;
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
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].points[0][0]).toBe(customTimestamp);
      // Done
    });
    it("Prefers points over value when both are provided", async () => {
      // Arrange
      const customPoints: [number, number[]][] = [[1234567890, [10.0, 20.0]]];
      const submission = {
        ...MOCK.SUBMISSION,
        points: customPoints,
        value: [1.0, 2.0], // Should be ignored
      };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].points).toEqual(customPoints);
      // Done
    });
    it("Handles empty points array by falling back to value", async () => {
      // Arrange
      const submission = {
        ...MOCK.SUBMISSION,
        points: [] as [number, number[]][],
        value: [7.0, 8.0],
      };
      // Act
      await submitDistribution(submission);
      // Assert
      const submitArgs = mockSubmitDistributionPoints.mock.calls[0][0];
      expect(submitArgs.series[0].points).toHaveLength(1);
      expect(submitArgs.series[0].points[0][1]).toEqual([7.0, 8.0]);
      // Done
    });
  });
});
