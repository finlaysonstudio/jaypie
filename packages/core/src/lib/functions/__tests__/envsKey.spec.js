import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import envsKey from "../envsKey.js";

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("EnvsKey Function", () => {
  it("Works", async () => {
    // Arrange
    process.env.MOCK_KEY = "MOCK_VALUE";
    // Act
    const response = envsKey("MOCK_KEY");
    // Assert
    expect(response).not.toBeFalse();
    expect(response).toBe("MOCK_VALUE");
  });
  describe("Error Conditions", () => {
    it("Throws error if key is not provided", () => {
      expect(() => {
        envsKey();
      }).toThrowJaypieError();
    });
    it("Throws error if key is not a string", () => {
      expect(() => {
        envsKey(1);
      }).toThrowJaypieError();
    });
    it("Throws error if key is falsy", () => {
      expect(() => {
        envsKey();
      }).toThrowJaypieError();
    });
  });
  describe("Features", () => {
    it("Is case insensitive on passed key", () => {
      // Arrange
      process.env.MOCK_KEY = "MOCK_VALUE";
      // Act
      const response = envsKey("mock_key");
      // Assert
      expect(response).not.toBeFalse();
      expect(response).toBe("MOCK_VALUE");
    });
    it("Is case insensitive on object key", () => {
      // Arrange
      process.env.mock_key = "MOCK_VALUE";
      // Act
      const response = envsKey("MOCK_KEY");
      // Assert
      expect(response).not.toBeFalse();
      expect(response).toBe("MOCK_VALUE");
    });
  });
});
