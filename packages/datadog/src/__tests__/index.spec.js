import { describe, expect, it } from "vitest";

// Subject
import { DATADOG, submitMetric, submitMetricSet } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports constants we expect", () => {
    expect(DATADOG).toBeObject();
  });
  it("Exports functions we expect", () => {
    expect(submitMetric).toBeFunction();
    expect(submitMetricSet).toBeFunction();
  });
});
