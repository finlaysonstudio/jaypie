import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Fabricator } from "./Fabricator.js";
import { Faker } from "@faker-js/faker";

describe("Fabricator", () => {
  let originalProjectSeed: string | undefined;

  beforeEach(() => {
    originalProjectSeed = process.env.PROJECT_SEED;
  });

  afterEach(() => {
    if (originalProjectSeed !== undefined) {
      process.env.PROJECT_SEED = originalProjectSeed;
    } else {
      delete process.env.PROJECT_SEED;
    }
  });
  describe("constructor", () => {
    it("should create instance without seed", () => {
      const fabricator = new Fabricator();
      expect(fabricator).toBeInstanceOf(Fabricator);
      expect(typeof fabricator.id).toBe("string");
      expect(fabricator.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should create instance with string seed", () => {
      const fabricator = new Fabricator("test-seed");
      expect(fabricator).toBeInstanceOf(Fabricator);
    });

    it("should create instance with number seed", () => {
      const fabricator = new Fabricator(42);
      expect(fabricator).toBeInstanceOf(Fabricator);
    });

    it("should create instance with UUID seed", () => {
      const fabricator = new Fabricator("550e8400-e29b-41d4-a716-446655440000");
      expect(fabricator).toBeInstanceOf(Fabricator);
    });

    it("should create instance with options object only", () => {
      const fabricator = new Fabricator({
        seed: "test-seed",
        name: "Test Fab",
      });
      expect(fabricator).toBeInstanceOf(Fabricator);
      expect(fabricator.name).toBe("Test Fab");
    });

    it("should create instance with seed and options", () => {
      const fabricator = new Fabricator("my-seed", { name: "Named Fab" });
      expect(fabricator).toBeInstanceOf(Fabricator);
      expect(fabricator.name).toBe("Named Fab");
    });

    it("should create instance with options object containing seed", () => {
      const fabricator = new Fabricator({ seed: 123 });
      expect(fabricator).toBeInstanceOf(Fabricator);
    });

    it("should prefer seed from first param over options.seed", () => {
      const fab1 = new Fabricator("first-seed", { seed: "options-seed" });
      const fab2 = new Fabricator("first-seed");

      // Should use the first param seed
      expect(fab1.faker.person.firstName()).toBe(fab2.faker.person.firstName());
    });

    it("should generate capitalized name when no name provided", () => {
      const fabricator = new Fabricator("consistent-seed");
      expect(typeof fabricator.name).toBe("string");

      // Should have two words
      const words = fabricator.name.split(" ");
      expect(words.length).toBe(2);

      // Each word should be capitalized
      words.forEach((word) => {
        expect(word[0]).toBe(word[0].toUpperCase());
      });
    });

    it("should generate same name with same seed", () => {
      const fab1 = new Fabricator("same-seed");
      const fab2 = new Fabricator("same-seed");

      expect(fab1.name).toBe(fab2.name);
    });

    it("should generate different name with different seed", () => {
      const fab1 = new Fabricator("seed1");
      const fab2 = new Fabricator("seed2");

      expect(fab1.name).not.toBe(fab2.name);
    });

    it("should accept name as a function", () => {
      const fabricator = new Fabricator({ name: () => "Custom Name" });
      expect(fabricator.name).toBe("Custom Name");
    });

    it("should call function to get name", () => {
      let callCount = 0;
      const nameFunc = () => {
        callCount++;
        return "Function Name";
      };

      const fabricator = new Fabricator({ name: nameFunc });
      expect(callCount).toBe(1);
      expect(fabricator.name).toBe("Function Name");
    });

    it("should accept name as an async function", async () => {
      const fabricator = new Fabricator({
        name: async () => "Async Name",
      });

      // Wait for the promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fabricator.name).toBe("Async Name");
    });

    it("should work with seed and name function", () => {
      const fabricator = new Fabricator("my-seed", {
        name: () => "Functional Name",
      });

      expect(fabricator.name).toBe("Functional Name");
    });
  });

  describe("id property", () => {
    it("should use UUID seed as id (lowercase)", () => {
      const uuid = "550E8400-E29B-41D4-A716-446655440000";
      const fabricator = new Fabricator(uuid);

      expect(fabricator.id).toBe(uuid.toLowerCase());
    });

    it("should generate UUID from non-UUID string seed", () => {
      const fabricator = new Fabricator("test-seed");

      expect(typeof fabricator.id).toBe("string");
      expect(fabricator.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate UUID from number seed", () => {
      const fabricator = new Fabricator(12345);

      expect(typeof fabricator.id).toBe("string");
      expect(fabricator.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate deterministic id from same non-UUID seed", () => {
      const fab1 = new Fabricator("consistent-seed");
      const fab2 = new Fabricator("consistent-seed");

      expect(fab1.id).toBe(fab2.id);
    });

    it("should generate deterministic id from same UUID seed", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const fab1 = new Fabricator(uuid);
      const fab2 = new Fabricator(uuid);

      expect(fab1.id).toBe(fab2.id);
      expect(fab1.id).toBe(uuid.toLowerCase());
    });

    it("should generate different ids from different seeds", () => {
      const fab1 = new Fabricator("seed1");
      const fab2 = new Fabricator("seed2");

      expect(fab1.id).not.toBe(fab2.id);
    });

    it("should generate random UUID when no seed provided", () => {
      const fab1 = new Fabricator();
      const fab2 = new Fabricator();

      expect(fab1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(fab2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      // Different instances should have different random IDs
      expect(fab1.id).not.toBe(fab2.id);
    });

    it("should always return lowercase UUID", () => {
      const uppercaseUuid = "550E8400-E29B-41D4-A716-446655440000";
      const fabricator = new Fabricator(uppercaseUuid);

      expect(fabricator.id).toBe(uppercaseUuid.toLowerCase());
      expect(fabricator.id).not.toContain("A");
      expect(fabricator.id).not.toContain("B");
      expect(fabricator.id).not.toContain("C");
      expect(fabricator.id).not.toContain("D");
      expect(fabricator.id).not.toContain("E");
      expect(fabricator.id).not.toContain("F");
    });

    it("should work with options object containing seed", () => {
      const fabricator = new Fabricator({ seed: "test-seed" });

      expect(typeof fabricator.id).toBe("string");
      expect(fabricator.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("next() method", () => {
    it("should create a new Fabricator instance", () => {
      const fab = new Fabricator("test-seed");
      const nextFab = fab.next();
      expect(nextFab).toBeInstanceOf(Fabricator);
      expect(nextFab).not.toBe(fab);
    });

    it("should create a new fabricator with different id", () => {
      const fab = new Fabricator("test-seed");
      const nextFab = fab.next();
      expect(nextFab.id).not.toBe(fab.id);
    });

    it("should chain multiple next() calls", () => {
      const fab1 = new Fabricator("test-seed");
      const fab2 = fab1.next();
      const fab3 = fab2.next();
      const fab4 = fab3.next();

      // Each should have different ids
      expect(fab1.id).not.toBe(fab2.id);
      expect(fab2.id).not.toBe(fab3.id);
      expect(fab3.id).not.toBe(fab4.id);

      // But should be deterministic
      const fab1Fresh = new Fabricator("test-seed");
      const fab2Fresh = fab1Fresh.next();
      expect(fab1.id).toBe(fab1Fresh.id);
      expect(fab2.id).toBe(fab2Fresh.id);
    });

    it("should have deterministic faker output", () => {
      const fab = new Fabricator("test-seed");
      const nextFab = fab.next();

      // Each instance should have deterministic output based on its id
      const name1a = fab.faker.person.firstName();
      const name1b = fab.faker.person.firstName();

      const name2a = nextFab.faker.person.firstName();
      const name2b = nextFab.faker.person.firstName();

      // Within same instance, should be different (sequential calls)
      expect(name1a).not.toBe(name1b);
      expect(name2a).not.toBe(name2b);

      // But when created fresh with same seed, should match first call
      const fab1Fresh = new Fabricator("test-seed");
      const nextFabFresh = fab1Fresh.next();
      expect(fab1Fresh.faker.person.firstName()).toBe(name1a);
      expect(nextFabFresh.faker.person.firstName()).toBe(name2a);
    });

    it("should create different sequences from different seeds", () => {
      const fabA = new Fabricator("seed-a");
      const fabB = new Fabricator("seed-b");

      const nextA = fabA.next();
      const nextB = fabB.next();

      // Different starting seeds produce different chains
      expect(nextA.id).not.toBe(nextB.id);
    });

    it("should work without explicit seed", () => {
      delete process.env.PROJECT_SEED;

      const fab1 = new Fabricator();
      const fab2 = fab1.next();

      expect(fab2).toBeInstanceOf(Fabricator);
      expect(fab2.id).not.toBe(fab1.id);
    });

    it("should preserve lowercase format", () => {
      const fab = new Fabricator("550E8400-E29B-41D4-A716-446655440000");
      const nextFab = fab.next();

      expect(fab.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(nextFab.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("PROJECT_SEED environment variable", () => {
    it("should use PROJECT_SEED when no seed provided", () => {
      process.env.PROJECT_SEED = "env-seed";

      const fab1 = new Fabricator();
      const fab2 = new Fabricator();

      // Both should have same id because they use the same PROJECT_SEED
      expect(fab1.id).toBe(fab2.id);

      // Verify it's deterministic with the env seed
      const fab3 = new Fabricator("env-seed");
      expect(fab1.id).toBe(fab3.id);
    });

    it("should use explicit seed over PROJECT_SEED", () => {
      process.env.PROJECT_SEED = "env-seed";

      const fabEnv = new Fabricator();
      const fabExplicit = new Fabricator("explicit-seed");

      // Should be different because explicit seed overrides env
      expect(fabEnv.id).not.toBe(fabExplicit.id);

      // Verify env seed was used for first one
      const fabEnv2 = new Fabricator();
      expect(fabEnv.id).toBe(fabEnv2.id);
    });

    it("should generate random UUID when no PROJECT_SEED and no seed", () => {
      delete process.env.PROJECT_SEED;

      const fab1 = new Fabricator();
      const fab2 = new Fabricator();

      // Should be different random UUIDs
      expect(fab1.id).not.toBe(fab2.id);
      expect(fab1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(fab2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should use PROJECT_SEED with options object when no seed in options", () => {
      process.env.PROJECT_SEED = "env-seed";

      const fab1 = new Fabricator({ name: "Test Name" });
      const fab2 = new Fabricator({ name: "Test Name" });

      // Both should have same id from PROJECT_SEED
      expect(fab1.id).toBe(fab2.id);
      expect(fab1.name).toBe("Test Name");
    });

    it("should prefer options.seed over PROJECT_SEED", () => {
      process.env.PROJECT_SEED = "env-seed";

      const fabEnv = new Fabricator();
      const fabOptions = new Fabricator({ seed: "options-seed" });

      expect(fabEnv.id).not.toBe(fabOptions.id);
    });

    it("should handle PROJECT_SEED as UUID", () => {
      process.env.PROJECT_SEED = "550e8400-e29b-41d4-a716-446655440000";

      const fab = new Fabricator();

      expect(fab.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should lowercase PROJECT_SEED if it's a UUID", () => {
      process.env.PROJECT_SEED = "550E8400-E29B-41D4-A716-446655440000";

      const fab = new Fabricator();

      expect(fab.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should produce deterministic results with PROJECT_SEED", () => {
      process.env.PROJECT_SEED = "test-env-seed";

      const fab1 = new Fabricator();
      const fab2 = new Fabricator();

      // Same faker output
      expect(fab1.faker.person.firstName()).toBe(fab2.faker.person.firstName());

      // Same random output
      const fab3 = new Fabricator();
      const fab4 = new Fabricator();
      expect(fab3.random()).toBe(fab4.random());
    });
  });

  describe("faker getter", () => {
    it("should return faker instance", () => {
      const fabricator = new Fabricator();
      const faker = fabricator.faker;
      expect(faker).toBeInstanceOf(Faker);
    });

    it("should return same faker instance on multiple calls", () => {
      const fabricator = new Fabricator();
      const faker1 = fabricator.faker;
      const faker2 = fabricator.faker;
      expect(faker1).toBe(faker2);
    });
  });

  describe("seeding behavior", () => {
    it("should produce deterministic output with same string seed", () => {
      const fabricator1 = new Fabricator("test-seed");
      const fabricator2 = new Fabricator("test-seed");

      const name1 = fabricator1.faker.person.firstName();
      const name2 = fabricator2.faker.person.firstName();

      expect(name1).toBe(name2);
    });

    it("should produce deterministic output with same number seed", () => {
      const fabricator1 = new Fabricator(12345);
      const fabricator2 = new Fabricator(12345);

      const email1 = fabricator1.faker.internet.email();
      const email2 = fabricator2.faker.internet.email();

      expect(email1).toBe(email2);
    });

    it("should produce deterministic output with same UUID seed", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const fabricator1 = new Fabricator(uuid);
      const fabricator2 = new Fabricator(uuid);

      const word1 = fabricator1.faker.lorem.word();
      const word2 = fabricator2.faker.lorem.word();

      expect(word1).toBe(word2);
    });

    it("should produce different output with different seeds", () => {
      const fabricator1 = new Fabricator("seed1");
      const fabricator2 = new Fabricator("seed2");

      const name1 = fabricator1.faker.person.firstName();
      const name2 = fabricator2.faker.person.firstName();

      expect(name1).not.toBe(name2);
    });

    it("should produce random output without seed", () => {
      const fabricator1 = new Fabricator();
      const fabricator2 = new Fabricator();

      // Generate multiple values to ensure they're different
      const values1 = Array.from({ length: 5 }, () =>
        fabricator1.faker.person.firstName(),
      );
      const values2 = Array.from({ length: 5 }, () =>
        fabricator2.faker.person.firstName(),
      );

      // At least some values should be different (very unlikely to be all the same)
      const allSame = values1.every((val, idx) => val === values2[idx]);
      expect(allSame).toBe(false);
    });
  });

  describe("faker functionality", () => {
    it("should generate person data", () => {
      const fabricator = new Fabricator("test");
      const faker = fabricator.faker;

      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      expect(typeof firstName).toBe("string");
      expect(typeof lastName).toBe("string");
      expect(firstName.length).toBeGreaterThan(0);
      expect(lastName.length).toBeGreaterThan(0);
    });

    it("should generate internet data", () => {
      const fabricator = new Fabricator(42);
      const faker = fabricator.faker;

      const email = faker.internet.email();
      const url = faker.internet.url();

      expect(typeof email).toBe("string");
      expect(typeof url).toBe("string");
      expect(email).toContain("@");
      expect(url).toMatch(/^https?:\/\//);
    });

    it("should generate lorem text", () => {
      const fabricator = new Fabricator("lorem-seed");
      const faker = fabricator.faker;

      const word = faker.lorem.word();
      const sentence = faker.lorem.sentence();

      expect(typeof word).toBe("string");
      expect(typeof sentence).toBe("string");
      expect(word.length).toBeGreaterThan(0);
      expect(sentence.length).toBeGreaterThan(0);
    });
  });

  describe("random", () => {
    it("should have random method available", () => {
      const fabricator = new Fabricator();
      expect(typeof fabricator.random).toBe("function");
    });

    it("should generate deterministic random numbers with seed", () => {
      const fabricator1 = new Fabricator("random-seed");
      const fabricator2 = new Fabricator("random-seed");

      const value1 = fabricator1.random();
      const value2 = fabricator2.random();

      expect(value1).toBe(value2);
    });

    it("should generate integers with integer flag", () => {
      const fabricator = new Fabricator(42);
      const results = Array.from({ length: 10 }, () =>
        fabricator.random({ min: 1, max: 100, integer: true }),
      );

      results.forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it("should respect min and max bounds", () => {
      const fabricator = new Fabricator();
      const results = Array.from({ length: 10 }, () =>
        fabricator.random({ min: 10, max: 20 }),
      );

      results.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      });
    });

    it("should work with currency precision", () => {
      const fabricator = new Fabricator(123);
      const results = Array.from({ length: 10 }, () =>
        fabricator.random({ currency: true, min: 0, max: 100 }),
      );

      results.forEach((value) => {
        const decimalPlaces = (value.toString().split(".")[1] || "").length;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("proxied faker fields", () => {
    it("should provide direct access to animal module", () => {
      const fabricator = new Fabricator("test");
      const animalType = fabricator.animal.type();
      expect(typeof animalType).toBe("string");
      expect(animalType.length).toBeGreaterThan(0);
    });

    it("should provide direct access to person module", () => {
      const fabricator = new Fabricator(42);
      const firstName = fabricator.person.firstName();
      expect(typeof firstName).toBe("string");
      expect(firstName.length).toBeGreaterThan(0);
    });

    it("should provide direct access to internet module", () => {
      const fabricator = new Fabricator();
      const email = fabricator.internet.email();
      expect(typeof email).toBe("string");
      expect(email).toContain("@");
    });

    it("should provide direct access to location module", () => {
      const fabricator = new Fabricator(123);
      const city = fabricator.location.city();
      expect(typeof city).toBe("string");
      expect(city.length).toBeGreaterThan(0);
    });

    it("should provide direct access to company module", () => {
      const fabricator = new Fabricator("company");
      const companyName = fabricator.company.name();
      expect(typeof companyName).toBe("string");
      expect(companyName.length).toBeGreaterThan(0);
    });

    it("should produce deterministic results through proxied fields", () => {
      const fab1 = new Fabricator("proxy-seed");
      const fab2 = new Fabricator("proxy-seed");

      expect(fab1.animal.type()).toBe(fab2.animal.type());
      expect(fab1.person.firstName()).toBe(fab2.person.firstName());
      expect(fab1.internet.email()).toBe(fab2.internet.email());
    });
  });

  describe("words", () => {
    it("should return a string with two words", () => {
      const fabricator = new Fabricator();
      const result = fabricator.words();

      expect(typeof result).toBe("string");
      const words = result.split(" ");
      expect(words.length).toBe(2);
    });

    it("should produce deterministic results with same seed", () => {
      const fabricator1 = new Fabricator("words-seed");
      const fabricator2 = new Fabricator("words-seed");

      const result1 = fabricator1.words();
      const result2 = fabricator2.words();

      expect(result1).toBe(result2);
    });

    it("should produce different results with different seeds", () => {
      const fabricator1 = new Fabricator("seed1");
      const fabricator2 = new Fabricator("seed2");

      const result1 = fabricator1.words();
      const result2 = fabricator2.words();

      expect(result1).not.toBe(result2);
    });

    it("should generate valid word combinations", () => {
      const fabricator = new Fabricator(123);

      // Generate multiple combinations to test all patterns
      const results = Array.from({ length: 20 }, () => fabricator.words());

      results.forEach((result) => {
        expect(typeof result).toBe("string");
        const words = result.split(" ");
        expect(words.length).toBe(2);
        expect(words[0].length).toBeGreaterThan(0);
        expect(words[1].length).toBeGreaterThan(0);
      });
    });

    it("should use one of the three patterns", () => {
      const fabricator = new Fabricator(42);

      // Generate many results to ensure we're using the patterns
      const results = Array.from({ length: 30 }, () => fabricator.words());

      // All results should be strings with exactly 2 words
      results.forEach((result) => {
        expect(result.split(" ").length).toBe(2);
      });

      // Results should vary (not all the same)
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });
  });

  describe("generate.person", () => {
    it("should generate person with all required fields", () => {
      const fabricator = new Fabricator();
      const person = fabricator.generate.person();

      expect(person).toHaveProperty("id");
      expect(person).toHaveProperty("firstName");
      expect(person).toHaveProperty("middleName");
      expect(person).toHaveProperty("lastName");
      expect(person).toHaveProperty("fullName");

      expect(typeof person.id).toBe("string");
      expect(person.id.length).toBeGreaterThan(0);
      expect(typeof person.firstName).toBe("string");
      expect(person.firstName.length).toBeGreaterThan(0);
      expect(typeof person.lastName).toBe("string");
      expect(person.lastName.length).toBeGreaterThan(0);
      expect(typeof person.fullName).toBe("string");
      expect(person.fullName.length).toBeGreaterThan(0);
    });

    it("should generate deterministic person with same id", () => {
      const fabricator = new Fabricator();
      const id = "550e8400-e29b-41d4-a716-446655440000";

      const person1 = fabricator.generate.person(id);
      const person2 = fabricator.generate.person(id);

      expect(person1).toEqual(person2);
      expect(person1.id).toBe(id);
      expect(person2.id).toBe(id);
    });

    it("should generate different person with different id", () => {
      const fabricator = new Fabricator();
      const id1 = "550e8400-e29b-41d4-a716-446655440000";
      const id2 = "550e8400-e29b-41d4-a716-446655440001";

      const person1 = fabricator.generate.person(id1);
      const person2 = fabricator.generate.person(id2);

      expect(person1).not.toEqual(person2);
    });

    it("should generate different persons without id", () => {
      const fabricator = new Fabricator();

      const person1 = fabricator.generate.person();
      const person2 = fabricator.generate.person();

      // They should be different (extremely unlikely to be the same)
      expect(person1).not.toEqual(person2);
    });

    it("should include firstName in fullName", () => {
      const fabricator = new Fabricator();
      const person = fabricator.generate.person("test-id");

      expect(person.fullName).toContain(person.firstName);
    });

    it("should include lastName in fullName", () => {
      const fabricator = new Fabricator();
      const person = fabricator.generate.person("test-id");

      expect(person.fullName).toContain(person.lastName);
    });

    it("should handle missing middleName", () => {
      const fabricator = new Fabricator();

      // Generate many persons to find one with missing middle name
      const persons = Array.from({ length: 100 }, (_, i) =>
        fabricator.generate.person(`test-${i}`),
      );

      const withoutMiddle = persons.filter((p) => p.middleName === undefined);
      expect(withoutMiddle.length).toBeGreaterThan(0);
    });

    it("should sometimes have hyphenated lastName", () => {
      const fabricator = new Fabricator();

      // Generate many persons to find one with hyphenated last name
      const persons = Array.from({ length: 500 }, (_, i) =>
        fabricator.generate.person(`last-${i}`),
      );

      const hyphenated = persons.filter((p) => p.lastName.includes("-"));
      expect(hyphenated.length).toBeGreaterThan(0);
    });

    it("should sometimes include middleName in fullName", () => {
      const fabricator = new Fabricator();

      // Generate many persons to test middle name inclusion
      const persons = Array.from({ length: 100 }, (_, i) =>
        fabricator.generate.person(`full-${i}`),
      );

      const withMiddleInFull = persons.filter(
        (p) =>
          p.middleName !== undefined &&
          p.fullName.includes(p.middleName) &&
          p.fullName.split(" ").length === 3,
      );

      expect(withMiddleInFull.length).toBeGreaterThan(0);
    });

    it("should work with fabricator seeding independently", () => {
      // Parent fabricator seed should not affect person generation
      const fabricator1 = new Fabricator("parent-seed");
      const fabricator2 = new Fabricator("different-parent-seed");

      const id = "same-person-id";
      const person1 = fabricator1.generate.person(id);
      const person2 = fabricator2.generate.person(id);

      // Should be the same because they use the same person id
      expect(person1).toEqual(person2);
    });

    it("should validate fullName structure", () => {
      const fabricator = new Fabricator();
      const person = fabricator.generate.person("validate-test");

      // fullName should have at least 2 words (first last) or 3 (first middle last)
      const nameParts = person.fullName.split(" ");
      expect(nameParts.length).toBeGreaterThanOrEqual(2);
      expect(nameParts.length).toBeLessThanOrEqual(3);
    });
  });
});
