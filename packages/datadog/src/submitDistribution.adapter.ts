import { client, v1 } from "@datadog/datadog-api-client";
import { getSecret } from "@jaypie/aws";
import { log } from "@jaypie/core";

import { DATADOG } from "./constants.js";
import objectToKeyValueArrayPipeline from "./objectToKeyValueArray.pipeline.js";
import getStatsDClient, { isLambdaWithExtension } from "./statsd.client.js";

//
//
// Types
//

interface SubmitDistributionOptions {
  apiKey?: string;
  apiSecret?: string;
  name?: string;
  points?: [number, number[]][];
  value?: number | number[];
  tags?: string[] | Record<string, unknown>;
  timestamp?: number;
}

interface SubmitDistributionStatsDOptions {
  name?: string;
  points?: [number, number[]][];
  value?: number | number[];
  tags?: string[] | Record<string, unknown>;
}

//
//
// Main
//

const submitDistribution = async ({
  apiKey = process.env[DATADOG.ENV.DATADOG_API_KEY],
  apiSecret = process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] ||
    process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] ||
    process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN],
  name,
  points = [],
  value,
  tags,
  timestamp = Number.parseInt((Date.now() / 1000).toString(), 10),
}: SubmitDistributionOptions = {}): Promise<boolean> => {
  try {
    log.trace.var({ submitDistribution: { name, points, value } });

    if (isLambdaWithExtension()) {
      return submitDistributionViaStatsD({ name, points, value, tags });
    }

    //
    //
    // Validate
    //

    if (!apiKey && !apiSecret) {
      log.warn("DATADOG_API_KEY was not provided");
      return false;
    }
    if (!name) {
      log.warn("Distribution metric name was not provided");
      return false;
    }
    if (!timestamp) {
      log.warn("Distribution metric timestamp was not provided");
    }

    // Validate points or value
    let finalPoints = points;
    if (!points || points.length === 0) {
      if (value === undefined || value === null) {
        log.warn("Distribution metric points or value was not provided");
        return false;
      }

      // Convert value to points array
      const pointValues = Array.isArray(value) ? value : [value];
      finalPoints = [[timestamp, pointValues]];
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
    const apiInstance = new v1.MetricsApi(configuration);

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

    const data = {
      body: {
        series: [
          {
            metric: name,
            tags: finalTags,
            points: finalPoints,
          },
        ],
      },
      contentEncoding: "deflate" as const,
    };

    //
    //
    // Process
    //

    try {
      log.trace.var({ submitDistribution: data });
      await apiInstance.submitDistributionPoints(data);
    } catch (error) {
      log.error.var({ submitDistributionError: (error as Error).message });
      return false;
    }

    //
    //
    // Return
    //

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error({
      submitDistributionUnexpectedError: (error as Error).message,
    });
    return false;
  }
};

//
//
//

const submitDistributionViaStatsD = ({
  name,
  points,
  value,
  tags,
}: SubmitDistributionStatsDOptions): boolean => {
  try {
    if (!name) {
      log.warn("Distribution metric name was not provided");
      return false;
    }

    let finalPoints: number[];
    if (!points || points.length === 0) {
      if (value === undefined || value === null) {
        log.warn("Distribution metric points or value was not provided");
        return false;
      }
      const pointValues = Array.isArray(value) ? value : [value];
      finalPoints = pointValues;
    } else {
      finalPoints = points.flatMap((point) => point[1] || []);
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

    for (const pointValue of finalPoints) {
      statsdClient.distribution(name, pointValue, finalTags);
    }

    return true;
  } catch (error) {
    log.error.var({ submitDistributionStatsDError: (error as Error).message });
    return false;
  }
};

//
//
// Export
//
export default submitDistribution;
