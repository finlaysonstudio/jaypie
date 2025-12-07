import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Subject
import sleep from "../sleep.function.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

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
});

//
//
// Run tests
//

describe("Sleep Function", () => {
  it("Does not sleep in test", async () => {
    const currentTime = Date.now();
    await sleep(1000);
    const newTime = Date.now();
    expect(newTime - currentTime).toBeLessThan(1000);
  });
});
