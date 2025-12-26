import { BadRequestError } from "@jaypie/errors";
import { describe, expect, it } from "vitest";

import { serviceHandler } from "..";

// Example from README: division handler
const divisionHandler = serviceHandler({
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

describe("serviceHandler", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof serviceHandler).toBe("function");
    });

    it("returns a function", () => {
      const handler = serviceHandler({
        service: () => "test",
      });
      expect(typeof handler).toBe("function");
    });

    it("returns a Promise", async () => {
      const handler = serviceHandler({
        service: () => "test",
      });
      const result = handler();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBe("test");
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

    it('divisionHandler({ numerator: "14", denominator: "7" }) returns 2 (coerces strings)', async () => {
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

    it('divisionHandler({ numerator: 1, denominator: "0" }) throws BadRequestError (fails validation after coercion)', async () => {
      // divisionHandler({ numerator: 1, denominator: "0" }); // throws BadRequestError
      await expect(
        divisionHandler({ numerator: 1, denominator: "0" }),
      ).rejects.toThrow(BadRequestError);
    });

    it('divisionHandler({ numerator: "ONE" }) throws BadRequestError (cannot coerce NaN)', async () => {
      // divisionHandler({ numerator: "ONE" }); // throws BadRequestError
      await expect(divisionHandler({ numerator: "ONE" })).rejects.toThrow(
        BadRequestError,
      );
    });

    it('divisionHandler({ denominator: "TWO" }) throws BadRequestError (cannot coerce NaN)', async () => {
      // divisionHandler({ denominator: "TWO" }); // throws BadRequestError
      await expect(divisionHandler({ denominator: "TWO" })).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe("Features", () => {
    describe("Input Parsing", () => {
      it("handles empty input", async () => {
        const handler = serviceHandler({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler()).resolves.toBe(42);
      });

      it("handles undefined input", async () => {
        const handler = serviceHandler({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler(undefined)).resolves.toBe(42);
      });

      it("parses JSON string input", async () => {
        const handler = serviceHandler({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler('{ "value": 42 }')).resolves.toBe(42);
      });

      it("throws on invalid JSON", async () => {
        const handler = serviceHandler({
          service: () => "test",
        });
        await expect(handler("not json")).rejects.toThrow(BadRequestError);
      });

      it("throws on non-object JSON", async () => {
        const handler = serviceHandler({
          service: () => "test",
        });
        await expect(handler("[1, 2, 3]")).rejects.toThrow(BadRequestError);
      });
    });

    describe("Type Coercion", () => {
      it("coerces string to number", async () => {
        const handler = serviceHandler({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: "42" })).resolves.toBe(42);
      });

      it("coerces string to boolean", async () => {
        const handler = serviceHandler({
          input: {
            value: { type: Boolean },
          },
          service: ({ value }: { value: boolean }) => value,
        });
        await expect(handler({ value: "true" })).resolves.toBe(true);
        await expect(handler({ value: "false" })).resolves.toBe(false);
      });

      it("coerces number to string", async () => {
        const handler = serviceHandler({
          input: {
            value: { type: String },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: 42 })).resolves.toBe("42");
      });

      it("coerces number to boolean", async () => {
        const handler = serviceHandler({
          input: {
            value: { type: Boolean },
          },
          service: ({ value }: { value: boolean }) => value,
        });
        await expect(handler({ value: 1 })).resolves.toBe(true);
        await expect(handler({ value: 0 })).resolves.toBe(false);
        await expect(handler({ value: -1 })).resolves.toBe(false);
      });

      it("coerces boolean to number", async () => {
        const handler = serviceHandler({
          input: {
            value: { type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: true })).resolves.toBe(1);
        await expect(handler({ value: false })).resolves.toBe(0);
      });

      it("coerces boolean to string", async () => {
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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

      it("skips validation for undefined values", async () => {
        const handler = serviceHandler({
          input: {
            value: {
              type: Number,
              validate: (v) => (v as number) > 0,
            },
          },
          service: ({ value }: { value?: number }) => value ?? "undefined",
        });
        await expect(handler({})).resolves.toBe("undefined");
      });
    });

    describe("Default Values", () => {
      it("applies default when value is undefined", async () => {
        const handler = serviceHandler({
          input: {
            value: { default: 42, type: Number },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({})).resolves.toBe(42);
      });

      it("does not apply default when value is provided", async () => {
        const handler = serviceHandler({
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
        const handler = serviceHandler({
          input: {
            value: { type: "number" },
          },
          service: ({ value }: { value: number }) => value,
        });
        await expect(handler({ value: "42" })).resolves.toBe(42);
      });

      it('accepts "string" as type', async () => {
        const handler = serviceHandler({
          input: {
            value: { type: "string" },
          },
          service: ({ value }: { value: string }) => value,
        });
        await expect(handler({ value: 42 })).resolves.toBe("42");
      });

      it('accepts "boolean" as type', async () => {
        const handler = serviceHandler({
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
        const handler = serviceHandler({
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
  });
});
