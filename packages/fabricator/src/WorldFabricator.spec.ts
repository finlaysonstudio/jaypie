import { describe, it, expect } from "vitest";
import {
  Faker,
  az,
  da,
  de,
  en,
  eo,
  es,
  fi,
  fr,
  hr,
  it as itLocale,
  lv,
  mk,
  nl,
  pl,
  tr,
} from "@faker-js/faker";
import { Fabricator } from "./Fabricator.js";
import numericSeedArray from "./util/numericSeedArray.js";

/**
 * WorldFabricator generates world names based on city names from various locales
 * Takes the longest segment (or last among tied lengths) from city names
 */
class WorldFabricator extends Fabricator {
  constructor(seed?: string | number) {
    super({
      seed,
      name: ({ fabricator }) => {
        // Curated list of locales
        const locales = [nl, de, tr, mk, hr, lv, eo, az, da, fi, pl];

        // Pick a random locale using the fabricator
        const selectedLocale =
          locales[fabricator.number.int({ min: 0, max: locales.length - 1 })];

        // Create a faker with the selected locale
        const localeFaker = new Faker({ locale: selectedLocale });
        const seedArray = numericSeedArray(fabricator.id);
        localeFaker.seed(seedArray);

        const city = localeFaker.location.city();
        const segments = city.split(" ");

        // Find the longest segment, or last segment if tied
        let longestSegment = segments[0];
        let maxLength = segments[0].length;

        for (let i = 1; i < segments.length; i++) {
          if (segments[i].length >= maxLength) {
            longestSegment = segments[i];
            maxLength = segments[i].length;
          }
        }

        return longestSegment;
      },
    });
  }

  /**
   * Generates an array of city names from en, es, fr, it locales
   * @param count - Number of cities to generate (default: 1)
   * @returns Array of city names
   */
  cities(count = 1): string[] {
    const cityLocales = [en, es, fr, itLocale];
    const cities: string[] = [];

    for (let i = 0; i < count; i++) {
      // Pick a random locale
      const selectedLocale =
        cityLocales[this.number.int({ min: 0, max: cityLocales.length - 1 })];

      // Create a faker with the selected locale
      const localeFaker = new Faker({ locale: selectedLocale });
      const seedArray = numericSeedArray(`${this.id}-city-${i}`);
      localeFaker.seed(seedArray);

      cities.push(localeFaker.location.city());
    }

    return cities;
  }

  /**
   * Generates an array of export items from faker.food (vegetable, spice, ingredient, or fruit)
   * @param count - Number of exports to generate (default: 1)
   * @returns Array of export items
   */
  exports(count = 1): string[] {
    const exportItems: string[] = [];
    const foodTypes = ["vegetable", "spice", "ingredient", "fruit"] as const;

    for (let i = 0; i < count; i++) {
      // Create a faker seeded for this export item
      const exportFaker = new Faker({ locale: en });
      const seedArray = numericSeedArray(`${this.id}-export-${i}`);
      exportFaker.seed(seedArray);

      // Pick a random food type
      const selectedType =
        foodTypes[
          exportFaker.number.int({ min: 0, max: foodTypes.length - 1 })
        ];

      // Generate the food item based on type
      const foodItem = exportFaker.food[selectedType]();
      exportItems.push(foodItem);
    }

    return exportItems;
  }
}

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

  it("should generate cities from en, es, fr, it locales", () => {
    const world = new WorldFabricator("city-seed");
    const cities = world.cities(12);

    // Should generate exactly 12 cities
    expect(cities).toHaveLength(12);

    // All should be non-empty strings
    cities.forEach((city) => {
      expect(typeof city).toBe("string");
      expect(city.length).toBeGreaterThan(0);
    });

    // Log cities for visual inspection
    // eslint-disable-next-line no-console
    console.log("Generated Cities:");
    cities.forEach((city, index) => {
      // eslint-disable-next-line no-console
      console.log(`  City ${index + 1}: ${city}`);
    });
  });

  it("should generate deterministic cities with same seed", () => {
    const world1 = new WorldFabricator("city-deterministic");
    const cities1 = world1.cities(5);

    const world2 = new WorldFabricator("city-deterministic");
    const cities2 = world2.cities(5);

    expect(cities1).toEqual(cities2);
  });

  it("should allow custom city count", () => {
    const world = new WorldFabricator("custom-count");

    const cities5 = world.cities(5);
    expect(cities5).toHaveLength(5);

    const cities20 = world.cities(20);
    expect(cities20).toHaveLength(20);
  });

  it("should default to 1 city when no count provided", () => {
    const world = new WorldFabricator("default-count");
    const cities = world.cities();

    expect(cities).toHaveLength(1);
  });

  it("should generate different cities for different worlds", () => {
    const world1 = new WorldFabricator("world-1");
    const world2 = new WorldFabricator("world-2");

    const cities1 = world1.cities(10);
    const cities2 = world2.cities(10);

    // Different worlds should generate different cities
    expect(cities1).not.toEqual(cities2);

    // At least some cities should be different
    const sameCities = cities1.filter((city, index) => city === cities2[index]);
    expect(sameCities.length).toBeLessThan(10);
  });

  it("should generate exports from food categories", () => {
    const world = new WorldFabricator("export-seed");
    const worldExports = world.exports(10);

    // Should generate exactly 10 exports
    expect(worldExports).toHaveLength(10);

    // All should be non-empty strings
    worldExports.forEach((exportItem) => {
      expect(typeof exportItem).toBe("string");
      expect(exportItem.length).toBeGreaterThan(0);
    });

    // Log exports for visual inspection
    // eslint-disable-next-line no-console
    console.log("Generated Exports:");
    worldExports.forEach((exportItem, index) => {
      // eslint-disable-next-line no-console
      console.log(`  Export ${index + 1}: ${exportItem}`);
    });
  });

  it("should generate deterministic exports with same seed", () => {
    const world1 = new WorldFabricator("export-deterministic");
    const worldExports1 = world1.exports(5);

    const world2 = new WorldFabricator("export-deterministic");
    const worldExports2 = world2.exports(5);

    expect(worldExports1).toEqual(worldExports2);
  });

  it("should default to 1 export when no count provided", () => {
    const world = new WorldFabricator("default-export");
    const worldExports = world.exports();

    expect(worldExports).toHaveLength(1);
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

    // Different worlds should generate different exports
    expect(worldExports1).not.toEqual(worldExports2);
  });

  it("should generate consistent results regardless of batch size", () => {
    const world1 = new WorldFabricator("same-seed");
    const worldA = new WorldFabricator("same-seed");

    const cities1 = world1.cities(6);
    const worldExports1 = world1.exports(6);

    const worldExportsA = worldA.exports(12);
    const citiesA = worldA.cities(24);

    // Same seed should produce same results regardless of batch size
    expect(cities1).toEqual(citiesA.slice(0, 6));
    expect(worldExports1).toEqual(worldExportsA.slice(0, 6));

    // Log for visual verification
    // eslint-disable-next-line no-console
    console.log("\nBatch Size Consistency Test:");
    // eslint-disable-next-line no-console
    console.log("cities1 (6):", cities1);
    // eslint-disable-next-line no-console
    console.log("citiesA (first 6 of 24):", citiesA.slice(0, 6));
    // eslint-disable-next-line no-console
    console.log("exports1 (6):", worldExports1);
    // eslint-disable-next-line no-console
    console.log("exportsA (first 6 of 12):", worldExportsA.slice(0, 6));
  });
});
