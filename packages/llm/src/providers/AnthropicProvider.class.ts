import { JsonObject } from "@jaypie/types";
import { PROVIDER } from "../constants.js";
import { LlmProvider } from "../types/LlmProvider.interface.js";

export class AnthropicProvider implements LlmProvider {
  private model: string;
  private apiKey?: string;

  constructor(
    model: string = PROVIDER.ANTHROPIC.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async send(message: string): Promise<string | JsonObject> {
    // TODO: Implement Anthropic API call
    return `[anthropic ${this.model}] ${message}`;
  }
}
