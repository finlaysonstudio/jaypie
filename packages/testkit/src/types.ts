import { Log } from "@jaypie/core";
import { Mock } from "vitest";

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

export interface JaypieHandlerOptions {
  setup?: Array<(...args: any[]) => Promise<void> | void>;
  teardown?: Array<(...args: any[]) => Promise<void> | void>;
  unavailable?: boolean;
  validate?: Array<(...args: any[]) => Promise<boolean> | boolean>;
}

export interface ExpressHandlerOptions extends JaypieHandlerOptions {
  locals?: Record<string, unknown | ((...args: any[]) => any)>;
}

export type ExpressHandlerProps = ExpressHandlerOptions | ((...args: any[]) => any) | undefined;

export interface SQSMessageResponse {
  value: string;
} 