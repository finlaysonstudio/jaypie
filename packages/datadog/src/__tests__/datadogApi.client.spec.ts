import { getEnvSecret, getSecret } from "@jaypie/aws";
import { EventEmitter } from "events";
import { request } from "https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { DATADOG } from "../constants.js";
import { datadogService } from "../datadog.service.js";
import {
  buildDatadogQuery,
  getDatadogCredentials,
  validateDatadogSetup,
} from "../datadogApi.client.js";

//
//
// Mock modules
//

vi.mock("@jaypie/aws");
vi.mock("https", () => ({ request: vi.fn() }));

function mockHttpsResponse({
  body,
  statusCode,
}: {
  body: string;
  statusCode: number;
}): void {
  (request as unknown as Mock).mockImplementation(
    (_options: unknown, callback: (res: EventEmitter) => void) => {
      const req = Object.assign(new EventEmitter(), {
        end: () => {
          const res = Object.assign(new EventEmitter(), { statusCode });
          callback(res);
          res.emit("data", Buffer.from(body));
          res.emit("end");
        },
        write: vi.fn(),
      });
      return req;
    },
  );
}

const KEY_ENV = Object.values(DATADOG.ENV);

function clearKeyEnv(): void {
  for (const name of KEY_ENV) {
    delete process.env[name];
    delete process.env[`SECRET_${name}`];
    delete process.env[`${name}_SECRET`];
  }
}

