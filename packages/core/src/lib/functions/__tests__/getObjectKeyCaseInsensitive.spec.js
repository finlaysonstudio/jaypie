import { describe, expect, it } from "vitest";

import getObjectKeyCaseInsensitive from "../getObjectKeyCaseInsensitive.js";

//
//
// Mock constants
//

const TEST = {
  VALUE: "testValue",
};

//
//
// Run tests
//

describe("GetObjectKeyCaseInsensitive", () => {
  it("Works", async () => {
    const object = { one: TEST.VALUE };
    const response = await getObjectKeyCaseInsensitive(object, "one");
    expect(response).toBe(TEST.VALUE);
  });
  it("Matches lowercase to uppercase", async () => {
    const object = { one: TEST.VALUE };
    const response = await getObjectKeyCaseInsensitive(object, "ONE");
    expect(response).toBe(TEST.VALUE);
  });
  it("Matches uppercase to lowercase", async () => {
    const object = { ONE: TEST.VALUE };
    const response = await getObjectKeyCaseInsensitive(object, "one");
    expect(response).toBe(TEST.VALUE);
  });
});
