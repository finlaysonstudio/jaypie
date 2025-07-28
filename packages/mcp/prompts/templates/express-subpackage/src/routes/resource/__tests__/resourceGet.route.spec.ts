import { describe, expect, it } from "vitest";
import resourceGet from "../resourceGet.route.js";

describe("Resource Get Route", () => {
  it("returns resource data", async () => {
    const mockRequest = {
      query: { search: "test" },
      locals: {},
    } as any;

    const response = await resourceGet(mockRequest);
    
    expect(response.message).toBe("Resource endpoint");
    expect(response.query).toEqual({ search: "test" });
    expect(response.timestamp).toBeDefined();
  });

  it("handles empty query", async () => {
    const mockRequest = {
      query: {},
      locals: {},
    } as any;

    const response = await resourceGet(mockRequest);
    
    expect(response.message).toBe("Resource endpoint");
    expect(response.query).toEqual({});
  });
});