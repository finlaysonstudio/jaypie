import { describe, expect, it } from "vitest";

import { COST, MODEL } from "../../constants.js";
import { tokenCost } from "../tokenCost.js";

const HAIKU = COST[MODEL.HAIKU];

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
          output: 0,
          reasoning: 1_000_000,
          total: 1_000_000,
        },
      ]);
      expect(cost).toBeCloseTo(HAIKU.output, 6);
    });

    it("Prices cache reads and five-minute cache writes", () => {
      const cost = tokenCost([
        {
          cacheRead: 1_000_000,
          cacheWrite: 1_000_000,
          input: 0,
          model: MODEL.HAIKU,
          output: 0,
          reasoning: 0,
          total: 0,
        },
      ]);
      const write = HAIKU.cachedInputWrite as { "5m": number };
      expect(cost).toBeCloseTo(
        (HAIKU.cachedInputRead as number) + write["5m"],
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
