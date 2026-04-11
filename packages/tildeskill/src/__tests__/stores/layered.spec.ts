import { describe, expect, it } from "vitest";

import { createLayeredStore } from "../../stores/layered";
import { createMemoryStore } from "../../stores/memory";
import { expandIncludes } from "../../core/expandIncludes";

describe("createLayeredStore", () => {
  describe("construction", () => {
    it("throws when layers is empty", () => {
      expect(() => createLayeredStore({ layers: [] })).toThrow(
        /at least one layer/,
      );
    });

    it("throws when a namespace is blank", () => {
      const store = createMemoryStore();
      expect(() =>
        createLayeredStore({ layers: [{ namespace: "   ", store }] }),
      ).toThrow(/namespace must be non-empty/);
    });

    it("throws when namespaces collide", () => {
      const store = createMemoryStore();
      expect(() =>
        createLayeredStore({
          layers: [
            { namespace: "local", store },
            { namespace: "LOCAL", store },
          ],
        }),
      ).toThrow(/unique/);
    });
  });

  describe("get", () => {
    it("walks layers top-to-bottom and returns the first match namespaced", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# local AWS" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "aws", content: "# jaypie AWS" },
        { alias: "lambda", content: "# Lambda" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const hit = await store.get("aws");
      expect(hit?.alias).toBe("local:aws");
      expect(hit?.content).toBe("# local AWS");

      const lambda = await store.get("lambda");
      expect(lambda?.alias).toBe("jaypie:lambda");
    });

    it("routes namespaced aliases directly to that layer", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# local AWS" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "aws", content: "# jaypie AWS" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const hit = await store.get("jaypie:aws");
      expect(hit?.alias).toBe("jaypie:aws");
      expect(hit?.content).toBe("# jaypie AWS");
    });

    it("returns null when nothing matches", async () => {
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: createMemoryStore() },
          { namespace: "jaypie", store: createMemoryStore() },
        ],
      });
      expect(await store.get("missing")).toBeNull();
    });
  });

  describe("find", () => {
    it("uses per-layer plural/singular fallback", async () => {
      const local = createMemoryStore([]);
      const jaypie = createMemoryStore([
        { alias: "skill", content: "# Skill" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const hit = await store.find("skills");
      expect(hit?.alias).toBe("jaypie:skill");
    });

    it("prefers earlier layers even when fallback would match later", async () => {
      const local = createMemoryStore([
        { alias: "tests", content: "# local tests" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "test", content: "# jaypie test" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const hit = await store.find("test");
      expect(hit?.alias).toBe("local:tests");
    });
  });

  describe("getByNickname", () => {
    it("aggregates matches across every layer", async () => {
      const local = createMemoryStore([
        { alias: "crixus", content: "# Crixus", nicknames: ["sparticus"] },
      ]);
      const jaypie = createMemoryStore([
        {
          alias: "spartacus",
          content: "# Spartacus",
          nicknames: ["sparticus"],
        },
        { alias: "aws", content: "# AWS", nicknames: ["amazon"] },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const results = await store.getByNickname("sparticus");
      expect(results.map((r) => r.alias)).toEqual([
        "jaypie:spartacus",
        "local:crixus",
      ]);
    });

    it("returns an empty array when no layer has the nickname", async () => {
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: createMemoryStore() },
          { namespace: "jaypie", store: createMemoryStore() },
        ],
      });
      expect(await store.getByNickname("missing")).toEqual([]);
    });
  });

  describe("list", () => {
    it("returns prefixed aliases from every layer sorted alphabetically", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# local AWS" },
        { alias: "notes", content: "# local notes" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "aws", content: "# jaypie AWS" },
        { alias: "lambda", content: "# Lambda" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const all = await store.list();
      expect(all.map((r) => r.alias)).toEqual([
        "jaypie:aws",
        "jaypie:lambda",
        "local:aws",
        "local:notes",
      ]);
    });

    it("filters by namespace prefix against the namespaced alias", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# local AWS" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "aws", content: "# jaypie AWS" },
        { alias: "lambda", content: "# Lambda" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const jaypieOnly = await store.list({ namespace: "jaypie:" });
      expect(jaypieOnly.map((r) => r.alias)).toEqual([
        "jaypie:aws",
        "jaypie:lambda",
      ]);
    });

    it("filters by tag across layers", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# AWS", tags: ["cloud"] },
      ]);
      const jaypie = createMemoryStore([
        { alias: "lambda", content: "# Lambda", tags: ["cloud"] },
        { alias: "test", content: "# Test", tags: ["testing"] },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const cloudSkills = await store.list({ tag: "cloud" });
      expect(cloudSkills.map((r) => r.alias)).toEqual([
        "jaypie:lambda",
        "local:aws",
      ]);
    });
  });

  describe("search", () => {
    it("aggregates hits from every layer with namespaced aliases", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# AWS\n\nDeploy to the cloud" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "lambda", content: "# Lambda\n\nDeploy easily" },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const results = await store.search("deploy");
      expect(results.map((r) => r.alias)).toEqual([
        "jaypie:lambda",
        "local:aws",
      ]);
    });
  });

  describe("put", () => {
    it("routes namespace-qualified writes to the correct layer", async () => {
      const local = createMemoryStore();
      const jaypie = createMemoryStore();
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const stored = await store.put({
        alias: "local:new",
        content: "# New",
      });
      expect(stored.alias).toBe("local:new");

      const inLocal = await local.get("new");
      expect(inLocal?.content).toBe("# New");

      const inJaypie = await jaypie.get("new");
      expect(inJaypie).toBeNull();
    });

    it("throws when the alias is not namespace-qualified", async () => {
      const store = createLayeredStore({
        layers: [{ namespace: "local", store: createMemoryStore() }],
      });

      await expect(
        store.put({ alias: "unqualified", content: "# nope" }),
      ).rejects.toThrow(/namespace-qualified/);
    });
  });

  describe("expandIncludes integration", () => {
    it("resolves namespaced includes across layers", async () => {
      const local = createMemoryStore([
        { alias: "base", content: "Base content" },
      ]);
      const jaypie = createMemoryStore([
        {
          alias: "main",
          content: "Main content",
          includes: ["local:base"],
        },
      ]);
      const store = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });

      const main = await store.get("jaypie:main");
      expect(main).not.toBeNull();
      const expanded = await expandIncludes(store, main!);
      expect(expanded).toContain("Base content");
      expect(expanded).toContain("Main content");
    });
  });
});
