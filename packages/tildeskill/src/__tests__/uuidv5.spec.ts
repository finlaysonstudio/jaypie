import { describe, expect, it } from "vitest";

import { uuidv5 } from "../core/uuidv5";

// Vectors generated with the `uuid` package's v5()
const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

describe("uuidv5", () => {
  it("matches the RFC 4122 v5 reference implementation", () => {
    expect(uuidv5("jaypie:aws", { namespace: DNS_NAMESPACE })).toBe(
      "d4984b33-4f49-5cf6-ae0e-d7fbc6421bcc",
    );
    expect(uuidv5("hello", { namespace: URL_NAMESPACE })).toBe(
      "074171de-bc84-5ea4-b636-1135477620e1",
    );
  });

  it("is deterministic", () => {
    expect(uuidv5("x", { namespace: DNS_NAMESPACE })).toBe(
      uuidv5("x", { namespace: DNS_NAMESPACE }),
    );
  });

  it("throws ConfigurationError for an invalid namespace", () => {
    expect(() => uuidv5("x", { namespace: "not-a-uuid" })).toThrow(/namespace/);
  });
});
