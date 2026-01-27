import { describe, expect, it } from "vitest";

import { normalizeAlias, parseList } from "../core/normalize";

describe("normalizeAlias", () => {
  it("converts to lowercase", () => {
    expect(normalizeAlias("MySkill")).toBe("myskill");
    expect(normalizeAlias("AWS")).toBe("aws");
  });

  it("trims whitespace", () => {
    expect(normalizeAlias("  skill  ")).toBe("skill");
    expect(normalizeAlias("\tskill\n")).toBe("skill");
  });

  it("handles mixed case and whitespace", () => {
    expect(normalizeAlias("  My-Skill  ")).toBe("my-skill");
  });

  it("preserves hyphens and underscores", () => {
    expect(normalizeAlias("my-skill")).toBe("my-skill");
    expect(normalizeAlias("my_skill")).toBe("my_skill");
  });
});

describe("parseList", () => {
  it("returns empty array for undefined", () => {
    expect(parseList(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseList("")).toEqual([]);
  });

  it("parses comma-separated string", () => {
    expect(parseList("aws, tests, errors")).toEqual(["aws", "tests", "errors"]);
  });

  it("normalizes items in comma-separated string", () => {
    expect(parseList("AWS, Tests, ERRORS")).toEqual(["aws", "tests", "errors"]);
  });

  it("handles array input", () => {
    expect(parseList(["aws", "tests"])).toEqual(["aws", "tests"]);
  });

  it("normalizes array items", () => {
    expect(parseList(["AWS", "  Tests  "])).toEqual(["aws", "tests"]);
  });

  it("filters empty items", () => {
    expect(parseList("aws,,tests,")).toEqual(["aws", "tests"]);
    expect(parseList(["aws", "", "tests"])).toEqual(["aws", "tests"]);
  });

  it("handles single item", () => {
    expect(parseList("aws")).toEqual(["aws"]);
    expect(parseList(["aws"])).toEqual(["aws"]);
  });
});
