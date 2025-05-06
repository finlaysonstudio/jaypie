import { describe, it, expect, vi, beforeEach } from "vitest";
import { Llm, toolkit, tools } from "../llm";

describe("LLM Mocks", () => {
  // 1. Base Cases
  describe("Base Cases", () => {
    it("Llm is a class", () => {
      expect(Llm).toBeClass();
    });

    it("getInstance returns a singleton instance", () => {
      const instance1 = Llm.getInstance();
      const instance2 = Llm.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("toolkit contains expected tools", () => {
      expect(toolkit).toHaveProperty("random");
      expect(toolkit).toHaveProperty("roll");
      expect(toolkit).toHaveProperty("time");
      expect(toolkit).toHaveProperty("weather");
    });

    it("tools is an array of the toolkit functions", () => {
      expect(tools).toEqual(Object.values(toolkit));
    });

    it("new instance initializes with empty history", () => {
      const llm = new Llm();
      expect(llm.history).toEqual([]);
    });
  });

  // 2. Error Conditions
  describe("Error Conditions", () => {
    it("handles empty messages in send", async () => {
      const llm = new Llm();
      const result = await llm.send([]);
      expect(result).toBe("_MOCK_LLM_RESPONSE_[LLM]");
      expect(llm.history).toEqual([]);
    });

    it("handles undefined options in static methods", async () => {
      const spy = vi.spyOn(Llm.getInstance(), "send");
      await Llm.send([{ role: "user", content: "Hello" }], undefined);
      expect(spy).toHaveBeenCalledWith(
        [{ role: "user", content: "Hello" }],
        {},
      );
    });
  });

  // 4. Observability
  describe("Observability", () => {
    it("instance tracks history of messages", async () => {
      const llm = new Llm();
      await llm.send([{ role: "user", content: "Hello" }]);
      expect(llm.history).toHaveLength(1);
      expect(llm.history[0]).toEqual({ role: "user", content: "Hello" });
    });

    it("instance tracks multiple messages", async () => {
      const llm = new Llm();
      await llm.send([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);
      expect(llm.history).toHaveLength(2);
    });
  });

  // 5. Happy Paths
  describe("Happy Paths", () => {
    let llm: Llm;

    beforeEach(() => {
      Llm.instance = undefined;
      llm = new Llm();
    });

    it("send returns a mock response", async () => {
      const response = await llm.send([{ role: "user", content: "Hello" }]);
      expect(response).toEqual("_MOCK_LLM_RESPONSE_[LLM]");
    });

    it("operate returns a mock result object", async () => {
      const result = await llm.operate("How's the weather?");
      expect(result).toEqual({
        result: "_MOCK_LLM_OPERATE_RESULT_[LLM]",
        raw: {},
      });
    });

    it("static send uses the singleton instance", async () => {
      const spy = vi.spyOn(Llm.getInstance(), "send");
      await Llm.send([{ role: "user", content: "Hello" }]);
      expect(spy).toHaveBeenCalledWith(
        [{ role: "user", content: "Hello" }],
        {},
      );
    });

    it("static operate uses the singleton instance", async () => {
      const spy = vi.spyOn(Llm.getInstance(), "operate");
      await Llm.operate("How's the weather?");
      expect(spy).toHaveBeenCalledWith("How's the weather?", {}, {});
    });

    it("send with options passes options through", async () => {
      const spy = vi.spyOn(Llm.getInstance(), "send");
      const options = { temperature: 0.7 };
      await Llm.send([{ role: "user", content: "Hello" }], options);
      expect(spy).toHaveBeenCalledWith(
        [{ role: "user", content: "Hello" }],
        options,
      );
    });
  });

  // 6. Features
  describe("Features", () => {
    it("operate adds to history", async () => {
      const llm = new Llm();
      await llm.operate("How's the weather?");
      expect(llm.history).toHaveLength(2);
      expect(llm.history[0]).toEqual({
        role: "user",
        content: "How's the weather?",
      });
      expect(llm.history[1]).toEqual({
        role: "assistant",
        content: "_MOCK_LLM_OPERATE_[LLM]",
      });
    });

    it("random tool returns a mocked value", () => {
      const result = toolkit.random();
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("roll tool returns a mocked value", () => {
      const result = toolkit.roll();
      expect(result).toBe(6);
    });

    it("time tool returns a mocked time string", () => {
      const result = toolkit.time();
      expect(result).toBe("_MOCK_TIME_[LLM]");
    });

    it("weather tool returns a mocked forecast", async () => {
      const result = await toolkit.weather({
        location: "San Francisco",
        days: 3,
      });
      expect(result).toEqual({
        location: "_MOCK_WEATHER_LOCATION_[LLM][San Francisco]",
        forecast: [
          {
            date: "2025-05-1",
            temperature: 72,
            condition: "Sunny",
            precipitation: 0,
          },
          {
            date: "2025-05-2",
            temperature: 72,
            condition: "Sunny",
            precipitation: 0,
          },
          {
            date: "2025-05-3",
            temperature: 72,
            condition: "Sunny",
            precipitation: 0,
          },
        ],
      });
    });

    it("weather tool defaults to 1 day when days not specified", async () => {
      const result = await toolkit.weather({ location: "Chicago" });
      expect(result.forecast).toHaveLength(1);
    });

    it("weather tool handles undefined options", async () => {
      const result = await toolkit.weather();
      expect(result.location).toBe("_MOCK_WEATHER_LOCATION_[LLM][undefined]");
      expect(result.forecast).toHaveLength(1);
    });
  });
});
