import { JsonObject } from "@jaypie/types";
import { LlmMessageRole } from "../../types/LlmProvider.interface.js";
import { PROVIDER } from "../../constants.js";

// Maps Jaypie roles to Anthropic roles
export const ROLE_MAP: Record<LlmMessageRole, string> = {
  [LlmMessageRole.User]: PROVIDER.ANTHROPIC.ROLE.USER,
  [LlmMessageRole.System]: PROVIDER.ANTHROPIC.ROLE.SYSTEM,
  [LlmMessageRole.Assistant]: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
  [LlmMessageRole.Developer]: PROVIDER.ANTHROPIC.ROLE.SYSTEM,
};

//
//
// Anthropic API types
//
// Local mirror of the subset of `@anthropic-ai/sdk`'s `Anthropic` namespace the
// adapter and utils use. Defining it here lets us drop the SDK dependency while
// keeping every `Anthropic.X` reference unchanged. The internal request shapes
// are already Anthropic's snake_case wire format, so the HTTP client serializes
// them verbatim.
//

/* eslint-disable @typescript-eslint/no-namespace */
export namespace Anthropic {
  export interface TextBlock {
    type: "text";
    text: string;
  }

  export interface ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: unknown;
  }

  export interface ThinkingBlock {
    type: "thinking";
    thinking: string;
    signature?: string;
  }

  export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock;

  export interface Base64ImageSource {
    type: "base64";
    media_type: string;
    data: string;
  }

  export interface Base64PDFSource {
    type: "base64";
    media_type: string;
    data: string;
  }

  export interface ToolResultBlockParam {
    type: "tool_result";
    tool_use_id: string;
    content: string;
  }

  export type ContentBlockParam =
    | { type: "text"; text: string }
    | {
        type: "image";
        source: Base64ImageSource | { type: "url"; url: string };
      }
    | {
        type: "document";
        source: Base64PDFSource | { type: "url"; url: string };
      }
    | ToolUseBlock
    | ToolResultBlockParam;

  export interface MessageParam {
    role: "user" | "assistant";
    content: string | ContentBlockParam[];
  }

  export namespace Messages {
    export namespace Tool {
      export type InputSchema = JsonObject;
    }
  }

  export interface Tool {
    name: string;
    description?: string;
    input_schema: Messages.Tool.InputSchema;
    type?: "custom";
  }

  export interface Usage {
    input_tokens: number;
    output_tokens: number;
    thinking_tokens?: number;
  }

  export interface MessageCreateParams {
    model: string;
    messages: MessageParam[];
    max_tokens: number;
    system?: string;
    tools?: Tool[];
    tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
    temperature?: number;
    stream?: boolean;
    // Allow `output_config` and arbitrary providerOptions passthrough.
    [key: string]: unknown;
  }

  export type MessageCreateParamsStreaming = MessageCreateParams & {
    stream: true;
  };

  export interface Message {
    id: string;
    type: "message";
    role: "assistant";
    model: string;
    content: ContentBlock[];
    stop_reason: string | null;
    stop_sequence?: string | null;
    usage: Usage;
  }

  export type ContentBlockDelta =
    | { type: "text_delta"; text: string }
    | { type: "input_json_delta"; partial_json: string };

  export type MessageStreamEvent =
    | { type: "message_start"; message: Message }
    | {
        type: "content_block_start";
        index: number;
        content_block: ContentBlock;
      }
    | { type: "content_block_delta"; index: number; delta: ContentBlockDelta }
    | { type: "content_block_stop"; index: number }
    | { type: "message_delta"; delta: Record<string, unknown>; usage: Usage }
    | { type: "message_stop" }
    | { type: "ping" };
}
/* eslint-enable @typescript-eslint/no-namespace */
