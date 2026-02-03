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

// Monitors types
export interface DatadogMonitorsOptions {
  tags?: string[];
  monitorTags?: string[];
  name?: string;
  status?: ("Alert" | "Warn" | "No Data" | "OK")[];
}

export interface DatadogMonitor {
  id: number;
  name: string;
  type: string;
  status: string;
  message?: string;
  tags: string[];
  priority?: number;
  query?: string;
  overallState?: string;
}

export interface DatadogMonitorsResult {
  success: boolean;
  monitors: DatadogMonitor[];
  error?: string;
}

// Synthetics types
export interface DatadogSyntheticsOptions {
  tags?: string[];
  type?: "api" | "browser";
}

export interface DatadogSyntheticTest {
  publicId: string;
  name: string;
  type: string;
  status: string;
  tags: string[];
  locations: string[];
  message?: string;
}

export interface DatadogSyntheticResult {
  publicId: string;
  resultId: string;
  status: number;
  checkTime: number;
  passed: boolean;
  location?: string;
}

export interface DatadogSyntheticsResult {
  success: boolean;
  tests: DatadogSyntheticTest[];
  error?: string;
}

export interface DatadogSyntheticResultsResult {
  success: boolean;
  publicId: string;
  results: DatadogSyntheticResult[];
  error?: string;
}

// Metrics types
export interface DatadogMetricsOptions {
  query: string;
  from: number;
  to: number;
}

export interface DatadogMetricSeries {
  metric: string;
  scope: string;
  pointlist: Array<[number, number | null]>;
  unit?: string;
}

export interface DatadogMetricsResult {
  success: boolean;
  query: string;
  timeRange: { from: number; to: number };
  series: DatadogMetricSeries[];
  error?: string;
}

// RUM types
export interface DatadogRumOptions {
  query?: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: "timestamp" | "-timestamp";
}

export interface DatadogRumEvent {
  id: string;
  type: string;
  timestamp?: string;
  sessionId?: string;
  viewUrl?: string;
  viewName?: string;
  errorMessage?: string;
  errorType?: string;
  attributes?: Record<string, unknown>;
}

export interface DatadogRumResult {
  success: boolean;
  query: string;
  timeRange: { from: string; to: string };
  events: DatadogRumEvent[];
  error?: string;
}

// Validation types
export interface DatadogValidationResult {
  success: boolean;
  apiKey: { present: boolean; source: string | null };
  appKey: { present: boolean; source: string | null };
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
 * Validate Datadog setup without making API calls
 */
export function validateDatadogSetup(): DatadogValidationResult {
  const apiKeySource = process.env.DATADOG_API_KEY
    ? "DATADOG_API_KEY"
    : process.env.DD_API_KEY
      ? "DD_API_KEY"
      : null;

  const appKeySource = process.env.DATADOG_APP_KEY
    ? "DATADOG_APP_KEY"
    : process.env.DATADOG_APPLICATION_KEY
      ? "DATADOG_APPLICATION_KEY"
      : process.env.DD_APP_KEY
        ? "DD_APP_KEY"
        : process.env.DD_APPLICATION_KEY
          ? "DD_APPLICATION_KEY"
          : null;

  return {
    apiKey: { present: apiKeySource !== null, source: apiKeySource },
    appKey: { present: appKeySource !== null, source: appKeySource },
    success: apiKeySource !== null && appKeySource !== null,
  };
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
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          if (res.statusCode === 400) {
            errorMessage = `Invalid query syntax. Check your query: "${effectiveQuery}". Datadog error: ${data}`;
          } else if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have logs_read permission.";
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again, or reduce your query scope.";
          }
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            logs: [],
            error: errorMessage,
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

  // Build compute array - each item needs aggregation and type
  const computeItems = compute.map((c) => {
    const item: {
      aggregation: string;
      type: string;
      metric?: string;
    } = {
      aggregation: c.aggregation,
      type: "total",
    };
    if (c.metric) {
      item.metric = c.metric;
    }
    return item;
  });

