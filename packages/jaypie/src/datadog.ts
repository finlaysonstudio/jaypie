import { loadPackage } from "./loadPackage.js";
import type * as DatadogTypes from "@jaypie/datadog";

type DatadogModule = typeof DatadogTypes;

// Re-export constant via getter to lazy load
export const DATADOG: DatadogModule["DATADOG"] = new Proxy(
  {} as DatadogModule["DATADOG"],
  {
    get(_, prop) {
      return loadPackage<DatadogModule>("@jaypie/datadog").DATADOG[
        prop as keyof DatadogModule["DATADOG"]
      ];
    },
  },
);

export function hasDatadogEnv(
  ...args: Parameters<DatadogModule["hasDatadogEnv"]>
): ReturnType<DatadogModule["hasDatadogEnv"]> {
  return loadPackage<DatadogModule>("@jaypie/datadog").hasDatadogEnv(...args);
}

export function submitDistribution(
  ...args: Parameters<DatadogModule["submitDistribution"]>
): ReturnType<DatadogModule["submitDistribution"]> {
  return loadPackage<DatadogModule>("@jaypie/datadog").submitDistribution(
    ...args,
  );
}

export function submitMetric(
  ...args: Parameters<DatadogModule["submitMetric"]>
): ReturnType<DatadogModule["submitMetric"]> {
  return loadPackage<DatadogModule>("@jaypie/datadog").submitMetric(...args);
}

export function submitMetricSet(
  ...args: Parameters<DatadogModule["submitMetricSet"]>
): ReturnType<DatadogModule["submitMetricSet"]> {
  return loadPackage<DatadogModule>("@jaypie/datadog").submitMetricSet(...args);
}
