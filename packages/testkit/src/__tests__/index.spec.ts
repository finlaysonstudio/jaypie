import { describe, expect, it } from "vitest";

// Subject
import {
  jsonApiErrorSchema,
  jsonApiSchema,
  matchers,
  mockLogFactory,
  restoreLog,
  spyLog,
  sqsTestRecords,
} from "../index";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports functions", () => {
    expect(mockLogFactory).toBeFunction();
    expect(restoreLog).toBeFunction();
    expect(spyLog).toBeFunction();
    expect(sqsTestRecords).toBeFunction();
  });
  it("Exports matchers", () => {
    expect(jsonApiErrorSchema).toBeObject();
    expect(jsonApiSchema).toBeObject();
    expect(matchers).toBeObject();
  });
});
