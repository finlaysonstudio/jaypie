import { describe, expect, it, vi } from "vitest";
import jaypieMock from "../jaypie.mock";

const { cloneDeep } = jaypieMock;

describe("cloneDeep", () => {
  it("Should be a mock function", () => {
    expect(vi.isMockFunction(cloneDeep)).toBe(true);
  });

  it("Should create a deep copy of an object", () => {
    const original = { a: 1, b: { c: 2 } };
    const copy = cloneDeep(original);
    
    // The copy should be a different object
    expect(copy).not.toBe(original);
    // But with the same structure
    expect(copy).toEqual(original);
    
    // Modifying the nested object in the copy should not affect the original
    copy.b.c = 3;
    expect(original.b.c).toBe(2);
  });
  
  it("Should handle arrays", () => {
    const original = [1, [2, 3]];
    const copy = cloneDeep(original);
    
    // The copy should be a different array
    expect(copy).not.toBe(original);
    // But with the same elements
    expect(copy).toEqual(original);
    
    // Modifying the nested array in the copy should not affect the original
    copy[1][0] = 4;
    expect(original[1][0]).toBe(2);
  });
  
  it("Should be mockable", () => {
    const mockValue = { mockResult: true };
    cloneDeep.mockReturnValueOnce(mockValue);
    
    const result = cloneDeep({ original: true });
    expect(result).toBe(mockValue);
    expect(cloneDeep).toHaveBeenCalledWith({ original: true });
  });
});