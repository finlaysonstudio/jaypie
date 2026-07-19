import { beforeEach, describe, expect, it } from "vitest";

import {
  assertModelStatus,
  clearRegistry,
  getModelIndexes,
  getModelStatus,
  isModelRegistered,
} from "../index/registry.js";
import {
  EXCHANGE_MODEL,
  EXCHANGE_MODEL_NAME,
  EXCHANGE_STATUS,
  registerExchangeModel,
} from "../models/exchange.js";

describe("Exchange Model", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("Base Cases", () => {
    it("registerExchangeModel is a function", () => {
      expect(typeof registerExchangeModel).toBe("function");
    });
    it("EXCHANGE_MODEL declares the exchange model", () => {
      expect(EXCHANGE_MODEL.model).toBe(EXCHANGE_MODEL_NAME);
      expect(EXCHANGE_MODEL_NAME).toBe("exchange");
    });
  });

  describe("Features", () => {
    it("registers the exchange model with indexModel and indexModelXid", () => {
      registerExchangeModel();
      expect(isModelRegistered("exchange")).toBe(true);
      const indexes = getModelIndexes("exchange");
      expect(indexes.map(({ name }) => name)).toEqual([
        "indexModel",
        "indexModelXid",
      ]);
    });

    it("declares the operate settlement status vocabulary", () => {
      registerExchangeModel();
      expect(getModelStatus("exchange")).toEqual([
        EXCHANGE_STATUS.COMPLETED,
        EXCHANGE_STATUS.INCOMPLETE,
        EXCHANGE_STATUS.IN_PROGRESS,
      ]);
      expect(() => assertModelStatus("exchange", "completed")).not.toThrow();
      expect(() => assertModelStatus("exchange", "banana")).toThrow();
    });

    it("is idempotent", () => {
      registerExchangeModel();
      expect(() => registerExchangeModel()).not.toThrow();
      expect(isModelRegistered("exchange")).toBe(true);
    });
  });
});
