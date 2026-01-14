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

vi.mock("../getCurrentInvokeUuid.webadapter.js", () => ({
  default: vi.fn(() => undefined),
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

  describe("with Web Adapter mode", () => {
    it("returns undefined when web adapter returns undefined", async () => {
      // Import fresh to get the mock
      const webAdapterMock =
        await import("../getCurrentInvokeUuid.webadapter.js");
      vi.mocked(webAdapterMock.default).mockReturnValue("WEB.ADAPTER.UUID");

      const mockReq = {
        headers: {
          "x-amzn-request-id": "header-request-id",
        },
      } as any;

      const response = getCurrentInvokeUuid(mockReq);
      expect(response).toBe("WEB.ADAPTER.UUID");
    });
  });

  describe("priority order", () => {
    it("uses web adapter header first when present", async () => {
      const webAdapterMock =
        await import("../getCurrentInvokeUuid.webadapter.js");
      vi.mocked(webAdapterMock.default).mockReturnValue("WEB.ADAPTER.UUID");

      const mockReq = {
        _lambdaContext: {
          awsRequestId: "REQUEST.UUID",
        },
        headers: {
          "x-amzn-request-id": "header-id",
        },
      } as any;

      const response = getCurrentInvokeUuid(mockReq);
      // Web adapter mode takes priority
      expect(response).toBe("WEB.ADAPTER.UUID");
    });
  });
});
