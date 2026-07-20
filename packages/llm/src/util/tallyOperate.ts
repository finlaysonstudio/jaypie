import { log } from "@jaypie/logger";

import { LlmUsageItem } from "../types/LlmProvider.interface.js";

const UNKNOWN = "unknown";

interface TallyOperateOptions {
  toolCallNames?: string[];
  turns: number;
  usage?: LlmUsageItem[];
}

/**
 * Tally loop totals onto the root logger's report session so handlers
 * (express, lambda) include llm activity in the report emitted at teardown.
 * Silently no-ops outside an active session or when the logger predates
 * tally support.
 */
export function tallyOperate({
  toolCallNames = [],
  turns,
  usage = [],
}: TallyOperateOptions): void {
  if (typeof log.tally !== "function") return;
  const llm: Record<string, unknown> = {
    operates: 1,
    toolCalls: toolCallNames.length,
    turns,
  };
  if (toolCallNames.length > 0) {
    const tools: Record<string, number> = {};
    for (const name of toolCallNames) {
      tools[name] = (tools[name] ?? 0) + 1;
    }
    llm.tools = tools;
  }
  if (usage.length > 0) {
    const usageByModel: Record<string, Record<string, number>> = {};
    for (const item of usage) {
      const key =
        [item.provider, item.model].filter(Boolean).join(":") || UNKNOWN;
      usageByModel[key] ??= { input: 0, output: 0, reasoning: 0, total: 0 };
      usageByModel[key].input += item.input;
      usageByModel[key].output += item.output;
      usageByModel[key].reasoning += item.reasoning;
      usageByModel[key].total += item.total;
      if (item.cacheRead !== undefined) {
        usageByModel[key].cacheRead =
          (usageByModel[key].cacheRead ?? 0) + item.cacheRead;
      }
      if (item.cacheWrite !== undefined) {
        usageByModel[key].cacheWrite =
          (usageByModel[key].cacheWrite ?? 0) + item.cacheWrite;
      }
    }
    llm.usage = usageByModel;
  }
  log.tally({ llm });
}
