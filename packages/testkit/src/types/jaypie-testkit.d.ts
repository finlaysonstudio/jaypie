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
export type JaypieLifecycleFunction = Array<AnyFunction> | AnyFunction;

export interface JaypieHandlerOptions {
  setup?: JaypieLifecycleFunction;
  teardown?: JaypieLifecycleFunction;
  unavailable?: boolean;
  validate?: JaypieLifecycleFunction;
}

export type JaypieHandlerProps = JaypieHandlerOptions | ((...args: any[]) => any) | undefined;

export interface ExpressHandlerOptions extends JaypieHandlerOptions {
  locals?: Record<string, AnyFunction | unknown>;
}

export type ExpressHandlerProps = ExpressHandlerOptions | ((...args: any[]) => any) | undefined;
