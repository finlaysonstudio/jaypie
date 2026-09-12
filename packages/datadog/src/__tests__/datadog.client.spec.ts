import { EventEmitter } from "events";
import { request } from "https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// Subject
import { createDatadogClient } from "../datadog.client.js";

//
//
// Mock constants
//

const MOCK = {
  API_KEY: "MOCK_API_KEY",
  PAYLOAD: {
    series: [
      {
        metric: "mock.metric",
        points: [{ timestamp: 1, value: 1 }],
        type: 0,
      },
    ],
  },
};

//
//
// Mock modules
//

vi.mock("https", () => ({ request: vi.fn() }));

interface MockResponse {
  body: string;
  error?: Error;
  statusCode: number;
}

function mockHttpsResponse({ body, error, statusCode }: MockResponse): void {
  (request as unknown as Mock).mockImplementation(
    (_options: unknown, callback: (res: EventEmitter) => void) => {
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        write: () => void;
      };
      req.write = vi.fn();
      req.end = () => {
        if (error) {
          req.emit("error", error);
          return;
        }
        const res = Object.assign(new EventEmitter(), { statusCode });
        callback(res);
        res.emit("data", Buffer.from(body));
        res.emit("end");
      };
      return req;
    },
  );
}

beforeEach(() => {
  mockHttpsResponse({ body: '{"errors":[]}', statusCode: 202 });
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Datadog Client", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(createDatadogClient).toBeFunction();
    });
  });

  describe("Happy Paths", () => {
    it("Resolves the parsed response on success", async () => {
      const client = createDatadogClient({ apiKey: MOCK.API_KEY });
      await expect(client.submitMetrics(MOCK.PAYLOAD)).resolves.toEqual({
        errors: [],
      });
    });
  });

  describe("Error Conditions", () => {
    it("Rejects with BadGatewayError carrying Datadog's errors", async () => {
      mockHttpsResponse({
        body: '{"errors":["Forbidden"]}',
        statusCode: 403,
      });
      const client = createDatadogClient({ apiKey: MOCK.API_KEY });
      await expect(async () =>
        client.submitMetrics(MOCK.PAYLOAD),
      ).toThrowBadGatewayError();
      await expect(client.submitMetrics(MOCK.PAYLOAD)).rejects.toThrow(
        "Forbidden",
      );
    });
    it("Rejects with BadGatewayError when the body is not JSON", async () => {
      mockHttpsResponse({ body: "Forbidden", statusCode: 403 });
      const client = createDatadogClient({ apiKey: MOCK.API_KEY });
      await expect(async () =>
        client.submitMetrics(MOCK.PAYLOAD),
      ).toThrowBadGatewayError();
      await expect(client.submitMetrics(MOCK.PAYLOAD)).rejects.toThrow(
        "HTTP 403: Forbidden",
      );
    });
    it("Rejects with BadGatewayError on a connection error", async () => {
      mockHttpsResponse({
        body: "",
        error: new TypeError("MOCK_CONNECTION_ERROR"),
        statusCode: 0,
      });
      const client = createDatadogClient({ apiKey: MOCK.API_KEY });
      await expect(async () =>
        client.submitDistributionPoints({ series: [] }),
      ).toThrowBadGatewayError();
    });
  });
});
