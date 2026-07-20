import { beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "@jaypie/logger";

import { storeExchange } from "../storeExchange.js";
import { isInitialized } from "../client.js";
import { createEntity } from "../entities.js";

vi.mock("../client.js", () => ({
  isInitialized: vi.fn(() => true),
}));

vi.mock("../entities.js", () => ({
  createEntity: vi.fn(async ({ entity }) => entity),
}));

vi.mock("@jaypie/logger", () => {
  const log = {
    var: vi.fn(),
    warn: vi.fn(),
  };
  return { default: log, log };
});

const envelope = () => ({
  ids: ["resp_1", "resp_2"],
  request: {
    data: { user: "Taylor" },
    input: "Hello",
    model: "mock-model",
  },
  resolution: {
    fallbackAttempts: 1,
    fallbackUsed: false,
    model: "mock-model",
    provider: "mock",
    retries: 0,
  },
  response: {
    content: "Hi!",
    historyDelta: [{ content: "Hi!", role: "assistant" }],
    reasoning: [],
    status: "completed",
    stopReason: "end_turn",
    usage: [],
    usageTotals: { "mock:mock-model": { input: 1, output: 2 } },
  },
  timing: { duration: 42, startedAt: "2026-01-01T00:00:00.000Z" },
});

describe("storeExchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isInitialized).mockReturnValue(true);
    vi.mocked(createEntity).mockImplementation(
      async ({ entity }) => entity as never,
    );
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof storeExchange).toBe("function");
    });
  });

  describe("Error Conditions", () => {
    it("warns and returns null when client is not initialized", async () => {
      vi.mocked(isInitialized).mockReturnValue(false);
      const result = await storeExchange(envelope());
      expect(result).toBeNull();
      expect(createEntity).not.toHaveBeenCalled();
      // #429 regression: the named logger import must resolve so warn does not
      // throw on the uninitialized path.
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("not initialized"),
      );
    });

    it("returns null instead of throwing when the write fails", async () => {
      vi.mocked(createEntity).mockRejectedValue(new Error("Dynamo down"));
      await expect(storeExchange(envelope())).resolves.toBeNull();
    });
  });

  describe("Features", () => {
    it("maps the envelope onto an exchange entity", async () => {
      const result = await storeExchange(envelope());
      expect(result).toMatchObject({
        content: "Hi!",
        data: { user: "Taylor" },
        input: "Hello",
        llm: "mock-model",
        model: "exchange",
        scope: "@",
        status: "completed",
        xid: "resp_2",
      });
      expect(result!.metadata).toMatchObject({
        duration: 42,
        fallbackAttempts: 1,
        fallbackUsed: false,
        provider: "mock",
        retries: 0,
        startedAt: "2026-01-01T00:00:00.000Z",
        stopReason: "end_turn",
      });
      expect(
        (result!.state as Record<string, unknown>).historyDelta,
      ).toHaveLength(1);
    });

    it("serializes structured content", async () => {
      const structured = envelope();
      structured.response.content = { answer: 42 } as never;
      const result = await storeExchange(structured);
      expect(result!.content).toBe('{"answer":42}');
    });

    it("accepts scope and parent exchange options", async () => {
      const result = await storeExchange(envelope(), {
        exchange: "parent-id",
        scope: "case#abc",
      });
      expect(result!.scope).toBe("case#abc");
      expect(result!.exchange).toBe("parent-id");
    });

    it("truncates oversized items and marks metadata", async () => {
      const big = envelope();
      big.response.historyDelta = [
        { content: "x".repeat(200 * 1024), role: "assistant" },
      ];
      big.request.input = "y".repeat(200 * 1024);
      big.response.content = "z".repeat(400 * 1024);
      const result = await storeExchange(big);
      const metadata = result!.metadata as Record<string, unknown>;
      expect(metadata.truncated).toContain("historyDelta");
      expect(
        (result!.state as Record<string, unknown>).historyDelta,
      ).toBeUndefined();
      expect((result!.content as string).endsWith("[truncated]")).toBe(true);
    });
  });
});
