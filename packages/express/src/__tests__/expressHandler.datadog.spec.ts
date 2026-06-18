import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { loadDatadogApiKey } from "@jaypie/datadog";

// Subject
import expressHandler from "../expressHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");
vi.mock("../decorateResponse.helper.js");
vi.mock("@jaypie/datadog", () => ({
  DATADOG: { METRIC: { TYPE: { COUNT: 1 } } },
  hasDatadogEnv: vi.fn(() => false),
  loadDatadogApiKey: vi.fn().mockResolvedValue(false),
  submitMetric: vi.fn().mockResolvedValue(true),
}));

interface MockResponse extends Partial<Response> {
  on: ReturnType<typeof vi.fn>;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    end: vi.fn(),
    json: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    status: vi.fn(() => res) as unknown as ReturnType<typeof vi.fn>,
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Express Handler Datadog LLM Observability setup", () => {
  it("Calls loadDatadogApiKey before the handler", async () => {
    const handler = vi.fn();
    const wrapped = expressHandler(handler);
    const req = {} as Request;
    const res = createMockResponse();
    await wrapped(req, res as Response);
    expect(loadDatadogApiKey as Mock).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    const order =
      (loadDatadogApiKey as Mock).mock.invocationCallOrder[0] <
      handler.mock.invocationCallOrder[0];
    expect(order).toBeTrue();
  });
});
