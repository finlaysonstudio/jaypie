import { describe, expect, it } from "vitest";

// Subject
import {
  DATADOG,
  DATADOG_HELP,
  datadogService,
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
    expect(DATADOG_HELP).toBeString();
  });
  it("Exports the Datadog fabric service", () => {
    expect(datadogService).toBeFunction();
    expect(datadogService.alias).toBe("datadog");
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
