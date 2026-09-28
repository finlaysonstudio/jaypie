import { describe, expect, it, vi } from "vitest";

import { fireworksAdapter } from "../FireworksAdapter.js";
import { googleAdapter } from "../GoogleAdapter.js";
import { mistralAdapter } from "../MistralAdapter.js";
import { openRouterAdapter } from "../OpenRouterAdapter.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";
import { OperateRequest } from "../../types.js";

vi.mock("zod/v4", () => ({
  z: {
    ZodType: class ZodType {},
    toJSONSchema: vi.fn(() => ({ type: "object", properties: {} })),
  },
}));

//
//
// Constants
//

const SYSTEM = "You are a careful assistant.";

// The operate loop prepends the system prompt to history and also passes it
// as `system`, so adapters see it twice.
const request: OperateRequest = {
  cache: false,
  messages: [
    {
      content: SYSTEM,
      role: LlmMessageRole.System,
      type: LlmMessageType.Message,
    },
    { content: "Hi", role: LlmMessageRole.User, type: LlmMessageType.Message },
  ],
  model: "test-model",
  system: SYSTEM,
};

function countSystem(messages: Array<{ role?: string; content?: unknown }>) {
  return messages.filter(
    (message) =>
      message.role === "system" &&
      JSON.stringify(message.content).includes(SYSTEM),
  ).length;
}

//
//
// Run tests
//

describe("System prompt sent once", () => {
  it("Fireworks", () => {
    const built = fireworksAdapter.buildRequest(request) as unknown as {
      messages: Array<{ role?: string; content?: unknown }>;
    };
    expect(countSystem(built.messages)).toBe(1);
  });

  it("Google", () => {
    const built = googleAdapter.buildRequest(request) as unknown as {
      config?: { systemInstruction?: string };
      contents: Array<{ parts: Array<{ text?: string }> }>;
    };
    expect(built.config?.systemInstruction).toBe(SYSTEM);
    expect(
      built.contents.some((content) =>
        content.parts.some((part) => part.text === SYSTEM),
      ),
    ).toBe(false);
  });

  it("Mistral", () => {
    const built = mistralAdapter.buildRequest(request) as unknown as {
      messages: Array<{ role?: string; content?: unknown }>;
    };
    expect(countSystem(built.messages)).toBe(1);
  });

  it("OpenRouter", () => {
    const built = openRouterAdapter.buildRequest(request) as unknown as {
      messages: Array<{ role?: string; content?: unknown }>;
    };
    expect(countSystem(built.messages)).toBe(1);
  });

  it("Keeps a different system message from history", () => {
    const built = openRouterAdapter.buildRequest({
      ...request,
      messages: [
        {
          content: "Mid-conversation note",
          role: LlmMessageRole.System,
          type: LlmMessageType.Message,
        },
        ...request.messages,
      ],
    }) as unknown as { messages: Array<{ role?: string }> };
    expect(
      built.messages.filter((message) => message.role === "system"),
    ).toHaveLength(2);
  });
});
