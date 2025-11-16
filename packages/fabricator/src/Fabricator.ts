import { en, Faker } from "@faker-js/faker";
import { v5 as uuidv5 } from "uuid";
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
  name?:
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>);
  seed?: string | number;
}

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
  const rawWords = fabricator.words();
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
  private _id: string;
  private _name: string;
  private _nameOption?:
    | string
    | ((params: FabricatorNameParams) => string)
    | ((params: FabricatorNameParams) => Promise<string>);
  private _random: RandomFunction;
  private _seedMap: {
    name: string;
    next: string;
  };

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

    // Initialize seedMap with uuidv5 based on _id
    this._seedMap = {
      name: uuidv5("name", this._id),
      next: uuidv5("next", this._id),
    };

    // Store the name option for chaining (store original, not defaulted)
    this._nameOption = opts.name;

    // Use default name generator if no name option provided
    const nameOption = opts.name ?? defaultNameGenerator;

    // Initialize name
    if (typeof nameOption === "function") {
      // Create a fabricator instance for the name function
      // Pass a dummy name to prevent infinite recursion
      const nameFabricator = new Fabricator(this._seedMap.name, {
        name: "",
      });
      const result = nameOption({ fabricator: nameFabricator });
      // Handle both sync and async functions
      if (result instanceof Promise) {
        // For promises, we need to handle this in an async manner
        // We'll store a placeholder and set it later
        this._name = "";
        result.then((resolvedName) => {
          this._name = resolvedName;
        });
      } else {
        this._name = result;
      }
    } else {
      this._name = nameOption;
    }
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
   * Creates a new Fabricator instance with next seed from _seedMap
   * @returns A new Fabricator instance seeded with the next UUID, chaining the name option if present
   */
  next(): Fabricator {
    if (this._nameOption !== undefined) {
      return new Fabricator(this._seedMap.next, { name: this._nameOption });
    }
    return new Fabricator(this._seedMap.next);
  }

  /**
   * Gets the internal random function
   */
  random: RandomFunction = (options?) => this._random(options);

  /**
   * Generates a random word combination using one of three patterns:
   * - adjective noun
   * - adjective verb
   * - noun verb
   * @returns A string with two words following one of the patterns
   */
  words(): string {
    const patterns = [
      () => `${this._faker.word.adjective()} ${this._faker.word.noun()}`, // adjective noun
      () => `${this._faker.word.adjective()} ${this._faker.word.verb()}`, // adjective verb
      () => `${this._faker.word.noun()} ${this._faker.word.verb()}`, // noun verb
    ];

    const selectedPattern =
      patterns[this._faker.number.int({ min: 0, max: patterns.length - 1 })];
    return selectedPattern();
  }

  /**
   * Generate namespace for complex data generation methods
   */
  generate = {
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
