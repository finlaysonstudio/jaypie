import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import axiosResponseVarPipeline from "../axiosResponseVar.pipeline.js";

// Subject
import logVar from "../logVar.function.js";

//
//
// Mock modules
//

vi.mock("../axiosResponseVar.pipeline.js");

beforeEach(() => {
  axiosResponseVarPipeline.key = "project";
});

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("LogVar Function", () => {
  it("Works", async () => {
    const response = logVar({ key: "value" });
    expect(response).not.toBeUndefined();
    expect(response).toBeObject();
    expect(response).toEqual({ key: "value" });
  });
  describe("Features", () => {
    it("Calls axiosResponseVarPipeline", () => {
      axiosResponseVarPipeline.filter.mockReturnValue("soap");
      const response = logVar("project", "mayhem");
      expect(axiosResponseVarPipeline.filter).toHaveBeenCalled();
      expect(response).toBeObject();
      expect(response).toEqual({ project: "soap" });
    });
  });
});
