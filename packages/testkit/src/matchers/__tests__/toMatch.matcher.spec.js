import { describe, expect, it } from "vitest";

// Subject
import { toMatchUuid } from "../toMatch.matcher.js";

expect.extend({ toMatchUuid });

//
//
// Run tests
//

describe("toMatch Matchers", () => {
  it("Is a function", () => {
    expect(toMatchUuid).toBeFunction();
  });
  describe("Matcher Function", () => {
    describe("toMatchUuid", () => {
      it("Matches UUIDs", () => {
        const response = toMatchUuid("123e4567-e89b-12d3-a456-426614174000");
        expect(response.message).toBeFunction();
        expect(response.message()).toBeString();
        expect(response.pass).toBeTrue();
      });
      it("Does not match non-UUIDs", () => {
        const response = toMatchUuid("mayhem");
        expect(response.message).toBeFunction();
        expect(response.message()).toBeString();
        expect(response.pass).toBeFalse();
      });
    });
  });
  describe("Extending Expect", () => {
    it("toMatchUuid", () => {
      expect("123e4567-e89b-12d3-a456-426614174000").toMatchUuid();
      expect("123e4567e89b12d3a456426614174000").toMatchUuid();
      expect("mayhem").not.toMatchUuid();
    });
  });
});
