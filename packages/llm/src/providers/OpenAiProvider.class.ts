import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError, placeholders } from "@jaypie/core";
import { OpenAI } from "openai";
import { PROVIDER } from "../constants.js";
import { JsonObject } from "../types/jaypie.d.js";
import {
  LlmProvider,
  LlmMessageOptions,
} from "../types/LlmProvider.interface.js";

export class OpenAiProvider implements LlmProvider {
  private model: string;
  private _client?: OpenAI;
  private apiKey?: string;

  constructor(
    model: string = PROVIDER.OPENAI.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
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
    return this._client;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = [];

    if (options?.system) {
      messages.push({ role: "system" as const, content: options.system });
    }
    const formattedMessage = placeholders(message, options?.data);
    messages.push({ role: "user" as const, content: formattedMessage });

    const completion = await client.chat.completions.create({
      messages,
      model: options?.model || this.model,
    });

    return completion.choices[0]?.message?.content || "";
  }
}
