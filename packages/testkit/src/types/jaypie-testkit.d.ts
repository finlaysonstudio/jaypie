import { Log } from "@jaypie/core";
import { Mock } from "vitest";
import { SQSMessageResponse } from "@jaypie/aws";

export interface JsonApiError {
  errors: Array<{
    status: number;
    title: string;
    detail?: string;
  }>;
}

export interface JsonApiData {
  data: {
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
    links?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
  meta?: Record<string, unknown>;
}

export interface MatcherResult {
  message: () => string;
  pass: boolean;
}

export interface MockLogMethod extends Mock {
  var: Mock;
}

export interface LogMock extends Log {
  debug: MockLogMethod;
  error: MockLogMethod;
  fatal: MockLogMethod;
  info: MockLogMethod;
  init: Mock;
  lib: Mock;
  mock: {
    debug: MockLogMethod;
    error: MockLogMethod;
    fatal: MockLogMethod;
    info: MockLogMethod;
    init: Mock;
    lib: Mock;
    tag: Mock;
    trace: MockLogMethod;
    untag: Mock;
    var: Mock;
    warn: MockLogMethod;
    with: Mock;
  };
  tag: Mock;
  trace: MockLogMethod;
  untag: Mock;
  var: Mock;
  warn: MockLogMethod;
  with: Mock;
}

export type AnyFunction = (...args: any[]) => Promise<any> | any;
export type JaypieHandlerFunction = (...args: any[]) => Promise<any> | any;
export type JaypieLifecycleOption = Array<AnyFunction> | AnyFunction;

export interface JaypieHandlerOptions {
  setup?: JaypieLifecycleOption;
  teardown?: JaypieLifecycleOption;
  unavailable?: boolean;
  validate?: JaypieLifecycleOption;
}
export type JaypieHandlerParameter = JaypieHandlerOptions | JaypieHandlerFunction;

export type JsonValue = 
  | { [key: string]: JsonValue }
  | boolean 
  | JsonValue[] 
  | null 
  | number 
  | string;
export type JsonObject = { [key: string]: JsonValue } | Array<JsonObject>;

export type ExpressResponsePartial = { 
  status: (code: number) => any 
};
export type ExpressHandlerReturn = 
  | { json(): JsonObject }
  | boolean 
  | JsonObject
  | null 
  | number 
  | string
  | undefined;
export type ExpressHandlerFunction = (req: Request, res: ExpressResponsePartial) => Promise<ExpressHandlerReturn | void> | ExpressHandlerReturn | void;
export interface ExpressHandlerOptions extends JaypieHandlerOptions {
  locals?: Record<string, AnyFunction | unknown>;
}
export type ExpressHandlerParameter = ExpressHandlerOptions | ExpressHandlerFunction;
