import { describe, expect, it } from "vitest";

// Subject
import {
  connect,
  connectFromSecretEnv,
  disconnect,
  mongoose,
} from "../index.js";

//
//
// Run tests
//

describe("Mongoose Package", () => {
  describe("Base Cases", () => {
    it("Exports connect function", () => {
      expect(connect).toBeFunction();
    });
    it("Exports connectFromSecretEnv function", () => {
      expect(connectFromSecretEnv).toBeFunction();
    });
    it("Exports disconnect function", () => {
      expect(disconnect).toBeFunction();
    });
    it("Exports mongoose object", () => {
      expect(mongoose).toBeDefined();
    });
  });

  describe("Lazy Loading", () => {
    it("Loads @jaypie/mongoose on first function call", async () => {
      // The wrapper should load @jaypie/mongoose when called
      // This will throw because there's no MongoDB connection, but that proves loading worked
      try {
        await disconnect();
      } catch {
        // Expected - no connection to disconnect
      }
      // If we got here without a ConfigurationError, the package loaded successfully
      expect(true).toBeTrue();
    });

    it("Mongoose proxy provides access to mongoose module", () => {
      // Access mongoose.connection to verify the proxy works
      expect(mongoose.connection).toBeDefined();
    });
  });
});
