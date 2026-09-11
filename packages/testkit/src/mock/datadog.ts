import {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
} from "./utils";

import { datadog as original } from "./original";

export const DATADOG = original.DATADOG;
export const DATADOG_HELP = original.DATADOG_HELP;
// The fabric service is passed through: its command router is the behavior
// under test whenever a consumer registers it as a tool.
export const datadogService = original.datadogService;
export const flushLlmObs = createMockReturnedFunction(undefined);
export const getLlmObs = createMockReturnedFunction(null);
export const hasDatadogEnv = createMockWrappedFunction(
  original.hasDatadogEnv,
  false,
);
export const isLlmObsEnabled = createMockReturnedFunction(false);
export const loadDatadogApiKey = createMockResolvedFunction(false);
export const submitDistribution = createMockResolvedFunction(true);
export const submitMetric = createMockResolvedFunction(true);
export const submitMetricSet = createMockResolvedFunction(true);
// No-op on the active span; the traced region's callback still runs.
export const tagSpan = createMockReturnedFunction(undefined);
export const traceSpan = createMockFunction(
  (_name: string, fn: () => unknown) => fn(),
);
