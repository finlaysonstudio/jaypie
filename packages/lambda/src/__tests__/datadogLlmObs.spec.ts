import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { loadDatadogApiKey } from "@jaypie/datadog";
import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";

// Subjects
import lambdaHandler from "../lambdaHandler.js";
import lambdaStreamHandler from "../lambdaStreamHandler.js";
import type { ResponseStream } from "../lambdaStreamHandler.js";

//
//
// Mock modules
//

vi.mock("@jaypie/datadog", () => ({
  loadDatadogApiKey: vi.fn().mockResolvedValue(false),
}));

//
//
// Mock environment
//

beforeEach(() => {
  spyLog(log);
});
afterEach(() => {
  vi.clearAllMocks();
  restoreLog(log);
});

//
//
// Run tests
//

describe("Datadog LLM Observability setup", () => {
  it("lambdaHandler calls loadDatadogApiKey before the handler", async () => {
    const handler = vi.fn(() => "RESULT");
    const wrapped = lambdaHandler(handler);
    await wrapped({});
    expect(loadDatadogApiKey as Mock).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    const order =
      (loadDatadogApiKey as Mock).mock.invocationCallOrder[0] <
      handler.mock.invocationCallOrder[0];
    expect(order).toBeTrue();
  });

  it("lambdaStreamHandler calls loadDatadogApiKey before the handler", async () => {
    const responseStream: ResponseStream = {
      write: vi.fn(),
      end: vi.fn(),
      setContentType: vi.fn(),
    };
    const handler = vi.fn();
    const wrapped = lambdaStreamHandler(handler);
    await (wrapped as unknown as (...args: unknown[]) => Promise<void>)(
      {},
      responseStream,
      {},
    );
    expect(loadDatadogApiKey as Mock).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    const order =
      (loadDatadogApiKey as Mock).mock.invocationCallOrder[0] <
      handler.mock.invocationCallOrder[0];
    expect(order).toBeTrue();
  });
});
