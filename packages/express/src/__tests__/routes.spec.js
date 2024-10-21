import { describe, expect, it } from "vitest";

// Subject
import {
  echoRoute,
  forbiddenRoute,
  goneRoute,
  noContentRoute,
  notFoundRoute,
  notImplementedRoute,
} from "../routes.js";

//
//
// Run tests
//

describe("Routes", () => {
  it("Exports functions we expect", () => {
    expect(echoRoute).toBeFunction();
    expect(forbiddenRoute).toBeFunction();
    expect(goneRoute).toBeFunction();
    expect(noContentRoute).toBeFunction();
    expect(notFoundRoute).toBeFunction();
    expect(notImplementedRoute).toBeFunction();
  });
});
