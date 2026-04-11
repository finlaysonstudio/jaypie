import { describe, expect, it } from "vitest";

import {
  createLayeredStore,
  createMarkdownStore,
  createMemoryStore,
  getAlternativeSpellings,
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
    expect(typeof store.find).toBe("function");
    expect(typeof store.get).toBe("function");
    expect(typeof store.list).toBe("function");
    expect(typeof store.put).toBe("function");
  });

  it("exports getAlternativeSpellings", () => {
    expect(typeof getAlternativeSpellings).toBe("function");
    expect(getAlternativeSpellings("skills")).toEqual(["skill"]);
  });

  it("exports createLayeredStore", () => {
    expect(typeof createLayeredStore).toBe("function");
    const store = createLayeredStore({
      layers: [{ namespace: "test", store: createMemoryStore() }],
    });
    expect(typeof store.find).toBe("function");
    expect(typeof store.get).toBe("function");
    expect(typeof store.getByNickname).toBe("function");
    expect(typeof store.list).toBe("function");
    expect(typeof store.put).toBe("function");
    expect(typeof store.search).toBe("function");
  });
});
