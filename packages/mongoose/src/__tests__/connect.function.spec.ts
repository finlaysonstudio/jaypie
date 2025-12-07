import { afterEach, describe, expect, it, vi, Mock } from "vitest";

import mongoose from "mongoose";
import connectFromSecretEnv from "../connectFromSecretEnv.function.js";

// Subject
import connect from "../connect.function.js";

//
//
// Mock modules
//

vi.mock("mongoose");
vi.mock("../connectFromSecretEnv.function.js");

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Connect Function", () => {
  it("Works", async () => {
    (connectFromSecretEnv as Mock).mockResolvedValue("MOCK_CONNECTION");
    process.env.SECRET_MONGODB_URI = "MOCK_SECRET_MONGODB_URI";
    const response = await connect();
    expect(response).not.toBeUndefined();
    expect(response).toBe("MOCK_CONNECTION");
  });
  describe("Error Conditions", () => {
    it("Throws if no SECRET_MONGODB_URI or MONGODB_URI", async () => {
      delete process.env.SECRET_MONGODB_URI;
      delete process.env.MONGODB_URI;
      try {
        await connect();
      } catch (error) {
        expect(
          (error as { isProjectError: boolean }).isProjectError,
        ).toBeTrue();
      }
      expect.assertions(1);
    });
  });
  describe("Features", () => {
    it("Falls back on MONGODB_URI", async () => {
      (mongoose.connect as Mock).mockResolvedValue("MOCK_CONNECTION");
      delete process.env.SECRET_MONGODB_URI;
      process.env.MONGODB_URI = "MOCK_MONGODB_URI";
      const response = await connect();
      expect(response).not.toBeUndefined();
      expect(response).toBe("MOCK_CONNECTION");
    });
  });
});
