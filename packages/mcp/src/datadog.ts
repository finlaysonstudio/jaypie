/**
 * Datadog API integration module
 */
import * as https from "node:https";

export interface DatadogCredentials {
  apiKey: string;
  appKey: string;
}

export interface DatadogSearchOptions {
  query?: string;
  source?: string;
  env?: string;
  service?: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: "timestamp" | "-timestamp";
}

export interface DatadogAnalyticsOptions {
  query?: string;
  source?: string;
  env?: string;
  service?: string;
  from?: string;
  to?: string;
  groupBy: string[];
  compute?: Array<{
    aggregation: "count" | "avg" | "sum" | "min" | "max" | "cardinality";
    metric?: string;
  }>;
}

export interface DatadogLogEntry {
  id: string;
  timestamp?: string;
  status?: string;
  service?: string;
  message?: string;
  attributes?: Record<string, unknown>;
}

export interface DatadogSearchResult {
  success: boolean;
  query: string;
  timeRange: { from: string; to: string };
  logs: DatadogLogEntry[];
  error?: string;
}

export interface DatadogAnalyticsBucket {
  by: Record<string, string>;
  computes: Record<string, number>;
}

export interface DatadogAnalyticsResult {
  success: boolean;
  query: string;
  timeRange: { from: string; to: string };
  groupBy: string[];
  buckets: DatadogAnalyticsBucket[];
  error?: string;
}

interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const nullLogger: Logger = {
  info: () => {},
  error: () => {},
};

/**
 * Get Datadog credentials from environment variables
 */
export function getDatadogCredentials(): DatadogCredentials | null {
  const apiKey = process.env.DATADOG_API_KEY || process.env.DD_API_KEY;
  const appKey =
    process.env.DATADOG_APP_KEY ||
    process.env.DATADOG_APPLICATION_KEY ||
    process.env.DD_APP_KEY ||
    process.env.DD_APPLICATION_KEY;

  if (!apiKey || !appKey) {
    return null;
  }

  return { apiKey, appKey };
}

/**
 * Validate Datadog API credentials
 */
