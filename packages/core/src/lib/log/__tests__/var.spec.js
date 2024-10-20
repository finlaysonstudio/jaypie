import { matchers as jaypieMatchers } from "@jaypie/testkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Logger from "../Logger.js";
import { ERROR } from "../util/constants.js";

import mockLog from "../util/log.js";

expect.extend(jaypieMatchers);

//
//
// Mock modules
//

vi.mock("../util/log.js");

//
//
// Mock environment
//

let log;
beforeEach(() => {
  log = new Logger();
});
afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Var", () => {
  it("Works", () => {
    log.var("msg", "Hello");
    expect(mockLog).toBeCalledWithInitialParams([{ msg: "Hello" }]);
  });
  it("Works as chained function", () => {
    log.info.var("msg", "Hello");
    expect(mockLog).toBeCalledWithInitialParams([{ msg: "Hello" }]);
  });
  it("Shows undefined second param", () => {
    log.var("msg", undefined);
    expect(mockLog).toBeCalledWithInitialParams([{ msg: "undefined" }]);
  });

  it("Allows key and value as single object", () => {
    log.var({ msg: "Hello" });
    expect(mockLog).toBeCalledWithInitialParams([{ msg: "Hello" }]);
  });

  it("Errors if object has multiple keys", () => {
    log.var({ one: 1, two: 2 });
    expect(mockLog).toBeCalledWithInitialParams([ERROR.VAR.MULTIPLE_KEYS]);
  });
  it("Errors if object is null", () => {
    log.var(null);
    expect(mockLog).toBeCalledWithInitialParams([ERROR.VAR.NULL_OBJECT]);
  });
  it("Errors if object is empty", () => {
    log.var({});
    expect(mockLog).toBeCalledWithInitialParams([ERROR.VAR.EMPTY_OBJECT]);
  });
  it("Errors if object is undefined", () => {
    log.var(undefined);
    expect(mockLog).toBeCalledWithInitialParams([ERROR.VAR.UNDEFINED_MESSAGE]);
  });
});
