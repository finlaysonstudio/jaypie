import { client, v2 } from "@datadog/datadog-api-client";
import type { MetricIntakeType } from "@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/MetricIntakeType.js";
import { getSecret } from "@jaypie/aws";
import { force, log } from "@jaypie/core";

import { DATADOG } from "./constants.js";
import objectToKeyValueArrayPipeline from "./objectToKeyValueArray.pipeline.js";
import getStatsDClient, { isLambdaWithExtension } from "./statsd.client.js";

//
//
// Types
//

interface SubmitMetricSetOptions {
  apiKey?: string;
  apiSecret?: string;
  type?: number;
  valueSet?: Record<string, number | string>;
  tags?: string[] | Record<string, unknown>;
  timestamp?: number;
}

interface SubmitMetricSetStatsDOptions {
  type?: number;
  valueSet: Record<string, number | string>;
  tags?: string[] | Record<string, unknown>;
}

//
//
// Main
//

const submitMetricSet = async ({
  apiKey = process.env[DATADOG.ENV.DATADOG_API_KEY],
  apiSecret = process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] ||
    process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] ||
    process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN],
  type = DATADOG.METRIC.TYPE.UNKNOWN,
  valueSet = {}, // { metricName1: value1, metricName2: value2 }
  tags,
  timestamp = Number.parseInt((Date.now() / 1000).toString(), 10),
}: SubmitMetricSetOptions = {}): Promise<boolean> => {
  try {
    log.trace.var({ submitMetricSet: { valueSet } });

    if (isLambdaWithExtension()) {
      return submitMetricSetViaStatsD({ type, valueSet, tags });
    }

    //
    //
    // Validate
    //

    if (!apiKey && !apiSecret) {
      log.warn("DATADOG_API_KEY was not provided");
      return false;
    }
    if (!valueSet) {
      log.warn("Metric valueSet was not provided");
      return false;
    }
    if (Object.keys(valueSet).length === 0) {
      log.warn("Metric value was not provided");
      return false;
    }
    if (!timestamp) {
      log.warn("Metric timestamp was not provided");
    }

    //
    //
    // Setup
    //

    let resolvedApiKey = apiKey;
    if (apiSecret) {
      resolvedApiKey = await getSecret(apiSecret);
    }

    const configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: resolvedApiKey,
      },
    });
    const apiInstance = new v2.MetricsApi(configuration);

    //
    //
    // Preprocess
    //

    const {
      PROJECT_ENV,
      PROJECT_KEY,
      PROJECT_SERVICE,
      PROJECT_SPONSOR,
      PROJECT_VERSION,
    } = process.env;

    // Build default tags array
    const defaultTagsArray: string[] = [];
    if (PROJECT_ENV) defaultTagsArray.push(`env:${PROJECT_ENV}`);
    if (PROJECT_KEY) defaultTagsArray.push(`project:${PROJECT_KEY}`);
    if (PROJECT_SERVICE) defaultTagsArray.push(`service:${PROJECT_SERVICE}`);
    if (PROJECT_SPONSOR) defaultTagsArray.push(`sponsor:${PROJECT_SPONSOR}`);
    if (PROJECT_VERSION) defaultTagsArray.push(`version:${PROJECT_VERSION}`);

    // Convert user tags to array format
    let userTagsArray: string[] = [];
    if (tags) {
      if (Array.isArray(tags)) {
        userTagsArray = tags;
      } else {
        userTagsArray = objectToKeyValueArrayPipeline(tags) as string[];
      }
    }

    // Combine tags with user tags taking precedence
    const allTags = [...defaultTagsArray, ...userTagsArray];

    // Remove duplicates, keeping the last occurrence of each prefix
    const seenPrefixes = new Set<string>();
    const seenValues = new Set<string>();
    const finalTags: string[] = [];

    // Process in reverse to keep last occurrence
    for (let i = allTags.length - 1; i >= 0; i--) {
      const tag = allTags[i];
      const colonIndex = tag.indexOf(":");

      if (colonIndex === -1) {
        // Tag without colon - only keep if not seen before
        if (!seenValues.has(tag)) {
          seenValues.add(tag);
          finalTags.unshift(tag);
        }
      } else {
        // Tag with colon - only keep if prefix not seen before
        const prefix = tag.substring(0, colonIndex);
        if (!seenPrefixes.has(prefix)) {
          seenPrefixes.add(prefix);
          finalTags.unshift(tag);
        }
      }
    }

    const series = [];
    for (const [name, value] of Object.entries(valueSet)) {
      series.push({
        metric: name,
        tags: finalTags,
        type: type as unknown as MetricIntakeType,
        points: [
          {
            timestamp,
            value: force.number(value),
          },
        ],
      });
    }
    const data = {
      body: {
        series,
      },
    };

    //
    //
    // Process
    //

    try {
      log.trace.var({ submitMetricRequest: data });
      await apiInstance.submitMetrics(data);
    } catch (error) {
      log.error.var({ submitMetricError: error });
      return false;
    }

    //
    //
    // Return
    //

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error({ submitMetricSetUnexpectedError: (error as Error).message });
    return false;
  }
};

