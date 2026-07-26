import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadEnvSecrets, loadEnvVariables } from "@jaypie/aws";

// Subjects
import lambdaHandler from "../lambdaHandler.js";
import websocketHandler from "../websocketHandler.js";

//
//
// Mock modules
//

vi.mock("@jaypie/aws", () => ({
  broadcastToConnections: vi.fn(),
  formatStreamError: vi.fn(),
  getContentTypeForFormat: vi.fn(() => "text/event-stream"),
  loadEnvSecrets: vi.fn().mockResolvedValue(undefined),
  loadEnvVariables: vi.fn().mockResolvedValue(false),
  sendToConnection: vi.fn(),
}));

vi.mock("@jaypie/datadog", () => ({
  flushLlmObs: vi.fn(),
  loadDatadogApiKey: vi.fn().mockResolvedValue(false),
}));

//
//
// Mock environment
//

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

describe("Issue 443: handler hydrates non-secret variables", () => {
  describe("Base Cases", () => {
    it("Does not fail when no bundle is configured", async () => {
      const handler = lambdaHandler(async () => "value");
      await expect(handler({})).resolves.toBe("value");
    });
  });

  describe("Happy Paths", () => {
    it("Hydrates variables during the lifecycle", async () => {
      const handler = lambdaHandler(async () => true);
      vi.mocked(loadEnvVariables).mockClear();
      await handler({});
      expect(loadEnvVariables).toHaveBeenCalled();
    });
    it("Hydrates without any handler option", async () => {
      const handler = lambdaHandler(async () => true, {});
      vi.mocked(loadEnvVariables).mockClear();
      await handler({});
      expect(loadEnvVariables).toHaveBeenCalled();
    });
    it("Hydrates in the websocket handler", async () => {
      const handler = websocketHandler(async () => true);
      vi.mocked(loadEnvVariables).mockClear();
      await handler({ requestContext: { connectionId: "mock" } });
      expect(loadEnvVariables).toHaveBeenCalled();
    });
  });

  describe("Features", () => {
    it("Starts the fetch at cold start, before any invocation", () => {
      vi.mocked(loadEnvVariables).mockClear();
      lambdaHandler(async () => true);
      expect(loadEnvVariables).toHaveBeenCalled();
    });
    it("Hydrates before secrets load", async () => {
      const order: string[] = [];
      vi.mocked(loadEnvVariables).mockImplementation(async () => {
        order.push("variables");
        return false;
      });
      vi.mocked(loadEnvSecrets).mockImplementation(async () => {
        order.push("secrets");
      });
      const handler = lambdaHandler(async () => true, {
        secrets: ["MOCK_SECRET"],
      });
      order.length = 0; // discard the cold-start prefetch
      await handler({});
      expect(order).toEqual(["variables", "secrets"]);
    });
    it("Hydrates before user setup runs", async () => {
      const order: string[] = [];
      vi.mocked(loadEnvVariables).mockImplementation(async () => {
        order.push("variables");
        return false;
      });
      const handler = lambdaHandler(async () => true, {
        setup: [
          async () => {
            order.push("setup");
          },
        ],
      });
      order.length = 0; // discard the cold-start prefetch
      await handler({});
      expect(order).toEqual(["variables", "setup"]);
    });
  });

  describe("Error Conditions", () => {
    it("Surfaces a hydration failure as a handler error", async () => {
      vi.mocked(loadEnvVariables).mockRejectedValue(
        new Error("parameter unavailable"),
      );
      const handler = lambdaHandler(async () => true, { throw: true });
      await expect(handler({})).rejects.toThrow();
    });
  });
});
