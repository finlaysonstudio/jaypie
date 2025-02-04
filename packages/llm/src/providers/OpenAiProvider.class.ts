import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/core";
import { OpenAI } from "openai";
import { PROVIDER } from "../constants.js";
import { LlmProvider } from "../types/LlmProvider.interface.js";

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

  async send(message: string): Promise<string> {
    const client = await this.getClient();
    const completion = await client.chat.completions.create({
      messages: [{ role: "user", content: message }],
      model: this.model,
    });

    return completion.choices[0]?.message?.content || "";
  }
}
