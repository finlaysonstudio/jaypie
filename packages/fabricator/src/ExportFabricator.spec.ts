import { describe, expect, it } from "vitest";
import { ExportFabricator } from "./ExportFabricator.js";

describe("ExportFabricator", () => {
  it("should generate export names from food categories", () => {
    const exportItem = new ExportFabricator("export-test");

    expect(exportItem.name).toBeDefined();
    expect(typeof exportItem.name).toBe("string");
    expect(exportItem.name.length).toBeGreaterThan(0);
  });

  it("should generate deterministic exports with same seed", () => {
    const export1 = new ExportFabricator("same-seed");
    const export2 = new ExportFabricator("same-seed");

    expect(export1.name).toBe(export2.name);
  });

  it("should generate different exports with different seeds", () => {
    const export1 = new ExportFabricator("seed-1");
    const export2 = new ExportFabricator("seed-2");

    expect(export1.name).not.toBe(export2.name);
  });

  it("should chain to next export", () => {
    const export1 = new ExportFabricator("chain-seed");
    const export2 = export1.next();
    const export3 = export2.next();

    expect(export1.id).not.toBe(export2.id);
    expect(export2.id).not.toBe(export3.id);
    expect(export1.name).toBeDefined();
    expect(export2.name).toBeDefined();
    expect(export3.name).toBeDefined();
  });

  it("should have climate property", () => {
    const exportItem = new ExportFabricator("climate-test");
    const climate = exportItem.climate;

    expect(climate).toBeDefined();
    expect(typeof climate).toBe("string");
    expect(["tropical", "temperate", "arid", "continental", "polar"]).toContain(
      climate,
    );
  });

  it("should have terrain property", () => {
    const exportItem = new ExportFabricator("terrain-test");
    const terrain = exportItem.terrain;

    expect(terrain).toBeDefined();
    expect(typeof terrain).toBe("string");
    expect(["coastal", "mountainous", "plains", "valley", "plateau"]).toContain(
      terrain,
    );
  });

  it("should have adjective property", () => {
    const exportItem = new ExportFabricator("adjective-test");
    const adjective = exportItem.adjective;

    expect(adjective).toBeDefined();
    expect(typeof adjective).toBe("string");
    expect(adjective.length).toBeGreaterThan(0);
  });

  it("should generate deterministic climate for same seed", () => {
    const export1 = new ExportFabricator("climate-seed");
    const export2 = new ExportFabricator("climate-seed");

    expect(export1.climate).toBe(export2.climate);
  });

  it("should generate deterministic terrain for same seed", () => {
    const export1 = new ExportFabricator("terrain-seed");
    const export2 = new ExportFabricator("terrain-seed");

    expect(export1.terrain).toBe(export2.terrain);
  });

  it("should generate deterministic adjective for same seed", () => {
    const export1 = new ExportFabricator("adj-seed");
    const export2 = new ExportFabricator("adj-seed");

    expect(export1.adjective).toBe(export2.adjective);
  });
});
