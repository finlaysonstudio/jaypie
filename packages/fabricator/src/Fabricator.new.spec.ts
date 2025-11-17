import { describe, expect, it } from "vitest";
import { Fabricator, type FabricatorNameParams } from "./Fabricator.js";

describe("Fabricator.new()", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("should create a basic fabricator with no nested fabricators", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
      });

      expect(fab).toBeInstanceOf(Fabricator);
      expect(fab.name).toBeTruthy();
      expect(fab.id).toBeTruthy();
    });

    it("should create fabricator with custom name generator", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
        name: () => "Custom Name",
      });

      expect(fab.name).toBe("Custom Name");
    });

    it("should create fabricator with string name", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
        name: "Static Name",
      });

      expect(fab.name).toBe("Static Name");
    });
  });

  // Features
  describe("Features", () => {
    it("should create nested fabricator methods from config", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
        name: "World",
        fabricators: {
          cities: {
            name: () => "City",
          },
          exports: {
            name: () => "Export",
          },
        },
      });

      expect(typeof fab.cities).toBe("function");
      expect(typeof fab.exports).toBe("function");
    });

    it("should generate array of child fabricators with count", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
        name: "World",
        fabricators: {
          cities: {
            name: ({ fabricator }: FabricatorNameParams) =>
              `City-${fabricator.id.slice(0, 8)}`,
          },
        },
      });

      const cities = fab.cities(3);

      expect(cities).toHaveLength(3);
      cities.forEach((city) => {
        expect(city).toBeInstanceOf(Fabricator);
        expect(city.name).toMatch(/^City-/);
      });
    });

    it("should generate generator of child fabricators without count", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
        name: "World",
        fabricators: {
          cities: {
            name: () => "City",
          },
        },
      });

      const citiesGen = fab.cities();
      const cities = [];
      let i = 0;
      for (const city of citiesGen) {
        cities.push(city);
        if (++i >= 3) break;
      }

      expect(cities).toHaveLength(3);
      cities.forEach((city) => {
        expect(city).toBeInstanceOf(Fabricator);
        expect(city.name).toBe("City");
      });
    });

    it("should support deeply nested fabricators", () => {
      const fab = Fabricator.new({
        seed: "test-seed",
        name: "World",
        fabricators: {
          cities: {
            name: () => "City",
            fabricators: {
              streets: {
                name: () => "Street",
              },
            },
          },
        },
      });

      const cities = fab.cities(2);
      expect(cities).toHaveLength(2);

      const streets = cities[0].streets(3);
      expect(streets).toHaveLength(3);
      streets.forEach((street) => {
        expect(street.name).toBe("Street");
      });
    });

    it("should generate deterministic child fabricators", () => {
      const fab1 = Fabricator.new({
        seed: "same-seed",
        name: "World",
        fabricators: {
          cities: {
            name: ({ fabricator }: FabricatorNameParams) => fabricator.id,
          },
        },
      });

      const fab2 = Fabricator.new({
        seed: "same-seed",
        name: "World",
        fabricators: {
          cities: {
            name: ({ fabricator }: FabricatorNameParams) => fabricator.id,
          },
        },
      });

      const cities1 = fab1.cities(5);
      const cities2 = fab2.cities(5);

      expect(cities1.map((c) => c.name)).toEqual(cities2.map((c) => c.name));
    });

    it("should chain through nested fabricators using next()", () => {
      const fab1 = Fabricator.new({
        seed: "chain-seed",
        name: "World",
        fabricators: {
          cities: {
            name: () => "City",
          },
        },
      });

      const fab2 = fab1.next();

      expect(fab2).toBeInstanceOf(Fabricator);
      expect(typeof fab2.cities).toBe("function");
      expect(fab1.id).not.toBe(fab2.id);

      const cities2 = fab2.cities(2);
      expect(cities2).toHaveLength(2);
    });

    it("should maintain type safety with nested config", () => {
      const config = {
        name: () => "World",
        fabricators: {
          cities: {
            name: () => "City",
          },
          exports: {
            name: () => "Export",
          },
        },
      } as const;

      const fab = Fabricator.new(config);

      // TypeScript should know these methods exist
      const cities = fab.cities(1);
      const exports = fab.exports(1);

      expect(cities).toHaveLength(1);
      expect(exports).toHaveLength(1);
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("should use custom name generators in nested structure", () => {
      const worldNameGen = ({ fabricator }: FabricatorNameParams) =>
        `World-${fabricator.id.slice(0, 4)}`;
      const cityNameGen = ({ fabricator }: FabricatorNameParams) =>
        `City-${fabricator.id.slice(0, 4)}`;

      const fab = Fabricator.new({
        seed: "test-seed",
        name: worldNameGen,
        fabricators: {
          cities: {
            name: cityNameGen,
          },
        },
      });

      expect(fab.name).toMatch(/^World-/);

      const cities = fab.cities(1);
      expect(cities[0].name).toMatch(/^City-/);
    });

    it("should generate different children for different parent seeds", () => {
      const config = {
        name: () => "World",
        fabricators: {
          cities: {
            name: ({ fabricator }: FabricatorNameParams) => fabricator.id,
          },
        },
      };

      const world1 = Fabricator.new({ ...config, seed: "world-1" });
      const world2 = Fabricator.new({ ...config, seed: "world-2" });

      const cities1 = world1.cities(5);
      const cities2 = world2.cities(5);

      // Different worlds should generate different city IDs
      expect(cities1.map((c) => c.name)).not.toEqual(
        cities2.map((c) => c.name),
      );
    });

    it("should allow mixing Fabricator.new() with traditional fabricators", () => {
      const nestedFab = Fabricator.new({
        seed: "nested-seed",
        name: "Nested World",
        fabricators: {
          items: {
            name: () => "Item",
          },
        },
      });

      const traditionalFab = new Fabricator("traditional-seed");

      expect(nestedFab).toBeInstanceOf(Fabricator);
      expect(traditionalFab).toBeInstanceOf(Fabricator);
      expect(typeof nestedFab.items).toBe("function");
      expect(traditionalFab.items).toBeUndefined();
    });
  });
});
