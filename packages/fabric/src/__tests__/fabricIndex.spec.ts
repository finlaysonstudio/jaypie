import { describe, expect, it } from "vitest";

import { fabricIndex } from "../index.js";

describe("fabricIndex", () => {
  it("returns the by-model shape when called with no field", () => {
    expect(fabricIndex()).toEqual({
      name: "indexModel",
      pk: ["model"],
      sk: ["scope", "updatedAt"],
    });
  });

  it("returns a sparse by-alias shape", () => {
    expect(fabricIndex("alias")).toEqual({
      name: "indexModelAlias",
      pk: ["model", "alias"],
      sk: ["scope", "updatedAt"],
      sparse: true,
    });
  });

  it("returns a sparse by-xid shape", () => {
    expect(fabricIndex("xid")).toEqual({
      name: "indexModelXid",
      pk: ["model", "xid"],
      sk: ["scope", "updatedAt"],
      sparse: true,
    });
  });

  it("handles category and type as ordinary fields", () => {
    expect(fabricIndex("category")).toMatchObject({
      name: "indexModelCategory",
      pk: ["model", "category"],
      sparse: true,
    });
    expect(fabricIndex("type")).toMatchObject({
      name: "indexModelType",
      pk: ["model", "type"],
      sparse: true,
    });
  });

  it("accepts an arbitrary field name and capitalizes it in the index name", () => {
    expect(fabricIndex("taco")).toEqual({
      name: "indexModelTaco",
      pk: ["model", "taco"],
      sk: ["scope", "updatedAt"],
      sparse: true,
    });
  });

  it("always sorts by scope + updatedAt", () => {
    for (const field of [undefined, "alias", "xid", "category", "taco"]) {
      expect(fabricIndex(field).sk).toEqual(["scope", "updatedAt"]);
    }
  });
});
