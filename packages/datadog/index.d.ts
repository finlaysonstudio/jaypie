export interface DatadogEnv {
  DATADOG_API_KEY: string;
  DD_SITE: string;
  SECRET_DATADOG_API_KEY: string;
}

export interface DatadogMetricType {
  UNKNOWN: 0;
  COUNT: 1;
  RATE: 2;
  GAUGE: 3;
}

export interface DatadogConstants {
  ENV: DatadogEnv;
  METRIC: {
    TYPE: DatadogMetricType;
  };
  SITE: string;
}

export const DATADOG: DatadogConstants;

export interface SubmitMetricOptions {
  apiKey?: string;
  apiSecret?: string;
  name: string;
  type?: DatadogMetricType[keyof DatadogMetricType];
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

export function submitMetric(options: SubmitMetricOptions): Promise<boolean>;

export interface SubmitMetricSetOptions
  extends Omit<SubmitMetricOptions, "value"> {
  values: number[];
}

export function submitMetricSet(
  options: SubmitMetricSetOptions,
): Promise<boolean>;

export interface SubmitDistributionOptions {
  apiKey?: string;
  apiSecret?: string;
  name: string;
  points?: number[][];
  value?: number | number[];
  tags?: Record<string, string> | string[];
  timestamp?: number;
}

export function submitDistribution(
  options: SubmitDistributionOptions,
): Promise<boolean>;
