import { ConfigurationError } from "@jaypie/errors";
import { describe, expect, it, vi } from "vitest";

import { hashSkill, syncSkills } from "../index";
import { createMemoryStore } from "../stores/memory";

describe("syncSkills", () => {
  it("adds, updates, removes, and leaves unchanged records alone", async () => {
    const from = createMemoryStore([
      { alias: "aws", content: "# AWS" },
      { alias: "lambda", content: "# Lambda v2" },
      { alias: "tests", content: "# Tests" },
    ]);
    const to = createMemoryStore([
      { alias: "aws", content: "# AWS" },
      { alias: "lambda", content: "# Lambda v1" },
      { alias: "retired", content: "# Retired" },
    ]);
    const put = vi.spyOn(to, "put");

    const result = await syncSkills({ from, to });

    expect(result).toEqual({
      added: ["tests"],
      removed: ["retired"],
      unchanged: ["aws"],
      updated: ["lambda"],
    });
    expect(put).toHaveBeenCalledTimes(2);
    await expect(to.list()).resolves.toEqual(await from.list());
  });

  it("detects frontmatter changes, not only content", async () => {
    const from = createMemoryStore([
      { alias: "aws", content: "# AWS", description: "New" },
    ]);
    const to = createMemoryStore([
      { alias: "aws", content: "# AWS", description: "Old" },
    ]);

    const result = await syncSkills({ from, to });

    expect(result.updated).toEqual(["aws"]);
    await expect(to.get("aws")).resolves.toMatchObject({ description: "New" });
  });

  it("refuses an empty source that would remove every record", async () => {
    const to = createMemoryStore([{ alias: "aws", content: "# AWS" }]);
    const remove = vi.spyOn(to, "delete");

    await expect(
      syncSkills({ from: createMemoryStore(), to }),
    ).rejects.toBeInstanceOf(ConfigurationError);
    expect(remove).not.toHaveBeenCalled();
    await expect(to.get("aws")).resolves.not.toBeNull();
  });

  it("empties the destination when allowEmptySource is true", async () => {
    const to = createMemoryStore([{ alias: "aws", content: "# AWS" }]);

    const result = await syncSkills({
      allowEmptySource: true,
      from: createMemoryStore(),
      to,
    });

    expect(result.removed).toEqual(["aws"]);
    await expect(to.list()).resolves.toEqual([]);
  });

  it("returns empty lists for two empty stores", async () => {
    const result = await syncSkills({
      from: createMemoryStore(),
      to: createMemoryStore(),
    });
    expect(result).toEqual({
      added: [],
      removed: [],
      unchanged: [],
      updated: [],
    });
  });
});

describe("hashSkill", () => {
  it("returns a stable sha256 hex digest", () => {
    const hash = hashSkill({ alias: "aws", content: "# AWS" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSkill({ alias: "aws", content: "# AWS" })).toBe(hash);
  });

  it("ignores key order, undefined fields, and empty lists", () => {
    expect(
      hashSkill({
        alias: "aws",
        content: "# AWS",
        description: undefined,
        includes: [],
        tags: [],
      }),
    ).toBe(hashSkill({ content: "# AWS", alias: "aws" }));
  });

  it("changes when any skill field changes", () => {
    const base = { alias: "aws", content: "# AWS" };
    const hash = hashSkill(base);
    expect(hashSkill({ ...base, content: "# AWS 2" })).not.toBe(hash);
    expect(hashSkill({ ...base, description: "AWS" })).not.toBe(hash);
    expect(hashSkill({ ...base, includes: ["base"] })).not.toBe(hash);
    expect(hashSkill({ ...base, name: "AWS" })).not.toBe(hash);
    expect(hashSkill({ ...base, nicknames: ["amazon"] })).not.toBe(hash);
    expect(hashSkill({ ...base, related: ["lambda"] })).not.toBe(hash);
    expect(hashSkill({ ...base, tags: ["cloud"] })).not.toBe(hash);
  });

  it("preserves list order", () => {
    expect(
      hashSkill({ alias: "a", content: "", includes: ["x", "y"] }),
    ).not.toBe(hashSkill({ alias: "a", content: "", includes: ["y", "x"] }));
  });
});
