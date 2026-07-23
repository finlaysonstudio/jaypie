import { getEnvSecret } from "@jaypie/aws";
import { log } from "@jaypie/logger";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleClient } from "../client.js";
import { initializeClient } from "../utils.js";

vi.mock("@jaypie/aws", () => ({
  getEnvSecret: vi.fn(),
}));

vi.mock("@jaypie/errors", () => ({
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConfigurationError";
    }
  },
}));

vi.mock("@jaypie/kit", () => ({
  placeholders: vi.fn((text) => text),
  JAYPIE: {
    LIB: {
      LLM: "llm",
    },
  },
}));

vi.mock("@jaypie/logger", () => {
  const mockLogger = {
    trace: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    var: vi.fn(),
  };

  return {
    createLogger: vi.fn().mockReturnValue(mockLogger),
    log: {
      lib: vi.fn().mockReturnValue(mockLogger),
    },
  };
});

vi.mock("../client.js", () => ({
  GoogleClient: vi.fn().mockImplementation(() => ({})),
}));

describe("Google Utils initializeClient key resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(log.lib).mockReturnValue({
      trace: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      var: vi.fn(),
    } as any);
  });

  it("resolves GOOGLE_API_KEY first and does not consult GEMINI_API_KEY", async () => {
    vi.mocked(getEnvSecret).mockImplementation(async (name: string) =>
      name === "GOOGLE_API_KEY" ? "google-key" : undefined,
    );

    await initializeClient();

    expect(getEnvSecret).toHaveBeenCalledWith("GOOGLE_API_KEY");
    expect(getEnvSecret).not.toHaveBeenCalledWith("GEMINI_API_KEY");
    expect(GoogleClient).toHaveBeenCalledWith({ apiKey: "google-key" });
  });

  it("falls back to GEMINI_API_KEY with a deprecation warning", async () => {
    const mockLogger = {
      trace: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      var: vi.fn(),
    };
    vi.mocked(log.lib).mockReturnValue(mockLogger as any);
    vi.mocked(getEnvSecret).mockImplementation(async (name: string) =>
      name === "GEMINI_API_KEY" ? "gemini-key" : undefined,
    );

    await initializeClient();

    expect(getEnvSecret).toHaveBeenCalledWith("GOOGLE_API_KEY");
    expect(getEnvSecret).toHaveBeenCalledWith("GEMINI_API_KEY");
    expect(GoogleClient).toHaveBeenCalledWith({ apiKey: "gemini-key" });
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("prefers the apiKey option over any env secret", async () => {
    vi.mocked(getEnvSecret).mockResolvedValue("env-key");

    await initializeClient({ apiKey: "provided-key" });

    expect(getEnvSecret).not.toHaveBeenCalled();
    expect(GoogleClient).toHaveBeenCalledWith({ apiKey: "provided-key" });
  });

  it("throws ConfigurationError when no key resolves", async () => {
    vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);

    await expect(initializeClient()).rejects.toThrow(
      "The application could not resolve the requested keys",
    );
  });
});
