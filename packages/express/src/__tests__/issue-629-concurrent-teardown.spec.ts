import { hasDatadogEnv, submitMetric } from "@jaypie/datadog";
import { log } from "@jaypie/logger";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// Subject
import expressHandler from "../expressHandler.js";
import expressStreamHandler from "../expressStreamHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");
vi.mock("@jaypie/datadog", () => ({
  DATADOG: { METRIC: { TYPE: { COUNT: 1 } } },
  hasDatadogEnv: vi.fn(() => true),
  loadDatadogApiKey: vi.fn().mockResolvedValue(false),
  submitMetric: vi.fn(),
}));

//
//
// Helpers
//

const METRIC_DELAY_MS = 40;
const CONTROLLER_DELAY_MS = 80;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SessionLogger {
  _report: Record<string, unknown>;
  _sessionActive: boolean;
  teardown: () => void;
}

let reports: Record<string, unknown>[];

beforeEach(() => {
  reports = [];
  (hasDatadogEnv as Mock).mockReturnValue(true);
  (submitMetric as Mock).mockImplementation(async () => {
    await delay(METRIC_DELAY_MS);
    return true;
  });
  const sessionLogger = log as unknown as SessionLogger;
  const originalTeardown = sessionLogger.teardown.bind(sessionLogger);
  vi.spyOn(sessionLogger, "teardown").mockImplementation(() => {
    if (sessionLogger._sessionActive) {
      reports.push({ ...sessionLogger._report });
    }
    originalTeardown();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Issue 629: concurrent requests and metric submission", () => {
  it("expressHandler keeps a later request's report when an earlier request awaits its metric", async () => {
    const app = express();
    app.get(
      "/fast",
      expressHandler(() => {
        log.report({ result: "fast" });
        return { ok: true };
      }),
    );
    app.get(
      "/slow",
      expressHandler(async () => {
        await delay(CONTROLLER_DELAY_MS);
        log.report({ result: "slow" });
        return { ok: true };
      }),
    );

    const fast = request(app).get("/fast");
    const fastDone = fast.then((res) => res);
    // Let the fast request reach its metric await before the slow one starts
    await delay(METRIC_DELAY_MS / 4);
    const [fastRes, slowRes] = await Promise.all([
      fastDone,
      request(app).get("/slow"),
    ]);

    expect(fastRes.status).toBe(200);
    expect(slowRes.status).toBe(200);
    const slowReport = reports.find((report) => report.path === "/slow");
    expect(slowReport).toBeDefined();
    expect(slowReport?.result).toBe("slow");
  });

  it("expressStreamHandler keeps a later request's report when an earlier request awaits its metric", async () => {
    const app = express();
    app.get(
      "/fast",
      expressStreamHandler(async (_req, res) => {
        log.report({ result: "fast" });
        res.write("fast");
      }),
    );
    app.get(
      "/slow",
      expressStreamHandler(async (_req, res) => {
        await delay(CONTROLLER_DELAY_MS);
        log.report({ result: "slow" });
        res.write("slow");
      }),
    );

    const fastDone = request(app)
      .get("/fast")
      .then((res) => res);
    await delay(METRIC_DELAY_MS / 4);
    const [fastRes, slowRes] = await Promise.all([
      fastDone,
      request(app).get("/slow"),
    ]);

    expect(fastRes.status).toBe(200);
    expect(slowRes.status).toBe(200);
    const slowReport = reports.find((report) => report.path === "/slow");
    expect(slowReport).toBeDefined();
    expect(slowReport?.result).toBe("slow");
  });
});
