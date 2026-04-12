import { describe, expect, it } from "vitest";

import { createSkillService } from "../service";
import { createLayeredStore } from "../stores/layered";
import { createMemoryStore } from "../stores/memory";

describe("createSkillService", () => {
  describe("returns a fabricService", () => {
    it("has $fabric property", () => {
      const store = createMemoryStore();
      const service = createSkillService(store);
      expect(service).toHaveProperty("$fabric");
    });

    it("has alias 'skill'", () => {
      const store = createMemoryStore();
      const service = createSkillService(store);
      expect(service.alias).toBe("skill");
    });

    it("has description and input", () => {
      const store = createMemoryStore();
      const service = createSkillService(store);
      expect(service.description).toBeDefined();
      expect(service.input).toBeDefined();
    });
  });

  describe("index listing", () => {
    it("returns index when called with no alias", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", description: "AWS docs" },
        { alias: "tests", content: "# Tests", description: "Testing guide" },
      ]);
      const service = createSkillService(store);
      const result = await service();
      expect(result).toContain("# Index of Skills");
      expect(result).toContain("aws - AWS docs");
      expect(result).toContain("tests - Testing guide");
    });

    it("returns index when alias is 'index'", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", description: "AWS docs" },
      ]);
      const service = createSkillService(store);
      const result = await service({ alias: "index" });
      expect(result).toContain("# Index of Skills");
      expect(result).toContain("aws");
    });

    it("filters out bare 'index' entry", async () => {
      const store = createMemoryStore([
        { alias: "index", content: "# Index", description: "Index" },
        { alias: "aws", content: "# AWS", description: "AWS docs" },
      ]);
      const service = createSkillService(store);
      const result = await service({ alias: "index" });
      expect(result).toContain("aws");
      expect(result).not.toContain("* index");
    });

    it("filters out namespaced ':index' entries", async () => {
      const local = createMemoryStore([
        { alias: "index", content: "# Local Index" },
        { alias: "aws", content: "# AWS", description: "AWS docs" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "index", content: "# Jaypie Index" },
        { alias: "tests", content: "# Tests", description: "Testing" },
      ]);
      const layered = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });
      const service = createSkillService(layered);
      const result = await service({ alias: "index" });
      expect(result).toContain("local:aws");
      expect(result).toContain("jaypie:tests");
      expect(result).not.toContain(":index");
    });

    it("lists skills without descriptions", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# AWS" }]);
      const service = createSkillService(store);
      const result = await service({ alias: "index" });
      expect(result).toContain("* aws");
    });
  });

  describe("get skill", () => {
    it("returns skill content by alias", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS\n\nAWS documentation content" },
      ]);
      const service = createSkillService(store);
      const result = await service({ alias: "aws" });
      expect(result).toBe("# AWS\n\nAWS documentation content");
    });

    it("throws when skill not found", async () => {
      const store = createMemoryStore();
      const service = createSkillService(store);
      await expect(service({ alias: "missing" })).rejects.toThrow(/not found/);
    });

    it("throws on invalid alias", async () => {
      const store = createMemoryStore();
      const service = createSkillService(store);
      await expect(service({ alias: "../../etc" })).rejects.toThrow(/invalid/i);
    });
  });

  describe("expandIncludes", () => {
    it("expands includes in returned content", async () => {
      const store = createMemoryStore([
        { alias: "base", content: "Base content" },
        { alias: "main", content: "Main content", includes: ["base"] },
      ]);
      const service = createSkillService(store);
      const result = await service({ alias: "main" });
      expect(result).toContain("Base content");
      expect(result).toContain("Main content");
    });
  });

  describe("plural/singular fallback", () => {
    it("annotates when fallback resolved a different alias", async () => {
      const store = createMemoryStore([
        { alias: "skill", content: "# Skill content" },
      ]);
      const service = createSkillService(store);
      const result = await service({ alias: "skills" });
      expect(result).toContain("<!-- resolved: skill -->");
      expect(result).toContain("# Skill content");
    });

    it("does not annotate on exact match", async () => {
      const store = createMemoryStore([
        { alias: "skill", content: "# Skill content" },
      ]);
      const service = createSkillService(store);
      const result = await service({ alias: "skill" });
      expect(result).not.toContain("<!-- resolved:");
      expect(result).toBe("# Skill content");
    });
  });

  describe("layered store integration", () => {
    it("resolves skills from layered store", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# Local AWS" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "tests", content: "# Jaypie Tests" },
      ]);
      const layered = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });
      const service = createSkillService(layered);

      const aws = await service({ alias: "aws" });
      expect(aws).toBe("# Local AWS");

      const tests = await service({ alias: "tests" });
      expect(tests).toBe("# Jaypie Tests");
    });

    it("resolves namespaced alias directly", async () => {
      const local = createMemoryStore([
        { alias: "aws", content: "# Local AWS" },
      ]);
      const jaypie = createMemoryStore([
        { alias: "aws", content: "# Jaypie AWS" },
      ]);
      const layered = createLayeredStore({
        layers: [
          { namespace: "local", store: local },
          { namespace: "jaypie", store: jaypie },
        ],
      });
      const service = createSkillService(layered);

      const result = await service({ alias: "jaypie:aws" });
      expect(result).toBe("# Jaypie AWS");
    });
  });
});
