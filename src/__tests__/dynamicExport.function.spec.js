import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Subject
import dynamicExport from "../dynamicExport.function.js";

//
//
// Mock constants
//

const MOCK = {
  MODULE: "mock-module",
};

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

describe("Dynamic Export Function", () => {
  it("Is a function", () => {
    expect(dynamicExport).toBeFunction();
  });
  describe("Error Handling", () => {
    it("Throws if exports is not an array", () => {
      expect(() => dynamicExport({ exports: "string" })).toThrow();
    });
    it("Throws if exports is an empty array", () => {
      expect(() => dynamicExport({ exports: [] })).toThrow();
    });
    it("Throws if moduleImport is not a string", () => {
      expect(() => dynamicExport({ moduleImport: 123 })).toThrow();
    });
  });
  describe("Happy Path", () => {
    it("Returns an object", () => {
      expect(dynamicExport({ moduleImport: MOCK.MODULE })).toBeObject();
    });
    it("Returns an object with the exports", () => {
      const exports = ["default", "named"];
      const result = dynamicExport({ exports, moduleImport: MOCK.MODULE });
      expect(result).toContainKeys(exports);
    });
    it("Returns an object with the exports as functions", () => {
      const exports = ["default", "named"];
      const result = dynamicExport({ exports, moduleImport: MOCK.MODULE });
      expect(result.default).toBeFunction();
      expect(result.named).toBeFunction();
    });
    it("Exported functions throw if the real module is not installed", async () => {
      const exports = ["default"];
      const result = dynamicExport({ exports, moduleImport: MOCK.MODULE });
      await expect(result.default()).rejects.toThrow();
    });
  });
  describe("Features", () => {
    const mockDefaultFunction = vi.fn();
    const mockNamedFunction = vi.fn();
    const mockScalar = "scalar";
    beforeAll(() => {
      vi.doMock(MOCK.MODULE, () => {
        return {
          default: mockDefaultFunction,
          named: mockNamedFunction,
          scalar: mockScalar,
        };
      });
    });
    it("Calls the default function", async () => {
      const exports = ["default", "named"];
      const result = dynamicExport({ exports, moduleImport: MOCK.MODULE });
      await result.default();
      expect(mockDefaultFunction).toHaveBeenCalled();
    });
    it("Calls the named function", async () => {
      const exports = ["default", "named"];
      const result = dynamicExport({ exports, moduleImport: MOCK.MODULE });
      await result.named();
      expect(mockNamedFunction).toHaveBeenCalled();
    });
    it.todo("Returns the scalar", async () => {
      const exports = ["scalar"];
      const result = dynamicExport({ exports, moduleImport: MOCK.MODULE });
      expect(result.scalar).not.toBeFunction();
      expect(result.scalar).toBe(mockScalar);
    });
  });
});
