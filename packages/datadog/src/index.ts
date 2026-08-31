//
//
// Export
//

export { DATADOG } from "./constants.js";
export { datadogService } from "./datadog.service.js";
export type {
  DatadogAnalyticsBucket,
  DatadogAnalyticsResult,
  DatadogCredentials,
  DatadogLogEntry,
  DatadogMetricSeries,
  DatadogMetricsResult,
  DatadogMonitor,
  DatadogMonitorsResult,
  DatadogRumEvent,
  DatadogRumResult,
  DatadogSearchResult,
  DatadogSyntheticResult,
  DatadogSyntheticResultsResult,
  DatadogSyntheticTest,
  DatadogSyntheticsResult,
  DatadogValidationResult,
} from "./datadogApi.client.js";
export { DATADOG_HELP } from "./datadogHelp.constant.js";
export { default as hasDatadogEnv } from "./hasDatadogEnv.function.js";
export { flushLlmObs, getLlmObs, isLlmObsEnabled } from "./llmobs.js";
export { default as loadDatadogApiKey } from "./loadDatadogApiKey.function.js";
export { tagSpan, traceSpan } from "./span.js";
export { default as submitDistribution } from "./submitDistribution.adapter.js";
export { default as submitMetric } from "./submitMetric.adapter.js";
export { default as submitMetricSet } from "./submitMetricSet.adapter.js";
