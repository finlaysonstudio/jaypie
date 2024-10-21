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
  apiSecret = process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY],
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

  const data = {
    body: {
      series: [
        // https://datadoghq.dev/datadog-api-client-typescript/classes/v2.MetricSeries.html
        {
          metric: name,
          tags: objectToKeyValueArrayPipeline(tags),
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
    const response = await apiInstance.submitMetrics(data);
    if (JSON.stringify(response) !== JSON.stringify(NO_ERROR_RESPONSE_OBJECT)) {
      log.var({ submitMetricResponse: response });
    }
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
