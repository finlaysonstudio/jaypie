import { describe, it, expect, vi, beforeEach } from "vitest";
import { mongoose as expectedMongoose } from "@jaypie/mongoose";
import {
  connect,
  connectFromSecretEnv,
  disconnect,
  mongoose,
} from "../mongoose";

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

describe("Jaypie Mongoose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("Mocks expected function", () => {
    expect(connect).not.toHaveBeenCalled();
    expect(connectFromSecretEnv).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
  it("Mocks return appropriate values", () => {
    expect(connect()).toBeTrue();
    expect(connectFromSecretEnv()).toBeTrue();
    expect(disconnect()).toBeTrue();
  });
  it("Mongoose is unaltered (for now)", () => {
    expect(mongoose).toBe(expectedMongoose);
  });
  it.todo("Mocks mongoose", () => {
    expect(vi.isMockFunction(mongoose)).toBeTrue();
    expect(vi.isMockFunction(mongoose.connect)).toBeTrue();
  });
});
