import { describe, expect, it } from "vitest";

import {
  parseFrontmatter,
  stringifyFrontmatter,
} from "../lib/functions/frontmatter.function.js";

describe("parseFrontmatter", () => {
  it("is a function", () => {
    expect(typeof parseFrontmatter).toBe("function");
  });

  it("parses frontmatter data and content body", () => {
    const input = "---\nname: Widget\ncount: 3\n---\n# Body\n\nText\n";
    const { content, data } = parseFrontmatter(input);
    expect(data).toEqual({ name: "Widget", count: 3 });
    expect(content).toBe("# Body\n\nText\n");
  });

  it("returns empty data and the input when there is no frontmatter", () => {
    const input = "# Just a heading\n\nNo frontmatter.\n";
    const { content, data } = parseFrontmatter(input);
    expect(data).toEqual({});
    expect(content).toBe(input);
  });

  it("treats four dashes as content, not a delimiter", () => {
    const input = "----\nnot frontmatter\n";
    const { content, data } = parseFrontmatter(input);
    expect(data).toEqual({});
    expect(content).toBe(input);
  });

  it("strips a leading byte-order mark before checking the delimiter", () => {
    const input = "﻿---\ntitle: Hello\n---\nbody\n";
    const { content, data } = parseFrontmatter(input);
    expect(data).toEqual({ title: "Hello" });
    expect(content).toBe("body\n");
  });

  it("handles a frontmatter block with no body", () => {
    const { content, data } = parseFrontmatter("---\nonly: data\n---\n");
    expect(data).toEqual({ only: "data" });
    expect(content).toBe("");
  });

  it("supports a generic frontmatter type", () => {
    const { data } = parseFrontmatter<{ version: string }>(
      "---\nversion: 1.2.3\n---\n",
    );
    expect(data.version).toBe("1.2.3");
  });
});

describe("stringifyFrontmatter", () => {
  it("is a function", () => {
    expect(typeof stringifyFrontmatter).toBe("function");
  });

  it("serializes frontmatter and body and round-trips through parse", () => {
    const output = stringifyFrontmatter("Body text", {
      description: "A widget",
      name: "Widget",
    });
    expect(output).toBe(
      "---\ndescription: A widget\nname: Widget\n---\nBody text\n",
    );
    const { content, data } = parseFrontmatter(output);
    expect(data).toEqual({ description: "A widget", name: "Widget" });
    expect(content).toBe("Body text\n");
  });

  it("returns the body alone when data is empty", () => {
    expect(stringifyFrontmatter("Just body")).toBe("Just body\n");
    expect(stringifyFrontmatter("Just body", {})).toBe("Just body\n");
  });
});
