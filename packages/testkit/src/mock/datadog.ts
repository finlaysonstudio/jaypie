import { createMockFunction } from "./utils";

export const submitMetric = createMockFunction<
  (options: Record<string, unknown>) => boolean
>(() => true);

export const submitMetricSet = createMockFunction<
  (options: Record<string, unknown>) => boolean
>(() => true);
