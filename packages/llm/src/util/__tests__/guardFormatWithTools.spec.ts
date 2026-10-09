import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORMAT_WITH_TOOLS_UNSUPPORTED, MODEL } from "../../constants.js";
import { LlmUnrecoverableError } from "../../errors/LlmError.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import { LlmTool } from "../../types/LlmTool.interface.js";
import {
  guardFormatWithTools,
  supportsFormatWithTools,
} from "../guardFormatWithTools.js";

const warn = vi.hoisted(() => vi.fn());

vi.mock("../logger.js", () => ({
  getLogger: () => ({ warn }),
}));

const FORMAT = { answer: String };
const MARKED = "mistral-large-4-0";
const TOOL: LlmTool = {
  call: () => "ok",
  description: "Test tool",
  name: "test",
  parameters: { properties: {}, type: "object" },
  type: "function",
};

describe("supportsFormatWithTools", () => {
  it("Is false for every marked id", () => {
    for (const model of FORMAT_WITH_TOOLS_UNSUPPORTED) {
      expect(supportsFormatWithTools(model)).toBe(false);
    }
  });

  it("Is true for an unmarked id", () => {
    expect(supportsFormatWithTools(MODEL.SONNET)).toBe(true);
    expect(supportsFormatWithTools("unknown-model")).toBe(true);
  });
});

describe("guardFormatWithTools", () => {
  beforeEach(() => {
    warn.mockClear();
  });

  it("Warns when a marked model gets format and tools", () => {
    guardFormatWithTools({ format: FORMAT, model: MARKED, tools: [TOOL] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(MARKED);
  });

  it("Accepts a Toolkit", () => {
    guardFormatWithTools({
      format: FORMAT,
      model: MARKED,
      tools: new Toolkit([TOOL]),
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("Throws instead of warning when failing fast", () => {
    let thrown: unknown;
    try {
      guardFormatWithTools({
        failFast: true,
        format: FORMAT,
        model: MARKED,
        provider: "mistral",
        tools: [TOOL],
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LlmUnrecoverableError);
    expect((thrown as LlmUnrecoverableError).model).toBe(MARKED);
    expect((thrown as LlmUnrecoverableError).provider).toBe("mistral");
    expect(warn).not.toHaveBeenCalled();
  });

  it("Is silent with only one of format and tools", () => {
    guardFormatWithTools({ failFast: true, format: FORMAT, model: MARKED });
    guardFormatWithTools({ failFast: true, model: MARKED, tools: [TOOL] });
    guardFormatWithTools({
      failFast: true,
      format: FORMAT,
      model: MARKED,
      tools: [],
    });
    guardFormatWithTools({
      failFast: true,
      format: FORMAT,
      model: MARKED,
      tools: new Toolkit([]),
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("Is silent for an unmarked model", () => {
    guardFormatWithTools({
      failFast: true,
      format: FORMAT,
      model: MODEL.SONNET,
      tools: [TOOL],
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
