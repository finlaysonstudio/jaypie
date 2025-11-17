import { describe, expect, it } from "vitest";
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

  it("should chain through first 12 world names using next()", () => {
    const world1 = new WorldFabricator("world-seed");
    const world2 = world1.next();
    const world3 = world2.next();
    const world4 = world3.next();
    const world5 = world4.next();
    const world6 = world5.next();
    const world7 = world6.next();
    const world8 = world7.next();
    const world9 = world8.next();
    const world10 = world9.next();
    const world11 = world10.next();
    const world12 = world11.next();

    const worldNames = [
      world1.name,
      world2.name,
      world3.name,
      world4.name,
      world5.name,
      world6.name,
      world7.name,
      world8.name,
      world9.name,
      world10.name,
      world11.name,
      world12.name,
    ];

    // All should be strings
    worldNames.forEach((name) => {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });

    // All should be unique (very likely with different seeds)
    const uniqueNames = new Set(worldNames);
    expect(uniqueNames.size).toBeGreaterThan(1);

    // Log the world names for visual inspection
    // eslint-disable-next-line no-console
    console.log("First 12 World Names:");
    worldNames.forEach((name, index) => {
      // eslint-disable-next-line no-console
      console.log(`  World ${index + 1}: ${name}`);
    });
  });

  it("should be deterministic when chained", () => {
    const world1a = new WorldFabricator("chain-seed");
    const world2a = world1a.next();

    const world1b = new WorldFabricator("chain-seed");
    const world2b = world1b.next();

    expect(world1a.name).toBe(world1b.name);
    expect(world2a.name).toBe(world2b.name);
  });

  it("should generate cities as CityFabricator instances", () => {
    const world = new WorldFabricator("city-seed");
    const cities = world.cities(12);

    // Should generate exactly 12 cities
    expect(cities).toHaveLength(12);

    // All should be CityFabricator instances with names
    cities.forEach((city) => {
      expect(city.name).toBeDefined();
      expect(typeof city.name).toBe("string");
      expect(city.name.length).toBeGreaterThan(0);
      expect(city.next).toBeDefined();
      expect(city.streets).toBeDefined();
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

  it("should generate exports as ExportFabricator instances", () => {
    const world = new WorldFabricator("export-seed");
    const worldExports = world.exports(10);

    // Should generate exactly 10 exports
    expect(worldExports).toHaveLength(10);

    // All should be ExportFabricator instances with names and properties
    worldExports.forEach((exportItem) => {
      expect(exportItem.name).toBeDefined();
      expect(typeof exportItem.name).toBe("string");
      expect(exportItem.name.length).toBeGreaterThan(0);
      expect(exportItem.climate).toBeDefined();
      expect(exportItem.terrain).toBeDefined();
      expect(exportItem.adjective).toBeDefined();
    });

    // Log exports for visual inspection
    // eslint-disable-next-line no-console
    console.log("Generated Exports:");
    worldExports.forEach((exportItem, index) => {
      // eslint-disable-next-line no-console
      console.log(
        `  Export ${index + 1}: ${exportItem.name} (${exportItem.climate}, ${exportItem.terrain})`,
      );
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
    const world2 = world1.next();

    const cities1 = world1.cities(6);
    const worldExports1 = world1.exports(6);

    const worldExportsA = worldA.exports(12);
    const citiesA = worldA.cities(24);

    const cities2 = world2.cities(6);
    const worldExports2 = world2.exports(6);

    // Same seed should produce same results regardless of batch size
    const cityNames1 = cities1.map((c) => c.name);
    const cityNamesA = citiesA.slice(0, 6).map((c) => c.name);
    expect(cityNames1).toEqual(cityNamesA);

    const exportNames1 = worldExports1.map((e) => e.name);
    const exportNamesA = worldExportsA.slice(0, 6).map((e) => e.name);
    expect(exportNames1).toEqual(exportNamesA);

    // Next world should produce different results
    const cityNames2 = cities2.map((c) => c.name);
    expect(cityNames1).not.toEqual(cityNames2);

    const exportNames2 = worldExports2.map((e) => e.name);
    expect(exportNames1).not.toEqual(exportNames2);

    // Log for visual verification
    // eslint-disable-next-line no-console
    console.log("\nBatch Size Consistency Test:");
    // eslint-disable-next-line no-console
    console.log("cities1 (6):", cityNames1);
    // eslint-disable-next-line no-console
    console.log("citiesA (first 6 of 24):", cityNamesA);
    // eslint-disable-next-line no-console
    console.log("cities2 (next world, 6):", cityNames2);
    // eslint-disable-next-line no-console
    console.log("exports1 (6):", exportNames1);
    // eslint-disable-next-line no-console
    console.log("exportsA (first 6 of 12):", exportNamesA);
    // eslint-disable-next-line no-console
    console.log("exports2 (next world, 6):", exportNames2);
  });

  it("should chain through WorldFabricator instances using next()", () => {
    const world1 = new WorldFabricator("chain-test");
    const world2 = world1.next();
    const world3 = world2.next();

    // All should be WorldFabricator instances with cities and exports methods
    expect(world2.cities).toBeDefined();
    expect(world2.exports).toBeDefined();
    expect(world3.cities).toBeDefined();
    expect(world3.exports).toBeDefined();

    // Should have different IDs (deterministic seeds)
    expect(world1.id).not.toBe(world2.id);
    expect(world2.id).not.toBe(world3.id);

    // Should generate different cities and exports
    const cities1 = world1.cities(3);
    const cities2 = world2.cities(3);
    const cities3 = world3.cities(3);

    const cityNames1 = cities1.map((c) => c.name);
    const cityNames2 = cities2.map((c) => c.name);
    const cityNames3 = cities3.map((c) => c.name);

    expect(cityNames1).not.toEqual(cityNames2);
    expect(cityNames2).not.toEqual(cityNames3);

    const exports1 = world1.exports(3);
    const exports2 = world2.exports(3);
    const exports3 = world3.exports(3);

    const exportNames1 = exports1.map((e) => e.name);
    const exportNames2 = exports2.map((e) => e.name);
    const exportNames3 = exports3.map((e) => e.name);

    expect(exportNames1).not.toEqual(exportNames2);
    expect(exportNames2).not.toEqual(exportNames3);
  });
});
