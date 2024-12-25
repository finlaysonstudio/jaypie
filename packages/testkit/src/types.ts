import { ProjectError } from "@jaypie/core";
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

export interface JaypieErrorConstructor {
  new (...args: any[]): ProjectError;
  (...args: any[]): ProjectError;
}

export interface LogMock {
  debug: Mock;
  error: Mock;
  fatal: Mock;
  info: Mock;
  init: Mock;
  lib: Mock;
  tag: Mock;
  trace: Mock;
  untag: Mock;
  var: Mock;
  warn: Mock;
  with: Mock;
}

export interface JaypieHandlerOptions {
  setup?: Array<(...args: any[]) => any>;
  teardown?: Array<(...args: any[]) => any>;
  unavailable?: boolean;
  validate?: Array<(...args: any[]) => any>;
}

export interface ExpressHandlerOptions extends JaypieHandlerOptions {
  locals?: Record<string, unknown | ((...args: any[]) => any)>;
}

export type ExpressHandlerProps = ExpressHandlerOptions | ((...args: any[]) => any) | undefined;

export interface SQSMessageResponse {
  value: string;
} 