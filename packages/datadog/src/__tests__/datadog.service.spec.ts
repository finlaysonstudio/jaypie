import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import {
  aggregateDatadogLogs,
  getDatadogCredentials,
  queryDatadogMetrics,
  searchDatadogLogs,
  validateDatadogSetup,
} from "../datadogApi.client.js";
import { DATADOG_HELP } from "../datadogHelp.constant.js";

// Subject
import { datadogService } from "../datadog.service.js";

//
//
// Mock constants
//

const MOCK = {
  CREDENTIALS: { apiKey: "MOCK_API_KEY", appKey: "MOCK_APP_KEY" },
  FAILURE: {
    error:
      "Access denied. Verify your API and Application keys have logs_read permission.",
    logs: [],
    query: "status:error",
    success: false,
    timeRange: { from: "now-15m", to: "now" },
  },
  SUCCESS: {
    logs: [{ id: "MOCK_LOG_ID" }],
    query: "status:error",
    success: true,
    timeRange: { from: "now-15m", to: "now" },
  },
};

//
//
// Mock modules
//

vi.mock("../datadogApi.client.js");

beforeEach(() => {
  (getDatadogCredentials as Mock).mockResolvedValue(MOCK.CREDENTIALS);
  (searchDatadogLogs as Mock).mockResolvedValue(MOCK.SUCCESS);
  (aggregateDatadogLogs as Mock).mockResolvedValue(MOCK.SUCCESS);
  (queryDatadogMetrics as Mock).mockResolvedValue(MOCK.SUCCESS);
  (validateDatadogSetup as Mock).mockReturnValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Datadog Service", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(datadogService).toBeFunction();
    });
    it("Is registered under the datadog alias", () => {
      expect(datadogService.alias).toBe("datadog");
    });
  });

  describe("Happy Paths", () => {
    it("Returns help when no command is given", async () => {
      await expect(datadogService({})).resolves.toBe(DATADOG_HELP);
    });
    it("Returns the result of a successful call", async () => {
      await expect(
        datadogService({ command: "logs", query: "status:error" }),
      ).resolves.toEqual(MOCK.SUCCESS);
    });
  });

  describe("Error Conditions", () => {
    it("Throws ConfigurationError when credentials are missing", async () => {
      (getDatadogCredentials as Mock).mockResolvedValue(null);
      await expect(async () =>
        datadogService({ command: "logs" }),
      ).toThrowConfigurationError();
    });
    it("Throws BadRequestError for an unknown command", async () => {
      await expect(async () =>
        datadogService({ command: "not_a_command" }),
      ).toThrowBadRequestError();
    });
    it("Throws BadRequestError when log_analytics omits groupBy", async () => {
      await expect(async () =>
        datadogService({ command: "log_analytics" }),
      ).toThrowBadRequestError();
    });
    it("Throws BadRequestError when metrics omits query", async () => {
      await expect(async () =>
        datadogService({ command: "metrics" }),
      ).toThrowBadRequestError();
    });
  });

  describe("Features", () => {
    it("Returns an unsuccessful API response as data rather than throwing", async () => {
      (searchDatadogLogs as Mock).mockResolvedValue(MOCK.FAILURE);
      const result = (await datadogService({
        command: "logs",
        query: "status:error",
      })) as typeof MOCK.FAILURE;
      expect(result.success).toBeFalse();
      expect(result.error).toBe(MOCK.FAILURE.error);
    });
    it("Returns an unsuccessful aggregate response as data", async () => {
      (aggregateDatadogLogs as Mock).mockResolvedValue(MOCK.FAILURE);
      const result = (await datadogService({
        command: "log_analytics",
        groupBy: "service,status",
      })) as typeof MOCK.FAILURE;
      expect(result.success).toBeFalse();
    });
    it("Resolves credentials before every command", async () => {
      await datadogService({ command: "logs" });
      expect(getDatadogCredentials).toHaveBeenCalledTimes(1);
    });
    it("Does not resolve credentials for help", async () => {
      await datadogService({});
      expect(getDatadogCredentials).not.toHaveBeenCalled();
    });
  });
});
