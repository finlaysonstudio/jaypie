// Tests for lambda adapter

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lambdaServiceHandler } from "../lambda/index.js";
import { serviceHandler } from "../serviceHandler.js";

// Mock @jaypie/aws
vi.mock("@jaypie/aws", () => ({
  getMessages: vi.fn((event) => {
    // Default behavior: return event wrapped in array
    if (event === undefined) return [];
    if (Array.isArray(event)) return event;
    if (event && typeof event === "object" && "Records" in event) {
      // Mock SQS event parsing
      return (event.Records as Array<{ body: string }>).map((r) =>
        JSON.parse(r.body),
      );
    }
    return [event];
  }),
}));

// Mock @jaypie/lambda
vi.mock("@jaypie/lambda", () => ({
  lambdaHandler: vi.fn((handler, options) => {
    // Return a function that captures the options for testing
    const wrappedHandler = async (
      event: unknown,
      context?: unknown,
    ): Promise<unknown> => {
      return handler(event, context);
    };
    wrappedHandler._options = options;
    return wrappedHandler;
  }),
}));

describe("Lambda Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("lambdaServiceHandler", () => {
    it("is a function", () => {
      expect(lambdaServiceHandler).toBeFunction();
    });

    describe("Basic Functionality", () => {
      it("creates a lambda handler from a service handler", () => {
        const handler = serviceHandler({
          alias: "test",
          service: (input) => input,
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        expect(lambdaHandler).toBeFunction();
      });

      it("processes a single message and returns single result", async () => {
        const handler = serviceHandler({
          alias: "test",
          input: {
            name: { type: String },
          },
          service: ({ name }) => `Hello, ${name}!`,
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        const result = await lambdaHandler({ name: "Alice" });

        expect(result).toBe("Hello, Alice!");
      });

      it("processes multiple messages and returns array of results", async () => {
        const handler = serviceHandler({
          alias: "test",
          input: {
            value: { type: Number },
          },
          service: ({ value }) => value * 2,
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        const result = await lambdaHandler([
          { value: 1 },
          { value: 2 },
          { value: 3 },
        ]);

        expect(result).toEqual([2, 4, 6]);
      });

      it("parses SQS event records", async () => {
        const handler = serviceHandler({
          alias: "test",
          input: {
            id: { type: String },
          },
          service: ({ id }) => `processed-${id}`,
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        const sqsEvent = {
          Records: [
            { body: JSON.stringify({ id: "a" }) },
            { body: JSON.stringify({ id: "b" }) },
          ],
        };

        const result = await lambdaHandler(sqsEvent);

        expect(result).toEqual(["processed-a", "processed-b"]);
      });
    });

    describe("Function Signature", () => {
      it("accepts handler as first argument with options object", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler(handler, {
          secrets: ["MY_SECRET"],
        });

        expect(lambdaHandler).toBeFunction();
        expect((lambdaHandler as { _options?: object })._options).toMatchObject(
          {
            secrets: ["MY_SECRET"],
          },
        );
      });

      it("accepts config object with handler property", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          secrets: ["MY_SECRET"],
        });

        expect(lambdaHandler).toBeFunction();
        expect((lambdaHandler as { _options?: object })._options).toMatchObject(
          {
            secrets: ["MY_SECRET"],
          },
        );
      });
    });

    describe("Handler Alias", () => {
      it("uses handler.alias as the name for logging", () => {
        const handler = serviceHandler({
          alias: "myService",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        expect(
          (lambdaHandler as { _options?: { name?: string } })._options?.name,
        ).toBe("myService");
      });

      it("allows name override via options", () => {
        const handler = serviceHandler({
          alias: "originalName",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          name: "overriddenName",
        });

        expect(
          (lambdaHandler as { _options?: { name?: string } })._options?.name,
        ).toBe("overriddenName");
      });

      it("uses undefined name when handler has no alias and no name override", () => {
        const handler = serviceHandler({
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        expect(
          (lambdaHandler as { _options?: { name?: string } })._options?.name,
        ).toBeUndefined();
      });
    });

    describe("Lambda Handler Options", () => {
      it("passes secrets option to lambdaHandler", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          secrets: ["API_KEY", "DB_SECRET"],
        });

        expect(
          (lambdaHandler as { _options?: { secrets?: string[] } })._options
            ?.secrets,
        ).toEqual(["API_KEY", "DB_SECRET"]);
      });

      it("passes setup option to lambdaHandler", () => {
        const setupFn = vi.fn();
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          setup: [setupFn],
        });

        expect(
          (lambdaHandler as { _options?: { setup?: unknown[] } })._options
            ?.setup,
        ).toEqual([setupFn]);
      });

      it("passes teardown option to lambdaHandler", () => {
        const teardownFn = vi.fn();
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          teardown: [teardownFn],
        });

        expect(
          (lambdaHandler as { _options?: { teardown?: unknown[] } })._options
            ?.teardown,
        ).toEqual([teardownFn]);
      });

      it("passes validate option to lambdaHandler", () => {
        const validateFn = vi.fn();
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          validate: [validateFn],
        });

        expect(
          (lambdaHandler as { _options?: { validate?: unknown[] } })._options
            ?.validate,
        ).toEqual([validateFn]);
      });

      it("passes throw option to lambdaHandler", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          throw: true,
        });

        expect(
          (lambdaHandler as { _options?: { throw?: boolean } })._options?.throw,
        ).toBe(true);
      });

      it("passes unavailable option to lambdaHandler", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          unavailable: true,
        });

        expect(
          (lambdaHandler as { _options?: { unavailable?: boolean } })._options
            ?.unavailable,
        ).toBe(true);
      });

      it("passes chaos option to lambdaHandler", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          chaos: "full",
        });

        expect(
          (lambdaHandler as { _options?: { chaos?: string } })._options?.chaos,
        ).toBe("full");
      });
    });

    describe("Edge Cases", () => {
      it("handles empty array of messages", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: ({ value }) => value,
        });

        // Mock getMessages to return empty array
        const { getMessages } = await import("@jaypie/aws");
        vi.mocked(getMessages).mockReturnValueOnce([]);

        const lambdaHandler = lambdaServiceHandler({ handler });

        const result = await lambdaHandler(undefined);

        expect(result).toEqual([]);
      });

      it("handles handler without input definitions", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: (input) => ({ received: input }),
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        const result = await lambdaHandler({ foo: "bar" });

        expect(result).toEqual({ received: { foo: "bar" } });
      });

      it("handles async service function", async () => {
        const handler = serviceHandler({
          alias: "test",
          input: {
            delay: { type: Number, default: 0 },
          },
          service: async ({ delay }) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return "done";
          },
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        const result = await lambdaHandler({ delay: 10 });

        expect(result).toBe("done");
      });
    });

    describe("sendMessage and onMessage", () => {
      it("passes context with sendMessage to service when onMessage is provided", async () => {
        const messages: Array<{ content: string; level?: string }> = [];

        const handler = serviceHandler({
          alias: "test",
          input: { name: { type: String } },
          service: ({ name }, context) => {
            context?.sendMessage?.({ content: `Processing ${name}` });
            return `Hello, ${name}!`;
          },
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
        });

        const result = await lambdaHandler({ name: "Alice" });

        expect(result).toBe("Hello, Alice!");
        expect(messages).toEqual([{ content: "Processing Alice" }]);
      });

      it("supports message levels", async () => {
        const messages: Array<{ content: string; level?: string }> = [];

        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            context?.sendMessage?.({ content: "Debug info", level: "debug" });
            context?.sendMessage?.({ content: "Warning!", level: "warn" });
            return "done";
          },
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
        });

        await lambdaHandler({});

        expect(messages).toEqual([
          { content: "Debug info", level: "debug" },
          { content: "Warning!", level: "warn" },
        ]);
      });

      it("service works when onMessage is not provided", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            // Safely call sendMessage even when not provided
            context?.sendMessage?.({ content: "This goes nowhere" });
            return "done";
          },
        });

        const lambdaHandler = lambdaServiceHandler({ handler });

        const result = await lambdaHandler({});

        expect(result).toBe("done");
      });

      it("swallows errors in onMessage and continues execution", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            context?.sendMessage?.({ content: "Before error" });
            context?.sendMessage?.({ content: "This will throw" });
            context?.sendMessage?.({ content: "After error" });
            return "completed";
          },
        });

        let callCount = 0;
        const lambdaHandler = lambdaServiceHandler({
          handler,
          onMessage: () => {
            callCount++;
            if (callCount === 2) {
              throw new Error("onMessage error");
            }
          },
        });

        // Should complete without throwing
        const result = await lambdaHandler({});

        expect(result).toBe("completed");
        expect(callCount).toBe(3); // All three messages were attempted
      });

      it("supports async onMessage callbacks", async () => {
        const messages: string[] = [];

        const handler = serviceHandler({
          alias: "test",
          service: async (_, context) => {
            await context?.sendMessage?.({ content: "Step 1" });
            await context?.sendMessage?.({ content: "Step 2" });
            return "done";
          },
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          onMessage: async (msg) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            messages.push(msg.content);
          },
        });

        const result = await lambdaHandler({});

        expect(result).toBe("done");
        expect(messages).toEqual(["Step 1", "Step 2"]);
      });

      it("sends messages for each message in batch processing", async () => {
        const messages: string[] = [];

        const handler = serviceHandler({
          alias: "test",
          input: { id: { type: String } },
          service: ({ id }, context) => {
            context?.sendMessage?.({ content: `Processing ${id}` });
            return `result-${id}`;
          },
        });

        const lambdaHandler = lambdaServiceHandler({
          handler,
          onMessage: (msg) => {
            messages.push(msg.content);
          },
        });

        const result = await lambdaHandler([
          { id: "a" },
          { id: "b" },
          { id: "c" },
        ]);

        expect(result).toEqual(["result-a", "result-b", "result-c"]);
        expect(messages).toEqual([
          "Processing a",
          "Processing b",
          "Processing c",
        ]);
      });
    });

    describe("Integration Example", () => {
      it("works with typical evaluation handler pattern", async () => {
        // Simulates the target use case from the issue
        interface EvalInput {
          count: number;
          models: string[];
          plan: string;
        }

        interface EvalResult {
          jobId: string;
          plan: string;
        }

        const evaluationsHandler = serviceHandler<EvalInput, EvalResult>({
          alias: "evaluationsHandler",
          input: {
            count: { type: Number, default: 1 },
            models: { type: [String], default: [] },
            plan: { type: String },
          },
          service: ({ plan }) => ({
            jobId: `job-${Date.now()}`,
            plan,
          }),
        });

        const handler = lambdaServiceHandler({
          handler: evaluationsHandler,
          secrets: [
            "ANTHROPIC_API_KEY",
            "GEMINI_API_KEY",
            "OPENAI_API_KEY",
            "OPENROUTER_API_KEY",
          ],
        });

        // Simulate SQS event with single message
        const { getMessages } = await import("@jaypie/aws");
        vi.mocked(getMessages).mockReturnValueOnce([
          {
            plan: "test-plan",
            count: 5,
            models: ["gpt-4", "claude-3"],
          },
        ]);

        const result = await handler({
          Records: [
            {
              body: JSON.stringify({
                plan: "test-plan",
                count: 5,
                models: ["gpt-4", "claude-3"],
              }),
            },
          ],
        });

        expect(result).toMatchObject({
          plan: "test-plan",
        });
        expect((result as EvalResult).jobId).toMatch(/^job-/);
      });
    });
  });
});
