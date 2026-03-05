import { PROVIDER } from "../../constants.js";
import { OpenAiAdapter } from "./OpenAiAdapter.js";

/**
 * XaiAdapter extends OpenAiAdapter since xAI (Grok) uses an OpenAI-compatible API.
 * Only the name and default model are overridden; all request building, response parsing,
 * error classification, tool handling, and streaming are inherited.
 */
export class XaiAdapter extends OpenAiAdapter {
  // @ts-expect-error Narrowing override: xAI name differs from parent's literal "openai"
  readonly name = PROVIDER.XAI.NAME;
  // @ts-expect-error Narrowing override: xAI default model differs from parent's literal
  readonly defaultModel = PROVIDER.XAI.MODEL.DEFAULT;
}

// Export singleton instance
export const xaiAdapter = new XaiAdapter();
