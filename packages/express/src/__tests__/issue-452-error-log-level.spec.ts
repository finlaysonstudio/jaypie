import { ConfigurationError, NotFoundError } from "@jaypie/errors";
import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import expressHandler from "../expressHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Issue 452: expressHandler error log level", () => {
  it("Logs error when the handler throws a 500-class Jaypie error", async () => {
    const app = express();
    app.use(
      expressHandler(() => {
        throw new ConfigurationError("Model not registered");
      }),
    );

    const res = await request(app).get("/");

    expect(res.status).toBe(500);
    expect(log.error).toHaveBeenCalled();
  });

  it("Does not log error when the handler throws a 4xx Jaypie error", async () => {
    const app = express();
    app.use(
      expressHandler(() => {
        throw new NotFoundError();
      }),
    );

    const res = await request(app).get("/");

    expect(res.status).toBe(404);
    expect(log.error).not.toHaveBeenCalled();
  });
});
