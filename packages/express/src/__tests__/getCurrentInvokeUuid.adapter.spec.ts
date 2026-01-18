import { afterEach, describe, expect, it, vi } from "vitest";

//
//
// Mock modules
//

vi.mock("../adapter/index.js", () => ({
  getCurrentInvoke: vi.fn(() => ({
    context: {
      awsRequestId: "MOCK.UUID",
    },
    event: {},
  })),
}));

// Subject (import after mocks)
import getCurrentInvokeUuid from "../getCurrentInvokeUuid.adapter.js";
import { getCurrentInvoke } from "../adapter/index.js";

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("GetCurrentInvokeUuid Adapter", () => {
  describe("function", () => {
    it("is a function", () => {
      expect(getCurrentInvokeUuid).toBeFunction();
    });
  });

  describe("with Jaypie adapter context", () => {
    it("returns the mocked UUID from adapter context", () => {
      const response = getCurrentInvokeUuid();
      expect(response).toBe("MOCK.UUID");
    });
  });

  describe("with request containing _lambdaContext", () => {
    it("returns UUID from request._lambdaContext", () => {
      const mockReq = {
        _lambdaContext: {
          awsRequestId: "REQUEST.CONTEXT.UUID",
        },
        headers: {},
      } as any;

      const response = getCurrentInvokeUuid(mockReq);
      expect(response).toBe("REQUEST.CONTEXT.UUID");
    });

    it("prioritizes request context over global context", () => {
      const mockReq = {
        _lambdaContext: {
          awsRequestId: "REQUEST.UUID",
        },
        headers: {},
      } as any;

      const response = getCurrentInvokeUuid(mockReq);
      expect(response).toBe("REQUEST.UUID");
      // Global context should not be checked
      expect(getCurrentInvoke).not.toHaveBeenCalled();
    });
  });

  describe("fallback to global context", () => {
    it("uses global context when request has no _lambdaContext", () => {
      const mockReq = {
        headers: {},
      } as any;

      const response = getCurrentInvokeUuid(mockReq);
      expect(response).toBe("MOCK.UUID");
      expect(getCurrentInvoke).toHaveBeenCalled();
    });
  });
});
