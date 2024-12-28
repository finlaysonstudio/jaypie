declare module "@jaypie/datadog" {
  export interface MetricOptions {
    host?: string;
    tags?: string[];
    timestamp?: number;
    type?: "count" | "gauge" | "histogram" | "set";
  }

  export interface MetricSetOptions extends MetricOptions {
    metrics: Array<{
      metric: string;
      points: Array<[number, number]>;
      type?: "count" | "gauge" | "histogram" | "set";
    }>;
  }

  /**
   * Submit a single metric to Datadog
   */
  export function submitMetric(
    metric: string,
    value: number,
    options?: MetricOptions
  ): Promise<boolean>;

  /**
   * Submit multiple metrics to Datadog in a single request
   */
  export function submitMetricSet(
    options: MetricSetOptions
  ): Promise<boolean>;
} 