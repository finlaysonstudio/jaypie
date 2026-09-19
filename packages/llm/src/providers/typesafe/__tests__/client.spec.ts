import { afterEach, describe, expect, it, vi } from "vitest";

import { PROVIDER } from "../../../constants.js";
import {
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../../errors/LlmError.js";
import { TypeSafeClient } from "../client.js";

function mockFetch({
  body,
  headers = {},
  ok = true,
  status = 200,
}: {
  body: unknown;
  headers?: Record<string, string>;
  ok?: boolean;
  status?: number;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    headers: new Headers(headers),
    json: async () => body,
    ok,
    status,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("TypeSafeClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Works", () => {
    expect(TypeSafeClient).toBeFunction();
    expect(new TypeSafeClient({ apiKey: "_MOCK_KEY" })).toBeInstanceOf(
      TypeSafeClient,
    );
  });

  describe("Happy Paths", () => {
    it("Lists models from the models route", async () => {
      const fetchMock = mockFetch({ body: { models: [] } });
      await new TypeSafeClient({ apiKey: "_MOCK_KEY" }).listModels();
      expect(fetchMock.mock.calls[0][0]).toBe(
        `${PROVIDER.TYPESAFE.BASE_URL}/models`,
      );
      expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    });
  });

  describe("Error Conditions", () => {
    it("Maps 401 to unrecoverable", async () => {
      mockFetch({ body: { message: "bad key" }, ok: false, status: 401 });
      await expect(
        new TypeSafeClient({ apiKey: "_MOCK_KEY" }).listModels(),
      ).rejects.toThrow(LlmUnrecoverableError);
    });

    it("Maps 429 to a rate limit and reads retry-after seconds", async () => {
      mockFetch({
        body: { message: "slow down" },
        headers: { "retry-after": "30" },
        ok: false,
        status: 429,
      });
      await expect(
        new TypeSafeClient({ apiKey: "_MOCK_KEY" }).listModels(),
      ).rejects.toMatchObject({
        name: "LlmRateLimitError",
        retryAfterMs: 30000,
      });
    });

    it("Maps 529 to a rate limit", async () => {
      mockFetch({ body: { message: "overloaded" }, ok: false, status: 529 });
      await expect(
        new TypeSafeClient({ apiKey: "_MOCK_KEY" }).listModels(),
      ).rejects.toThrow(LlmRateLimitError);
    });

    it("Maps 500 to transient", async () => {
      mockFetch({ body: { message: "boom" }, ok: false, status: 500 });
      await expect(
        new TypeSafeClient({ apiKey: "_MOCK_KEY" }).listModels(),
      ).rejects.toThrow(LlmTransientError);
    });

    it("Surfaces a non-JSON body as the detail", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        headers: new Headers(),
        json: async () => ({}),
        ok: false,
        status: 400,
        text: async () => "upstream exploded",
      });
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        new TypeSafeClient({ apiKey: "_MOCK_KEY" }).listModels(),
      ).rejects.toThrow("upstream exploded");
    });
  });
});