export async function validateDatadogCredentials(
  credentials: DatadogCredentials,
): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.datadoghq.com",
      port: 443,
      path: "/api/v1/validate",
      method: "GET",
      headers: {
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve({ valid: true });
        } else {
          resolve({
            valid: false,
            error: `Datadog API returned status ${res.statusCode}: ${data}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      resolve({ valid: false, error: error.message });
    });

    req.end();
  });
}

/**
 * Build query string from environment variables and options
 */
export function buildDatadogQuery(options: DatadogSearchOptions): string {
  const ddEnv = process.env.DD_ENV;
  const ddService = process.env.DD_SERVICE;
  const ddSource = process.env.DD_SOURCE;
  const ddQuery = process.env.DD_QUERY;

  const queryParts: string[] = [];

  // Add source (parameter > env var > default 'lambda')
  const effectiveSource = options.source || ddSource || "lambda";
  queryParts.push(`source:${effectiveSource}`);

  // Add env (parameter > env var)
  const effectiveEnv = options.env || ddEnv;
  if (effectiveEnv) {
    queryParts.push(`env:${effectiveEnv}`);
  }

  // Add service (parameter > env var)
  const effectiveService = options.service || ddService;
  if (effectiveService) {
    queryParts.push(`service:${effectiveService}`);
  }

  // Add base query from DD_QUERY if available
  if (ddQuery) {
    queryParts.push(ddQuery);
  }

  // Add user-provided query terms
  if (options.query) {
    queryParts.push(options.query);
  }

  return queryParts.join(" ");
}

/**
 * Search Datadog logs
 */
export async function searchDatadogLogs(
  credentials: DatadogCredentials,
  options: DatadogSearchOptions = {},
  logger: Logger = nullLogger,
): Promise<DatadogSearchResult> {
  const effectiveQuery = buildDatadogQuery(options);
  const effectiveFrom = options.from || "now-15m";
  const effectiveTo = options.to || "now";
  const effectiveLimit = Math.min(options.limit || 50, 1000);
  const effectiveSort = options.sort || "-timestamp";

  logger.info(`Effective query: ${effectiveQuery}`);
  logger.info(
    `Search params: from=${effectiveFrom}, to=${effectiveTo}, limit=${effectiveLimit}, sort=${effectiveSort}`,
  );

  const requestBody = JSON.stringify({
    filter: {
      query: effectiveQuery,
      from: effectiveFrom,
      to: effectiveTo,
    },
    page: {
      limit: effectiveLimit,
    },
    sort: effectiveSort,
  });

  return new Promise((resolve) => {
    const requestOptions = {
      hostname: "api.datadoghq.com",
      port: 443,
      path: "/api/v2/logs/events/search",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
        "Content-Length": Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });

      res.on("end", () => {
        logger.info(`Response status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          logger.error(`Datadog API error: ${res.statusCode}`);
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            logs: [],
            error: `Datadog API returned status ${res.statusCode}: ${data}`,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as {
            data?: Array<{
              id: string;
              attributes?: {
                timestamp?: string;
                status?: string;
                service?: string;
                message?: string;
                attributes?: Record<string, unknown>;
              };
            }>;
          };

          const logs = (response.data || []).map((log) => {
            const attrs = log.attributes || {};
            return {
              id: log.id,
              timestamp: attrs.timestamp,
              status: attrs.status,
              service: attrs.service,
              message: attrs.message,
              attributes: attrs.attributes,
            };
          });

          logger.info(`Retrieved ${logs.length} log entries`);

          resolve({
            success: true,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            logs,
          });
        } catch (parseError) {
          logger.error("Failed to parse Datadog response:", parseError);
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            logs: [],
            error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      logger.error("Request error:", error);
      resolve({
        success: false,
        query: effectiveQuery,
        timeRange: { from: effectiveFrom, to: effectiveTo },
        logs: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Aggregate Datadog logs using the Analytics API
 * Groups logs by specified fields and computes aggregations
 */
export async function aggregateDatadogLogs(
  credentials: DatadogCredentials,
  options: DatadogAnalyticsOptions,
  logger: Logger = nullLogger,
): Promise<DatadogAnalyticsResult> {
  const effectiveQuery = buildDatadogQuery(options);
  const effectiveFrom = options.from || "now-15m";
  const effectiveTo = options.to || "now";
  const groupBy = options.groupBy;
  const compute = options.compute || [{ aggregation: "count" as const }];

  logger.info(`Analytics query: ${effectiveQuery}`);
  logger.info(`Group by: ${groupBy.join(", ")}`);
  logger.info(`Time range: ${effectiveFrom} to ${effectiveTo}`);

  const requestBody = JSON.stringify({
    filter: {
      query: effectiveQuery,
      from: effectiveFrom,
      to: effectiveTo,
    },
    group_by: groupBy.map((field) => ({
      facet: field,
      limit: 100,
      sort: {
        aggregation: "count",
        order: "desc",
      },
    })),
    compute: compute.map((c) => ({
      aggregation: c.aggregation,
      metric: c.metric,
      type: "total",
    })),
    page: {
      limit: 100,
    },
  });

  return new Promise((resolve) => {
    const requestOptions = {
      hostname: "api.datadoghq.com",
      port: 443,
      path: "/api/v2/logs/analytics/aggregate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
        "Content-Length": Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });

      res.on("end", () => {
        logger.info(`Response status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          logger.error(`Datadog Analytics API error: ${res.statusCode}`);
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            groupBy,
            buckets: [],
            error: `Datadog API returned status ${res.statusCode}: ${data}`,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as {
            data?: {
              buckets?: Array<{
                by?: Record<string, string>;
                computes?: Record<string, number>;
              }>;
            };
          };

          const buckets = (response.data?.buckets || []).map((bucket) => ({
            by: bucket.by || {},
            computes: bucket.computes || {},
          }));

          logger.info(`Retrieved ${buckets.length} aggregation buckets`);

          resolve({
            success: true,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            groupBy,
            buckets,
          });
        } catch (parseError) {
          logger.error(
            "Failed to parse Datadog analytics response:",
            parseError,
          );
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            groupBy,
            buckets: [],
            error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      logger.error("Request error:", error);
      resolve({
        success: false,
        query: effectiveQuery,
        timeRange: { from: effectiveFrom, to: effectiveTo },
        groupBy,
        buckets: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.write(requestBody);
    req.end();
  });
}
