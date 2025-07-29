import { client, v2 } from "@datadog/datadog-api-client";
import { getSecret } from "@jaypie/aws";
import { force, log } from "@jaypie/core";

import { DATADOG } from "./constants.js";
import objectToKeyValueArrayPipeline from "./objectToKeyValueArray.pipeline.js";

//
//
// Constants
//

const NO_ERROR_RESPONSE_OBJECT = { errors: [] };

//
//
// Main
//

const submitMetric = async ({
  apiKey = process.env[DATADOG.ENV.DATADOG_API_KEY],
  apiSecret = process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] ||
    process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] ||
    process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN],
  name,
  type = DATADOG.METRIC.TYPE.UNKNOWN,
  value,
  tags,
  timestamp = Number.parseInt(Date.now() / 1000, 10),
} = {}) => {
  log.trace.var({ submitMetric: { name, value } });

  //
  //
  // Validate
  //

  if (!apiKey && !apiSecret) {
    log.warn("DATADOG_API_KEY was not provided");
    return false;
  }
  if (!name) {
    log.warn("Metric name was not provided");
    return false;
  }
  if (!timestamp) {
    log.warn("Metric timestamp was not provided");
  }
  if (value === undefined || value === null || Number.isNaN()) {
    log.warn("Metric value was not provided");
    return false;
  }

  //
  //
  // Setup
  //

  if (apiSecret) {
    apiKey = await getSecret(apiSecret);
  }

  const configuration = client.createConfiguration({
    authMethods: {
      apiKeyAuth: apiKey,
    },
  });
  const apiInstance = new v2.MetricsApi(configuration);

  // Required by Datadog to be a number
  value = force.number(value);

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
  const defaultTagsArray = [];
  if (PROJECT_ENV) defaultTagsArray.push(`env:${PROJECT_ENV}`);
  if (PROJECT_KEY) defaultTagsArray.push(`project:${PROJECT_KEY}`);
  if (PROJECT_SERVICE) defaultTagsArray.push(`service:${PROJECT_SERVICE}`);
  if (PROJECT_SPONSOR) defaultTagsArray.push(`sponsor:${PROJECT_SPONSOR}`);
  if (PROJECT_VERSION) defaultTagsArray.push(`version:${PROJECT_VERSION}`);

  // Convert user tags to array format
  let userTagsArray = [];
  if (tags) {
    if (Array.isArray(tags)) {
      userTagsArray = tags;
    } else {
      userTagsArray = objectToKeyValueArrayPipeline(tags);
    }
  }

  // Combine tags with user tags taking precedence
  const allTags = [...defaultTagsArray, ...userTagsArray];

  // Remove duplicates, keeping the last occurrence of each prefix
  const seenPrefixes = new Set();
  const seenValues = new Set();
  const finalTags = [];

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

  const data = {
    body: {
      series: [
        // https://datadoghq.dev/datadog-api-client-typescript/classes/v2.MetricSeries.html
        {
          metric: name,
          tags: finalTags,
          type,
          points: [
            {
              timestamp,
              value,
            },
          ],
        },
      ],
    },
  };

  //
  //
  // Process
  //

  try {
    log.trace.var({ submitMetric: data });
    await apiInstance.submitMetrics(data);
  } catch (error) {
    log.error.var({ submitMetricError: error.message });
    return false;
  }

  //
  //
  // Return
  //

  return true;
};

//
//
// Export
//
export default submitMetric;
