import type { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { JsonObject } from "@jaypie/types";
import { PROVIDER } from "../../constants.js";
import {
  bedrockAdapter,
  createOperateLoop,
  createStreamLoop,
  OperateLoop,
  StreamLoop,
} from "../../operate/index.js";
import {
  LlmHistory,
  LlmHistoryItem,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
} from "../../types/LlmProvider.interface.js";
import { LlmStreamChunk } from "../../types/LlmStreamChunk.interface.js";
import { getLogger, initializeClient } from "./utils.js";

export class BedrockProvider implements LlmProvider {
  private model: string;
  private region?: string;
  private _client?: BedrockRuntimeClient;
  private _operateLoop?: OperateLoop;
  private _streamLoop?: StreamLoop;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = PROVIDER.BEDROCK.DEFAULT,
    { region }: { region?: string } = {},
  ) {
    this.model = model;
    this.region = region;
  }

  private async getClient(): Promise<BedrockRuntimeClient> {
    if (this._client) return this._client;
    this._client = await initializeClient({ region: this.region });
    return this._client;
  }

  private async getOperateLoop(): Promise<OperateLoop> {
    if (this._operateLoop) return this._operateLoop;
    const client = await this.getClient();
    this._operateLoop = createOperateLoop({ adapter: bedrockAdapter, client });
    return this._operateLoop;
  }

  private async getStreamLoop(): Promise<StreamLoop> {
    if (this._streamLoop) return this._streamLoop;
    const client = await this.getClient();
    this._streamLoop = createStreamLoop({ adapter: bedrockAdapter, client });
    return this._streamLoop;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const operateLoop = await this.getOperateLoop();
    const mergedOptions = { ...options, model: options?.model ?? this.model };
    const response = await operateLoop.execute(message, mergedOptions);
    return response.content ?? "";
  }

  async operate(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    const operateLoop = await this.getOperateLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    const response = await operateLoop.execute(input, mergedOptions);

    if (response.history && response.history.length > 0) {
      this.conversationHistory = response.history;
    }

    return response;
  }

  async *stream(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): AsyncIterable<LlmStreamChunk> {
    const streamLoop = await this.getStreamLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    yield* streamLoop.execute(input, mergedOptions);
  }
}
