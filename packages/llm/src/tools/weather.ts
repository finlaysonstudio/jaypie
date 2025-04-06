import { LlmTool } from "../types/LlmTool.interface.js";
import { fetchWeatherApi } from "openmeteo";
import { JsonObject } from "@jaypie/types";

export const weather: LlmTool = {
  description: "Get current weather and forecast data for a specific location",
  name: "weather",
  parameters: {
    type: "object",
    properties: {
      latitude: {
        type: "number",
        description:
          "Latitude of the location. Default: 42.051554533384866 (Evanston, IL)",
      },
      longitude: {
        type: "number",
        description:
          "Longitude of the location. Default: -87.6759911441785 (Evanston, IL)",
      },
      timezone: {
        type: "string",
        description: "Timezone for the location. Default: America/Chicago",
      },
      past_days: {
        type: "number",
        description:
          "Number of past days to include in the forecast. Default: 1",
      },
      forecast_days: {
        type: "number",
        description: "Number of forecast days to include. Default: 1",
      },
    },
    required: [],
  },
  type: "function",
  call: async ({
    latitude = 42.051554533384866,
    longitude = -87.6759911441785,
    timezone = "America/Chicago",
    past_days = 1,
    forecast_days = 1,
  } = {}): Promise<JsonObject> => {
    try {
      const params = {
        latitude,
        longitude,
        hourly: [
          "temperature_2m",
          "precipitation_probability",
          "precipitation",
        ],
        current: [
          "temperature_2m",
          "is_day",
          "showers",
          "cloud_cover",
          "wind_speed_10m",
          "relative_humidity_2m",
          "precipitation",
          "snowfall",
          "rain",
          "apparent_temperature",
        ],
        timezone,
        past_days,
        forecast_days,
        wind_speed_unit: "mph",
        temperature_unit: "fahrenheit",
        precipitation_unit: "inch",
      };

      const url = "https://api.open-meteo.com/v1/forecast";
      const responses = await fetchWeatherApi(url, params);

      // Helper function to form time ranges
      const range = (start: number, stop: number, step: number) =>
        Array.from(
          { length: (stop - start) / step },
          (_, i) => start + i * step,
        );

      // Process first location
      const response = responses[0];

      // Attributes for timezone and location
      const utcOffsetSeconds = response.utcOffsetSeconds();
      const timezoneAbbreviation = response.timezoneAbbreviation();

      const current = response.current()!;
      const hourly = response.hourly()!;

      // Create weather data object
      const weatherData = {
        location: {
          latitude: response.latitude(),
          longitude: response.longitude(),
          timezone: response.timezone(),
          timezoneAbbreviation,
          utcOffsetSeconds,
        },
        current: {
          time: new Date(
            (Number(current.time()) + utcOffsetSeconds) * 1000,
          ).toISOString(),
          temperature2m: current.variables(0)!.value(),
          isDay: current.variables(1)!.value(),
          showers: current.variables(2)!.value(),
          cloudCover: current.variables(3)!.value(),
          windSpeed10m: current.variables(4)!.value(),
          relativeHumidity2m: current.variables(5)!.value(),
          precipitation: current.variables(6)!.value(),
          snowfall: current.variables(7)!.value(),
          rain: current.variables(8)!.value(),
          apparentTemperature: current.variables(9)!.value(),
        },
        hourly: {
          time: range(
            Number(hourly.time()),
            Number(hourly.timeEnd()),
            hourly.interval(),
          ).map((t) => new Date((t + utcOffsetSeconds) * 1000).toISOString()),
          temperature2m: Array.from(hourly.variables(0)!.valuesArray()!),
          precipitationProbability: Array.from(
            hourly.variables(1)!.valuesArray()!,
          ),
          precipitation: Array.from(hourly.variables(2)!.valuesArray()!),
        },
      };

      return weatherData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Weather API error: ${error.message}`);
      }
      throw new Error("Unknown error occurred while fetching weather data");
    }
  },
};
