import { en, Faker } from "@faker-js/faker";
import numericSeedArray from "./util/numericSeedArray.js";
import { random, type RandomFunction } from "./random.js";

/**
 * Fabricator class for generating test data with faker.js
 * Manages an internal faker instance with optional seeding for deterministic output
 */
export class Fabricator {
  private _faker: Faker;
  private _random: RandomFunction;

  /**
   * Creates a new Fabricator instance
   * @param seed - Optional seed (string or number) for deterministic data generation
   */
  constructor(seed?: string | number) {
    this._faker = new Faker({ locale: en });

    // Initialize random with seed
    this._random = random(seed);

    if (seed !== undefined) {
      const seedArray = numericSeedArray(String(seed));
      this._faker.seed(seedArray);
    }
  }

  /**
   * Gets the internal faker instance
   */
  get faker(): Faker {
    return this._faker;
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
  get airline() {
    return this._faker.airline;
  }
  get animal() {
    return this._faker.animal;
  }
  get color() {
    return this._faker.color;
  }
  get commerce() {
    return this._faker.commerce;
  }
  get company() {
    return this._faker.company;
  }
  get database() {
    return this._faker.database;
  }
  get datatype() {
    return this._faker.datatype;
  }
  get date() {
    return this._faker.date;
  }
  get finance() {
    return this._faker.finance;
  }
  get git() {
    return this._faker.git;
  }
  get hacker() {
    return this._faker.hacker;
  }
  get helpers() {
    return this._faker.helpers;
  }
  get image() {
    return this._faker.image;
  }
  get internet() {
    return this._faker.internet;
  }
  get location() {
    return this._faker.location;
  }
  get lorem() {
    return this._faker.lorem;
  }
  get music() {
    return this._faker.music;
  }
  get number() {
    return this._faker.number;
  }
  get person() {
    return this._faker.person;
  }
  get phone() {
    return this._faker.phone;
  }
  get science() {
    return this._faker.science;
  }
  get string() {
    return this._faker.string;
  }
  get system() {
    return this._faker.system;
  }
  get vehicle() {
    return this._faker.vehicle;
  }
  get word() {
    return this._faker.word;
  }
}
