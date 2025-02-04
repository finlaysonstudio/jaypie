import { LlmProvider } from "../types/LlmProvider.interface.js";
import { PROVIDER } from "../constants.js";

export class AnthropicProvider implements LlmProvider {
  private model: string;

  constructor(model: string = PROVIDER.ANTHROPIC.MODEL.DEFAULT) {
    this.model = model;
  }

  async send(message: string): Promise<string> {
    // TODO: Implement Anthropic API call
    return `[anthropic ${this.model}] ${message}`;
  }
} 