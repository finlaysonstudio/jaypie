import { describe, expect, it } from "vitest";

// Subject
import { Llm, LLM } from "../index.js";

describe("Index", () => {
  it("Exports functions we expect", () => {
    expect(Llm).toBeFunction();
    expect(LLM).toBeObject();
    expect(LLM.DEFAULT).toBeObject();
    expect(LLM.PROVIDER).toBeObject();
    expect(LLM.PROVIDER.OPENAI).toBeObject();
  });
});
