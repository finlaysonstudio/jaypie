import { describe, expect, it } from "vitest";

// Subject
import { GeminiProvider, GoogleProvider, Llm, LLM } from "../index.js";

describe("Index", () => {
  it("Exports functions we expect", () => {
    expect(Llm).toBeFunction();
    expect(LLM).toBeObject();
    expect(LLM.DEFAULT).toBeObject();
    expect(LLM.PROVIDER).toBeObject();
    expect(LLM.PROVIDER.OPENAI).toBeObject();
  });

  it("Exports GeminiProvider as a deprecated alias of GoogleProvider", () => {
    expect(GoogleProvider).toBeFunction();
    expect(GeminiProvider).toBe(GoogleProvider);
  });
});
