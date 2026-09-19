import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROVIDER } from "../../../constants.js";
import {
  LlmRateLimitError,
  LlmUnrecoverableError,
} from "../../../errors/LlmError.js";
import { LlmQuestions } from "../../../types/LlmQuestion.interface.js";
import { TypeSafeProvider } from "../TypeSafeProvider.class.js";

vi.mock("@jaypie/aws", () => ({
  getEnvSecret: vi.fn().mockResolvedValue("_MOCK_TYPESAFE_KEY"),
}));

const QUESTIONS: LlmQuestions = {
  urgent: { instructions: "Is this urgent?", type: "noul" },
};

const BODY = {
  answers: { urgent: { noul: 0.9, type: "noul" } },
  model: "jev-1.13.0",
  usage: { input_tokens: 40, output_tokens: 6 },
};

function mockFetch(
  response: Partial<{
    body: unknown;
    headers: Record<string, string>;
    ok: boolean;
    status: number;
  }> = {},
) {
  const { body = BODY, headers = {}, ok = true, status = 200 } = response;
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

describe("TypeSafeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Works", () => {
    expect(TypeSafeProvider).toBeClass();
    expect(new TypeSafeProvider()).toBeInstanceOf(TypeSafeProvider);
  });

  describe("Happy Paths", () => {
    it("Posts model, state, and questions to the System One route", async () => {
      const fetchMock = mockFetch();
      await new TypeSafeProvider().question("Charged twice", {
        questions: QUESTIONS,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${PROVIDER.TYPESAFE.BASE_URL}/systemone`);
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer _MOCK_TYPESAFE_KEY");
      expect(JSON.parse(init.body)).toEqual({
        model: PROVIDER.TYPESAFE.DEFAULT,
        questions: QUESTIONS,
        state: "Charged twice",
      });
    });

    it("Returns the answers verbatim and marks the answer native", async () => {
      mockFetch();
      const response = await new TypeSafeProvider().question("Charged twice", {
        questions: QUESTIONS,
      });
      expect(response.answers).toEqual(BODY.answers);
      expect(response.emulated).toBe(false);
      expect(response.provider).toBe(PROVIDER.TYPESAFE.NAME);
    });

    it("Reports usage against the versioned model the API echoes", async () => {
      mockFetch();
      const response = await new TypeSafeProvider("jev-latest").question(
        "Charged twice",
        { questions: QUESTIONS },
      );
      expect(response.model).toBe("jev-1.13.0");
      expect(response.usage).toEqual([
        {
          input: 40,
          model: "jev-1.13.0",
          output: 6,
          provider: PROVIDER.TYPESAFE.NAME,
          reasoning: 0,
          total: 46,
        },
      ]);
    });
  });

  describe("Features", () => {
    it("Prefers a per-call model over the constructed one", async () => {
      const fetchMock = mockFetch();
      await new TypeSafeProvider().question("Charged twice", {
        model: "jev-preview",
        questions: QUESTIONS,
      });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(
        "jev-preview",
      );
    });
  });

  describe("Error Conditions", () => {
    it("Does not implement send", async () => {
      await expect(new TypeSafeProvider().send()).rejects.toThrow(
        "answers questions only",
      );
    });

    it("Raises an unrecoverable error on an invalid key", async () => {
      mockFetch({ body: { message: "Invalid key" }, ok: false, status: 401 });
      await expect(
        new TypeSafeProvider().question("state", { questions: QUESTIONS }),
      ).rejects.toThrow(LlmUnrecoverableError);
    });

    it("Names the failing field on a validation error", async () => {
      mockFetch({
        body: { detail: "questions.urgent: unknown type" },
        ok: false,
        status: 422,
      });
      await expect(
        new TypeSafeProvider().question("state", { questions: QUESTIONS }),
      ).rejects.toThrow("questions.urgent: unknown type");
    });

    it("Raises a rate limit error that carries retry-after", async () => {
      mockFetch({
        body: { message: "slow down" },
        headers: { "retry-after": "12" },
        ok: false,
        status: 429,
      });
      await expect(
        new TypeSafeProvider().question("state", {
          questions: QUESTIONS,
          retry: { rateLimit: false },
        }),
      ).rejects.toMatchObject({ retryAfterMs: 12000 });
    });

    it("Treats 529 overloaded as a rate limit", async () => {
      mockFetch({ body: { message: "overloaded" }, ok: false, status: 529 });
      await expect(
        new TypeSafeProvider().question("state", {
          questions: QUESTIONS,
          retry: { rateLimit: false },
        }),
      ).rejects.toThrow(LlmRateLimitError);
    });

    it("Retries a transient failure and answers on the retry", async () => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          headers: new Headers(),
          json: async () => ({ message: "boom" }),
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ message: "boom" }),
        })
        .mockResolvedValue({
          headers: new Headers(),
          json: async () => BODY,
          ok: true,
          status: 200,
          text: async () => JSON.stringify(BODY),
        });
      vi.stubGlobal("fetch", fetchMock);
      const pending = new TypeSafeProvider().question("state", {
        questions: QUESTIONS,
      });
      await vi.advanceTimersByTimeAsync(2000);
      await expect(pending).resolves.toMatchObject({ emulated: false });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });
});
