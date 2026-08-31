/**
 * Datadog Service - Unified Datadog observability access
 *
 * A fabric service, so it registers directly with an LLM toolkit through
 * `fabricTool()` or with an MCP server through `suite.register()`.
 *
 * Error contract: faults the caller can act on throw a Jaypie error, because
 * neither `fabricTool()` nor `fabricMcp()` converts a throw into a result.
 * A missing key is a `ConfigurationError`; a bad command or a missing required
 * parameter is a `BadRequestError`. An unsuccessful Datadog response is not a
 * throw: the result carries `success: false` and a status-specific `error`
 * string, so a model reading the tool output can explain the failure and move
 * on rather than losing the call to an exception.
 */
import { BadRequestError, ConfigurationError } from "@jaypie/errors";
import { fabricService } from "@jaypie/fabric";

import {
  aggregateDatadogLogs,
  getDatadogCredentials,
  getDatadogSyntheticResults,
  listDatadogMonitors,
  listDatadogSynthetics,
  queryDatadogMetrics,
  searchDatadogLogs,
  searchDatadogRum,
  validateDatadogSetup,
} from "./datadogApi.client.js";
import { DATADOG_HELP } from "./datadogHelp.constant.js";

// Silent logger for direct execution
const log = {
  error: () => {},
  info: () => {},
};

// Flattened input type for the unified Datadog service
interface DatadogInput {
  aggregation?: string;
  command?: string;
  env?: string;
  from?: string;
  groupBy?: string;
  limit?: number;
  metric?: string;
  monitorTags?: string;
  name?: string;
  query?: string;
  service?: string;
  sort?: string;
  source?: string;
  status?: string;
  tags?: string;
  testId?: string;
  to?: string;
  type?: string;
}

