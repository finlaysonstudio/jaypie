import { describe, expect, it, vi } from "vitest";

import { createDynamoDbStore } from "../../dynamodb";

const { loads } = vi.hoisted(() => ({ loads: { count: 0 } }));

vi.mock("@jaypie/dynamodb", () => {
  loads.count += 1;
  return {
    deleteEntity: vi.fn(async () => false),
    getEntity: vi.fn(async () => null),
    queryByCategory: vi.fn(async () => ({ items: [] })),
    updateEntity: vi.fn(async ({ entity }) => entity),
  };
});

describe("createDynamoDbStore loading", () => {
  it("does not load @jaypie/dynamodb until the first store operation", async () => {
    const store = createDynamoDbStore({ category: "jaypie" });
    expect(loads.count).toBe(0);

    await expect(store.list()).resolves.toEqual([]);
    expect(loads.count).toBe(1);
  });
});
