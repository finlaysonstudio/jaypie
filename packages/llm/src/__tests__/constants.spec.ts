import { describe, expect, it } from "vitest";

// Subject
import { DEFAULT, PROVIDER } from "../constants.js";

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(DEFAULT).toBeObject();
    expect(DEFAULT.PROVIDER).toBeObject();
    expect(PROVIDER).toBeObject();
    expect(PROVIDER.OPENAI).toBeObject();
    expect(PROVIDER.ANTHROPIC).toBeObject();
    expect(PROVIDER.OPENAI.MODEL).toBeObject();
    expect(PROVIDER.ANTHROPIC.MODEL).toBeObject();
    expect(DEFAULT.PROVIDER).toBe(PROVIDER.OPENAI);
  });
}); 