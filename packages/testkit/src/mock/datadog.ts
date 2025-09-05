import { createMockResolvedFunction, createMockWrappedFunction } from "./utils";

import * as original from "@jaypie/datadog";

export const DATADOG = original.DATADOG;
export const hasDatadogEnv = createMockWrappedFunction(
  original.hasDatadogEnv,
  false,
);
export const submitDistribution = createMockResolvedFunction(true);
export const submitMetric = createMockResolvedFunction(true);
export const submitMetricSet = createMockResolvedFunction(true);
