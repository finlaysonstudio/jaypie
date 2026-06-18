import {
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
} from "./utils";

import * as original from "@jaypie/datadog";

export const DATADOG = original.DATADOG;
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
