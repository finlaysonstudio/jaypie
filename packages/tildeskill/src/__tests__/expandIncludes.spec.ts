import { describe, expect, it } from "vitest";

import { expandIncludes } from "../core/expandIncludes";
import { createMemoryStore } from "../stores/memory";

describe("expandIncludes", () => {
  describe("basic functionality", () => {
    it("returns content as-is when no includes", async () => {
      const store = createMemoryStore([]);
      const record = { alias: "test", content: "# Test\n\nContent" };

      const result = await expandIncludes(store, record);

      expect(result).toBe("# Test\n\nContent");
    });

    it("returns content as-is when includes is empty array", async () => {
      const store = createMemoryStore([]);
      const record = { alias: "test", content: "# Test", includes: [] };

      const result = await expandIncludes(store, record);

      expect(result).toBe("# Test");
    });

    it("prepends single include content", async () => {
      const store = createMemoryStore([
        { alias: "base", content: "# Base\n\nBase content" },
      ]);
      const record = {
        alias: "test",
        content: "# Test\n\nTest content",
        includes: ["base"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("# Base\n\nBase content\n\n# Test\n\nTest content");
    });

    it("prepends multiple includes in order", async () => {
      const store = createMemoryStore([
        { alias: "first", content: "First content" },
        { alias: "second", content: "Second content" },
      ]);
      const record = {
        alias: "test",
        content: "Test content",
        includes: ["first", "second"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("First content\n\nSecond content\n\nTest content");
    });
  });

  describe("missing includes", () => {
    it("skips missing includes silently", async () => {
      const store = createMemoryStore([
        { alias: "exists", content: "Exists content" },
      ]);
      const record = {
        alias: "test",
        content: "Test content",
        includes: ["missing", "exists"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("Exists content\n\nTest content");
    });

    it("returns original content when all includes missing", async () => {
      const store = createMemoryStore([]);
      const record = {
        alias: "test",
        content: "Test content",
        includes: ["missing1", "missing2"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("Test content");
    });
  });

  describe("circular include prevention", () => {
    it("prevents self-reference", async () => {
      const store = createMemoryStore([
        { alias: "test", content: "Test content", includes: ["test"] },
      ]);
      const record = {
        alias: "test",
        content: "Test content",
        includes: ["test"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("Test content");
    });

    it("prevents circular references between two skills", async () => {
      const store = createMemoryStore([
        { alias: "a", content: "A content", includes: ["b"] },
        { alias: "b", content: "B content", includes: ["a"] },
      ]);
      const record = { alias: "a", content: "A content", includes: ["b"] };

      const result = await expandIncludes(store, record);

      // b includes a, but a is already visited, so only b's content is included
      expect(result).toBe("B content\n\nA content");
    });

    it("prevents circular references in chain", async () => {
      const store = createMemoryStore([
        { alias: "a", content: "A content", includes: ["b"] },
        { alias: "b", content: "B content", includes: ["c"] },
        { alias: "c", content: "C content", includes: ["a"] },
      ]);
      const record = { alias: "a", content: "A content", includes: ["b"] };

      const result = await expandIncludes(store, record);

      // Chain: a -> b -> c, c tries to include a but it's visited
      expect(result).toBe("C content\n\nB content\n\nA content");
    });
  });

  describe("nested includes", () => {
    it("expands nested includes recursively", async () => {
      const store = createMemoryStore([
        { alias: "base", content: "Base content" },
        { alias: "middle", content: "Middle content", includes: ["base"] },
      ]);
      const record = {
        alias: "top",
        content: "Top content",
        includes: ["middle"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("Base content\n\nMiddle content\n\nTop content");
    });

    it("expands deeply nested includes", async () => {
      const store = createMemoryStore([
        { alias: "level1", content: "Level 1" },
        { alias: "level2", content: "Level 2", includes: ["level1"] },
        { alias: "level3", content: "Level 3", includes: ["level2"] },
      ]);
      const record = {
        alias: "level4",
        content: "Level 4",
        includes: ["level3"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("Level 1\n\nLevel 2\n\nLevel 3\n\nLevel 4");
    });

    it("handles multiple nested includes at same level", async () => {
      const store = createMemoryStore([
        { alias: "base-a", content: "Base A" },
        { alias: "base-b", content: "Base B" },
        { alias: "middle", content: "Middle", includes: ["base-a", "base-b"] },
      ]);
      const record = {
        alias: "top",
        content: "Top",
        includes: ["middle"],
      };

      const result = await expandIncludes(store, record);

      expect(result).toBe("Base A\n\nBase B\n\nMiddle\n\nTop");
    });
  });
});
