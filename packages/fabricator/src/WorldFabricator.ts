import {
  az,
  da,
  de,
  eo,
  Faker,
  fi,
  hr,
  lv,
  mk,
  nl,
  pl,
  tr,
} from "@faker-js/faker";
import { CityFabricator } from "./CityFabricator.js";
import { ExportFabricator } from "./ExportFabricator.js";
import { Fabricator } from "./Fabricator.js";
import numericSeedArray from "./util/numericSeedArray.js";

/**
 * WorldFabricator generates world names based on city names from various locales
 * Takes the longest segment (or last among tied lengths) from city names
 */
export class WorldFabricator extends Fabricator {
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
   * Generates cities as CityFabricator instances
   * @param count - Number of cities to generate. If not provided, returns a generator.
   * @returns Array of CityFabricator instances or generator
   */
  cities(): Generator<CityFabricator, void, undefined>;
  cities(count: number): CityFabricator[];
  cities(
    count?: number,
  ): CityFabricator[] | Generator<CityFabricator, void, undefined> {
    if (count === undefined) {
      // Return a generator for infinite chaining
      const worldId = this.id;
      return (function* (): Generator<CityFabricator, void, undefined> {
        let i = 0;
        while (true) {
          yield new CityFabricator(`${worldId}-city-${i++}`);
        }
      })();
    }

    // Return an array of CityFabricator instances
    const cityFabricators: CityFabricator[] = [];
    for (let i = 0; i < count; i++) {
      cityFabricators.push(new CityFabricator(`${this.id}-city-${i}`));
    }
    return cityFabricators;
  }

  /**
   * Generates exports as ExportFabricator instances
   * @param count - Number of exports to generate. If not provided, returns a generator.
   * @returns Array of ExportFabricator instances or generator
   */
  exports(): Generator<ExportFabricator, void, undefined>;
  exports(count: number): ExportFabricator[];
  exports(
    count?: number,
  ): ExportFabricator[] | Generator<ExportFabricator, void, undefined> {
    if (count === undefined) {
      // Return a generator for infinite chaining
      const worldId = this.id;
      return (function* (): Generator<ExportFabricator, void, undefined> {
        let i = 0;
        while (true) {
          yield new ExportFabricator(`${worldId}-export-${i++}`);
        }
      })();
    }

    // Return an array of ExportFabricator instances
    const exportFabricators: ExportFabricator[] = [];
    for (let i = 0; i < count; i++) {
      exportFabricators.push(new ExportFabricator(`${this.id}-export-${i}`));
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
