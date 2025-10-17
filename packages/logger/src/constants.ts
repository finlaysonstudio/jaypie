export const DEFAULT = {
  LEVEL: "debug",
  VAR_LEVEL: "debug",
};

export const ERROR_PREFIX = '{ "lib": "@jaypie/logger" }:';

export const ERROR = {
  VAR: {
    EMPTY_OBJECT: `${ERROR_PREFIX} Logger.var() called with empty object`,
    MULTIPLE_KEYS: `${ERROR_PREFIX} Logger.var() called with multiple keys`,
    NULL_OBJECT: `${ERROR_PREFIX} Logger.var() called with null`,
    UNDEFINED_MESSAGE: `${ERROR_PREFIX} Logger.var() called with \`undefined\` message`,
  },
};

export const FORMAT = {
  JSON: "json",
  TEXT: "text",
} as const;

export const LEVEL = {
  ALL: "all",
  DEBUG: "debug",
  ERROR: "error",
  FATAL: "fatal",
  INFO: "info",
  SILENT: "silent",
  TRACE: "trace",
  WARN: "warn",
} as const;

export const LEVEL_VALUES: Record<string, number> = {
  all: 100,
  debug: 70,
  error: 10,
  fatal: 1,
  info: 50,
  none: 0,
  silent: 0,
  trace: 90,
  warn: 30,
};

export const PSEUDO_LEVELS = ["ALL", "SILENT"];
