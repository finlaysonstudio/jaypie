import { request } from "https";
import { deflateSync } from "zlib";

import { DATADOG } from "./constants.js";

//
//
// Types
//

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface MetricSeries {
  metric: string;
  type: number;
  points: MetricPoint[];
  tags?: string[];
}

interface SubmitMetricsPayload {
  series: MetricSeries[];
}

interface DistributionPoint {
  timestamp: number;
  values: number[];
}

interface DistributionSeries {
  metric: string;
  points: [number, number[]][];
  tags?: string[];
}

interface SubmitDistributionPayload {
  series: DistributionSeries[];
}

interface DatadogApiResponse {
  status?: string;
  errors?: string[];
}

interface DatadogClientOptions {
  apiKey: string;
  site?: string;
}

//
//
// Helper
//

const getBaseUrl = (site: string): string => {
  const siteMap: Record<string, string> = {
    "datadoghq.com": "api.datadoghq.com",
    "datadoghq.eu": "api.datadoghq.eu",
    "us3.datadoghq.com": "api.us3.datadoghq.com",
    "us5.datadoghq.com": "api.us5.datadoghq.com",
    "ap1.datadoghq.com": "api.ap1.datadoghq.com",
    "ddog-gov.com": "api.ddog-gov.com",
  };
  return siteMap[site] || `api.${site}`;
};

const makeRequest = <T>(
  hostname: string,
  path: string,
  apiKey: string,
  body: string,
  useDeflate = false,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const payload = useDeflate ? deflateSync(Buffer.from(body)) : body;

    const options = {
      hostname,
      port: 443,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey,
        ...(useDeflate && { "Content-Encoding": "deflate" }),
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            resolve({ status: "ok" } as T);
          }
        } else {
          try {
            const errorData = JSON.parse(data);
            reject(
              new Error(
                errorData.errors?.join(", ") ||
                  `HTTP ${res.statusCode}: ${data}`,
              ),
            );
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
};

//
//
// Client
//

export const createDatadogClient = ({ apiKey, site }: DatadogClientOptions) => {
  const hostname = getBaseUrl(
    site || process.env[DATADOG.ENV.DD_SITE] || DATADOG.SITE,
  );

  return {
    /**
     * Submit metrics to Datadog v2 API
     * POST /api/v2/series
     */
    submitMetrics: async (
      payload: SubmitMetricsPayload,
    ): Promise<DatadogApiResponse> => {
      const body = JSON.stringify(payload);
      return makeRequest<DatadogApiResponse>(
        hostname,
        "/api/v2/series",
        apiKey,
        body,
      );
    },

    /**
     * Submit distribution points to Datadog v1 API
     * POST /api/v1/distribution_points
     */
    submitDistributionPoints: async (
      payload: SubmitDistributionPayload,
      useDeflate = true,
    ): Promise<DatadogApiResponse> => {
      const body = JSON.stringify(payload);
      return makeRequest<DatadogApiResponse>(
        hostname,
        "/api/v1/distribution_points",
        apiKey,
        body,
        useDeflate,
      );
    },
  };
};

//
//
// Export Types
//

export type {
  DatadogApiResponse,
  DatadogClientOptions,
  DistributionPoint,
  DistributionSeries,
  MetricPoint,
  MetricSeries,
  SubmitDistributionPayload,
  SubmitMetricsPayload,
};
