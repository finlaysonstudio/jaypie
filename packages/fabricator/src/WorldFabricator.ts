import {
  az,
  da,
  de,
  en,
  eo,
  es,
  Faker,
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
import {
  Fabricator,
  type FabricatorNameParams,
  type NestedFabricator,
  type NestedFabricatorConfig,
} from "./Fabricator.js";
import numericSeedArray from "./util/numericSeedArray.js";

//
// Name Generators
//

/**
 * Generates world names from city segments in various locales
 */
function worldNameGenerator({ fabricator }: FabricatorNameParams): string {
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
}

/**
 * Generates city names from en, es, fr, it locales
 */
function cityNameGenerator({ fabricator }: FabricatorNameParams): string {
  const cityLocales = [en, es, fr, itLocale];

  // Pick a random locale using the fabricator
  const selectedLocale =
    cityLocales[fabricator.number.int({ min: 0, max: cityLocales.length - 1 })];

  // Create a faker with the selected locale
  const localeFaker = new Faker({ locale: selectedLocale });
  const seedArray = numericSeedArray(fabricator.id);
  localeFaker.seed(seedArray);

  return localeFaker.location.city();
}

/**
 * Generates export names from faker.food
 */
function exportNameGenerator({ fabricator }: FabricatorNameParams): string {
  const foodTypes = ["vegetable", "spice", "ingredient", "fruit"] as const;

  // Pick a random food type
  const selectedType =
    foodTypes[fabricator.number.int({ min: 0, max: foodTypes.length - 1 })];

  // Generate the food item based on type
  return fabricator.faker.food[selectedType]();
}

//
// Configuration
//

const worldFabricatorConfig = {
  name: worldNameGenerator,
  fabricators: {
    cities: {
      name: cityNameGenerator,
    },
    exports: {
      name: exportNameGenerator,
    },
  },
} as const satisfies NestedFabricatorConfig;

type WorldFabricatorConfig = typeof worldFabricatorConfig;

//
// Class
//

/**
 * WorldFabricator generates world names based on city names from various locales
 * Takes the longest segment (or last among tied lengths) from city names
 *
 * You can use either:
 * - `new WorldFabricator(seed)` - Traditional class-based approach with cities() and exports() methods
 * - `WorldFabricator.create(seed)` - Modern config-based approach using Fabricator.new()
 * - `Fabricator.new(worldFabricatorConfig)` - Direct use of config
 */
export class WorldFabricator extends Fabricator {
  /**
   * Creates a new WorldFabricator using the config-based approach
   * This provides automatic cities() and exports() methods with proper typing
   *
   * @param seed - Optional seed for deterministic generation
   * @returns A WorldFabricator with cities() and exports() methods
   *
   * @example
   * const world = WorldFabricator.create("my-seed");
   * const cities = world.cities(5);
   * const exports = world.exports(10);
   * cities[0].name; // Type-safe access to city name
   */
  static create(
    seed?: string | number,
  ): NestedFabricator<WorldFabricatorConfig> {
    return Fabricator.new({
      ...worldFabricatorConfig,
      seed,
    });
  }

  constructor(seed?: string | number) {
    super({
      seed,
      name: worldNameGenerator,
    });
  }

  /**
   * Generates cities as Fabricator instances
   * @param count - Number of cities to generate. If not provided, returns a generator.
   * @returns Array of Fabricator instances or generator
   */
  cities(): Generator<Fabricator, void, undefined>;
  cities(count: number): Fabricator[];
  cities(
    count?: number,
  ): Fabricator[] | Generator<Fabricator, void, undefined> {
    if (count === undefined) {
      // Return a generator for infinite chaining
      const worldId = this.id;
      return (function* (): Generator<Fabricator, void, undefined> {
        let i = 0;
        while (true) {
          yield Fabricator.new({
            seed: `${worldId}-city-${i++}`,
            name: cityNameGenerator,
          });
        }
      })();
    }

    // Return an array of Fabricator instances
    const cityFabricators: Fabricator[] = [];
    for (let i = 0; i < count; i++) {
      cityFabricators.push(
        Fabricator.new({
          seed: `${this.id}-city-${i}`,
          name: cityNameGenerator,
        }),
      );
    }
    return cityFabricators;
  }

  /**
   * Generates exports as Fabricator instances
   * @param count - Number of exports to generate. If not provided, returns a generator.
   * @returns Array of Fabricator instances or generator
   */
  exports(): Generator<Fabricator, void, undefined>;
  exports(count: number): Fabricator[];
  exports(
    count?: number,
  ): Fabricator[] | Generator<Fabricator, void, undefined> {
    if (count === undefined) {
      // Return a generator for infinite chaining
      const worldId = this.id;
      return (function* (): Generator<Fabricator, void, undefined> {
        let i = 0;
        while (true) {
          yield Fabricator.new({
            seed: `${worldId}-export-${i++}`,
            name: exportNameGenerator,
          });
        }
      })();
    }

    // Return an array of Fabricator instances
    const exportFabricators: Fabricator[] = [];
    for (let i = 0; i < count; i++) {
      exportFabricators.push(
        Fabricator.new({
          seed: `${this.id}-export-${i}`,
          name: exportNameGenerator,
        }),
      );
    }
    return exportFabricators;
  }

  /**
   * Creates a new WorldFabricator instance with next seed
   * @returns A new WorldFabricator instance seeded with the next UUID
   */
  next(): WorldFabricator {
    const nextFabricator = super.next();
    return new WorldFabricator(nextFabricator.id);
  }
}