  // Build group_by with proper sort configuration
  const groupByItems = groupBy.map((field) => {
    const item: {
      facet: string;
      limit: number;
      sort: {
        type: string;
        order: string;
        aggregation?: string;
      };
    } = {
      facet: field,
      limit: 100,
      sort: {
        type: "measure",
        order: "desc",
        aggregation: compute[0]?.aggregation || "count",
      },
    };
    return item;
  });

  const requestBody = JSON.stringify({
    filter: {
      query: effectiveQuery,
      from: effectiveFrom,
      to: effectiveTo,
    },
    group_by: groupByItems,
    compute: computeItems,
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
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          if (res.statusCode === 400) {
            errorMessage = `Invalid query or groupBy fields. Verify facet names exist: ${groupBy.join(", ")}. Datadog error: ${data}`;
          } else if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have logs_read permission.";
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again, or reduce your query scope.";
          }
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            groupBy,
            buckets: [],
            error: errorMessage,
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

/**
 * List Datadog monitors with optional filtering
 */
export async function listDatadogMonitors(
  credentials: DatadogCredentials,
  options: DatadogMonitorsOptions = {},
  logger: Logger = nullLogger,
): Promise<DatadogMonitorsResult> {
  logger.info("Fetching Datadog monitors");

  const queryParams = new URLSearchParams();

  if (options.tags && options.tags.length > 0) {
    queryParams.set("tags", options.tags.join(","));
  }
  if (options.monitorTags && options.monitorTags.length > 0) {
    queryParams.set("monitor_tags", options.monitorTags.join(","));
  }
  if (options.name) {
    queryParams.set("name", options.name);
  }

  const queryString = queryParams.toString();
  const path = `/api/v1/monitor${queryString ? `?${queryString}` : ""}`;

  logger.info(`Request path: ${path}`);

  return new Promise((resolve) => {
    const requestOptions = {
      hostname: "api.datadoghq.com",
      port: 443,
      path,
      method: "GET",
      headers: {
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
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
          logger.error(`Datadog Monitors API error: ${res.statusCode}`);
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have monitors_read permission.";
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again.";
          }
          resolve({
            success: false,
            monitors: [],
            error: errorMessage,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as Array<{
            id: number;
            name: string;
            type: string;
            overall_state?: string;
            message?: string;
            tags?: string[];
            priority?: number;
            query?: string;
          }>;

          let monitors = response.map((monitor) => ({
            id: monitor.id,
            name: monitor.name,
            type: monitor.type,
            status: monitor.overall_state || "Unknown",
            message: monitor.message,
            tags: monitor.tags || [],
            priority: monitor.priority,
            query: monitor.query,
            overallState: monitor.overall_state,
          }));

          // Filter by status if specified
          if (options.status && options.status.length > 0) {
            monitors = monitors.filter((m) =>
              options.status!.includes(
                m.status as "Alert" | "Warn" | "No Data" | "OK",
              ),
            );
          }

          logger.info(`Retrieved ${monitors.length} monitors`);

          resolve({
            success: true,
            monitors,
          });
        } catch (parseError) {
          logger.error(
            "Failed to parse Datadog monitors response:",
            parseError,
          );
          resolve({
            success: false,
            monitors: [],
            error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      logger.error("Request error:", error);
      resolve({
        success: false,
        monitors: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.end();
  });
}

/**
 * List Datadog Synthetic tests
 */
export async function listDatadogSynthetics(
  credentials: DatadogCredentials,
  options: DatadogSyntheticsOptions = {},
  logger: Logger = nullLogger,
): Promise<DatadogSyntheticsResult> {
  logger.info("Fetching Datadog Synthetic tests");

  return new Promise((resolve) => {
    const requestOptions = {
      hostname: "api.datadoghq.com",
      port: 443,
      path: "/api/v1/synthetics/tests",
      method: "GET",
      headers: {
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
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
          logger.error(`Datadog Synthetics API error: ${res.statusCode}`);
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have synthetics_read permission.";
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again.";
          }
          resolve({
            success: false,
            tests: [],
            error: errorMessage,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as {
            tests?: Array<{
              public_id: string;
              name: string;
              type: string;
              status: string;
              tags?: string[];
              locations?: string[];
              message?: string;
            }>;
          };

          let tests = (response.tests || []).map((test) => ({
            publicId: test.public_id,
            name: test.name,
            type: test.type,
            status: test.status,
            tags: test.tags || [],
            locations: test.locations || [],
            message: test.message,
          }));

          // Filter by type if specified
          if (options.type) {
            tests = tests.filter((t) => t.type === options.type);
          }

          // Filter by tags if specified
          if (options.tags && options.tags.length > 0) {
            tests = tests.filter((t) =>
              options.tags!.some((tag) => t.tags.includes(tag)),
            );
          }

          logger.info(`Retrieved ${tests.length} synthetic tests`);

          resolve({
            success: true,
            tests,
          });
        } catch (parseError) {
          logger.error(
            "Failed to parse Datadog synthetics response:",
            parseError,
          );
          resolve({
            success: false,
            tests: [],
            error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      logger.error("Request error:", error);
      resolve({
        success: false,
        tests: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.end();
  });
}

/**
 * Get recent results for a specific Synthetic test
 */
export async function getDatadogSyntheticResults(
  credentials: DatadogCredentials,
  publicId: string,
  logger: Logger = nullLogger,
): Promise<DatadogSyntheticResultsResult> {
  logger.info(`Fetching results for Synthetic test: ${publicId}`);

  return new Promise((resolve) => {
    const requestOptions = {
      hostname: "api.datadoghq.com",
      port: 443,
      path: `/api/v1/synthetics/tests/${publicId}/results`,
      method: "GET",
      headers: {
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
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
          logger.error(
            `Datadog Synthetics Results API error: ${res.statusCode}`,
          );
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have synthetics_read permission.";
          } else if (res.statusCode === 404) {
            errorMessage = `Synthetic test '${publicId}' not found. Use datadog_synthetics (without testId) to list available tests.`;
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again.";
          }
          resolve({
            success: false,
            publicId,
            results: [],
            error: errorMessage,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as {
            results?: Array<{
              result_id: string;
              status: number;
              check_time: number;
              dc_id?: number;
              result?: {
                passed?: boolean;
              };
            }>;
          };

          const results = (response.results || []).map((result) => ({
            publicId,
            resultId: result.result_id,
            status: result.status,
            checkTime: result.check_time,
            passed: result.result?.passed ?? result.status === 0,
            location: result.dc_id?.toString(),
          }));

          logger.info(`Retrieved ${results.length} synthetic results`);

          resolve({
            success: true,
            publicId,
            results,
          });
        } catch (parseError) {
          logger.error(
            "Failed to parse Datadog synthetic results:",
            parseError,
          );
          resolve({
            success: false,
            publicId,
            results: [],
            error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      logger.error("Request error:", error);
      resolve({
        success: false,
        publicId,
        results: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.end();
  });
}

/**
 * Query Datadog metrics
 */
export async function queryDatadogMetrics(
  credentials: DatadogCredentials,
  options: DatadogMetricsOptions,
  logger: Logger = nullLogger,
): Promise<DatadogMetricsResult> {
  logger.info(`Querying metrics: ${options.query}`);
  logger.info(`Time range: ${options.from} to ${options.to}`);

  const queryParams = new URLSearchParams({
    query: options.query,
    from: options.from.toString(),
    to: options.to.toString(),
  });

  return new Promise((resolve) => {
    const requestOptions = {
      hostname: "api.datadoghq.com",
      port: 443,
      path: `/api/v1/query?${queryParams.toString()}`,
      method: "GET",
      headers: {
        "DD-API-KEY": credentials.apiKey,
        "DD-APPLICATION-KEY": credentials.appKey,
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
          logger.error(`Datadog Metrics API error: ${res.statusCode}`);
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          if (res.statusCode === 400) {
            errorMessage = `Invalid metric query. Check format: 'aggregation:metric.name{tags}'. Query: "${options.query}". Datadog error: ${data}`;
          } else if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have metrics_read permission.";
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again, or reduce your time range.";
          }
          resolve({
            success: false,
            query: options.query,
            timeRange: { from: options.from, to: options.to },
            series: [],
            error: errorMessage,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as {
            series?: Array<{
              metric: string;
              scope: string;
              pointlist: Array<[number, number | null]>;
              unit?: Array<{ name?: string }>;
            }>;
          };

          const series = (response.series || []).map((s) => ({
            metric: s.metric,
            scope: s.scope,
            pointlist: s.pointlist,
            unit: s.unit?.[0]?.name,
          }));

          logger.info(`Retrieved ${series.length} metric series`);

          resolve({
            success: true,
            query: options.query,
            timeRange: { from: options.from, to: options.to },
            series,
          });
        } catch (parseError) {
          logger.error("Failed to parse Datadog metrics response:", parseError);
          resolve({
            success: false,
            query: options.query,
            timeRange: { from: options.from, to: options.to },
            series: [],
            error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          });
        }
      });
    });

    req.on("error", (error) => {
      logger.error("Request error:", error);
      resolve({
        success: false,
        query: options.query,
        timeRange: { from: options.from, to: options.to },
        series: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.end();
  });
}

/**
 * Search Datadog RUM events
 */
export async function searchDatadogRum(
  credentials: DatadogCredentials,
  options: DatadogRumOptions = {},
  logger: Logger = nullLogger,
): Promise<DatadogRumResult> {
  const effectiveQuery = options.query || "*";
  const effectiveFrom = options.from || "now-15m";
  const effectiveTo = options.to || "now";
  const effectiveLimit = Math.min(options.limit || 50, 1000);
  const effectiveSort = options.sort || "-timestamp";

  logger.info(`RUM query: ${effectiveQuery}`);
  logger.info(`Time range: ${effectiveFrom} to ${effectiveTo}`);

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
      path: "/api/v2/rum/events/search",
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
          logger.error(`Datadog RUM API error: ${res.statusCode}`);
          let errorMessage = `Datadog API returned status ${res.statusCode}: ${data}`;
          // Check for specific "No valid indexes" error which means no RUM app is configured
          if (data.includes("No valid indexes")) {
            errorMessage =
              "No RUM application found. Ensure you have a RUM application configured in Datadog and it has collected data. " +
              "You can create a RUM application at https://app.datadoghq.com/rum/list";
          } else if (res.statusCode === 400) {
            errorMessage = `Invalid RUM query. Check syntax: "${effectiveQuery}". Datadog error: ${data}`;
          } else if (res.statusCode === 403) {
            errorMessage =
              "Access denied. Verify your API and Application keys have rum_read permission.";
          } else if (res.statusCode === 429) {
            errorMessage =
              "Rate limited by Datadog. Wait a moment and try again, or reduce your query scope.";
          }
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            events: [],
            error: errorMessage,
          });
          return;
        }

        try {
          const response = JSON.parse(data) as {
            data?: Array<{
              id: string;
              type: string;
              attributes?: {
                timestamp?: string;
                attributes?: {
                  session?: { id?: string };
                  view?: { url?: string; name?: string };
                  error?: { message?: string; type?: string };
                  [key: string]: unknown;
                };
              };
            }>;
          };

          const events = (response.data || []).map((event) => {
            const attrs = event.attributes?.attributes || {};
            return {
              id: event.id,
              type: event.type,
              timestamp: event.attributes?.timestamp,
              sessionId: attrs.session?.id,
              viewUrl: attrs.view?.url,
              viewName: attrs.view?.name,
              errorMessage: attrs.error?.message,
              errorType: attrs.error?.type,
              attributes: attrs,
            };
          });

          logger.info(`Retrieved ${events.length} RUM events`);

          resolve({
            success: true,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            events,
          });
        } catch (parseError) {
          logger.error("Failed to parse Datadog RUM response:", parseError);
          resolve({
            success: false,
            query: effectiveQuery,
            timeRange: { from: effectiveFrom, to: effectiveTo },
            events: [],
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
        events: [],
        error: `Connection error: ${error.message}`,
      });
    });

    req.write(requestBody);
    req.end();
  });
}
