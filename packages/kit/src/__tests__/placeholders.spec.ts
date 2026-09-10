import { describe, expect, it } from "vitest";

import placeholders from "../lib/functions/placeholders.js";

describe("placeholders", () => {
  it("is a function", () => {
    expect(typeof placeholders).toBe("function");
  });

  describe("Whitespace", () => {
    it("resolves keys with and without inner whitespace", () => {
      expect(placeholders("{{name}}|{{ name }}", { name: "Alice" })).toBe(
        "Alice|Alice",
      );
    });

    it("preserves original whitespace on missing keys", () => {
      expect(placeholders("{{missing}}|{{ missing }}", {})).toBe(
        "{{missing}}|{{ missing }}",
      );
    });
  });

  describe("Falsy values", () => {
    it("renders empty string and zero (#526)", () => {
      expect(placeholders("a={{ x }} b={{ n }}", { n: 0, x: "" })).toBe(
        "a= b=0",
      );
    });

    it("renders false", () => {
      expect(placeholders("{{ flag }}", { flag: false })).toBe("false");
    });

    it("renders null", () => {
      expect(placeholders("{{ x }}", { x: null })).toBe("null");
    });

    it("renders falsy nested values", () => {
      expect(
        placeholders("{{ user.count }}|{{ items[0] }}", {
          items: [0],
          user: { count: 0 },
        }),
      ).toBe("0|0");
    });

    it("keeps the handlebar for undefined values", () => {
      expect(placeholders("{{ x }}", { x: undefined })).toBe("{{ x }}");
    });

    it("keeps the handlebar when an intermediate path is falsy", () => {
      expect(placeholders("{{ user.name }}", { user: null })).toBe(
        "{{ user.name }}",
      );
    });
  });
});
