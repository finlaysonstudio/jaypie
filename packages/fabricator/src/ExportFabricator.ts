import { en, Faker } from "@faker-js/faker";
import { Fabricator } from "./Fabricator.js";
import numericSeedArray from "./util/numericSeedArray.js";

/**
 * ExportFabricator generates export items from faker.food (vegetable, spice, ingredient, or fruit)
 */
export class ExportFabricator extends Fabricator {
  constructor(seed?: string | number) {
    super({
      seed,
      name: ({ fabricator }) => {
        const foodTypes = [
          "vegetable",
          "spice",
          "ingredient",
          "fruit",
        ] as const;

        // Pick a random food type
        const selectedType =
          foodTypes[
            fabricator.number.int({ min: 0, max: foodTypes.length - 1 })
          ];

        // Generate the food item based on type
        return fabricator.faker.food[selectedType]();
      },
    });
  }

  /**
   * Creates a new ExportFabricator instance with next seed
   * @returns A new ExportFabricator instance seeded with the next UUID
   */
  next(): ExportFabricator {
    const nextFabricator = super.next();
    return new ExportFabricator(nextFabricator.id);
  }

  /**
   * Gets the climate suitable for this export
   * @returns Climate type
   */
  get climate(): string {
    const climates = ["tropical", "temperate", "arid", "continental", "polar"];
    const climateFaker = new Faker({ locale: en });
    const seedArray = numericSeedArray(`${this.id}-climate`);
    climateFaker.seed(seedArray);

    return climates[
      climateFaker.number.int({ min: 0, max: climates.length - 1 })
    ];
  }

  /**
   * Gets the terrain suitable for this export
   * @returns Terrain type
   */
  get terrain(): string {
    const terrains = ["coastal", "mountainous", "plains", "valley", "plateau"];
    const terrainFaker = new Faker({ locale: en });
    const seedArray = numericSeedArray(`${this.id}-terrain`);
    terrainFaker.seed(seedArray);

    return terrains[
      terrainFaker.number.int({ min: 0, max: terrains.length - 1 })
    ];
  }

  /**
   * Gets an adjective describing this export
   * @returns Adjective
   */
  get adjective(): string {
    const adjectiveFaker = new Faker({ locale: en });
    const seedArray = numericSeedArray(`${this.id}-adjective`);
    adjectiveFaker.seed(seedArray);

    return adjectiveFaker.word.adjective();
  }
}
