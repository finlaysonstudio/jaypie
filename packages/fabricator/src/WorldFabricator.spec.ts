import { describe, expect, it } from "vitest";
import { Fabricator } from "./Fabricator.js";
import { WorldFabricator } from "./WorldFabricator.js";

describe("WorldFabricator", () => {
  it("should generate world names using city segments", () => {
    const world = new WorldFabricator("test-seed");

    // Name should be a string (non-empty)
    expect(typeof world.name).toBe("string");
    expect(world.name.length).toBeGreaterThan(0);
  });

  it("should generate deterministic world names with same seed", () => {
    const world1 = new WorldFabricator("same-seed");
    const world2 = new WorldFabricator("same-seed");

    expect(world1.name).toBe(world2.name);
  });

  it("should generate cities as Fabricator instances", () => {
    const world = new WorldFabricator("city-seed");
    const cities = world.cities(12);

    // Should generate exactly 12 cities
    expect(cities).toHaveLength(12);

    // All should be Fabricator instances with names
    cities.forEach((city) => {
      expect(city.name).toBeDefined();
      expect(typeof city.name).toBe("string");
      expect(city.name.length).toBeGreaterThan(0);
    });

    // Log cities for visual inspection
    // eslint-disable-next-line no-console
    console.log("Generated Cities:");
    cities.forEach((city, index) => {
      // eslint-disable-next-line no-console
      console.log(`  City ${index + 1}: ${city.name}`);
    });
  });

  it("should generate deterministic cities with same seed", () => {
    const world1 = new WorldFabricator("city-deterministic");
    const cities1 = world1.cities(5);

    const world2 = new WorldFabricator("city-deterministic");
    const cities2 = world2.cities(5);

    // Same names for same seeds
    expect(cities1.map((c) => c.name)).toEqual(cities2.map((c) => c.name));
  });

  it("should allow custom city count", () => {
    const world = new WorldFabricator("custom-count");

    const cities5 = world.cities(5);
    expect(cities5).toHaveLength(5);

    const cities20 = world.cities(20);
    expect(cities20).toHaveLength(20);
  });

  it("should return generator when no count provided", () => {
    const world = new WorldFabricator("generator-test");
    const citiesGen = world.cities();

    // Get first 3 cities from generator
    const cities = [];
    let i = 0;
    for (const city of citiesGen) {
      cities.push(city);
      if (++i >= 3) break;
    }

    expect(cities).toHaveLength(3);
    cities.forEach((city) => {
      expect(city.name).toBeDefined();
      expect(typeof city.name).toBe("string");
    });
  });

  it("should generate different cities for different worlds", () => {
    const world1 = new WorldFabricator("world-1");
    const world2 = new WorldFabricator("world-2");

    const cities1 = world1.cities(10);
    const cities2 = world2.cities(10);

    // Different worlds should generate different city names
    const names1 = cities1.map((c) => c.name);
    const names2 = cities2.map((c) => c.name);
    expect(names1).not.toEqual(names2);
  });

  it("should generate exports as Fabricator instances", () => {
    const world = new WorldFabricator("export-seed");
    const worldExports = world.exports(10);

    // Should generate exactly 10 exports
    expect(worldExports).toHaveLength(10);

    // All should be Fabricator instances with names
    worldExports.forEach((exportItem) => {
      expect(exportItem.name).toBeDefined();
      expect(typeof exportItem.name).toBe("string");
      expect(exportItem.name.length).toBeGreaterThan(0);
    });

    // Log exports for visual inspection
    // eslint-disable-next-line no-console
    console.log("Generated Exports:");
    worldExports.forEach((exportItem, index) => {
      // eslint-disable-next-line no-console
      console.log(`  Export ${index + 1}: ${exportItem.name}`);
    });
  });

  it("should generate deterministic exports with same seed", () => {
    const world1 = new WorldFabricator("export-deterministic");
    const worldExports1 = world1.exports(5);

    const world2 = new WorldFabricator("export-deterministic");
    const worldExports2 = world2.exports(5);

    // Same names for same seeds
    expect(worldExports1.map((e) => e.name)).toEqual(
      worldExports2.map((e) => e.name),
    );
  });

  it("should return generator when no export count provided", () => {
    const world = new WorldFabricator("export-generator-test");
    const exportsGen = world.exports();

    // Get first 3 exports from generator
    const worldExports = [];
    let i = 0;
    for (const exportItem of exportsGen) {
      worldExports.push(exportItem);
      if (++i >= 3) break;
    }

    expect(worldExports).toHaveLength(3);
    worldExports.forEach((exportItem) => {
      expect(exportItem.name).toBeDefined();
      expect(typeof exportItem.name).toBe("string");
    });
  });

  it("should allow custom export count", () => {
    const world = new WorldFabricator("custom-export-count");

    const worldExports3 = world.exports(3);
    expect(worldExports3).toHaveLength(3);

    const worldExports15 = world.exports(15);
    expect(worldExports15).toHaveLength(15);
  });

  it("should generate different exports for different worlds", () => {
    const world1 = new WorldFabricator("export-world-1");
    const world2 = new WorldFabricator("export-world-2");

    const worldExports1 = world1.exports(8);
    const worldExports2 = world2.exports(8);

    // Different worlds should generate different export names
    const names1 = worldExports1.map((e) => e.name);
    const names2 = worldExports2.map((e) => e.name);
    expect(names1).not.toEqual(names2);
  });

  it("should generate consistent results regardless of batch size", () => {
    const world1 = new WorldFabricator("same-seed");
    const worldA = new WorldFabricator("same-seed");

    const cities1 = world1.cities(6);
    const worldExports1 = world1.exports(6);

    const worldExportsA = worldA.exports(12);
    const citiesA = worldA.cities(24);

    // Same seed should produce same results regardless of batch size
    const cityNames1 = cities1.map((c) => c.name);
    const cityNamesA = citiesA.slice(0, 6).map((c) => c.name);
    expect(cityNames1).toEqual(cityNamesA);

    const exportNames1 = worldExports1.map((e) => e.name);
    const exportNamesA = worldExportsA.slice(0, 6).map((e) => e.name);
    expect(exportNames1).toEqual(exportNamesA);

    // Log for visual verification
    // eslint-disable-next-line no-console
    console.log("\nBatch Size Consistency Test:");
    // eslint-disable-next-line no-console
    console.log("cities1 (6):", cityNames1);
    // eslint-disable-next-line no-console
    console.log("citiesA (first 6 of 24):", cityNamesA);
    // eslint-disable-next-line no-console
    console.log("exports1 (6):", exportNames1);
    // eslint-disable-next-line no-console
    console.log("exportsA (first 6 of 12):", exportNamesA);
  });

  describe("WorldFabricator.create() - Config-based approach", () => {
    it("should create a world with cities() and exports() methods", () => {
      const world = WorldFabricator.create("test-seed");

      expect(world).toBeInstanceOf(Fabricator);
      expect(typeof world.cities).toBe("function");
      expect(typeof world.exports).toBe("function");
    });

    it("should generate deterministic cities with same seed", () => {
      const world1 = WorldFabricator.create("same-seed");
      const world2 = WorldFabricator.create("same-seed");

      const cities1 = world1.cities(5);
      const cities2 = world2.cities(5);

      expect(cities1.map((c) => c.name)).toEqual(cities2.map((c) => c.name));
    });

    it("should generate deterministic exports with same seed", () => {
      const world1 = WorldFabricator.create("same-seed");
      const world2 = WorldFabricator.create("same-seed");

      const exports1 = world1.exports(5);
      const exports2 = world2.exports(5);

      expect(exports1.map((e) => e.name)).toEqual(exports2.map((e) => e.name));
    });

    it("should generate cities as fabricators with proper names", () => {
      const world = WorldFabricator.create("city-test");
      const cities = world.cities(10);

      expect(cities).toHaveLength(10);
      cities.forEach((city) => {
        expect(city).toBeInstanceOf(Fabricator);
        expect(typeof city.name).toBe("string");
        expect(city.name.length).toBeGreaterThan(0);
      });
    });

    it("should generate exports as fabricators with proper names", () => {
      const world = WorldFabricator.create("export-test");
      const worldExports = world.exports(10);

      expect(worldExports).toHaveLength(10);
      worldExports.forEach((exportItem) => {
        expect(exportItem).toBeInstanceOf(Fabricator);
        expect(typeof exportItem.name).toBe("string");
        expect(exportItem.name.length).toBeGreaterThan(0);
      });
    });

    it("should return generators when no count provided", () => {
      const world = WorldFabricator.create("generator-test");

      const citiesGen = world.cities();
      const cities = [];
      let i = 0;
      for (const city of citiesGen) {
        cities.push(city);
        if (++i >= 3) break;
      }

      expect(cities).toHaveLength(3);

      const exportsGen = world.exports();
      const worldExports = [];
      let j = 0;
      for (const exportItem of exportsGen) {
        worldExports.push(exportItem);
        if (++j >= 3) break;
      }

      expect(worldExports).toHaveLength(3);
    });

    it("should work without a seed", () => {
      const world = WorldFabricator.create();

      expect(world).toBeInstanceOf(Fabricator);
      expect(world.name).toBeTruthy();

      const cities = world.cities(2);
      expect(cities).toHaveLength(2);

      const worldExports = world.exports(2);
      expect(worldExports).toHaveLength(2);
    });
  });
});