export const datadogService = fabricService({
  alias: "datadog",
  description:
    "Access Datadog observability data. Commands: logs, log_analytics, monitors, synthetics, metrics, rum. Call with no args for help.",
  input: {
    aggregation: {
      description:
        "Aggregation type for log_analytics (count, avg, sum, min, max, cardinality)",
      required: false,
      type: String,
    },
    command: {
      description:
        "Command to execute: logs, log_analytics, monitors, synthetics, metrics, rum (omit for help)",
      required: false,
      type: String,
    },
    env: {
      description: "Environment filter (e.g., production, staging)",
      required: false,
      type: String,
    },
    from: {
      description:
        "Start time (e.g., now-1h, now-15m, now-1d, or ISO 8601 timestamp)",
      required: false,
      type: String,
    },
    groupBy: {
      description:
        "Fields to group by for log_analytics (comma-separated, e.g., service,status)",
      required: false,
      type: String,
    },
    limit: {
      description: "Maximum number of results to return",
      required: false,
      type: Number,
    },
    metric: {
      description: "Metric field for aggregation (e.g., @duration)",
      required: false,
      type: String,
    },
    monitorTags: {
      description: "Monitor tags filter (comma-separated)",
      required: false,
      type: String,
    },
    name: {
      description: "Name filter for monitors",
      required: false,
      type: String,
    },
    query: {
      description:
        'Datadog query string (e.g., status:error, @lambda.arn:"arn:aws:...")',
      required: false,
      type: String,
    },
    service: {
      description: "Service name filter",
      required: false,
      type: String,
    },
    sort: {
      description: "Sort order (timestamp or -timestamp)",
      required: false,
      type: String,
    },
    source: {
      description: "Log source filter (default: lambda)",
      required: false,
      type: String,
    },
    status: {
      description:
        "Monitor status filter (comma-separated: Alert, Warn, No Data, OK)",
      required: false,
      type: String,
    },
    tags: {
      description: "Tags filter (comma-separated)",
      required: false,
      type: String,
    },
    testId: {
      description: "Synthetic test ID for getting results",
      required: false,
      type: String,
    },
    to: {
      description: "End time (e.g., now, or ISO 8601 timestamp)",
      required: false,
      type: String,
    },
    type: {
      description: "Synthetic test type filter (api or browser)",
      required: false,
      type: String,
    },
  },
  service: async (params: DatadogInput) => {
    const { command } = params;

    if (!command || command === "help") {
      return DATADOG_HELP;
    }

    const credentials = await getDatadogCredentials();
    if (!credentials) {
      throw new ConfigurationError(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }

    // Helper to parse comma-separated strings into arrays
    const parseArray = (value?: string): string[] | undefined => {
      if (!value) return undefined;
      return value.split(",").map((s) => s.trim());
    };

    switch (command) {
      case "validate": {
        return validateDatadogSetup();
      }

      case "logs": {
        return searchDatadogLogs(
          credentials,
          {
            env: params.env,
            from: params.from,
            limit: params.limit,
            query: params.query,
            service: params.service,
            sort: params.sort as "timestamp" | "-timestamp" | undefined,
            source: params.source,
            to: params.to,
          },
          log,
        );
      }

      case "log_analytics": {
        const groupByArray = parseArray(params.groupBy);
        if (!groupByArray || groupByArray.length === 0) {
          throw new BadRequestError(
            "groupBy is required (comma-separated field names, e.g., service,status)",
          );
        }
        const compute = params.aggregation
          ? [
              {
                aggregation: params.aggregation as
                  "count" | "avg" | "sum" | "min" | "max" | "cardinality",
                metric: params.metric,
              },
            ]
          : [{ aggregation: "count" as const }];
        return aggregateDatadogLogs(
          credentials,
          {
            compute,
            env: params.env,
            from: params.from,
            groupBy: groupByArray,
            query: params.query,
            service: params.service,
            source: params.source,
            to: params.to,
          },
          log,
        );
      }

      case "monitors": {
        const statusArray = parseArray(params.status) as
          ("Alert" | "Warn" | "No Data" | "OK")[] | undefined;
        return listDatadogMonitors(
          credentials,
          {
            monitorTags: parseArray(params.monitorTags),
            name: params.name,
            status: statusArray,
            tags: parseArray(params.tags),
          },
          log,
        );
      }

      case "synthetics": {
        if (params.testId) {
          return getDatadogSyntheticResults(credentials, params.testId, log);
        }
        return listDatadogSynthetics(
          credentials,
          {
            tags: parseArray(params.tags),
            type: params.type as "api" | "browser" | undefined,
          },
          log,
        );
      }

      case "metrics": {
        if (!params.query)
          throw new BadRequestError("query is required for metrics");
        const now = Math.floor(Date.now() / 1000);
        const fromStr = params.from || "1h";
        let fromTs: number;
        if (fromStr.match(/^\d+$/)) {
          fromTs = parseInt(fromStr, 10);
        } else if (fromStr.match(/^(\d+)h$/)) {
          const hours = parseInt(fromStr.match(/^(\d+)h$/)![1], 10);
          fromTs = now - hours * 3600;
        } else if (fromStr.match(/^(\d+)m$/)) {
          const minutes = parseInt(fromStr.match(/^(\d+)m$/)![1], 10);
          fromTs = now - minutes * 60;
        } else if (fromStr.match(/^(\d+)d$/)) {
          const days = parseInt(fromStr.match(/^(\d+)d$/)![1], 10);
          fromTs = now - days * 86400;
        } else {
          fromTs = now - 3600;
        }
        const toStr = params.to || "now";
        const toTs = toStr === "now" ? now : parseInt(toStr, 10);
        return queryDatadogMetrics(
          credentials,
          { from: fromTs, query: params.query, to: toTs },
          log,
        );
      }

      case "rum": {
        return searchDatadogRum(
          credentials,
          {
            from: params.from,
            limit: params.limit,
            query: params.query,
            to: params.to,
          },
          log,
        );
      }

      default:
        throw new BadRequestError(
          `Unknown command: ${command}. Use datadog() for help.`,
        );
    }
  },
});

// Re-export types and functions
export * from "./datadogApi.client.js";
