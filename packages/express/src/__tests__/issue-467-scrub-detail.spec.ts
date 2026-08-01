import { BadRequestError, ConfigurationError } from "@jaypie/errors";
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
// Constants
//

const CLIENT_DETAIL = "data.confirm must match the API key id, name, or label";
const SERVER_DETAIL = "Fabric model chat is not registered";

//
//
// Run tests
//

describe("Issue 467: expressHandler error detail scrubbing", () => {
  it("Responds with the detail of a 4xx error as thrown", async () => {
    const app = express();
    app.use(
      expressHandler(() => {
        throw new BadRequestError(CLIENT_DETAIL);
      }),
    );

    const res = await request(app).get("/");

    expect(res.status).toBe(400);
    expect(res.body.errors[0].detail).toBe(CLIENT_DETAIL);
  });

  it("Scrubs the detail of a 4xx error when scrub is true", async () => {
    const app = express();
    app.use(
      expressHandler(
        () => {
          throw new BadRequestError(CLIENT_DETAIL);
        },
        { scrub: true },
      ),
    );

    const res = await request(app).get("/");

    expect(res.status).toBe(400);
    expect(res.body.errors[0].detail).toBe(
      "The request was not properly formatted",
    );
  });

  it("Scrubs the detail of a 5xx error by default", async () => {
    const app = express();
    app.use(
      expressHandler(() => {
        throw new ConfigurationError(SERVER_DETAIL);
      }),
    );

    const res = await request(app).get("/");

    expect(res.status).toBe(500);
    expect(res.body.errors[0].detail).not.toBe(SERVER_DETAIL);
  });

  it("Responds with the detail of a 5xx error when scrub is false", async () => {
    const app = express();
    app.use(
      expressHandler(
        () => {
          throw new ConfigurationError(SERVER_DETAIL);
        },
        { scrub: false },
      ),
    );

    const res = await request(app).get("/");

    expect(res.status).toBe(500);
    expect(res.body.errors[0].detail).toBe(SERVER_DETAIL);
  });
});
