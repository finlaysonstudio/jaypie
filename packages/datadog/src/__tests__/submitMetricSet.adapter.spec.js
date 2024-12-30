import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client, v2 } from "@datadog/datadog-api-client";
import { getSecret } from "@jaypie/aws";
import { cloneDeep } from "@jaypie/core";

import { DATADOG } from "../constants.js";

// Subject
import submitMetricSet from "../submitMetricSet.adapter.js";

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
    type: DATADOG.METRIC.TYPE.GAUGE,
    valueSet: { "MOCK.METRIC.NAME": 12 },
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
    const response = await submitMetricSet(MOCK.SUBMISSION);
    expect(response).not.toBeUndefined();
  });
  it("Creates a client configuration", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetricSet(MOCK.SUBMISSION);
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
    await submitMetricSet(MOCK.SUBMISSION);
    // Assert
    expect(v2.MetricsApi).toHaveBeenCalled();
    expect(v2.MetricsApi).toHaveBeenCalledTimes(1);
    // Done
  });
  it("Submits a metric", async () => {
    // Arrange
    // N/A
    // Act
    await submitMetricSet(MOCK.SUBMISSION);
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
    expect(submitMetricsArgs.body.series[0].metric).toBe(
      Object.keys(MOCK.SUBMISSION.valueSet)[0], // "MOCK.METRIC.NAME"
    );
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
  it("Submits multiple metrics", async () => {
    // Arrange
    const valueSet = {
      "MOCK.METRIC.NAME.1": 12,
      "MOCK.METRIC.NAME.2": 24,
    };
    const submission = { ...MOCK.SUBMISSION, valueSet };
    // Act
    await submitMetricSet(submission);
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
    expect(submitMetricsArgs.body.series).toHaveLength(2);
    expect(submitMetricsArgs.body.series[0]).toBeObject();
    expect(submitMetricsArgs.body.series[0]).toHaveProperty("metric");
    expect(submitMetricsArgs.body.series[0].metric).toBe(
      Object.keys(valueSet)[0], // "MOCK.METRIC.NAME.1"
    );
    // expect(submitMetricsArgs.body.series[0].metric.points).toBeArray();
    expect(submitMetricsArgs.body.series[0].points).toHaveLength(1);
    expect(submitMetricsArgs.body.series[0].points[0]).toBeObject();
    expect(submitMetricsArgs.body.series[0].points[0]).toHaveProperty(
      "timestamp",
    );
    expect(submitMetricsArgs.body.series[0].points[0].timestamp).toBeNumber();
    expect(submitMetricsArgs.body.series[0].points[0]).toHaveProperty("value");
    expect(submitMetricsArgs.body.series[0].points[0].value).toBeNumber();
    expect(submitMetricsArgs.body.series[0].points[0].value).toBe(12);
    expect(submitMetricsArgs.body.series[1]).toBeObject();
  });
  describe("Error cases", () => {
    it("Will return false if DD_API_KEY is missing", async () => {
      // Arrange
      const submission = { ...MOCK.SUBMISSION, apiKey: undefined };
      // Act
      const response = await submitMetricSet(submission);
      // Assert
      expect(response).toBeFalse();
      // Done
    });
  });
  describe("Features", () => {
    it("Submits tags", async () => {
      // Arrange
      const tags = ["MOCK_TAG"];
      // Act
      await submitMetricSet({ ...MOCK.SUBMISSION, tags });
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
      await submitMetricSet({ ...MOCK.SUBMISSION, tags });
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
      await submitMetricSet(submission);
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
      await submitMetricSet(submission);
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
});
