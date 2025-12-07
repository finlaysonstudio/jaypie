import { describe, expect, it } from "vitest";

import { createResponseBuilder, ResponseBuilder } from "../ResponseBuilder.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmOutputMessage,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";

//
//
// Tests
//

describe("ResponseBuilder", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports ResponseBuilder class", () => {
      expect(ResponseBuilder).toBeDefined();
      expect(typeof ResponseBuilder).toBe("function");
    });

    it("exports createResponseBuilder factory", () => {
      expect(createResponseBuilder).toBeDefined();
      expect(typeof createResponseBuilder).toBe("function");
    });

    it("can be instantiated with config", () => {
      const builder = new ResponseBuilder({
        model: "gpt-5",
        provider: "openai",
      });
      expect(builder).toBeInstanceOf(ResponseBuilder);
    });

    it("factory creates ResponseBuilder instance", () => {
      const builder = createResponseBuilder({
        model: "claude-opus-4",
        provider: "anthropic",
      });
      expect(builder).toBeInstanceOf(ResponseBuilder);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("builds response with initial values", () => {
      const builder = new ResponseBuilder({
        model: "gpt-5",
        provider: "openai",
      });

      const response = builder.build();

      expect(response).toMatchObject({
        content: undefined,
        error: undefined,
        history: [],
        model: "gpt-5",
        output: [],
        provider: "openai",
        responses: [],
        status: LlmResponseStatus.InProgress,
        usage: [],
      });
    });

    it("builds complete response with all fields set", () => {
      const builder = new ResponseBuilder({
        model: "gpt-5",
        provider: "openai",
      });

      const response = builder
        .setContent("Hello, World!")
        .setStatus(LlmResponseStatus.Completed)
        .setHistory([
          {
            content: "Hi",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          } as LlmInputMessage,
        ])
        .addUsage({ input: 10, output: 20, reasoning: 0, total: 30 })
        .addResponse({ id: "resp-123" })
        .build();

      expect(response.content).toBe("Hello, World!");
      expect(response.status).toBe(LlmResponseStatus.Completed);
      expect(response.history).toHaveLength(1);
      expect(response.usage).toHaveLength(1);
      expect(response.responses).toHaveLength(1);
    });
  });

  // Features
  describe("Features", () => {
    describe("Content", () => {
      it("sets string content", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setContent("text response")
          .build();

        expect(response.content).toBe("text response");
      });

      it("sets JSON object content", () => {
        const jsonContent = { key: "value", nested: { foo: "bar" } };
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setContent(jsonContent)
          .build();

        expect(response.content).toEqual(jsonContent);
      });
    });

    describe("Status", () => {
      it("sets status via setStatus", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setStatus(LlmResponseStatus.Incomplete)
          .build();

        expect(response.status).toBe(LlmResponseStatus.Incomplete);
      });

      it("sets completed status via complete()", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .complete()
          .build();

        expect(response.status).toBe(LlmResponseStatus.Completed);
      });

      it("sets incomplete status via incomplete()", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .incomplete()
          .build();

        expect(response.status).toBe(LlmResponseStatus.Incomplete);
      });
    });

    describe("Error", () => {
      it("sets error", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setError({
            detail: "Something went wrong",
            status: 500,
            title: "Internal Error",
          })
          .build();

        expect(response.error).toEqual({
          detail: "Something went wrong",
          status: 500,
          title: "Internal Error",
        });
      });
    });

    describe("History", () => {
      it("sets history", () => {
        const history: LlmHistory = [
          {
            content: "Hello",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          } as LlmInputMessage,
        ];

        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setHistory(history)
          .build();

        expect(response.history).toEqual(history);
      });

      it("appends to history", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .appendToHistory({
            content: "First",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          })
          .appendToHistory({
            content: "Second",
            role: LlmMessageRole.Assistant,
            type: LlmMessageType.Message,
          })
          .build();

        expect(response.history).toHaveLength(2);
        expect(response.history[0]).toMatchObject({ content: "First" });
        expect(response.history[1]).toMatchObject({ content: "Second" });
      });

      it("provides getHistory for access", () => {
        const builder = new ResponseBuilder({
          model: "test",
          provider: "test",
        });

        builder.appendToHistory({
          content: "Test",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        });

        const history = builder.getHistory();
        expect(history).toHaveLength(1);
      });
    });

    describe("Output", () => {
      it("sets output", () => {
        const output = [
          {
            content: "Response",
            role: LlmMessageRole.Assistant,
            type: LlmMessageType.Message,
          } as LlmOutputMessage,
        ];

        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setOutput(output)
          .build();

        expect(response.output).toEqual(output);
      });

      it("appends to output", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .appendToOutput({
            content: "First",
            role: LlmMessageRole.Assistant,
            type: LlmMessageType.Message,
          })
          .appendToOutput({
            content: "Second",
            role: LlmMessageRole.Assistant,
            type: LlmMessageType.Message,
          })
          .build();

        expect(response.output).toHaveLength(2);
      });

      it("provides getOutput for access", () => {
        const builder = new ResponseBuilder({
          model: "test",
          provider: "test",
        });

        builder.appendToOutput({
          content: "Test",
          role: LlmMessageRole.Assistant,
          type: LlmMessageType.Message,
        });

        const output = builder.getOutput();
        expect(output).toHaveLength(1);
      });
    });

    describe("Usage", () => {
      it("adds usage entries", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .addUsage({ input: 10, output: 20, reasoning: 0, total: 30 })
          .addUsage({ input: 15, output: 25, reasoning: 5, total: 45 })
          .build();

        expect(response.usage).toHaveLength(2);
        expect(response.usage[0]).toEqual({
          input: 10,
          output: 20,
          reasoning: 0,
          total: 30,
        });
        expect(response.usage[1]).toEqual({
          input: 15,
          output: 25,
          reasoning: 5,
          total: 45,
        });
      });

      it("sets entire usage array", () => {
        const usage = [{ input: 100, output: 200, reasoning: 0, total: 300 }];

        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .setUsage(usage)
          .build();

        expect(response.usage).toEqual(usage);
      });

      it("provides getUsage for access", () => {
        const builder = new ResponseBuilder({
          model: "test",
          provider: "test",
        });

        builder.addUsage({ input: 10, output: 20, reasoning: 0, total: 30 });

        const usage = builder.getUsage();
        expect(usage).toHaveLength(1);
      });
    });

    describe("Responses", () => {
      it("adds raw provider responses", () => {
        const response = new ResponseBuilder({
          model: "test",
          provider: "test",
        })
          .addResponse({ id: "1", data: "first" })
          .addResponse({ id: "2", data: "second" })
          .build();

        expect(response.responses).toHaveLength(2);
      });
    });

    describe("Fluent API", () => {
      it("chains all methods", () => {
        const response = new ResponseBuilder({
          model: "gpt-5",
          provider: "openai",
        })
          .setContent("Hello")
          .setStatus(LlmResponseStatus.Completed)
          .setHistory([])
          .setOutput([])
          .setUsage([])
          .addResponse({})
          .addUsage({ input: 0, output: 0, reasoning: 0, total: 0 })
          .appendToHistory()
          .appendToOutput()
          .complete()
          .build();

        expect(response).toBeDefined();
        expect(response.status).toBe(LlmResponseStatus.Completed);
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("build returns a copy, not the internal reference", () => {
      const builder = new ResponseBuilder({
        model: "test",
        provider: "test",
      });

      const response1 = builder.build();
      builder.setContent("Modified");
      const response2 = builder.build();

      expect(response1.content).toBeUndefined();
      expect(response2.content).toBe("Modified");
    });
  });
});
