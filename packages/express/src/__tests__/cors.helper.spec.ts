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
      expect(callback).not.toHaveBeenCalled();
      cors(null as unknown as Request, null as unknown as Response, callback);
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
    });
  });
});
