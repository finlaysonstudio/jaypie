import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../../lib/errors.lib.js";

// Subject
import errorVar from "../errorVar.pipeline.js";

const { key, filter } = errorVar;

describe("ErrorVar Pipeline", () => {
  it("Works", () => {
    expect(key).toBe("error");
    const result = filter({ key: "value" });
    expect(result).not.toBeUndefined();
    expect(result).toBeObject();
    expect(result).toEqual({ key: "value" });
  });
  it("Doesn't touch an error string", () => {
    expect(key).toBe("error");
    const result = filter("sorpresa");
    expect(result).not.toBeUndefined();
    expect(result).toBeString();
    expect(result).toEqual("sorpresa");
  });
  it("Doesn't touch an error plain object", () => {
    expect(key).toBe("error");
    const result = filter({ message: "sorpresa" });
    expect(result).not.toBeUndefined();
    expect(result).toBeObject();
    expect(result).toEqual({ message: "sorpresa" });
  });
  it("Only returns certain keys if the object is an error instance", () => {
    // Arrange
    const error = new Error("Oh, I am slain!", { cause: "Sorpresa!" });
    // Act
    const result = filter(error);
    // Assert
    expect(result).not.toBeUndefined();
    expect(result).toBeObject();
    expect(result).toContainAllKeys(["cause", "message", "name", "stack"]);
  });
  it("Only returns certain keys if the object is a Jaypie error", () => {
    // Arrange
    const error = new ConfigurationError("Oh, I am slain!");
    // Act
    const result = filter(error);
    // Assert
    expect(result).not.toBeUndefined();
    expect(result).toBeObject();
    expect(result).toContainAllKeys([
      "detail",
      "isProjectError",
      "message",
      "name",
      "stack",
      "status",
      "title",
    ]);
  });
});
