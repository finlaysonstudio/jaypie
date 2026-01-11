import { describe, expect, it } from "vitest";

// Subject
import axiosResponseVarPipeline from "../axiosResponseVar.pipeline.js";

const { key, filter } = axiosResponseVarPipeline;

//
//
// Run tests
//

describe("AxiosResponseVar Pipeline", () => {
  it("Works", async () => {
    expect(key).toBe("response");
    const response = filter({ project: "mayhem" });
    expect(response).not.toBeUndefined();
    expect(response).toBeObject();
    expect(response).toEqual({ project: "mayhem" });
  });
  it("Removes config and request if it is an axios response", () => {
    const response = filter({
      BOGUS: "BOGUS", // It also removes bogus keys
      config: {},
      data: {},
      headers: {},
      request: {},
      status: 200,
      statusText: "OK",
    });
    expect(response).not.toBeUndefined();
    expect(response).toBeObject();
    expect(response).toEqual({
      data: {},
      headers: {},
      status: 200,
      statusText: "OK",
    });
  });
});
