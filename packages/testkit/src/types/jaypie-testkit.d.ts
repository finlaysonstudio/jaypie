import { Log } from "@jaypie/core";
import { Mock } from "vitest";
import type { Request, Response } from "express";

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

export type GenericArgs = Array<unknown>;
export type GenericFunction<T = unknown> = (
  ...args: T[]
) => Promise<unknown> | unknown;
export type JaypieLifecycleOption = Array<GenericFunction> | GenericFunction;

export interface JaypieHandlerOptions {
  setup?: JaypieLifecycleOption;
  teardown?: JaypieLifecycleOption;
  unavailable?: boolean;
  validate?: JaypieLifecycleOption;
}

export type JaypieHandlerParameter<T = unknown> =
  | JaypieHandlerOptions
  | GenericFunction<T>;

export type JsonValue =
  | { [key: string]: JsonValue }
  | boolean
  | JsonValue[]
  | null
  | number
  | string;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = Array<JsonObject>;
export type JsonReturn = JsonObject | JsonArray;

export type ExpressHandlerReturn =
  | { json(): JsonReturn }
  | boolean
  | JsonObject
  | null
  | number
  | string
  | undefined;
export type ExpressHandlerFunction = (
  req: Request,
  res: Response,
) => Promise<ExpressHandlerReturn | void> | ExpressHandlerReturn | void;
export interface ExpressHandlerOptions extends JaypieHandlerOptions {
  locals?: Record<string, GenericFunction | unknown>;
}
export type ExpressHandlerParameter =
  | ExpressHandlerOptions
  | ExpressHandlerFunction;

export type JaypieHandlerFunction = GenericFunction | ExpressHandlerFunction;

export interface WithJsonFunction {
  json: () => unknown;
}
