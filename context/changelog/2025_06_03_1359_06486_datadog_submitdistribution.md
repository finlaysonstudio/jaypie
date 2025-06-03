# Datadog submitDistribution

packages/datadog/src/__tests__/submitMetricSet.adapter.spec.js
packages/datadog/src/__tests__/submitMetricSet.adapter.spec.js
packages/datadog/src/index.js
packages/datadog/src/submitMetric.adapter.js
packages/datadog/src/submitMetricSet.adapter.js
packages/testkit/src/mock/datadog.ts

I would like to create a new Datadog function, submitDistribution.

```typescript
const submitMetricSet = async ({
  apiKey = process.env[DATADOG.ENV.DATADOG_API_KEY],
  apiSecret = process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY],
  points = [], // Points relating to the distribution point metric. All points must be tuples with timestamp and a list of values (cannot be a string). Timestamps should be in POSIX time in seconds.
  point,
  tags,
  timestamp = Number.parseInt(Date.now() / 1000, 10),
} = {}) => {
```

It will have to be exported in the datadog module index.
It should be mocked in the datadog mock.
Tests should be as rigorous as the originals.

Here is sample code from Datadog on how their library works.
The end result should follow repository conventions, not Datadog's.

Use `points` when provided.
When `points` is not provided but `point` is, check if point is an array. 
If it is not, wrap it in one like point = [point]
submit a single tuple like this: points: `[[Math.round(Date.now() / 1000), point]]`

```typescript
/**
 * Submit deflate distribution points returns "Payload accepted" response
 */

import { client, v1 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v1.MetricsApi(configuration);

const params: v1.MetricsApiSubmitDistributionPointsRequest = {
  body: {
    series: [
      {
        metric: "system.load.1.dist",
        points: [[Math.round(new Date().getTime() / 1000), [1.0, 2.0]]],
      },
    ],
  },
  contentEncoding: "deflate",
};

apiInstance
  .submitDistributionPoints(params)
  .then((data: v1.IntakePayloadAccepted) => {
    console.log(
      "API called successfully. Returned data: " + JSON.stringify(data)
    );
  })
  .catch((error: any) => console.error(error));
```

---

The work above was completed.
I want to change `point` to `value`

## COMPLETED

Successfully updated the submitDistribution function to use `value` parameter instead of `point`:

- Updated function signature in `packages/datadog/src/submitDistribution.adapter.js:26`
- Updated validation logic in `packages/datadog/src/submitDistribution.adapter.js:52-60`
- Updated log tracing in `packages/datadog/src/submitDistribution.adapter.js:30`
- Updated all test cases in `packages/datadog/src/__tests__/submitDistribution.adapter.spec.js`
- All tests passing (62/62)
- Build successful