import { describe, expect, it } from "vitest";

import { getAlternativeSpellings } from "../core/spellings";

describe("getAlternativeSpellings", () => {
  it("strips trailing s for plurals", () => {
    expect(getAlternativeSpellings("skills")).toEqual(["skill"]);
  });

  it("strips trailing s and es for words ending in es", () => {
    expect(getAlternativeSpellings("indexes")).toEqual(["indexe", "index"]);
  });

  it("appends s and es for singulars", () => {
    expect(getAlternativeSpellings("fish")).toEqual(["fishs", "fishes"]);
  });

  it("normalizes casing and whitespace before generating", () => {
    expect(getAlternativeSpellings("  SKILLS  ")).toEqual(["skill"]);
  });
});