beforeEach(() => {
  clearKeyEnv();
  (getSecret as Mock).mockResolvedValue("MOCK_SECRET_VALUE");
  (getEnvSecret as Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  clearKeyEnv();
  vi.clearAllMocks();
});

describe("Datadog Query Building", () => {
  describe("buildDatadogQuery", () => {
    it("handles queries with quoted ARN values", () => {
      const options = {
        query:
          '@lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:my-function"',
        source: "lambda",
      };

      const result = buildDatadogQuery(options);

      // Should include the full query with quotes preserved
      expect(result).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:my-function"',
      );
      expect(result).toContain("source:lambda");
    });

    it("omits default source:lambda when query contains source: token", () => {
      const options = {
        query: "source:cloudwatch status:error",
      };

      const result = buildDatadogQuery(options);

      expect(result).not.toContain("source:lambda");
      expect(result).toContain("source:cloudwatch");
    });

    it("still adds explicit source param even when query contains source:", () => {
      const options = {
        query: "source:cloudwatch status:error",
        source: "lambda",
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain("source:lambda");
      expect(result).toContain("source:cloudwatch");
    });

    it("preserves double quotes in query strings", () => {
      const options = {
        query: '@http.url:"https://example.com/path?param=value"',
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain(
        '@http.url:"https://example.com/path?param=value"',
      );
    });

    it("handles complex queries with multiple quoted values", () => {
      const options = {
        query:
          '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:test" AND @http.status_code:500',
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:test"',
      );
      expect(result).toContain("@http.status_code:500");
    });

    it("handles queries with escaped quotes", () => {
      const options = {
        query: '@message:"error: \\"invalid value\\""',
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain('@message:"error: \\"invalid value\\""');
    });

    it("builds correct query with env and service", () => {
      const options = {
        env: "production",
        query: '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:my-func"',
        service: "my-service",
        source: "lambda",
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain("source:lambda");
      expect(result).toContain("env:production");
      expect(result).toContain("service:my-service");
      expect(result).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:my-func"',
      );
    });
  });

  describe("JSON serialization of queries", () => {
    it("correctly serializes query with quotes for Datadog API", () => {
      const query =
        'source:lambda @lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:test"';

      const requestBody = JSON.stringify({
        filter: {
          from: "now-1h",
          query,
          to: "now",
        },
        page: {
          limit: 50,
        },
        sort: "-timestamp",
      });

      // Parse it back to verify it's valid JSON
      const parsed = JSON.parse(requestBody);

      expect(parsed.filter.query).toBe(query);
      expect(parsed.filter.query).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:test"',
      );
    });
  });
});

describe("Datadog Credentials", () => {
  describe("getDatadogCredentials", () => {
    it("Resolves both keys through getEnvSecret", async () => {
      (getEnvSecret as Mock).mockImplementation(async (name: string) => {
        if (name === DATADOG.ENV.DATADOG_API_KEY) return "MOCK_API_KEY";
        if (name === DATADOG.ENV.DATADOG_APP_KEY) return "MOCK_APP_KEY";
        return undefined;
      });
      await expect(getDatadogCredentials()).resolves.toEqual({
        apiKey: "MOCK_API_KEY",
        appKey: "MOCK_APP_KEY",
      });
    });
    it("Returns null when the application key is missing", async () => {
      (getEnvSecret as Mock).mockImplementation(async (name: string) =>
        name === DATADOG.ENV.DATADOG_API_KEY ? "MOCK_API_KEY" : undefined,
      );
      await expect(getDatadogCredentials()).resolves.toBeNull();
    });
    it("Returns null when nothing is configured", async () => {
      await expect(getDatadogCredentials()).resolves.toBeNull();
    });
    it("Resolves an API key held as a Secrets Manager reference", async () => {
      process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] = "MOCK_API_KEY_ARN";
      (getEnvSecret as Mock).mockImplementation(async (name: string) =>
        name === DATADOG.ENV.DATADOG_APP_KEY ? "MOCK_APP_KEY" : undefined,
      );
      await expect(getDatadogCredentials()).resolves.toEqual({
        apiKey: "MOCK_SECRET_VALUE",
        appKey: "MOCK_APP_KEY",
      });
      expect(getSecret).toHaveBeenCalledWith("MOCK_API_KEY_ARN");
    });
  });

  describe("validateDatadogSetup", () => {
    it("Reports the plain variables", () => {
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "MOCK_API_KEY";
      process.env[DATADOG.ENV.DD_APP_KEY] = "MOCK_APP_KEY";
      const result = validateDatadogSetup();
      expect(result.success).toBeTrue();
      expect(result.apiKey.source).toBe(DATADOG.ENV.DATADOG_API_KEY);
      expect(result.appKey.source).toBe(DATADOG.ENV.DD_APP_KEY);
    });
    it("Counts a secret reference as present", () => {
      process.env[`SECRET_${DATADOG.ENV.DATADOG_APP_KEY}`] = "MOCK_APP_KEY_ARN";
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "MOCK_API_KEY";
      const result = validateDatadogSetup();
      expect(result.success).toBeTrue();
      expect(result.appKey.present).toBeTrue();
      expect(result.appKey.source).toBe(
        `SECRET_${DATADOG.ENV.DATADOG_APP_KEY}`,
      );
    });
    it("Reports both keys missing when nothing is set", () => {
      const result = validateDatadogSetup();
      expect(result.success).toBeFalse();
      expect(result.apiKey.source).toBeNull();
      expect(result.appKey.source).toBeNull();
    });
  });
});

describe("Datadog API Failures", () => {
  beforeEach(() => {
    (getEnvSecret as Mock).mockImplementation(async (name: string) => {
      if (name === DATADOG.ENV.DATADOG_API_KEY) return "MOCK_API_KEY";
      if (name === DATADOG.ENV.DATADOG_APP_KEY) return "MOCK_APP_KEY";
      return undefined;
    });
  });

  it("Returns a 403 as data with a readable error rather than throwing", async () => {
    mockHttpsResponse({ body: '{"errors":["Forbidden"]}', statusCode: 403 });
    const result = (await datadogService({
      command: "logs",
      query: "status:error",
    })) as { error?: string; success: boolean };
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.success).toBeFalse();
    expect(result.error).toMatch(/Access denied/);
    expect(result.error).toMatch(/logs_read/);
  });

  it("Returns a 403 from log_analytics as data", async () => {
    mockHttpsResponse({ body: '{"errors":["Forbidden"]}', statusCode: 403 });
    const result = (await datadogService({
      command: "log_analytics",
      groupBy: "service",
    })) as { error?: string; success: boolean };
    expect(result.success).toBeFalse();
    expect(result.error).toBeString();
  });
});
