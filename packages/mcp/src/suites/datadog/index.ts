/**
 * Datadog Suite - Unified Datadog observability access
 */
import { fabricService } from "@jaypie/fabric";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregateDatadogLogs,
  getDatadogCredentials,
  getDatadogSyntheticResults,
  listDatadogMonitors,
  listDatadogSynthetics,
  queryDatadogMetrics,
  searchDatadogLogs,
  searchDatadogRum,
} from "./datadog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Silent logger for direct execution
const log = {
  error: () => {},
  info: () => {},
};

async function getHelp(): Promise<string> {
  return fs.readFile(path.join(__dirname, "help.md"), "utf-8");
}

// Input type for the unified Datadog service
interface DatadogInput {
  aggregation?: "count" | "avg" | "sum" | "min" | "max" | "cardinality";
  env?: string;
  from?: string;
  groupBy?: string[];
  limit?: number;
  metric?: string;
  monitorTags?: string[];
  name?: string;
  query?: string;
  service?: string;
  sort?: "timestamp" | "-timestamp";
  source?: string;
  status?: ("Alert" | "Warn" | "No Data" | "OK")[];
  tags?: string[];
  testId?: string;
  to?: string;
  type?: "api" | "browser";
}

export const datadogService = fabricService({
  alias: "datadog",
  description:
    "Access Datadog observability data. Commands: logs, log_analytics, monitors, synthetics, metrics, rum. Call with no args for help.",
  input: {
    command: {
      description: "Command to execute (omit for help)",
      required: false,
      type: String,
    },
    input: {
      description: "Command parameters",
      required: false,
      type: Object,
    },
  },
  service: async ({
    command,
    input: params,
  }: {
    command?: string;
    input?: DatadogInput;
  }) => {
    if (!command || command === "help") {
      return getHelp();
    }

    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }

    const p = params || {};

    switch (command) {
      case "logs": {
        const result = await searchDatadogLogs(
          credentials,
          {
            env: p.env,
            from: p.from,
            limit: p.limit,
            query: p.query,
            service: p.service,
            sort: p.sort,
            source: p.source,
            to: p.to,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      case "log_analytics": {
        if (!p.groupBy || p.groupBy.length === 0) {
          throw new Error("groupBy is required (array of field names)");
        }
        const compute = p.aggregation
          ? [{ aggregation: p.aggregation, metric: p.metric }]
          : [{ aggregation: "count" as const }];
        const result = await aggregateDatadogLogs(
          credentials,
          {
            compute,
            env: p.env,
            from: p.from,
            groupBy: p.groupBy,
            query: p.query,
            service: p.service,
            source: p.source,
            to: p.to,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      case "monitors": {
        const result = await listDatadogMonitors(
          credentials,
          {
            monitorTags: p.monitorTags,
            name: p.name,
            status: p.status,
            tags: p.tags,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      case "synthetics": {
        if (p.testId) {
          const result = await getDatadogSyntheticResults(
            credentials,
            p.testId,
            log,
          );
          if (!result.success) throw new Error(result.error);
          return result;
        }
        const result = await listDatadogSynthetics(
          credentials,
          {
            tags: p.tags,
            type: p.type,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      case "metrics": {
        if (!p.query) throw new Error("query is required for metrics");
        const now = Math.floor(Date.now() / 1000);
        const fromStr = p.from || "1h";
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
        const toStr = p.to || "now";
        const toTs = toStr === "now" ? now : parseInt(toStr, 10);
        const result = await queryDatadogMetrics(
          credentials,
          { from: fromTs, query: p.query, to: toTs },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      case "rum": {
        const result = await searchDatadogRum(
          credentials,
          {
            from: p.from,
            limit: p.limit,
            query: p.query,
            to: p.to,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      default:
        throw new Error(`Unknown command: ${command}. Use datadog() for help.`);
    }
  },
});

// Re-export types and functions for testing
export * from "./datadog.js";
