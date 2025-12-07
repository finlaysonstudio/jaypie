import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import getCurrentInvokeUuid from "../getCurrentInvokeUuid.adapter.js";

//
//
// Mock modules
//

vi.mock("@codegenie/serverless-express", () => ({
  getCurrentInvoke: vi.fn(() => ({
    context: {
      awsRequestId: "MOCK.UUID",
    },
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("GetCurrentInvokeUuid Adapter", () => {
  it("Works", () => {
    expect(getCurrentInvokeUuid).toBeFunction();
    const response = getCurrentInvokeUuid();
    expect(response).not.toBeUndefined();
  });
  it("Returns the mocked UUID", () => {
    const response = getCurrentInvokeUuid();
    expect(response).toBe("MOCK.UUID");
  });
});
