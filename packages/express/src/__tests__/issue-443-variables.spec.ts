import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { loadEnvSecrets, loadEnvVariables } from "@jaypie/aws";

// Subject
import expressHandler from "../expressHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");
vi.mock("../decorateResponse.helper.js");
vi.mock("@jaypie/aws", () => ({
  formatStreamError: vi.fn(),
  getContentTypeForFormat: vi.fn(() => "text/event-stream"),
  loadEnvSecrets: vi.fn().mockResolvedValue(undefined),
  loadEnvVariables: vi.fn().mockResolvedValue(false),
}));
vi.mock("@jaypie/datadog", () => ({
  DATADOG: { METRIC: { TYPE: { COUNT: 1 } } },
  hasDatadogEnv: vi.fn(() => false),
  loadDatadogApiKey: vi.fn().mockResolvedValue(false),
  submitMetric: vi.fn().mockResolvedValue(true),
}));

//
//
// Mock objects
//

interface MockResponse extends Partial<Response> {
  on: ReturnType<typeof vi.fn>;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    end: vi.fn(),
    json: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    status: vi.fn(() => res) as unknown as ReturnType<typeof vi.fn>,
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Issue 443: express handler hydrates non-secret variables", () => {
  describe("Base Cases", () => {
    it("Does not fail when no bundle is configured", async () => {
      const handler = vi.fn();
      const wrapped = expressHandler(handler);
      await wrapped({} as Request, createMockResponse() as Response);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Happy Paths", () => {
    it("Hydrates variables before the handler", async () => {
      const handler = vi.fn();
      const wrapped = expressHandler(handler);
      vi.mocked(loadEnvVariables).mockClear();
      await wrapped({} as Request, createMockResponse() as Response);
      expect(loadEnvVariables as Mock).toHaveBeenCalled();
      expect(
        (loadEnvVariables as Mock).mock.invocationCallOrder[0] <
          handler.mock.invocationCallOrder[0],
      ).toBeTrue();
    });
    it("Hydrates on every request", async () => {
      const wrapped = expressHandler(vi.fn());
      vi.mocked(loadEnvVariables).mockClear();
      await wrapped({} as Request, createMockResponse() as Response);
      await wrapped({} as Request, createMockResponse() as Response);
      expect(loadEnvVariables as Mock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Features", () => {
    it("Starts the fetch at cold start, before any request", () => {
      vi.mocked(loadEnvVariables).mockClear();
      expressHandler(vi.fn());
      expect(loadEnvVariables as Mock).toHaveBeenCalledTimes(1);
    });
    it("Hydrates before secrets load", async () => {
      const wrapped = expressHandler(vi.fn(), { secrets: ["MOCK_SECRET"] });
      vi.mocked(loadEnvVariables).mockClear();
      vi.mocked(loadEnvSecrets).mockClear();
      await wrapped({} as Request, createMockResponse() as Response);
      expect(
        (loadEnvVariables as Mock).mock.invocationCallOrder[0] <
          (loadEnvSecrets as Mock).mock.invocationCallOrder[0],
      ).toBeTrue();
    });
  });
});
