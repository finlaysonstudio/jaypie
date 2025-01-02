import { beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import corsHelper from "../cors.helper.js";

//
//
// Mock modules
//

vi.mock("cors", () => ({
  default: (options) => {
    return (req, res, next) => next();
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
      cors(null, null, callback);
      expect(callback).toHaveBeenCalled();
    });
  });
});
