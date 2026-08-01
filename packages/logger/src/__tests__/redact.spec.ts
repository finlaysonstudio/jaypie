import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRedactor,
  isSecret,
  looksSecret,
  REDACTED,
  sanitizeAuth,
  secret,
} from "../redact";
import Logger from "../Logger";

//
//
// Helpers
//

function md5Last4(value: string): string {
  const hash = createHash("md5").update(value).digest("hex");
  return `md5_${hash.slice(-4)}`;
}

function lastJsonOutput(spy: ReturnType<typeof vi.spyOn>): any {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  return JSON.parse(call[0] as string);
}

//
//
// Tests
//

describe("Redaction", () => {
  const ENV_KEYS = ["LOG_REDACT", "LOG_REDACT_KEYS"];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.restoreAllMocks();
  });

  describe("Recursion", () => {
    it("redacts authorization nested in a logged wrapper", () => {
      const value = {
        event: {
          headers: { authorization: "Bearer sk_live_abcdef123456" },
        },
      };
      const result = sanitizeAuth(value) as any;
      expect(result.event.headers.authorization).toBe("sk_3456");
    });

    it("redacts inside arrays", () => {
      const value = {
        accounts: [{ accountNumber: "000123456789" }],
      };
      const result = sanitizeAuth(value) as any;
      expect(result.accounts[0].accountNumber).toBe("…6789");
    });

    it("returns the original reference when nothing redacts", () => {
      const value = { foo: "bar", nested: { baz: [1, 2, 3] } };
      expect(sanitizeAuth(value)).toBe(value);
    });

    it("does not mutate the input", () => {
      const value = {
        bankAccount: { accountNumber: "000123456789" },
      };
      sanitizeAuth(value);
      expect(value.bankAccount.accountNumber).toBe("000123456789");
    });

    it("survives circular references", () => {
      const value: any = { password: "hunter22" };
      value.self = value;
      const result = sanitizeAuth(value) as any;
      expect(result.password).toBe(md5Last4("hunter22"));
      expect(result.self).toBe("[Circular]");
    });

    it("does not traverse class instances", () => {
      const value = { when: new Date(0) };
      expect(sanitizeAuth(value)).toBe(value);
    });
  });

  describe("Denylist and renders", () => {
    it("renders bank account and routing numbers as last four", () => {
      const result = sanitizeAuth({
        bankAccount: {
          accountNumber: "000123456789",
          routingNumber: "021000021",
        },
      }) as any;
      expect(result.bankAccount.accountNumber).toBe("…6789");
      expect(result.bankAccount.routingNumber).toBe("…0021");
    });

    it("renders card numbers as bin plus last four", () => {
      const result = sanitizeAuth({
        cardNumber: "4111 1111 1111 1111",
      }) as any;
      expect(result.cardNumber).toBe("411111…1111");
    });

    it("renders ssn as last four", () => {
      const result = sanitizeAuth({ ssn: "123-45-6789" }) as any;
      expect(result.ssn).toBe("…6789");
    });

    it("never renders any part of a cvv", () => {
      const result = sanitizeAuth({ cvv: "123" }) as any;
      expect(result.cvv).toBe(REDACTED);
      expect(result.cvv).not.toContain("1");
    });

    it("fully redacts values too short for a partial reveal", () => {
      const result = sanitizeAuth({ accountNumber: "1234" }) as any;
      expect(result.accountNumber).toBe(REDACTED);
    });

    it("matches names regardless of case and separators", () => {
      const result = sanitizeAuth({
        Routing_Number: "021000021",
        "x-api-key": "sk_live_abcdef123456",
      }) as any;
      expect(result.Routing_Number).toBe("…0021");
      expect(result["x-api-key"]).toBe("sk_3456");
    });

    it("redacts password and refreshToken auth-style", () => {
      const result = sanitizeAuth({
        password: "hunter22",
        refreshToken: "sk_live_abcdef123456",
      }) as any;
      expect(result.password).toBe(md5Last4("hunter22"));
      expect(result.refreshToken).toBe("sk_3456");
    });

    it("redacts numeric values", () => {
      const result = sanitizeAuth({ accountNumber: 123456789012 }) as any;
      expect(result.accountNumber).toBe("…9012");
    });

    it("collapses objects under redacted names", () => {
      const result = sanitizeAuth({ apiKey: { id: "a", value: "b" } }) as any;
      expect(result.apiKey).toBe(REDACTED);
    });
  });

  describe("looksSecret", () => {
    it("accepts known credential shapes", () => {
      expect(looksSecret("sk_live_abcdef123456")).toBe(true);
      expect(looksSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
      expect(looksSecret("ghp_abcdefghij1234567890KLMNO")).toBe(true);
      expect(looksSecret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-part")).toBe(
        true,
      );
    });

    it("accepts random mixed tokens with rare letters", () => {
      expect(looksSecret("A8kQzX92LmNv4PqRw7Jt")).toBe(true);
    });

    it("rejects paths, urls, uuids, and prose", () => {
      expect(looksSecret("uploads/2026/report.pdf")).toBe(false);
      expect(looksSecret("https://example.com/a")).toBe(false);
      expect(looksSecret("0b86c3c7-aa64-4c28-81cb-bad5c1c80456")).toBe(false);
      expect(looksSecret("MyDocument2024Final")).toBe(false);
      expect(looksSecret("plain words here")).toBe(false);
      expect(looksSecret("short")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(looksSecret(1234567890123456)).toBe(false);
      expect(looksSecret(null)).toBe(false);
    });
  });

  describe("Ambiguous names", () => {
    it("redacts a secret-looking value under key", () => {
      const result = sanitizeAuth({
        findings: [{ field: "apiKey", key: "sk_live_abcdef123456" }],
      }) as any;
      expect(result.findings[0].key).toBe("sk_3456");
    });

    it("keeps a pathy value under key", () => {
      const value = { key: "uploads/2026/report.pdf" };
      expect(sanitizeAuth(value)).toBe(value);
    });

    it("keeps a uuid under key", () => {
      const value = { key: "0b86c3c7-aa64-4c28-81cb-bad5c1c80456" };
      expect(sanitizeAuth(value)).toBe(value);
    });

    it("keeps short structured values under key", () => {
      const value = { key: "USER#123" };
      expect(sanitizeAuth(value)).toBe(value);
    });

    it("keeps ordinary values under token", () => {
      const value = { token: "color.primary" };
      expect(sanitizeAuth(value)).toBe(value);
    });
  });

  describe("Secret-shaped values under any name", () => {
    it("redacts credential-shaped strings regardless of field name", () => {
      const result = sanitizeAuth({
        note: "sk_live_abcdef123456",
      }) as any;
      expect(result.note).toBe("sk_3456");
    });

    it("keeps slug values that merely start with sk-", () => {
      const value = { vendor: "sk-hynix-memory-chips" };
      expect(sanitizeAuth(value)).toBe(value);
    });
  });

  describe("secret()", () => {
    it("brands a value", () => {
      const wrapped = secret("plaintext-credential");
      expect(isSecret(wrapped)).toBe(true);
      expect(isSecret("plaintext-credential")).toBe(false);
    });

    it("serializes to the true value for the real consumer", () => {
      const wrapped = secret("plaintext-credential");
      expect(JSON.stringify({ key: wrapped })).toBe(
        '{"key":"plaintext-credential"}',
      );
      expect(String(wrapped)).toBe("plaintext-credential");
    });

    it("redacts wherever the logger walks", () => {
      const result = sanitizeAuth({
        findings: [{ field: "apiKey", value: secret("plaintext-credential") }],
      }) as any;
      expect(result.findings[0].value).toBe(md5Last4("plaintext-credential"));
    });

    it("is idempotent", () => {
      const wrapped = secret("value");
      expect(secret(wrapped)).toBe(wrapped);
    });
  });

  describe("Pluggable configuration", () => {
    it("honors extra names via redactKeys", () => {
      const redactor = createRedactor({ redactKeys: ["memberId"] });
      const result = redactor({ member_id: "abc123" }) as any;
      expect(result.member_id).toBe(md5Last4("abc123"));
    });

    it("honors extra names via LOG_REDACT_KEYS", () => {
      process.env.LOG_REDACT_KEYS = "memberId,internalNote";
      const redactor = createRedactor();
      const result = redactor({ memberId: "abc123" }) as any;
      expect(result.memberId).toBe(md5Last4("abc123"));
    });

    it("honors a custom hook ahead of built-in rules", () => {
      const redactor = createRedactor({
        redact: (value, { path }) =>
          path === "body.email" ? "redacted-email" : undefined,
      });
      const result = redactor({
        body: { email: "adamf@example.com", name: "Adam" },
      }) as any;
      expect(result.body.email).toBe("redacted-email");
      expect(result.body.name).toBe("Adam");
    });

    it("provides key and path context to the hook", () => {
      const calls: Array<{ key?: string; path: string }> = [];
      const redactor = createRedactor({
        redact: (value, context) => {
          calls.push(context);
          return undefined;
        },
      });
      redactor({ a: [{ b: 1 }] });
      expect(calls).toContainEqual({ key: "b", path: "a[0].b" });
    });

    it("disables all scrubbing with redact false", () => {
      const redactor = createRedactor({ redact: false });
      const value = { password: "hunter22" };
      expect(redactor(value)).toBe(value);
    });

    it("disables all scrubbing with LOG_REDACT env", () => {
      process.env.LOG_REDACT = "false";
      const redactor = createRedactor();
      const value = { password: "hunter22" };
      expect(redactor(value)).toBe(value);
    });

    it("explicit option overrides LOG_REDACT env", () => {
      process.env.LOG_REDACT = "false";
      const redactor = createRedactor({ redact: () => undefined });
      const result = redactor({ password: "hunter22" }) as any;
      expect(result.password).toBe(md5Last4("hunter22"));
    });
  });

  describe("Logger integration", () => {
    it("redacts nested credentials in log.var", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", level: "debug" });
      logger.debug.var({
        event: { headers: { authorization: "Bearer sk_live_abcdef123456" } },
      });
      const entry = lastJsonOutput(spy);
      expect(entry.data.headers.authorization).toBe("sk_3456");
      expect(entry.message).not.toContain("sk_live_abcdef123456");
    });

    it("redacts the wrapper key itself in log.var", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", level: "debug" });
      logger.debug.var({ password: "hunter22" });
      const entry = lastJsonOutput(spy);
      expect(entry.data).toBe(md5Last4("hunter22"));
    });

    it("redacts objects passed to plain log methods", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", level: "debug" });
      logger.debug("Submit input", {
        bankAccount: {
          accountNumber: "000123456789",
          routingNumber: "021000021",
        },
      });
      const entry = lastJsonOutput(spy);
      expect(entry.data.bankAccount.accountNumber).toBe("…6789");
      expect(entry.data.bankAccount.routingNumber).toBe("…0021");
    });

    it("honors redactKeys and hook via logger config", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", level: "debug" });
      logger.config({ redactKeys: ["memberId"] });
      logger.debug.var({ memberId: "abc123" });
      const entry = lastJsonOutput(spy);
      expect(entry.data).toBe(md5Last4("abc123"));
    });

    it("renders secret() through redactAuth in log output", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", level: "debug" });
      logger.debug.var({
        response: { data: { key: secret("plaintext-credential") } },
      });
      const entry = lastJsonOutput(spy);
      expect(entry.data.data.key).toBe(md5Last4("plaintext-credential"));
    });
  });
});
