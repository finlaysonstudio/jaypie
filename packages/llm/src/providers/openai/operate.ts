import { JsonArray } from "@jaypie/types";
import { OpenAI } from "openai";
import { LlmOperateOptions } from "../../types/LlmProvider.interface.js";
import { getLogger, prepareMessages } from "./utils.js";

export async function operate(
  message: string,
  options: LlmOperateOptions = {},
  context: { client: OpenAI },
): Promise<JsonArray> {
  const log = getLogger();
  const messages = prepareMessages(message, options || {});

  log.trace("Using operate function");

  return [{ messagesData: JSON.stringify(messages) }];
}
