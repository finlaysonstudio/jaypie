import { getEnvSecret } from "@jaypie/aws";
import {
  ConfigurationError,
  JAYPIE,
  log as defaultLog,
  placeholders,
} from "@jaypie/core";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { PROVIDER } from "../constants.js";
import {
  LlmProvider,
  LlmMessageOptions,
} from "../types/LlmProvider.interface.js";
import naturalZodSchema from "../util/naturalZodSchema.js";

export class OpenAiProvider implements LlmProvider {
  private model: string;
  private _client?: OpenAI;
  private apiKey?: string;
  private log: typeof defaultLog;

  constructor(
    model: string = PROVIDER.OPENAI.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
    this.log = defaultLog.lib({ lib: JAYPIE.LIB.LLM });
  }

  private async getClient(): Promise<OpenAI> {
    if (this._client) {
      return this._client;
    }

    const apiKey = this.apiKey || (await getEnvSecret("OPENAI_API_KEY"));
    if (!apiKey) {
      throw new ConfigurationError(
        "The application could not resolve the requested keys",
      );
    }

    this._client = new OpenAI({ apiKey });
    this.log.trace("Initialized OpenAI client");
    return this._client;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = [];

    if (options?.system) {
      const systemMessage = {
        role: "developer" as const,
        content: placeholders(options.system, options?.data),
      };
      messages.push(systemMessage);
      this.log.var({ systemMessage });
    }
    const formattedMessage = placeholders(message, options?.data);
    const userMessage = {
      role: "user" as const,
      content: formattedMessage,
    };
    messages.push(userMessage);
    this.log.var({ userMessage });

    if (options?.response) {
      this.log.trace("Using structured output");
      const zodSchema =
        options.response instanceof z.ZodType
          ? options.response
          : naturalZodSchema(options.response as NaturalSchema);

      const completion = await client.beta.chat.completions.parse({
        messages,
        model: options?.model || this.model,
        response_format: zodResponseFormat(zodSchema, "response"),
      });
      this.log.var({ assistantReply: completion.choices[0].message.parsed });
      return completion.choices[0].message.parsed;
    }

    this.log.trace("Using text output (unstructured)");
    const completion = await client.chat.completions.create({
      messages,
      model: options?.model || this.model,
    });
    this.log.var({ assistantReply: completion.choices[0].message.content });

    return completion.choices[0]?.message?.content || "";
  }
}
