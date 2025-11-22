import { en, Faker } from "@faker-js/faker";
import { v5 as uuidv5 } from "uuid";
import { ConfigurationError } from "@jaypie/errors";
import numericSeedArray from "./util/numericSeedArray.js";
import { random, type RandomFunction } from "./random.js";
import isUuid from "./util/isUuid.js";
import { uuidFrom } from "./util/uuidFrom.js";

//
// Types
//

export interface FabricatorNameParams {
  fabricator: Fabricator;
}

export interface FabricatorOptions {
  generator?: Record<
    string,
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>)
  >;
  name?:
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>);
  seed?: string | number;
}

/**
 * Configuration for a child fabricator in the nested structure
 */
export interface NestedFabricatorConfig {
  generator?: Record<
    string,
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>)
  >;
  name?:
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>);
  fabricators?: Record<string, NestedFabricatorConfig>;
  seed?: string | number;
}

/**
 * Extracts the type of nested fabricator methods from a config
 * Generates methods that return either a generator or an array of fabricators
 */
export type NestedFabricatorMethods<Config extends NestedFabricatorConfig> =
  Config["fabricators"] extends Record<string, NestedFabricatorConfig>
    ? {
        [K in keyof Config["fabricators"]]: {
          (): Generator<
            NestedFabricator<Config["fabricators"][K]>,
            void,
            undefined
          >;
          (count: number): NestedFabricator<Config["fabricators"][K]>[];
        };
      }
    : Record<string, never>;

/**
 * Type of a fabricator created from a nested config
 * Includes all base Fabricator properties plus nested methods
 */
export type NestedFabricator<Config extends NestedFabricatorConfig> =
  Fabricator & NestedFabricatorMethods<Config>;

//
// Helper Functions
//

/**
 * Capitalizes the first letter of a word
 */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Default name generator function using capitalized words from fabricator
 * @param params - Object containing the fabricator instance
 * @returns A capitalized two-word name
 */
function defaultNameGenerator({ fabricator }: FabricatorNameParams): string {
  const rawWords = fabricator.generate.words();
  return rawWords
    .split(" ")
    .map((word) => capitalize(word))
    .join(" ");
}

//
// Class
//

/**
 * Fabricator class for generating test data with faker.js
 * Manages an internal faker instance with optional seeding for deterministic output
 */
