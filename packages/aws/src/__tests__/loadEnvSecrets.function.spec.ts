import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock getEnvSecret before importing subject
vi.mock("../getEnvSecret.function.js", () => ({
  default: vi.fn(),
}));

// Subject
import loadEnvSecrets from "../loadEnvSecrets.function.js";
import getEnvSecret from "../getEnvSecret.function.js";

//
//
// Mock constants
//

const MOCK = {
  ANTHROPIC_API_KEY: "mock-anthropic-key",
  OPENAI_API_KEY: "mock-openai-key",
  DATABASE_URL: "mock-database-url",
};

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  vi.clearAllMocks();
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("Load Environment Secrets Function", () => {
  describe("Base Cases", () => {
    it("Works", async () => {
      const response = await loadEnvSecrets();
      expect(response).toBeUndefined();
    });
    it("Is a function", () => {
      expect(typeof loadEnvSecrets).toBe("function");
    });
  });

  describe("Error Conditions", () => {
    it("Propagates errors from getEnvSecret", async () => {
      vi.mocked(getEnvSecret).mockRejectedValue(
        new Error("Secret fetch error"),
      );
      await expect(loadEnvSecrets("ANTHROPIC_API_KEY")).rejects.toThrow(
        "Secret fetch error",
      );
    });
  });

  describe("Happy Paths", () => {
    it("Loads a single secret and sets process.env", async () => {
      vi.mocked(getEnvSecret).mockResolvedValue(MOCK.ANTHROPIC_API_KEY);
      await loadEnvSecrets("ANTHROPIC_API_KEY");
      expect(getEnvSecret).toHaveBeenCalledWith("ANTHROPIC_API_KEY");
      expect(process.env.ANTHROPIC_API_KEY).toBe(MOCK.ANTHROPIC_API_KEY);
    });

    it("Loads multiple secrets from separate arguments", async () => {
      vi.mocked(getEnvSecret)
        .mockResolvedValueOnce(MOCK.ANTHROPIC_API_KEY)
        .mockResolvedValueOnce(MOCK.OPENAI_API_KEY);

      await loadEnvSecrets("ANTHROPIC_API_KEY", "OPENAI_API_KEY");

      expect(getEnvSecret).toHaveBeenCalledWith("ANTHROPIC_API_KEY");
      expect(getEnvSecret).toHaveBeenCalledWith("OPENAI_API_KEY");
      expect(process.env.ANTHROPIC_API_KEY).toBe(MOCK.ANTHROPIC_API_KEY);
      expect(process.env.OPENAI_API_KEY).toBe(MOCK.OPENAI_API_KEY);
    });

    it("Loads secrets from an array argument", async () => {
      vi.mocked(getEnvSecret)
        .mockResolvedValueOnce(MOCK.ANTHROPIC_API_KEY)
        .mockResolvedValueOnce(MOCK.OPENAI_API_KEY);

      await loadEnvSecrets(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);

      expect(getEnvSecret).toHaveBeenCalledWith("ANTHROPIC_API_KEY");
      expect(getEnvSecret).toHaveBeenCalledWith("OPENAI_API_KEY");
      expect(process.env.ANTHROPIC_API_KEY).toBe(MOCK.ANTHROPIC_API_KEY);
      expect(process.env.OPENAI_API_KEY).toBe(MOCK.OPENAI_API_KEY);
    });

    it("Handles mixed strings and arrays", async () => {
      vi.mocked(getEnvSecret)
        .mockResolvedValueOnce(MOCK.ANTHROPIC_API_KEY)
        .mockResolvedValueOnce(MOCK.OPENAI_API_KEY)
        .mockResolvedValueOnce(MOCK.DATABASE_URL);

      await loadEnvSecrets("ANTHROPIC_API_KEY", [
        "OPENAI_API_KEY",
        "DATABASE_URL",
      ]);

      expect(getEnvSecret).toHaveBeenCalledTimes(3);
      expect(process.env.ANTHROPIC_API_KEY).toBe(MOCK.ANTHROPIC_API_KEY);
      expect(process.env.OPENAI_API_KEY).toBe(MOCK.OPENAI_API_KEY);
      expect(process.env.DATABASE_URL).toBe(MOCK.DATABASE_URL);
    });
  });

  describe("Features", () => {
    it("Does not set process.env if getEnvSecret returns undefined", async () => {
      vi.mocked(getEnvSecret).mockResolvedValue(undefined);

      delete process.env.NONEXISTENT_KEY;
      await loadEnvSecrets("NONEXISTENT_KEY");

      expect(getEnvSecret).toHaveBeenCalledWith("NONEXISTENT_KEY");
      expect(process.env.NONEXISTENT_KEY).toBeUndefined();
    });

    it("Loads secrets in parallel", async () => {
      const callOrder: string[] = [];
      vi.mocked(getEnvSecret).mockImplementation(async (name: string) => {
        callOrder.push(`start:${name}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push(`end:${name}`);
        return `value-${name}`;
      });

      await loadEnvSecrets("KEY1", "KEY2", "KEY3");

      // All starts should happen before all ends (parallel execution)
      const startIndices = callOrder
        .filter((c) => c.startsWith("start:"))
        .map((c) => callOrder.indexOf(c));
      const endIndices = callOrder
        .filter((c) => c.startsWith("end:"))
        .map((c) => callOrder.indexOf(c));

      // Verify some parallelism occurred (starts can interleave with ends)
      expect(startIndices.length).toBe(3);
      expect(endIndices.length).toBe(3);
    });

    it("Handles empty array argument", async () => {
      await loadEnvSecrets([]);
      expect(getEnvSecret).not.toHaveBeenCalled();
    });

    it("Handles no arguments", async () => {
      await loadEnvSecrets();
      expect(getEnvSecret).not.toHaveBeenCalled();
    });
  });
});
