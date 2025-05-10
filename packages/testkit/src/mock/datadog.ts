import { createMockResolvedFunction } from "./utils";

import * as original from "@jaypie/datadog";

export const DATADOG = original.DATADOG;
export const submitMetric = createMockResolvedFunction(true);

export const submitMetricSet = createMockResolvedFunction(true);