export class Fabricator {
  private _faker: Faker;
  private _generator?: Record<
    string,
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>)
  >;
  private _id: string;
  private _name: string;
  private _random: RandomFunction;

  /**
   * Creates a new Fabricator instance
   * Supports multiple signatures:
   * - new Fabricator()
   * - new Fabricator(seed)
   * - new Fabricator(seed, options)
   * - new Fabricator(options)
   */
  constructor();
  constructor(seed: string | number);
  constructor(seed: string | number, options: FabricatorOptions);
  constructor(options: FabricatorOptions);
  constructor(
    seedOrOptions?: string | number | FabricatorOptions,
    options?: FabricatorOptions,
  ) {
    // Parse arguments to extract seed and options
    let seed: string | number | undefined;
    let opts: FabricatorOptions = {};

    if (typeof seedOrOptions === "object" && seedOrOptions !== null) {
      // Called as: new Fabricator(options)
      opts = seedOrOptions;
      seed = opts.seed;
    } else {
      // Called as: new Fabricator() or new Fabricator(seed) or new Fabricator(seed, options)
      seed = seedOrOptions;
      if (options) {
        opts = options;
      }
    }

    // If no seed provided, check PROJECT_SEED environment variable
    if (seed === undefined && process.env.PROJECT_SEED) {
      seed = process.env.PROJECT_SEED;
    }

    // Initialize faker
    this._faker = new Faker({ locale: en });

    // Initialize random with seed
    this._random = random(seed);

    // Apply seed to faker if provided
    if (seed !== undefined) {
      const seedArray = numericSeedArray(String(seed));
      this._faker.seed(seedArray);
    }

    // Initialize id from seed
    if (seed !== undefined) {
      const seedStr = String(seed);
      // If seed is already a UUID, use it (lowercase). Otherwise, generate UUID from seed.
      // We check isUuid first to avoid the warning that uuidFrom logs when given a UUID
      if (isUuid(seedStr)) {
        this._id = seedStr.toLowerCase();
      } else {
        this._id = uuidFrom(seed);
      }
    } else {
      // No seed provided, generate a random UUID
      this._id = this._faker.string.uuid();
    }

    // Store the generator option
    this._generator = opts.generator;

    // Determine final name value
    // If name is undefined, use generator.name or default
    const resolvedName =
      opts.name === undefined
        ? (this._generator?.name ?? defaultNameGenerator)
        : opts.name;

    // Initialize name from resolvedName
    if (typeof resolvedName === "function") {
      // Create a fabricator instance for the name function
      // Use a deterministic seed based on the fabricator id
      const nameSeed = uuidv5("name", this._id);
      const nameFabricator = new Fabricator(nameSeed, {
        name: "",
      });
      const result = resolvedName({ fabricator: nameFabricator });
      // Handle both sync and async functions
      if (result instanceof Promise) {
        // For promises, we need to handle this in an async manner
        this._name = "";
        result.then((resolvedNameValue) => {
          // If the function returns undefined or empty, use generator.name or default
          if (
            (resolvedNameValue === undefined || resolvedNameValue === "") &&
            this._generator?.name
          ) {
            const fallback = this._generator.name;
            if (typeof fallback === "function") {
              const fallbackResult = fallback({ fabricator: nameFabricator });
              if (fallbackResult instanceof Promise) {
                fallbackResult.then((name) => {
                  this._name = name;
                });
              } else {
                this._name = fallbackResult;
              }
            } else {
              this._name = fallback;
            }
          } else if (
            resolvedNameValue === undefined ||
            resolvedNameValue === ""
          ) {
            // No generator.name, use default
            this._name = defaultNameGenerator({ fabricator: nameFabricator });
          } else {
            this._name = resolvedNameValue;
          }
        });
      } else {
        // Sync function - check if result is undefined or empty
        if ((result === undefined || result === "") && this._generator?.name) {
          const fallback = this._generator.name;
          if (typeof fallback === "function") {
            const fallbackResult = fallback({ fabricator: nameFabricator });
            if (fallbackResult instanceof Promise) {
              this._name = "";
              fallbackResult.then((name) => {
                this._name = name;
              });
            } else {
              this._name = fallbackResult;
            }
          } else {
            this._name = fallback;
          }
        } else if (result === undefined || result === "") {
          // No generator.name, use default
          this._name = defaultNameGenerator({ fabricator: nameFabricator });
        } else {
          this._name = result;
        }
      }
    } else {
      this._name = resolvedName;
    }
  }

  /**
   * Creates a new nested fabricator from a configuration object
   * Automatically generates child fabricator methods based on the config
   *
   * @param config - Nested fabricator configuration
   * @returns A fabricator with dynamically generated child methods
   *
   * @example
   * const world = Fabricator.new({
   *   seed: "my-world",
   *   name: worldNameGenerator,
   *   fabricators: {
   *     cities: {
   *       name: cityNameGenerator,
   *       fabricators: {
   *         streets: { name: streetNameGenerator }
   *       }
   *     },
   *     exports: { name: exportNameGenerator }
   *   }
   * });
   *
   * // Now you can use:
   * world.cities(5); // Returns array of 5 city fabricators
   * world.cities(); // Returns a generator of city fabricators
   * const city = world.cities(1)[0];
   * city.streets(10); // Returns array of 10 street fabricators
   */
  static new<Config extends NestedFabricatorConfig>(
    config: Config,
  ): NestedFabricator<Config> {
    // Create base fabricator
    const baseFabricator = new Fabricator({
      generator: config.generator,
      name: config.name,
      seed: config.seed,
    });

    // If no nested fabricators, return base
    if (!config.fabricators) {
      return baseFabricator as NestedFabricator<Config>;
    }

    // Add child fabricator methods
    const fabricatorWithMethods = baseFabricator as NestedFabricator<Config>;

    for (const [key, childConfig] of Object.entries(config.fabricators)) {
      // Create the overloaded method
      const method = (count?: number) => {
        if (count === undefined) {
          // Return a generator for infinite chaining
          const parentId = baseFabricator.id;
          return (function* () {
            let i = 0;
            while (true) {
              yield Fabricator.new({
                ...childConfig,
                seed: `${parentId}-${key}-${i++}`,
              });
            }
          })();
        }

        // Return an array of fabricators
        const fabricators = [];
        for (let i = 0; i < count; i++) {
          fabricators.push(
            Fabricator.new({
              ...childConfig,
              seed: `${baseFabricator.id}-${key}-${i}`,
            }),
          );
        }
        return fabricators;
      };

      // Attach method to fabricator
      (fabricatorWithMethods as any)[key] = method;
    }

    return fabricatorWithMethods;
  }

  /**
   * Gets the internal faker instance
   */
  get faker(): Faker {
    return this._faker;
  }

  /**
   * Gets the fabricator id (UUID)
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the fabricator name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the internal random function
   */
  random: RandomFunction = (options?) => this._random(options);

  /**
   * Generate namespace for complex data generation methods
   */
  generate = {
    /**
     * Generates a random word combination using one of three patterns:
     * - adjective noun
     * - adjective verb
     * - noun verb
     * @returns A string with two words following one of the patterns
     */
    words: (): string => {
      const patterns = [
        () => `${this._faker.word.adjective()} ${this._faker.word.noun()}`, // adjective noun
        () => `${this._faker.word.adjective()} ${this._faker.word.verb()}`, // adjective verb
        () => `${this._faker.word.noun()} ${this._faker.word.verb()}`, // noun verb
      ];

      const selectedPattern =
        patterns[this._faker.number.int({ min: 0, max: patterns.length - 1 })];
      return selectedPattern();
    },
    /**
     * Generates a person with firstName, middleName, lastName, and fullName
     * Uses probabilistic logic for variations:
     * - firstName: 0.021 (rare) chance to be a lastName instead
     * - middleName: 0.146 (uncommon) chance to be missing, 0.021 (rare) chance to be lastName, 0.00307 (epic) chance to have two
     * - lastName: 0.021 (rare) chance to have two hyphenated
     * - fullName: always "first last", 0.146 (uncommon) chance to include middle
     *
     * @param id - Optional UUID to seed the subfaker. If not provided, generates a new UUID
     * @returns Person object with firstName, middleName, lastName, and fullName
     */
    person: (id?: string) => {
      // Generate or use provided id
      const personId = id ?? this._faker.string.uuid();

      // Create a seeded subfaker using the person id
      const subFaker = new Faker({ locale: en });
      const seedArray = numericSeedArray(personId);
      subFaker.seed(seedArray);

      // Generate firstName - rare chance (0.021) to be a lastName instead
      const firstName =
        subFaker.number.float() < 0.021
          ? subFaker.person.lastName()
          : subFaker.person.firstName();

      // Generate middleName with multiple conditions
      let middleName: string | undefined;
      const middleRoll = subFaker.number.float();

      if (middleRoll < 0.00307) {
        // Epic (0.00307): two middle names
        middleName = `${subFaker.person.firstName()} ${subFaker.person.firstName()}`;
      } else if (middleRoll < 0.00307 + 0.021) {
        // Rare (0.021): lastName as middle name
        middleName = subFaker.person.lastName();
      } else if (middleRoll < 0.00307 + 0.021 + 0.146) {
        // Uncommon (0.146): missing middle name
        middleName = undefined;
      } else {
        // Common: regular first name as middle name
        middleName = subFaker.person.firstName();
      }

      // Generate lastName - rare chance (0.021) to have two hyphenated
      const lastName =
        subFaker.number.float() < 0.021
          ? `${subFaker.person.lastName()}-${subFaker.person.lastName()}`
          : subFaker.person.lastName();

      // Generate fullName - uncommon (0.146) to include middle
      const includeMiddle = subFaker.number.float() < 0.146;
      const fullName =
        includeMiddle && middleName
          ? `${firstName} ${middleName} ${lastName}`
          : `${firstName} ${lastName}`;

      return {
        id: personId,
        firstName,
        middleName,
        lastName,
        fullName,
      };
    },
  };

  // Proxy all faker fields for direct access
  get airline(): Faker["airline"] {
    return this._faker.airline;
  }
  get animal(): Faker["animal"] {
    return this._faker.animal;
  }
  get color(): Faker["color"] {
    return this._faker.color;
  }
  get commerce(): Faker["commerce"] {
    return this._faker.commerce;
  }
  get company(): Faker["company"] {
    return this._faker.company;
  }
  get database(): Faker["database"] {
    return this._faker.database;
  }
  get datatype(): Faker["datatype"] {
    return this._faker.datatype;
  }
  get date(): Faker["date"] {
    return this._faker.date;
  }
  get finance(): Faker["finance"] {
    return this._faker.finance;
  }
  get git(): Faker["git"] {
    return this._faker.git;
  }
  get hacker(): Faker["hacker"] {
    return this._faker.hacker;
  }
  get helpers(): Faker["helpers"] {
    return this._faker.helpers;
  }
  get image(): Faker["image"] {
    return this._faker.image;
  }
  get internet(): Faker["internet"] {
    return this._faker.internet;
  }
  get location(): Faker["location"] {
    return this._faker.location;
  }
  get lorem(): Faker["lorem"] {
    return this._faker.lorem;
  }
  get music(): Faker["music"] {
    return this._faker.music;
  }
  get number(): Faker["number"] {
    return this._faker.number;
  }
  get person(): Faker["person"] {
    return this._faker.person;
  }
  get phone(): Faker["phone"] {
    return this._faker.phone;
  }
  get science(): Faker["science"] {
    return this._faker.science;
  }
  get string(): Faker["string"] {
    return this._faker.string;
  }
  get system(): Faker["system"] {
    return this._faker.system;
  }
  get vehicle(): Faker["vehicle"] {
    return this._faker.vehicle;
  }
  get word(): Faker["word"] {
    return this._faker.word;
  }
}
