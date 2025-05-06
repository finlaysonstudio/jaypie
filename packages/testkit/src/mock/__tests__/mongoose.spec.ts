import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  connect,
  connectFromSecretEnv,
  disconnect,
  mongoose,
} from "../mongoose";

// Mock the @jaypie/mongoose module
vi.mock("@jaypie/mongoose", () => ({
  mongoose: {
    disconnect: vi.fn().mockResolvedValue(true),
    connection: {
      readyState: 1,
    },
  },
}));

describe("mock/mongoose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("exports expected functions", () => {
      expect(connect).toBeInstanceOf(Function);
      expect(connectFromSecretEnv).toBeInstanceOf(Function);
      expect(disconnect).toBeInstanceOf(Function);
      expect(mongoose).toBeDefined();
    });

    it("connect returns true", () => {
      expect(connect()).toBe(true);
    });

    it("connectFromSecretEnv returns true", () => {
      expect(connectFromSecretEnv()).toBe(true);
    });

    it("disconnect returns true", () => {
      expect(disconnect()).toBe(true);
    });

    it("mongoose is properly mocked", () => {
      expect(mongoose.connection).toBeDefined();
      expect(mongoose.connection.readyState).toBe(1);
    });
  });

  describe("Features", () => {
    it("connect tracks calls", () => {
      connect();
      connect("mongodb://test");

      expect(connect).toHaveBeenCalledTimes(2);
      expect(connect).toHaveBeenCalledWith();
      expect(connect).toHaveBeenCalledWith("mongodb://test");
    });

    it("connectFromSecretEnv tracks calls", () => {
      connectFromSecretEnv();
      connectFromSecretEnv({ secretEnv: "TEST" });

      expect(connectFromSecretEnv).toHaveBeenCalledTimes(2);
      expect(connectFromSecretEnv).toHaveBeenCalledWith();
      expect(connectFromSecretEnv).toHaveBeenCalledWith({ secretEnv: "TEST" });
    });

    it("disconnect tracks calls", () => {
      disconnect();

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalledWith();
    });
  });
});
