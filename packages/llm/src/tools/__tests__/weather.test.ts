import { describe, expect, it, vi } from "vitest";
import { weather } from "../weather.js";

// Mock the fetchWeatherApi function
vi.mock("openmeteo", () => {
  return {
    fetchWeatherApi: vi.fn().mockImplementation(() => {
      // Create a mock response object with the expected structure
      const mockResponse = {
        utcOffsetSeconds: () => 0,
        timezone: () => "America/Chicago",
        timezoneAbbreviation: () => "CDT",
        latitude: () => 42.0399922,
        longitude: () => -87.6979454,
        current: () => ({
          time: () => 1616284800, // Example timestamp
          variables: (index: number) => ({
            value: () => {
              // Return different values based on the index
              const values = [72, 1, 0, 30, 5, 45, 0, 0, 0, 70];
              return values[index] || 0;
            },
          }),
        }),
        hourly: () => ({
          time: () => 1616284800,
          timeEnd: () => 1616371200,
          interval: () => 3600,
          variables: (index: number) => ({
            valuesArray: () => {
              // Return different arrays based on the index
              const arrays = [
                new Float32Array([
                  70, 72, 75, 78, 80, 82, 80, 78, 75, 72, 70, 68, 65, 62, 60,
                  58, 60, 62, 65, 68, 70, 72, 75, 78,
                ]),
                new Float32Array([
                  0, 0, 0, 0, 10, 20, 30, 40, 50, 40, 30, 20, 10, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0,
                ]),
                new Float32Array([
                  0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0,
                ]),
              ];
              return arrays[index] || new Float32Array(24);
            },
          }),
        }),
      };
      return [mockResponse];
    }),
  };
});

describe("weather tool", () => {
  it("should have the correct interface properties", () => {
    expect(weather.name).toBe("weather");
    expect(weather.description).toBeDefined();
    expect(weather.parameters).toBeDefined();
    expect(weather.type).toBe("function");
    expect(typeof weather.call).toBe("function");
  });

  it("should return weather data with default parameters", async () => {
    const result = await weather.call();

    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("hourly");

    expect(result.location.latitude).toBe(42.0399922);
    expect(result.location.longitude).toBe(-87.6979454);
    expect(result.location.timezone).toBe("America/Chicago");

    expect(result.current.temperature2m).toBe(72);
    expect(result.current.isDay).toBe(1);

    expect(Array.isArray(result.hourly.time)).toBe(true);
    expect(result.hourly.time.length).toBeGreaterThan(0);
    expect(Array.isArray(result.hourly.temperature2m)).toBe(true);
    expect(result.hourly.temperature2m.length).toBeGreaterThan(0);
  });

  it("should accept custom parameters", async () => {
    const customParams = {
      latitude: 41.8781,
      longitude: -87.6298,
      timezone: "America/Chicago",
      past_days: 2,
      forecast_days: 3,
    };

    const result = await weather.call(customParams);

    // The mock will return the same data regardless of input parameters,
    // but we can verify that the function executes successfully with custom parameters
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("hourly");
  });
});
