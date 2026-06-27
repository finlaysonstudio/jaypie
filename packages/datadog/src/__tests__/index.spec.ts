import { describe, expect, it } from "vitest";

// Subject
import {
  DATADOG,
  hasDatadogEnv,
  loadDatadogApiKey,
  submitDistribution,
  submitMetric,
  submitMetricSet,
  tagSpan,
  traceSpan,
} from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports constants we expect", () => {
    expect(DATADOG).toBeObject();
  });
  it("Exports functions we expect", () => {
    expect(hasDatadogEnv).toBeFunction();
    expect(loadDatadogApiKey).toBeFunction();
    expect(submitDistribution).toBeFunction();
    expect(submitMetric).toBeFunction();
    expect(submitMetricSet).toBeFunction();
    expect(tagSpan).toBeFunction();
    expect(traceSpan).toBeFunction();
  });
});
