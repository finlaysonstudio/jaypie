import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import corsHelper from "../cors.helper.js";

//
//
// Mock modules
//

vi.mock("cors", () => ({
  default: (options) => {
    // eslint-disable-next-line no-unused-vars
    const middleware = (req, res, next) => {};
    middleware.options = options;
    return middleware;
  },
}));

afterEach(() => {
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
    it("Works", () => {
      const cors = corsHelper();
      expect(cors).toBeDefined();
      expect(cors).toBeFunction();
    });
    it("Is Mocked", () => {
      const cors = corsHelper();
      expect(cors.options).toBeDefined();
      expect(cors.options).toBeObject();
    });
  });

  describe("Security", () => {
    it("allows requests with no origin", () => {
      delete process.env.BASE_URL;
      delete process.env.PROJECT_BASE_URL;
      const cors = corsHelper();
      const callback = vi.fn();
      cors.options.origin(null, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("allows BASE_URL origin", () => {
      process.env.BASE_URL = "example.com";
      delete process.env.PROJECT_BASE_URL;
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("https://example.com", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("allows PROJECT_BASE_URL origin", () => {
      delete process.env.BASE_URL;
      process.env.PROJECT_BASE_URL = "project.com";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("https://project.com", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("allows localhost", () => {
      process.env.PROJECT_ENV = "sandbox";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("http://localhost", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("allows localhost with port", () => {
      process.env.PROJECT_ENV = "sandbox";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("http://localhost:3000", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("blocks unauthorized origins", () => {
      delete process.env.BASE_URL;
      process.env.PROJECT_BASE_URL = "project.com";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("https://malicious.com", callback);
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });

    it("allows BASE_URL origin with http protocol", () => {
      process.env.BASE_URL = "http://example.com";
      delete process.env.PROJECT_BASE_URL;
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("http://example.com", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("allows BASE_URL origin with https protocol", () => {
      process.env.BASE_URL = "https://example.com";
      delete process.env.PROJECT_BASE_URL;
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("https://example.com", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("adds https protocol to BASE_URL if missing", () => {
      process.env.BASE_URL = "example.com";
      delete process.env.PROJECT_BASE_URL;
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("https://example.com", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("allows localhost only in sandbox environment", () => {
      process.env.PROJECT_ENV = "sandbox";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("http://localhost", callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("blocks localhost in non-sandbox environment", () => {
      process.env.PROJECT_ENV = "production";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("http://localhost", callback);
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });

    it("blocks localhost with port in non-sandbox environment", () => {
      process.env.PROJECT_ENV = "production";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("http://localhost:3000", callback);
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });
  });
  describe("Edge Cases", () => {
    it("Protects against similar origins", () => {
      delete process.env.BASE_URL;
      process.env.PROJECT_BASE_URL = "project.com";
      const middleware = corsHelper();
      const callback = vi.fn();
      middleware.options.origin("https://myproject.com", callback);
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
