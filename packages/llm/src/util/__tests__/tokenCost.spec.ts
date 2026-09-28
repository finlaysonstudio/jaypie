import { describe, expect, it } from "vitest";

import { COST, MODEL } from "../../constants.js";
import { tokenCost } from "../tokenCost.js";

const HAIKU = COST[MODEL.HAIKU];
const WRITE = HAIKU.cachedInputWrite as { "1h": number; "5m": number };

describe("tokenCost", () => {
  it("Works", () => {
    expect(tokenCost).toBeFunction();
  });

  describe("Happy Paths", () => {
    it("Prices input and output at the per-million rate", () => {
      const cost = tokenCost([
        {
          input: 1_000_000,
          model: MODEL.HAIKU,
          output: 1_000_000,
          reasoning: 0,
          total: 2_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(HAIKU.input + HAIKU.output, 6);
    });

    it("Sums across items", () => {
      const item = {
        input: 500_000,
        model: MODEL.HAIKU,
        output: 0,
        reasoning: 0,
        total: 500_000,
      };
      expect(tokenCost([item, item])).toBeCloseTo(HAIKU.input, 6);
    });

    it("Bills reasoning as output when no reasoning rate is listed", () => {
      const cost = tokenCost([
        {
          input: 0,
          model: MODEL.HAIKU,
          output: 1_000_000,
          reasoning: 1_000_000,
          total: 1_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(HAIKU.output, 6);
    });

    it("Bills reasoning once because output includes it", () => {
      const cost = tokenCost([
        {
          input: 0,
          model: MODEL.HAIKU,
          output: 1_000_000,
          reasoning: 250_000,
          total: 1_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(HAIKU.output, 6);
    });

    it("Prices cache reads and unsplit cache writes at the one-hour default", () => {
      const cost = tokenCost([
        {
          cacheRead: 1_000_000,
          cacheWrite: 1_000_000,
          input: 2_000_000,
          model: MODEL.HAIKU,
          output: 0,
          reasoning: 0,
          total: 2_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(
        (HAIKU.cachedInputRead as number) + WRITE["1h"],
        6,
      );
    });

    it("Bills cached input once because input includes it", () => {
      const cost = tokenCost([
        {
          cacheRead: 250_000,
          input: 1_000_000,
          model: MODEL.HAIKU,
          output: 0,
          reasoning: 0,
          total: 1_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(
        0.75 * HAIKU.input + 0.25 * (HAIKU.cachedInputRead as number),
        6,
      );
    });
  });

  describe("Features", () => {
    it("Prices an item by the fallback model when its own id is unpriced", () => {
      const cost = tokenCost(
        [
          {
            input: 1_000_000,
            model: "claude-haiku-4-5-20251001",
            output: 0,
            reasoning: 0,
            total: 1_000_000,
          },
        ],
        { model: MODEL.HAIKU },
      );
      expect(cost).toBeCloseTo(HAIKU.input, 6);
    });

    it("Prefers an item's own priced id over the fallback", () => {
      const cost = tokenCost(
        [
          {
            input: 1_000_000,
            model: MODEL.HAIKU,
            output: 0,
            reasoning: 0,
            total: 1_000_000,
          },
        ],
        { model: MODEL.LUNA },
      );
      expect(cost).toBeCloseTo(HAIKU.input, 6);
    });

    it("Prices writes split by TTL at each TTL's rate", () => {
      const cost = tokenCost([
        {
          cacheWrite: 1_000_000,
          cacheWriteTtl: { "1h": 250_000, "5m": 750_000 },
          input: 1_000_000,
          model: MODEL.HAIKU,
          output: 0,
          reasoning: 0,
          total: 1_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(0.25 * WRITE["1h"] + 0.75 * WRITE["5m"], 6);
    });

    it("Prices the unsplit remainder at the requested TTL", () => {
      const cost = tokenCost(
        [
          {
            cacheWrite: 1_000_000,
            cacheWriteTtl: { "1h": 500_000 },
            input: 1_000_000,
            model: MODEL.HAIKU,
            output: 0,
            reasoning: 0,
            total: 1_000_000,
          },
        ],
        { ttl: "5m" },
      );
      expect(cost).toBeCloseTo(0.5 * WRITE["1h"] + 0.5 * WRITE["5m"], 6);
    });

    it("Ignores TTL for scalar write rates", () => {
      const nova = COST[MODEL.NOVA_PRO];
      const item = {
        cacheWrite: 1_000_000,
        input: 1_000_000,
        model: MODEL.NOVA_PRO,
        output: 0,
        reasoning: 0,
        total: 1_000_000,
      };
      expect(tokenCost([item], { ttl: "5m" })).toBeCloseTo(
        tokenCost([item], { ttl: "1h" }) as number,
        9,
      );
      expect(typeof nova.cachedInputWrite).toBe("number");
    });

    it("Is undefined for an empty list", () => {
      expect(tokenCost([])).toBeUndefined();
    });

    it("Is undefined when any item names an unpriced model", () => {
      expect(
        tokenCost([
          { input: 1, model: "not-a-model", output: 1, reasoning: 0, total: 2 },
        ]),
      ).toBeUndefined();
      expect(
        tokenCost([{ input: 1, output: 1, reasoning: 0, total: 2 }]),
      ).toBeUndefined();
    });
  });
});
