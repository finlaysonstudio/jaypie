import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import getTextractJob from "../getTextractJob.function.js";

//
//
// Mock modules
//

// vi.mock("../file.js");
// vi.mock("module");

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("GetTextractJob Function", () => {
  it("Works", async () => {
    const response = await getTextractJob();
    console.log("response :>> ", response);
    expect(response).not.toBeUndefined();
  });
});
