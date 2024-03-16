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
    it("Throws if functions is not an array", async () => {
      try {
        await dynamicExport({ functions: "default" });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
    it("Throws if functions is an empty array", async () => {
      try {
        await dynamicExport({ functions: [] });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
    it("Throws if moduleImport is not a string", async () => {
      try {
        await dynamicExport({ moduleImport: 12 });
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
  });
  describe("Happy Path", () => {
    it("Returns an object", () => {
      expect(dynamicExport({ moduleImport: MOCK.MODULE })).toBeObject();
    });
    it("Scalars are undefined when module is not found", async () => {
      const vars = ["scalar"];
      const result = await dynamicExport({
        vars,
        moduleImport: MOCK.MODULE,
      });
      expect(result.scalar).toBeUndefined();
    });
    it("Exported functions throw if the real module is not installed", async () => {
      const functions = ["default"];
      const result = await dynamicExport({
        functions,
        moduleImport: MOCK.MODULE,
      });
      await expect(result.default()).rejects.toThrow();
    });
  });
  describe("Features", () => {
    const mockDefaultFunction = vi.fn();
    const mockNamedFunction = vi.fn();
    const mockVarName = "scalar";
    const mockVarValue = "value";
    beforeAll(() => {
      vi.doMock(MOCK.MODULE, () => {
        return {
          default: mockDefaultFunction,
          named: mockNamedFunction,
          [mockVarName]: mockVarValue,
        };
      });
    });
    it("Calls the default function", async () => {
      const functions = ["default", "named"];
      const result = await dynamicExport({
        functions,
        moduleImport: MOCK.MODULE,
      });
      await result.default();
      expect(mockDefaultFunction).toHaveBeenCalled();
    });
    it("Calls the named function", async () => {
      const functions = ["default", "named"];
      const result = await dynamicExport({
        functions,
        moduleImport: MOCK.MODULE,
      });
      await result.named();
      expect(mockNamedFunction).toHaveBeenCalled();
    });
    it("Returns the scalar", async () => {
      const vars = [mockVarName];
      const result = await dynamicExport({
        vars,
        moduleImport: MOCK.MODULE,
      });
      expect(result[mockVarName]).not.toBeFunction();
      expect(result[mockVarName]).toBe(mockVarValue);
    });
    it("Returns an object with the functions", async () => {
      const functions = ["default", "named"];
      const result = await dynamicExport({
        functions,
        moduleImport: MOCK.MODULE,
      });
      expect(result).toContainKeys(functions);
    });
    it("Returns an object with the functions as functions", async () => {
      const functions = ["default", "named"];
      const result = await dynamicExport({
        functions,
        moduleImport: MOCK.MODULE,
      });
      expect(result.default).toBeFunction();
      expect(result.named).toBeFunction();
    });
  });
});
