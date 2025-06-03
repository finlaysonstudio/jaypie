import { describe, expect, it } from "vitest";

// Subject
import { DATADOG, submitDistribution, submitMetric, submitMetricSet } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports constants we expect", () => {
    expect(DATADOG).toBeObject();
  });
  it("Exports functions we expect", () => {
    expect(submitDistribution).toBeFunction();
    expect(submitMetric).toBeFunction();
    expect(submitMetricSet).toBeFunction();
  });
});
