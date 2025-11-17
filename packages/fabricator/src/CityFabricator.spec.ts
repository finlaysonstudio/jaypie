import { describe, expect, it } from "vitest";
import { CityFabricator } from "./CityFabricator.js";

describe("CityFabricator", () => {
  it("should generate city names from en, es, fr, it locales", () => {
    const city = new CityFabricator("city-test");

    expect(city.name).toBeDefined();
    expect(typeof city.name).toBe("string");
    expect(city.name.length).toBeGreaterThan(0);
  });

  it("should generate deterministic cities with same seed", () => {
    const city1 = new CityFabricator("same-seed");
    const city2 = new CityFabricator("same-seed");

    expect(city1.name).toBe(city2.name);
  });

  it("should generate different cities with different seeds", () => {
    const city1 = new CityFabricator("seed-1");
    const city2 = new CityFabricator("seed-2");

    expect(city1.name).not.toBe(city2.name);
  });

  it("should chain to next city", () => {
    const city1 = new CityFabricator("chain-seed");
    const city2 = city1.next();
    const city3 = city2.next();

    expect(city1.id).not.toBe(city2.id);
    expect(city2.id).not.toBe(city3.id);
    expect(city1.name).toBeDefined();
    expect(city2.name).toBeDefined();
    expect(city3.name).toBeDefined();
  });

  it("should generate street names", () => {
    const city = new CityFabricator("streets-test");
    const streets = city.streets(5);

    expect(streets).toHaveLength(5);
    streets.forEach((street) => {
      expect(typeof street).toBe("string");
      expect(street.length).toBeGreaterThan(0);
    });
  });

  it("should generate deterministic streets", () => {
    const city1 = new CityFabricator("street-seed");
    const streets1 = city1.streets(3);

    const city2 = new CityFabricator("street-seed");
    const streets2 = city2.streets(3);

    expect(streets1).toEqual(streets2);
  });

  it("should have default of 1 street", () => {
    const city = new CityFabricator("default-streets");
    const streets = city.streets();

    expect(streets).toHaveLength(1);
  });
});
