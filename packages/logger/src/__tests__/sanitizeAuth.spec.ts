import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { redactAuth, sanitizeAuth } from "../sanitizeAuth";

describe("sanitizeAuth", () => {
  describe("redactAuth", () => {
    it("redacts sk-prefixed keys", () => {
      expect(redactAuth("sk-proj-abc1234")).toBe("sk_1234");
    });

    it("redacts Bearer with sk token", () => {
      expect(redactAuth("Bearer sk-proj-abc1234")).toBe("sk_1234");
    });

    it("redacts non-sk values with md5 suffix", () => {
      const value = "Bearer eyJtoken";
      const hash = createHash("md5").update(value).digest("hex");
      expect(redactAuth(value)).toBe(`md5_${hash.slice(-4)}`);
    });

    it("handles non-string input", () => {
      const result = redactAuth(12345);
      expect(result).toMatch(/^md5_[a-f0-9]{4}$/);
    });
  });

  describe("sanitizeAuth", () => {
    it("passes non-objects through unchanged", () => {
      expect(sanitizeAuth("hello")).toBe("hello");
      expect(sanitizeAuth(42)).toBe(42);
      expect(sanitizeAuth(null)).toBe(null);
      expect(sanitizeAuth(undefined)).toBe(undefined);
    });

    it("passes arrays through unchanged", () => {
      const arr = [1, 2, 3];
      expect(sanitizeAuth(arr)).toBe(arr);
    });

    it("returns original object when no authorization key", () => {
      const obj = { foo: "bar", baz: 123 };
      expect(sanitizeAuth(obj)).toBe(obj);
    });

    it("redacts authorization key (lowercase)", () => {
      const obj = { authorization: "Bearer sk-proj-abc1234" };
      const result = sanitizeAuth(obj) as Record<string, unknown>;
      expect(result.authorization).toBe("sk_1234");
    });

    it("redacts Authorization key (mixed case)", () => {
      const obj = { Authorization: "Bearer sk-proj-abc1234" };
      const result = sanitizeAuth(obj) as Record<string, unknown>;
      expect(result.Authorization).toBe("sk_1234");
    });

    it("redacts AUTHORIZATION key (upper case)", () => {
      const obj = { AUTHORIZATION: "Bearer sk-proj-abc1234" };
      const result = sanitizeAuth(obj) as Record<string, unknown>;
      expect(result.AUTHORIZATION).toBe("sk_1234");
    });

    it("redacts nested headers.authorization", () => {
      const obj = {
        headers: {
          authorization: "Bearer sk-proj-abc1234",
          "content-type": "application/json",
        },
      };
      const result = sanitizeAuth(obj) as Record<
        string,
        Record<string, unknown>
      >;
      expect(result.headers.authorization).toBe("sk_1234");
      expect(result.headers["content-type"]).toBe("application/json");
    });

    it("does not mutate the original object", () => {
      const obj = { authorization: "Bearer sk-proj-abc1234" };
      const original = obj.authorization;
      sanitizeAuth(obj);
      expect(obj.authorization).toBe(original);
    });

    it("does not mutate nested headers object", () => {
      const headers = { Authorization: "Bearer sk-proj-abc1234" };
      const obj = { headers };
      sanitizeAuth(obj);
      expect(headers.Authorization).toBe("Bearer sk-proj-abc1234");
    });

    it("skips headers that are not objects", () => {
      const obj = { headers: "not-an-object" };
      expect(sanitizeAuth(obj)).toBe(obj);
    });

    it("returns original when headers has no authorization", () => {
      const obj = { headers: { "content-type": "application/json" } };
      expect(sanitizeAuth(obj)).toBe(obj);
    });

    it("redacts top-level X-Service-Key (case-insensitive)", () => {
      const obj = { "X-Service-Key": "sk-proj-abc1234" };
      const result = sanitizeAuth(obj) as Record<string, unknown>;
      expect(result["X-Service-Key"]).toBe("sk_1234");
    });

    it("redacts top-level X-Webhook-Token (case-insensitive)", () => {
      const obj = { "x-webhook-token": "sk-proj-abc1234" };
      const result = sanitizeAuth(obj) as Record<string, unknown>;
      expect(result["x-webhook-token"]).toBe("sk_1234");
    });

    it("redacts nested headers X-Service-Key and X-Webhook-Token", () => {
      const obj = {
        headers: {
          "X-Service-Key": "sk-proj-service1234",
          "X-Webhook-Token": "sk-proj-webhook1234",
          "content-type": "application/json",
        },
      };
      const result = sanitizeAuth(obj) as Record<
        string,
        Record<string, unknown>
      >;
      expect(result.headers["X-Service-Key"]).toBe("sk_1234");
      expect(result.headers["X-Webhook-Token"]).toBe("sk_1234");
      expect(result.headers["content-type"]).toBe("application/json");
    });

    it("redacts authorization alongside service key and webhook token in headers", () => {
      const obj = {
        headers: {
          Authorization: "Bearer sk-proj-auth1234",
          "x-service-key": "Bearer sk-proj-service1234",
          "X-Webhook-Token": "Bearer sk-proj-webhook1234",
        },
      };
      const result = sanitizeAuth(obj) as Record<
        string,
        Record<string, unknown>
      >;
      expect(result.headers.Authorization).toBe("sk_1234");
      expect(result.headers["x-service-key"]).toBe("sk_1234");
      expect(result.headers["X-Webhook-Token"]).toBe("sk_1234");
    });

    it("does not mutate nested headers when redacting service key", () => {
      const headers = { "X-Service-Key": "sk-proj-abc1234" };
      const obj = { headers };
      sanitizeAuth(obj);
      expect(headers["X-Service-Key"]).toBe("sk-proj-abc1234");
    });
  });
});
