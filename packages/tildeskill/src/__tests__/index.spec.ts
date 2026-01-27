import { describe, expect, it } from "vitest";

import {
  createMarkdownStore,
  createMemoryStore,
  isValidAlias,
  normalizeAlias,
  parseList,
  validateAlias,
} from "../index";

describe("@jaypie/tildeskill exports", () => {
  it("exports normalizeAlias", () => {
    expect(typeof normalizeAlias).toBe("function");
    expect(normalizeAlias("AWS")).toBe("aws");
  });

  it("exports parseList", () => {
    expect(typeof parseList).toBe("function");
    expect(parseList("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("exports isValidAlias", () => {
    expect(typeof isValidAlias).toBe("function");
    expect(isValidAlias("valid-alias")).toBe(true);
    expect(isValidAlias("../bad")).toBe(false);
  });

  it("exports validateAlias", () => {
    expect(typeof validateAlias).toBe("function");
    expect(validateAlias("Valid")).toBe("valid");
  });

  it("exports createMarkdownStore", () => {
    expect(typeof createMarkdownStore).toBe("function");
  });

  it("exports createMemoryStore", () => {
    expect(typeof createMemoryStore).toBe("function");
    const store = createMemoryStore();
    expect(typeof store.get).toBe("function");
    expect(typeof store.list).toBe("function");
    expect(typeof store.put).toBe("function");
  });
});
