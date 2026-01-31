import type { Request, Response, NextFunction } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import corsHelper, { dynamicOriginCallbackHandler } from "../cors.helper.js";

//
//
// Mock modules
//

vi.mock("cors", () => ({
  default: () => {
    return (req: Request, res: Response, next: NextFunction) => next();
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.BASE_URL;
  delete process.env.PROJECT_BASE_URL;
});

//
//
// Run tests
//

describe("Cors Helper", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(corsHelper).toBeDefined();
      expect(corsHelper).toBeFunction();
    });
    it("When called, returns a middleware function", () => {
      const cors = corsHelper();
      expect(cors).toBeDefined();
      expect(cors).toBeFunction();
    });
    it("When middleware is called, it calls the mocked express cors function", () => {
      const cors = corsHelper();
      const callback = vi.fn();
      const mockReq = { method: "GET", headers: {} } as unknown as Request;
      const mockRes = {} as unknown as Response;
      expect(callback).not.toHaveBeenCalled();
      cors(mockReq, mockRes, callback);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("Features", () => {
    describe("dynamicOriginCallbackHandler", () => {
      it("is a function that returns a callback", () => {
        expect(dynamicOriginCallbackHandler).toBeDefined();
        expect(dynamicOriginCallbackHandler).toBeFunction();
        expect(dynamicOriginCallbackHandler()).toBeFunction();
      });
      it("allows wildcard origin", () => {
        const originHandler = dynamicOriginCallbackHandler("*");
        const origin = "https://any-domain.com";
        const callback = vi.fn();
        originHandler(origin, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      });
      it("allows requests with no origin", () => {
        const originHandler = dynamicOriginCallbackHandler();
        const callback = vi.fn();
        originHandler(undefined, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      });
      it("allows requests that match BASE_URL", () => {
        process.env.BASE_URL = "https://api.example.com";
        const originHandler = dynamicOriginCallbackHandler();
        const origin = "https://api.example.com";
        const callback = vi.fn();
        originHandler(origin, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      });
      it("allows requests that match PROJECT_BASE_URL", () => {
        process.env.PROJECT_BASE_URL = "https://api.example.com";
        const originHandler = dynamicOriginCallbackHandler();
        const origin = "https://api.example.com";
        const callback = vi.fn();
        originHandler(origin, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      });
      it("allows requests that match additional origins", () => {
        const originHandler = dynamicOriginCallbackHandler([
          "https://api.example.com",
          "https://api.example.org",
        ]);
        const origin = "https://api.example.com";
        const callback = vi.fn();
        originHandler(origin, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      });

      describe("Subdomain Matching", () => {
        it("allows subdomain when base domain is allowed", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://app.example.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          expect(callback).toHaveBeenCalledWith(null, true);
        });

        it("allows nested subdomains when base domain is allowed", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://sub.app.example.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          expect(callback).toHaveBeenCalledWith(null, true);
        });

        it("allows exact match for base domain", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://example.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          expect(callback).toHaveBeenCalledWith(null, true);
        });

        it("allows origin without protocol prefix in config", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://example.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          expect(callback).toHaveBeenCalledWith(null, true);
        });
      });

      describe("Security - Domain Matching", () => {
        it("rejects domains that contain the allowed domain as substring", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://notexample.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          // Should NOT be allowed - notexample.com is not a subdomain of example.com
          expect(callback).not.toHaveBeenCalledWith(null, true);
        });

        it("rejects domains with allowed domain as suffix but not subdomain", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://fakeexample.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          // Should NOT be allowed - fakeexample.com is not a subdomain of example.com
          expect(callback).not.toHaveBeenCalledWith(null, true);
        });

        it("rejects completely different domains", () => {
          const originHandler = dynamicOriginCallbackHandler("example.com");
          const origin = "https://evil.com";
          const callback = vi.fn();
          originHandler(origin, callback);
          expect(callback).not.toHaveBeenCalledWith(null, true);
        });
      });
    });
  });
});
