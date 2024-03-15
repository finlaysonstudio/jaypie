import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Subject
import { connectFromSecretEnv, disconnect } from "../mongoose.package.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Mongoose Package", () => {
  it("Works", () => {
    expect(connectFromSecretEnv).toBeFunction();
    expect(disconnect).toBeFunction();
  });
  describe("Error Handling", () => {
    it("Throws a configuration error if Mongoose is not installed", async () => {
      try {
        await connectFromSecretEnv();
      } catch (error) {
        expect(error.isProjectError).toBeTrue();
      }
      expect.assertions(1);
    });
  });
});
