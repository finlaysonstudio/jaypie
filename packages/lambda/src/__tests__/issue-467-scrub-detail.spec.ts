import { BadRequestError, ConfigurationError } from "@jaypie/errors";
import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import lambdaHandler from "../lambdaHandler.js";

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

type ErrorResponse = { errors: { detail: string; status: number }[] };

//
//
// Run tests
//

describe("Issue 467: lambdaHandler error detail scrubbing", () => {
  it("Returns the detail of a 4xx error as thrown", async () => {
    const handler = lambdaHandler(() => {
      throw new BadRequestError(CLIENT_DETAIL);
    });

    const result = (await handler({}, {})) as ErrorResponse;

    expect(result.errors[0].detail).toBe(CLIENT_DETAIL);
  });

  it("Scrubs the detail of a 4xx error when scrub is true", async () => {
    const handler = lambdaHandler(
      () => {
        throw new BadRequestError(CLIENT_DETAIL);
      },
      { scrub: true },
    );

    const result = (await handler({}, {})) as ErrorResponse;

    expect(result.errors[0].detail).toBe(
      "The request was not properly formatted",
    );
  });

  it("Scrubs the detail of a 5xx error by default", async () => {
    const handler = lambdaHandler(() => {
      throw new ConfigurationError(SERVER_DETAIL);
    });

    const result = (await handler({}, {})) as ErrorResponse;

    expect(result.errors[0].detail).not.toBe(SERVER_DETAIL);
  });

  it("Returns the detail of a 5xx error when scrub.server is false", async () => {
    const handler = lambdaHandler(
      () => {
        throw new ConfigurationError(SERVER_DETAIL);
      },
      { scrub: { server: false } },
    );

    const result = (await handler({}, {})) as ErrorResponse;

    expect(result.errors[0].detail).toBe(SERVER_DETAIL);
  });
});
