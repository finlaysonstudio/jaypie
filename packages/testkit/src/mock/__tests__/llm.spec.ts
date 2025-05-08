import { describe, it, expect, beforeEach } from "vitest";
import { Llm, toolkit, tools } from "../llm";

describe("LLM Mocks", () => {
  // Tests that Llm constructor is called
  it("calls Llm constructor when instantiated", () => {
    const llm = new Llm();
    expect(Llm).toHaveBeenCalled();
    expect(llm).not.toBeUndefined();
    expect(llm).toBeObject();
  });

  // 1. Base Cases
  describe("Base Cases", () => {
    it("Llm is a class", () => {
      expect(Llm).toBeClass();
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
  });

  // 2. Error Conditions
  describe("Error Conditions", () => {
    it("handles empty messages in send", async () => {
      const llm = new Llm();
      const result = await llm.send([]);
      expect(result).toBe("_MOCK_LLM_RESPONSE");
    });

    it("handles undefined options in static methods", async () => {
      await Llm.send([{ role: "user", content: "Hello" }], undefined);
      expect(Llm.send).toHaveBeenCalledWith(
        [{ role: "user", content: "Hello" }],
        undefined,
      );
    });
  });

  // 5. Happy Paths
  describe("Happy Paths", () => {
    let llm: any;

    beforeEach(() => {
      llm = new Llm();
    });

    it("send returns a mock response", async () => {
      const response = await llm.send([{ role: "user", content: "Hello" }]);
      expect(response).toEqual("_MOCK_LLM_RESPONSE");
    });

    it("operate returns a mock result object", async () => {
      const result = await llm.operate("How's the weather?");
      expect(result).toEqual({
        content: "_MOCK_OUTPUT_TEXT",
        history: expect.any(Array),
        output: expect.any(Array),
        responses: expect.any(Array),
        status: "completed",
        usage: expect.any(Object),
      });
    });

    it("static send uses the singleton instance", async () => {
      await Llm.send([{ role: "user", content: "Hello" }]);
      expect(Llm.send).toHaveBeenCalledWith(
        [{ role: "user", content: "Hello" }],
        undefined,
      );
    });

    it("static operate uses the singleton instance", async () => {
      await Llm.operate("How's the weather?");
      expect(Llm.operate).toHaveBeenCalledWith("How's the weather?");
    });

    it("send with options passes options through", async () => {
      const options = { temperature: 0.7 };
      await Llm.send([{ role: "user", content: "Hello" }], options);
      expect(Llm.send).toHaveBeenCalledWith(
        [{ role: "user", content: "Hello" }],
        options,
      );
    });
  });

  // 6. Features
  describe("Features", () => {
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
  });
});