//
//
//

const submitMetricSetViaStatsD = ({
  type = DATADOG.METRIC.TYPE.UNKNOWN,
  valueSet,
  tags,
}: SubmitMetricSetStatsDOptions): boolean => {
  try {
    if (!valueSet || Object.keys(valueSet).length === 0) {
      log.warn("Metric valueSet was not provided");
      return false;
    }

    const {
      PROJECT_ENV,
      PROJECT_KEY,
      PROJECT_SERVICE,
      PROJECT_SPONSOR,
      PROJECT_VERSION,
    } = process.env;

    const defaultTagsArray: string[] = [];
    if (PROJECT_ENV) defaultTagsArray.push(`env:${PROJECT_ENV}`);
    if (PROJECT_KEY) defaultTagsArray.push(`project:${PROJECT_KEY}`);
    if (PROJECT_SERVICE) defaultTagsArray.push(`service:${PROJECT_SERVICE}`);
    if (PROJECT_SPONSOR) defaultTagsArray.push(`sponsor:${PROJECT_SPONSOR}`);
    if (PROJECT_VERSION) defaultTagsArray.push(`version:${PROJECT_VERSION}`);

    let userTagsArray: string[] = [];
    if (tags) {
      if (Array.isArray(tags)) {
        userTagsArray = tags;
      } else {
        userTagsArray = objectToKeyValueArrayPipeline(tags) as string[];
      }
    }

    const allTags = [...defaultTagsArray, ...userTagsArray];

    const seenPrefixes = new Set<string>();
    const seenValues = new Set<string>();
    const finalTags: string[] = [];

    for (let i = allTags.length - 1; i >= 0; i--) {
      const tag = allTags[i];
      const colonIndex = tag.indexOf(":");

      if (colonIndex === -1) {
        if (!seenValues.has(tag)) {
          seenValues.add(tag);
          finalTags.unshift(tag);
        }
      } else {
        const prefix = tag.substring(0, colonIndex);
        if (!seenPrefixes.has(prefix)) {
          seenPrefixes.add(prefix);
          finalTags.unshift(tag);
        }
      }
    }

    const statsdClient = getStatsDClient();

    for (const [name, value] of Object.entries(valueSet)) {
      const numericValue = force.number(value);

      if (type === DATADOG.METRIC.TYPE.COUNT) {
        statsdClient.increment(name, numericValue, finalTags);
      } else if (type === DATADOG.METRIC.TYPE.GAUGE) {
        statsdClient.gauge(name, numericValue, finalTags);
      } else {
        statsdClient.increment(name, numericValue, finalTags);
      }
    }

    return true;
  } catch (error) {
    log.error.var({ submitMetricSetStatsDError: (error as Error).message });
    return false;
  }
};

//
//
// Export
//

export default submitMetricSet;
