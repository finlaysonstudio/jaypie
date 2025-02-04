export interface LlmProvider {
  send(message: string): Promise<string>;
} 