import { JsonObject, JsonReturn } from "@jaypie/types";

import {
  LlmHistory,
  LlmOperateResponse,
  LlmResponseStatus,
  LlmUsage,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";

// Derive LlmOutput type from LlmOperateResponse since it's not exported
type LlmOutput = LlmOperateResponse["output"];

//
//
// Types
//

export interface ResponseBuilderConfig {
  model: string;
  provider: string;
}

export interface LlmError {
  detail?: string;
  status: number | string;
  title: string;
}

//
//
// Main
//

/**
 * ResponseBuilder provides a fluent API for constructing LlmOperateResponse objects.
 * It standardizes response construction across providers.
 */
export class ResponseBuilder {
  private response: LlmOperateResponse;

  constructor(config: ResponseBuilderConfig) {
    this.response = {
      content: undefined,
      error: undefined,
      history: [],
      model: config.model,
      output: [],
      provider: config.provider,
      responses: [],
      status: LlmResponseStatus.InProgress,
      usage: [],
    };
  }

  /**
   * Set the response content
   */
  setContent(content: string | JsonObject | undefined): this {
    this.response.content = content;
    return this;
  }

  /**
   * Set the response status
   */
  setStatus(status: LlmResponseStatus): this {
    this.response.status = status;
    return this;
  }

  /**
   * Set an error on the response
   */
  setError(error: LlmError): this {
    this.response.error = error;
    return this;
  }

  /**
   * Set the history
   */
  setHistory(history: LlmHistory): this {
    this.response.history = history;
    return this;
  }

  /**
   * Append items to the history
   */
  appendToHistory(...items: LlmHistory): this {
    this.response.history.push(...items);
    return this;
  }

  /**
   * Set the output
   */
  setOutput(output: LlmOutput): this {
    this.response.output = output;
    return this;
  }

  /**
   * Append items to the output
   */
  appendToOutput(...items: LlmOutput): this {
    this.response.output.push(...items);
    return this;
  }

  /**
   * Add a raw provider response
   */
  addResponse(response: JsonReturn): this {
    this.response.responses.push(response);
    return this;
  }

  /**
   * Add a usage entry for a single API call
   */
  addUsage(usage: LlmUsageItem): this {
    this.response.usage.push(usage);
    return this;
  }

  /**
   * Set the entire usage array
   */
  setUsage(usage: LlmUsage): this {
    this.response.usage = usage;
    return this;
  }

  /**
   * Get the current usage array for modifications
   */
  getUsage(): LlmUsage {
    return this.response.usage;
  }

  /**
   * Get the current history for modifications
   */
  getHistory(): LlmHistory {
    return this.response.history;
  }

  /**
   * Get the current output for modifications
   */
  getOutput(): LlmOutput {
    return this.response.output;
  }

  /**
   * Mark response as completed
   */
  complete(): this {
    this.response.status = LlmResponseStatus.Completed;
    return this;
  }

  /**
   * Mark response as incomplete (e.g., max turns exceeded)
   */
  incomplete(): this {
    this.response.status = LlmResponseStatus.Incomplete;
    return this;
  }

  /**
   * Build and return the final response object
   */
  build(): LlmOperateResponse {
    return { ...this.response };
  }
}

/**
 * Factory function to create a new ResponseBuilder
 */
export function createResponseBuilder(
  config: ResponseBuilderConfig,
): ResponseBuilder {
  return new ResponseBuilder(config);
}
