import { BadRequestError } from "@jaypie/errors";
import { describe, expect, it } from "vitest";

import { fabricService } from "..";

// Example from README: division handler
const divisionHandler = fabricService({
  alias: "division",
  description: "Divides two numbers",
  input: {
    denominator: {
      default: 3,
      description: "Number 'on bottom', how many ways to split the value",
      type: Number,
      validate: (value) => value !== 0,
    },
    numerator: {
      default: 12,
      description: "Number 'on top', which is to be divided",
      type: Number,
    },
  },
  service: ({
    denominator,
    numerator,
  }: {
    denominator: number;
    numerator: number;
  }) => numerator / denominator,
});

describe("fabricService", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof fabricService).toBe("function");
    });

    it("returns a function", () => {
      const handler = fabricService({
        service: () => "test",
      });
      expect(typeof handler).toBe("function");
    });

    it("returns a Promise", async () => {
      const handler = fabricService({
        service: () => "test",
      });
      const result = handler();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBe("test");
    });

    it("exposes config properties directly on returned handler", () => {
      const config = {
        alias: "test-handler",
        description: "A test handler",
        input: {
          value: { type: Number, default: 42 },
        },
        service: ({ value }: { value: number }) => value * 2,
      };
      const handler = fabricService(config);

      expect(handler.alias).toBe("test-handler");
      expect(handler.description).toBe("A test handler");
      expect(handler.input).toBe(config.input);
      expect(handler.service).toBe(config.service);
    });

    it("handler has all original config properties", () => {
      const handler = fabricService({
        alias: "division",
        description: "Divides numbers",
        input: {
          denominator: { default: 2, type: Number },
          numerator: { type: Number },
        },
        service: ({
          denominator,
          numerator,
        }: {
          denominator: number;
          numerator: number;
        }) => numerator / denominator,
      });

      expect(handler.alias).toBe("division");
      expect(handler.description).toBe("Divides numbers");
      expect(handler.input?.numerator).toBeDefined();
      expect(handler.input?.denominator).toBeDefined();
      expect(handler.input?.denominator.default).toBe(2);
    });
  });

  describe("Happy Paths", () => {
    it("divisionHandler() returns 4 (uses defaults)", async () => {
      // divisionHandler(); // =4
      await expect(divisionHandler()).resolves.toBe(4);
    });

    it("divisionHandler({ numerator: 24 }) returns 8", async () => {
      // divisionHandler({ numerator: 24 }); // =8
      await expect(divisionHandler({ numerator: 24 })).resolves.toBe(8);
    });

    it("divisionHandler({ numerator: 24, denominator: 2 }) returns 12", async () => {
      // divisionHandler({ numerator: 24, denominator: 2 }); // =12
      await expect(
        divisionHandler({ numerator: 24, denominator: 2 }),
      ).resolves.toBe(12);
    });

    it('divisionHandler({ numerator: "14", denominator: "7" }) returns 2 (converts strings)', async () => {
      // divisionHandler({ numerator: "14", denominator: "7" }); // =2
      await expect(
        divisionHandler({ numerator: "14", denominator: "7" }),
      ).resolves.toBe(2);
    });

    it('divisionHandler(\'{ "numerator": "18" }\') returns 6 (parses JSON string)', async () => {
      // divisionHandler('{ "numerator": "18" }'); // =6; String parses as JSON
      await expect(divisionHandler('{ "numerator": "18" }')).resolves.toBe(6);
    });
  });

  describe("Error Cases", () => {
    it("divisionHandler({ numerator: 1, denominator: 0 }) throws BadRequestError (fails validation)", async () => {
      // divisionHandler({ numerator: 1, denominator: 0 }); // throws BadRequestError
      await expect(
        divisionHandler({ numerator: 1, denominator: 0 }),
      ).rejects.toThrow(BadRequestError);
    });

    it('divisionHandler({ numerator: 1, denominator: "0" }) throws BadRequestError (fails validation after conversion)', async () => {
      // divisionHandler({ numerator: 1, denominator: "0" }); // throws BadRequestError
      await expect(
        divisionHandler({ numerator: 1, denominator: "0" }),
      ).rejects.toThrow(BadRequestError);
    });

    it('divisionHandler({ numerator: "ONE" }) throws BadRequestError (cannot convert NaN)', async () => {
      // divisionHandler({ numerator: "ONE" }); // throws BadRequestError
      await expect(divisionHandler({ numerator: "ONE" })).rejects.toThrow(
        BadRequestError,
      );
    });

    it('divisionHandler({ denominator: "TWO" }) throws BadRequestError (cannot convert NaN)', async () => {
      // divisionHandler({ denominator: "TWO" }); // throws BadRequestError
      await expect(divisionHandler({ denominator: "TWO" })).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe("Features", () => {
    describe("Input Parsing", () => {
      it("handles empty input", async () => {
        const handler = fabricService({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler()).resolves.toBe(42);
      });

      it("handles undefined input", async () => {
        const handler = fabricService({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler(undefined)).resolves.toBe(42);
      });

      it("parses JSON string input", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler('{ "value": 42 }')).resolves.toBe(42);
      });

      it("throws on invalid JSON", async () => {
        const handler = fabricService({
          service: () => "test",
        });
        await expect(handler("not json")).rejects.toThrow(BadRequestError);
      });

      it("throws on non-object JSON", async () => {
        const handler = fabricService({
          service: () => "test",
        });
        await expect(handler("[1, 2, 3]")).rejects.toThrow(BadRequestError);
      });
    });

    describe("Type Conversion", () => {
      it("converts string to number", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: "42" })).resolves.toBe(42);
      });

      it("converts string to boolean", async () => {
        const handler = fabricService({
          input: {
            value: { type: Boolean },
          },
          service: ({ value }: { value: boolean }) => value,
        });
        await expect(handler({ value: "true" })).resolves.toBe(true);
        await expect(handler({ value: "false" })).resolves.toBe(false);
      });

      it("converts number to string", async () => {
        const handler = fabricService({
          input: {
            value: { type: String },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: 42 })).resolves.toBe("42");
      });

      it("converts number to boolean", async () => {
        const handler = fabricService({
          input: {
            value: { type: Boolean },
          },
          service: ({ value }: { value: boolean }) => value,
        });
        await expect(handler({ value: 1 })).resolves.toBe(true);
        await expect(handler({ value: 0 })).resolves.toBe(false);
        await expect(handler({ value: -1 })).resolves.toBe(false);
      });

      it("converts boolean to number", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: true })).resolves.toBe(1);
        await expect(handler({ value: false })).resolves.toBe(0);
      });

      it("converts boolean to string", async () => {
        const handler = fabricService({
          input: {
            value: { type: String },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: true })).resolves.toBe("true");
        await expect(handler({ value: false })).resolves.toBe("false");
      });
    });

    describe("Validation", () => {
      it("validates with function returning false", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: Number,
              validate: (v) => (v as number) > 0,
            },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: 1 })).resolves.toBe(1);
        await expect(handler({ value: 0 })).rejects.toThrow(BadRequestError);
      });

      it("validates with function throwing", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: Number,
              validate: (v) => {
                if ((v as number) <= 0)
                  throw new BadRequestError("Must be positive");
              },
            },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: 1 })).resolves.toBe(1);
        await expect(handler({ value: 0 })).rejects.toThrow(BadRequestError);
      });

      it("validates with async function", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: Number,
              validate: async (v) => {
                await Promise.resolve();
                return (v as number) > 0;
              },
            },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: 1 })).resolves.toBe(1);
        await expect(handler({ value: 0 })).rejects.toThrow(BadRequestError);
      });

      it("validates with RegExp", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: String,
              validate: /^[a-z]+$/,
            },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: "abc" })).resolves.toBe("abc");
        await expect(handler({ value: "ABC" })).rejects.toThrow(
          BadRequestError,
        );
        await expect(handler({ value: "123" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("validates with array of allowed values", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: String,
              validate: ["red", "green", "blue"],
            },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: "red" })).resolves.toBe("red");
        await expect(handler({ value: "green" })).resolves.toBe("green");
        await expect(handler({ value: "yellow" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("validates with array containing RegExp", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: String,
              validate: [/^test-/, "special"],
            },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: "test-123" })).resolves.toBe("test-123");
        await expect(handler({ value: "special" })).resolves.toBe("special");
        await expect(handler({ value: "other" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("validates with array containing async function", async () => {
        const handler = fabricService({
          input: {
            value: {
              type: Number,
              validate: [
                async (v) => {
                  await Promise.resolve();
                  return (v as number) === 42;
                },
              ],
            },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: 42 })).resolves.toBe(42);
        await expect(handler({ value: 1 })).rejects.toThrow(BadRequestError);
      });

      it("skips validation for undefined values when not required", async () => {
        const handler = fabricService({
          input: {
            value: {
              required: false,
              type: Number,
              validate: (v) => (v as number) > 0,
            },
          },
          service: ({ value }: { value?: number }) => value ?? "undefined",
        });
        await expect(handler({})).resolves.toBe("undefined");
      });
    });

    describe("Required Fields", () => {
      it("throws when required field is missing (no default)", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({})).rejects.toThrow(BadRequestError);
        await expect(handler({})).rejects.toThrow(
          'Missing required field "value"',
        );
      });

      it("does not throw when field has default", async () => {
        const handler = fabricService({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({})).resolves.toBe(42);
      });

      it("does not throw when required: false", async () => {
        const handler = fabricService({
          input: {
            value: { required: false, type: Number },
          },
          service: ({ value }: { value?: number }) => value ?? "undefined",
        });
        await expect(handler({})).resolves.toBe("undefined");
      });

      it("throws when required field is empty string (converts to undefined)", async () => {
        const handler = fabricService({
          input: {
            value: { type: String },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: "" })).rejects.toThrow(BadRequestError);
      });

      it("does not throw when required: true with default (default takes precedence)", async () => {
        const handler = fabricService({
          input: {
            value: { default: 42, required: true, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({})).resolves.toBe(42);
      });

      it("throws on missing required field even with other fields provided", async () => {
        const handler = fabricService({
          input: {
            a: { type: Number },
            b: { type: Number },
          },
          service: ({ a, b }: { a: number; b: number }) => a + b,
        });
        await expect(handler({ a: 1 })).rejects.toThrow(
          'Missing required field "b"',
        );
      });
    });

    describe("Default Values", () => {
      it("applies default when value is undefined", async () => {
        const handler = fabricService({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({})).resolves.toBe(42);
      });

      it("does not apply default when value is provided", async () => {
        const handler = fabricService({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: 100 })).resolves.toBe(100);
      });
    });

    describe("String Type Notation", () => {
      it('accepts "number" as type', async () => {
        const handler = fabricService({
          input: {
            value: { type: "number" },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: "42" })).resolves.toBe(42);
      });

      it('accepts "string" as type', async () => {
        const handler = fabricService({
          input: {
            value: { type: "string" },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: 42 })).resolves.toBe("42");
      });

      it('accepts "boolean" as type', async () => {
        const handler = fabricService({
          input: {
            value: { type: "boolean" },
          },
          service: ({ value }: { value: boolean }) => value,
        });
        await expect(handler({ value: "true" })).resolves.toBe(true);
      });
    });

    describe("Async Service", () => {
      it("supports async service function", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number },
          },
          service: async ({ value }: { value: number }) => {
            await Promise.resolve();
            return value * 2;
          },
        });
        await expect(handler({ value: 21 })).resolves.toBe(42);
      });
    });

    describe("Bare RegExp Type Shorthand", () => {
      it("accepts bare RegExp as type shorthand for validated string", async () => {
        const handler = fabricService({
          input: {
            email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
          },
          service: ({ email }: { email: string }) => email,
        });
        await expect(handler({ email: "test@example.com" })).resolves.toBe(
          "test@example.com",
        );
      });

      it("throws BadRequestError when value does not match RegExp", async () => {
        const handler = fabricService({
          input: {
            email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
          },
          service: ({ email }: { email: string }) => email,
        });
        await expect(handler({ email: "invalid" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("converts value to string before validation", async () => {
        const handler = fabricService({
          input: {
            code: { type: /^\d+$/ },
          },
          service: ({ code }: { code: string }) => code,
        });
        // Number 123 converts to string "123" which matches the regex
        await expect(handler({ code: 123 })).resolves.toBe("123");
      });

      it("supports default value with bare RegExp", async () => {
        const handler = fabricService({
          input: {
            code: { default: "ABC123", type: /^[A-Z]+\d+$/ },
          },
          service: ({ code }: { code: string }) => code,
        });
        await expect(handler({})).resolves.toBe("ABC123");
        await expect(handler({ code: "XYZ789" })).resolves.toBe("XYZ789");
      });

      it("supports required: false with bare RegExp", async () => {
        const handler = fabricService({
          input: {
            code: { required: false, type: /^[A-Z]+$/ },
          },
          service: ({ code }: { code?: string }) => code ?? "none",
        });
        await expect(handler({})).resolves.toBe("none");
      });

      it("works with no service (validation only)", async () => {
        const handler = fabricService({
          input: {
            email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
            name: { type: String },
          },
        });
        await expect(
          handler({ email: "bob@example.com", name: "Bob" }),
        ).resolves.toEqual({
          email: "bob@example.com",
          name: "Bob",
        });
      });

      it("real-world example: URL validation", async () => {
        const handler = fabricService({
          input: {
            url: { type: /^https?:\/\/.+/ },
          },
          service: ({ url }: { url: string }) => url,
        });
        await expect(handler({ url: "https://example.com" })).resolves.toBe(
          "https://example.com",
        );
        await expect(handler({ url: "http://localhost:3000" })).resolves.toBe(
          "http://localhost:3000",
        );
        await expect(handler({ url: "ftp://invalid" })).rejects.toThrow(
          BadRequestError,
        );
      });
    });

    describe("Validated String Shorthand", () => {
      it('accepts ["value1", "value2"] as type shorthand for validated string', async () => {
        const handler = fabricService({
          input: {
            currency: { type: ["dec", "sps"] },
          },
          service: ({ currency }: { currency: string }) => currency,
        });
        await expect(handler({ currency: "dec" })).resolves.toBe("dec");
        await expect(handler({ currency: "sps" })).resolves.toBe("sps");
      });

      it("throws BadRequestError when value not in allowed list", async () => {
        const handler = fabricService({
          input: {
            currency: { type: ["dec", "sps"] },
          },
          service: ({ currency }: { currency: string }) => currency,
        });
        await expect(handler({ currency: "usd" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("converts value to string before validation", async () => {
        const handler = fabricService({
          input: {
            code: { type: ["1", "2", "3"] },
          },
          service: ({ code }: { code: string }) => code,
        });
        // Number 1 converts to string "1" which matches
        await expect(handler({ code: 1 })).resolves.toBe("1");
      });

      it("accepts RegExp in validation array", async () => {
        const handler = fabricService({
          input: {
            value: { type: [/^test-/, "special"] },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: "test-123" })).resolves.toBe("test-123");
        await expect(handler({ value: "test-abc" })).resolves.toBe("test-abc");
        await expect(handler({ value: "special" })).resolves.toBe("special");
        await expect(handler({ value: "other" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("accepts array with only RegExp", async () => {
        const handler = fabricService({
          input: {
            email: { type: [/^[^@]+@[^@]+\.[^@]+$/] },
          },
          service: ({ email }: { email: string }) => email,
        });
        await expect(handler({ email: "test@example.com" })).resolves.toBe(
          "test@example.com",
        );
        await expect(handler({ email: "invalid" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("supports default value with validated string", async () => {
        const handler = fabricService({
          input: {
            currency: { default: "dec", type: ["dec", "sps"] },
          },
          service: ({ currency }: { currency: string }) => currency,
        });
        await expect(handler({})).resolves.toBe("dec");
        await expect(handler({ currency: "sps" })).resolves.toBe("sps");
      });

      it("supports required: false with validated string", async () => {
        const handler = fabricService({
          input: {
            currency: { required: false, type: ["dec", "sps"] },
          },
          service: ({ currency }: { currency?: string }) => currency ?? "none",
        });
        await expect(handler({})).resolves.toBe("none");
      });

      it("still distinguishes [String] as typed array", async () => {
        const handler = fabricService({
          input: {
            values: { type: [String] },
          },
          service: ({ values }: { values: string[] }) => values,
        });
        // This should be a typed array, converting elements to strings
        await expect(handler({ values: [1, 2, 3] })).resolves.toEqual([
          "1",
          "2",
          "3",
        ]);
      });

      it("still distinguishes [] as untyped array", async () => {
        const handler = fabricService({
          input: {
            values: { type: [] },
          },
          service: ({ values }: { values: unknown[] }) => values,
        });
        await expect(handler({ values: [1, "two", true] })).resolves.toEqual([
          1,
          "two",
          true,
        ]);
      });

      it("real-world example: sendMoney handler", async () => {
        const sendMoneyHandler = fabricService({
          input: {
            amount: { type: Number },
            currency: { type: ["dec", "sps"] },
            user: { type: String },
          },
          service: ({
            amount,
            currency,
            user,
          }: {
            amount: number;
            currency: string;
            user: string;
          }) => ({ amount, currency, user }),
        });

        await expect(
          sendMoneyHandler({ amount: 100, currency: "dec", user: "bob" }),
        ).resolves.toEqual({ amount: 100, currency: "dec", user: "bob" });

        await expect(
          sendMoneyHandler({ amount: 50, currency: "sps", user: "alice" }),
        ).resolves.toEqual({ amount: 50, currency: "sps", user: "alice" });

        await expect(
          sendMoneyHandler({ amount: 100, currency: "usd", user: "bob" }),
        ).rejects.toThrow(BadRequestError);
      });
    });

    describe("No Service (Validation Only)", () => {
      it("returns processed input when no service is provided", async () => {
        const handler = fabricService({
          input: {
            age: { type: Number },
            email: { type: String },
          },
        });
        const result = await handler({ age: "25", email: "bob@example.com" });
        expect(result).toEqual({ age: 25, email: "bob@example.com" });
      });

      it("applies defaults when no service is provided", async () => {
        const handler = fabricService({
          input: {
            count: { default: 10, type: Number },
            name: { type: String },
          },
        });
        const result = await handler({ name: "test" });
        expect(result).toEqual({ count: 10, name: "test" });
      });

      it("validates input when no service is provided", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number, validate: (v) => (v as number) > 0 },
          },
        });
        await expect(handler({ value: 5 })).resolves.toEqual({ value: 5 });
        await expect(handler({ value: 0 })).rejects.toThrow(BadRequestError);
      });

      it("validates with validated string shorthand when no service", async () => {
        const handler = fabricService({
          input: {
            status: { type: ["active", "inactive"] },
          },
        });
        await expect(handler({ status: "active" })).resolves.toEqual({
          status: "active",
        });
        await expect(handler({ status: "pending" })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("parses JSON string input when no service", async () => {
        const handler = fabricService({
          input: {
            value: { type: Number },
          },
        });
        const result = await handler('{"value": "42"}');
        expect(result).toEqual({ value: 42 });
      });

      it("returns parsed input when no input definitions and no service", async () => {
        const handler = fabricService({});
        const result = await handler({ foo: "bar", num: 42 });
        expect(result).toEqual({ foo: "bar", num: 42 });
      });

      it("enforces required fields when no service", async () => {
        const handler = fabricService({
          input: {
            required: { type: String },
          },
        });
        await expect(handler({})).rejects.toThrow(
          'Missing required field "required"',
        );
      });

      it("real-world example: validateUser", async () => {
        const validateUser = fabricService({
          input: {
            age: { type: Number, validate: (v) => (v as number) >= 18 },
            email: { type: [/^[^@]+@[^@]+\.[^@]+$/] },
            role: { default: "user", type: ["admin", "user", "guest"] },
          },
        });

        // Valid input
        await expect(
          validateUser({ age: "25", email: "bob@example.com" }),
        ).resolves.toEqual({
          age: 25,
          email: "bob@example.com",
          role: "user",
        });

        // Invalid age
        await expect(
          validateUser({ age: 16, email: "teen@example.com" }),
        ).rejects.toThrow(BadRequestError);

        // Invalid email
        await expect(
          validateUser({ age: 25, email: "not-an-email" }),
        ).rejects.toThrow(BadRequestError);
      });
    });

    describe("Validated Number Shorthand", () => {
      it("accepts [1, 2, 3] as type shorthand for validated number", async () => {
        const handler = fabricService({
          input: {
            level: { type: [1, 2, 3] },
          },
          service: ({ level }: { level: number }) => level,
        });
        await expect(handler({ level: 1 })).resolves.toBe(1);
        await expect(handler({ level: 2 })).resolves.toBe(2);
        await expect(handler({ level: 3 })).resolves.toBe(3);
      });

      it("throws BadRequestError when value not in allowed list", async () => {
        const handler = fabricService({
          input: {
            level: { type: [1, 2, 3] },
          },
          service: ({ level }: { level: number }) => level,
        });
        await expect(handler({ level: 4 })).rejects.toThrow(BadRequestError);
        await expect(handler({ level: 0 })).rejects.toThrow(BadRequestError);
      });

      it("converts value to number before validation", async () => {
        const handler = fabricService({
          input: {
            level: { type: [1, 2, 3] },
          },
          service: ({ level }: { level: number }) => level,
        });
        // String "2" converts to number 2 which matches
        await expect(handler({ level: "2" })).resolves.toBe(2);
      });

      it("supports default value with validated number", async () => {
        const handler = fabricService({
          input: {
            level: { default: 1, type: [1, 2, 3] },
          },
          service: ({ level }: { level: number }) => level,
        });
        await expect(handler({})).resolves.toBe(1);
        await expect(handler({ level: 3 })).resolves.toBe(3);
      });

      it("supports required: false with validated number", async () => {
        const handler = fabricService({
          input: {
            level: { required: false, type: [1, 2, 3] },
          },
          service: ({ level }: { level?: number }) => level ?? "none",
        });
        await expect(handler({})).resolves.toBe("none");
      });

      it("still distinguishes [Number] as typed array", async () => {
        const handler = fabricService({
          input: {
            values: { type: [Number] },
          },
          service: ({ values }: { values: number[] }) => values,
        });
        // This should be a typed array, converting elements to numbers
        await expect(handler({ values: ["1", "2", "3"] })).resolves.toEqual([
          1, 2, 3,
        ]);
      });

      it("validates against exact number values", async () => {
        const handler = fabricService({
          input: {
            rating: { type: [0.5, 1, 1.5, 2] },
          },
          service: ({ rating }: { rating: number }) => rating,
        });
        await expect(handler({ rating: 0.5 })).resolves.toBe(0.5);
        await expect(handler({ rating: 1.5 })).resolves.toBe(1.5);
        await expect(handler({ rating: 0.75 })).rejects.toThrow(
          BadRequestError,
        );
      });

      it("real-world example: priority levels", async () => {
        const taskHandler = fabricService({
          input: {
            priority: { type: [1, 2, 3, 4, 5] },
            title: { type: String },
          },
          service: ({
            priority,
            title,
          }: {
            priority: number;
            title: string;
          }) => ({ priority, title }),
        });

        await expect(
          taskHandler({ priority: 1, title: "Urgent" }),
        ).resolves.toEqual({ priority: 1, title: "Urgent" });

        await expect(
          taskHandler({ priority: 3, title: "Normal" }),
        ).resolves.toEqual({ priority: 3, title: "Normal" });

        await expect(
          taskHandler({ priority: 10, title: "Invalid" }),
        ).rejects.toThrow(BadRequestError);
      });
    });
  });
});
