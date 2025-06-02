# datadog submit metric update

packages/datadog/src/submitMetric.adapter.js
packages/datadog/src/submitMetricSet.adapter.js

submitMetric and submitMetricSet take tags.
In addition to what the user passes, include these tags:

* env
* project
* service
* sponsor
* version

Get their values from the environment:

```
const {
  PROJECT_ENV,
  PROJECT_KEY,
  PROJECT_SERVICE,
  PROJECT_SPONSOR,
  PROJECT_VERSION,
} = process.env;
```

If any of them are undefined or falsy do not include them.
If the user `tags` conflicts, prefer what the user passes in.
If the user passes in falsy tags, they mean to suppress the defaults.

---

The above work was already attempted but the tests are failing:

packages/datadog/src/__tests__/submitMetric.adapter.spec.js
packages/datadog/src/__tests__/submitMetricSet.adapter.spec.js
packages/datadog/src/objectToKeyValueArray.pipeline.js

The problem is `tags` can be passed in as an object or array.
Make sure there is a test for each case.
Maybe `tags` should use `objectToKeyValueArrayPipeline` sooner, combined with default tags in an array form, and then eliminate any duplicates.
For example, `["taco:beef", "cheese:false", "double", "cheese:extra", "double"]` would reduce to `["taco:beef", "cheese:extra", "double"]` by eliminating duplicates with no `:` and only using the last `prefix:`.