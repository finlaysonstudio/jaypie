import { OutgoingMessage } from "node:http";
import { Writable } from "node:stream";
import express from "express";
import { describe, expect, it, vi } from "vitest";

import type { ResponseStream } from "../types.js";

//
//
// Mock awslambda global
//

const mockWrappedStream: ResponseStream = {
  end: vi.fn(),
  write: vi.fn(),
};

vi.stubGlobal("awslambda", {
  HttpResponseStream: {
    from: vi.fn(() => mockWrappedStream),
  },
});

// Import after mocking
import LambdaResponseBuffered from "../LambdaResponseBuffered.js";
import LambdaResponseStreaming from "../LambdaResponseStreaming.js";

//
//
// Helpers
//

// Express's middleware/init.js swaps the response prototype to app.response,
// whose chain is ServerResponse -> OutgoingMessage, not Writable
function adoptExpressPrototype<T extends object>(res: T): T {
  Object.setPrototypeOf(res, express.response);
  return res;
}

// The destroyed getter lives on Writable.prototype, lost after the swap
function isDestroyed(res: Writable): boolean {
  return (res as unknown as { _writableState: { destroyed: boolean } })
    ._writableState.destroyed;
}

function closed(res: Writable): Promise<void> {
  return new Promise((resolve) => res.once("close", () => resolve()));
}

const RESPONSES = [
  {
    create: () => new LambdaResponseBuffered(),
    name: "LambdaResponseBuffered",
  },
  {
    create: () => new LambdaResponseStreaming({ end: vi.fn(), write: vi.fn() }),
    name: "LambdaResponseStreaming",
  },
];

//
//
// Tests
//

describe.each(RESPONSES)("$name destroy", ({ create }) => {
  it("keeps Writable's destroy after Express swaps the prototype", () => {
    const res = adoptExpressPrototype(create());
    expect(res.destroy).not.toBe(OutgoingMessage.prototype.destroy);
  });

  it("destroys without OutgoingMessage internal state", async () => {
    const res = adoptExpressPrototype(create());
    const done = closed(res);
    expect(() => res.destroy()).not.toThrow();
    await done;
    expect(isDestroyed(res)).toBe(true);
  });

  it("auto-destroys after end without throwing", async () => {
    const res = adoptExpressPrototype(create());
    const done = closed(res);
    res.end("ok");
    await done;
    expect(isDestroyed(res)).toBe(true);
  });
});
