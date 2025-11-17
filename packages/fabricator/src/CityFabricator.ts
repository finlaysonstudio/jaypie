import { en, es, fr, Faker, it as itLocale } from "@faker-js/faker";
import { Fabricator } from "./Fabricator.js";
import numericSeedArray from "./util/numericSeedArray.js";

/**
 * CityFabricator generates city names from en, es, fr, it locales
 */
export class CityFabricator extends Fabricator {
  constructor(seed?: string | number) {
    super({
      seed,
      name: ({ fabricator }) => {
        const cityLocales = [en, es, fr, itLocale];

        // Pick a random locale using the fabricator
        const selectedLocale =
          cityLocales[
            fabricator.number.int({ min: 0, max: cityLocales.length - 1 })
          ];

        // Create a faker with the selected locale
        const localeFaker = new Faker({ locale: selectedLocale });
        const seedArray = numericSeedArray(fabricator.id);
        localeFaker.seed(seedArray);

        return localeFaker.location.city();
      },
    });
  }

  /**
   * Creates a new CityFabricator instance with next seed
   * @returns A new CityFabricator instance seeded with the next UUID
   */
  next(): CityFabricator {
    const nextFabricator = super.next();
    return new CityFabricator(nextFabricator.id);
  }

  /**
   * Generates an array of street names
   * @param count - Number of streets to generate (default: 1)
   * @returns Array of street names
   */
  streets(count = 1): string[] {
    const streetNames: string[] = [];

    for (let i = 0; i < count; i++) {
      // Create a faker seeded for this street
      const streetFaker = new Faker({ locale: en });
      const seedArray = numericSeedArray(`${this.id}-street-${i}`);
      streetFaker.seed(seedArray);

      streetNames.push(streetFaker.location.street());
    }

    return streetNames;
  }
}
