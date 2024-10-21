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

const submitMetricSet = async ({
  apiKey = process.env[DATADOG.ENV.DATADOG_API_KEY],
  apiSecret = process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY],
  type = DATADOG.METRIC.TYPE.UNKNOWN,
  valueSet = {}, // { metricName1: value1, metricName2: value2 }
  tags,
  timestamp = Number.parseInt(Date.now() / 1000, 10),
} = {}) => {
  log.trace.var({ submitMetricSet: { valueSet } });

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

  if (apiSecret) {
    apiKey = await getSecret(apiSecret);
  }

  const configuration = client.createConfiguration({
    authMethods: {
      apiKeyAuth: apiKey,
    },
  });
  const apiInstance = new v2.MetricsApi(configuration);

  //
  //
  // Preprocess
  //

  const series = [];
  for (const [name, value] of Object.entries(valueSet)) {
    series.push({
      metric: name,
      tags: objectToKeyValueArrayPipeline(tags),
      type,
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
    const response = await apiInstance.submitMetrics(data);
    if (JSON.stringify(response) !== JSON.stringify(NO_ERROR_RESPONSE_OBJECT)) {
      log.var({ submitMetricResponse: response });
    }
  } catch (error) {
    log.error.var({ submitMetricError: error });
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

export default submitMetricSet;
