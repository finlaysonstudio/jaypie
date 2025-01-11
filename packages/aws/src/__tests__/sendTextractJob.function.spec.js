import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import sendTextractJob from "../sendTextractJob.function.js";

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

describe("SendTextractJob Function", () => {
  it("Works", async () => {
    const response = await sendTextractJob();
    console.log("response :>> ", response);
    expect(response).not.toBeUndefined();
  });
});
