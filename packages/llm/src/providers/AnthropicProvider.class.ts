import { JsonObject } from "@jaypie/types";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER } from "../constants.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
  LlmHistoryItem,
} from "../types/LlmProvider.interface.js";
import { naturalZodSchema } from "../util/index.js";
import { z } from "zod";
import {
  getLogger,
  initializeClient,
  prepareMessages,
  formatSystemMessage,
} from "./anthropic/index.js";

// Main class implementation
export class AnthropicProvider implements LlmProvider {
  private model: string;
  private _client?: Anthropic;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = PROVIDER.ANTHROPIC.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<Anthropic> {
    if (this._client) {
      return this._client;
    }

    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  // Basic text completion
  async createTextCompletion(
    client: Anthropic,
    messages: Anthropic.MessageParam[],
    model: string,
    systemMessage?: string,
  ): Promise<string> {
    this.log.trace("Using text output (unstructured)");

    const params: Anthropic.MessageCreateParams = {
      model,
      messages,
      max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
    };

    // Add system instruction if provided
    if (systemMessage) {
      params.system = systemMessage;
      this.log.trace(`System message: ${systemMessage.length} characters`);
    }

    const response = await client.messages.create(params);

    this.log.trace(
      `Assistant reply: ${response.content[0]?.text?.length || 0} characters`,
    );

    return response.content[0]?.text || "";
  }

  // Structured output completion
  async createStructuredCompletion(
    client: Anthropic,
    messages: Anthropic.MessageParam[],
    model: string,
    responseSchema: z.ZodType | JsonObject,
    systemMessage?: string,
  ): Promise<JsonObject> {
    this.log.trace("Using structured output");

    // Get the JSON schema for the response
    const schema =
      responseSchema instanceof z.ZodType
        ? responseSchema
        : naturalZodSchema(responseSchema as JsonObject);

    // Set system message with JSON instructions
    const defaultSystemPrompt =
      "You will be responding with structured JSON data. " +
      "Format your entire response as a valid JSON object with the following structure: " +
      (responseSchema instanceof z.ZodType
        ? JSON.stringify(this.simplifyZodSchema(schema))
        : JSON.stringify(responseSchema));

    const systemPrompt = systemMessage || defaultSystemPrompt;

    try {
      // Use standard Anthropic API to get response
      const params: Anthropic.MessageCreateParams = {
        model,
        messages,
        max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
        system: systemPrompt,
      };

      const response = await client.messages.create(params);

      // Extract text from response
      const responseText = response.content[0]?.text || "";

      // Find JSON in response
      const jsonMatch =
        responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
        responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          // Parse the JSON response
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const result = JSON.parse(jsonStr);
          this.log.trace("Received structured response", { result });
          return result;
        } catch {
          throw new Error(
            `Failed to parse JSON response from Anthropic: ${responseText}`,
          );
        }
      }

      // If we can't extract JSON
      throw new Error("Failed to parse structured response from Anthropic");
    } catch (error: unknown) {
      this.log.error("Error creating structured completion", { error });
      throw error;
    }
  }

  // Helper method to simplify Zod schema to a plain object for system prompt
  private simplifyZodSchema(schema: z.ZodType): Record<string, unknown> {
    try {
      // Type casting for internal Zod structure
      interface ZodTypeShape {
        _def?: {
          shape?: Record<string, unknown>;
        };
      }

      const zodSchema = schema as ZodTypeShape;

      if (typeof zodSchema._def?.shape === "object") {
        const result: Record<string, string> = {};
        Object.keys(zodSchema._def.shape || {}).forEach((key) => {
          result[key] = "string";
        });
        return result;
      }
      return { result: "string" };
    } catch (error: unknown) {
      this.log.error(`Error simplifying schema: ${error}`);
      return { result: "string" };
    }
  }

  // Main send method
  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = prepareMessages(message, options || {});
    const modelToUse = options?.model || this.model;

    // Process system message if provided
    let systemMessage: string | undefined;
    if (options?.system) {
      systemMessage = formatSystemMessage(options.system, {
        data: options.data,
        placeholders: options.placeholders,
      });
    }

    if (options?.response) {
      const schema =
        options.response instanceof z.ZodType
          ? options.response
          : naturalZodSchema(options.response);

      return this.createStructuredCompletion(
        client,
        messages,
        modelToUse,
        schema,
        systemMessage,
      );
    }

    return this.createTextCompletion(
      client,
      messages,
      modelToUse,
      systemMessage,
    );
  }

  // Placeholder for operate method - will be implemented in a future task
  // This will be properly implemented in the "Tool Calling Implementation" task
  async operate(
    input: string | LlmHistory | LlmInputMessage,

    _options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    throw new Error(
      "The operate method is not yet implemented for AnthropicProvider",
    );
  }
}
