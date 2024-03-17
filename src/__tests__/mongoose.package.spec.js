import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Subject
// * Subject is imported dynamically to allow `vi.resetModules()` to apply different mocks

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
  let connectFromSecretEnv;
  let disconnect;
  beforeAll(async () => {
    const {
      connectFromSecretEnv: _connectFromSecretEnv,
      disconnect: _disconnect,
    } = await import("../mongoose.package.js");
    connectFromSecretEnv = _connectFromSecretEnv;
    disconnect = _disconnect;
  });
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
  describe("Features", () => {
    const mockConnectFromSecretEnv = vi.fn();
    const mockDisconnect = vi.fn();
    beforeAll(async () => {
      // Setup mock of mongoose
      vi.doMock("@jaypie/mongoose", () => {
        return {
          connectFromSecretEnv: mockConnectFromSecretEnv,
          disconnect: mockDisconnect,
          mongoose: {
            disconnect: mockDisconnect,
          },
        };
      });
      // Preprocess
      vi.resetModules();
      const {
        connectFromSecretEnv: _connectFromSecretEnv,
        disconnect: _disconnect,
      } = await import("../mongoose.package.js");
      // Return
      connectFromSecretEnv = _connectFromSecretEnv;
      disconnect = _disconnect;
    });
    it("Calls @jaypie/mongoose for connectFromSecretEnv", async () => {
      await connectFromSecretEnv();
      expect(mockConnectFromSecretEnv).toHaveBeenCalled();
    });
    it("Calls @jaypie/mongoose for disconnect", async () => {
      await disconnect();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
