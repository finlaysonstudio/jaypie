import chalk from "chalk";

const COLOR = {
  PLAIN: chalk,
  TRACE: chalk.bgBlackBright,
  DEBUG: chalk.bgBlack,
  INFO: chalk.bgBlue,
  WARN: chalk.bgYellow,
  ERROR: chalk.bgRed,
  FATAL: chalk.bgRedBright,
};

const DEFAULT = {
  COLOR: chalk,
  LEVEL: "debug",
  FORMAT: "color",
  VAR_LEVEL: "debug",
};

const ERROR_PREFIX = '{ "lib": "@knowdev/log" }:';
const ERROR = {
  VAR: {
    EMPTY_OBJECT: `${ERROR_PREFIX} Logger.var() called with empty object`,
    MULTIPLE_KEYS: `${ERROR_PREFIX} Logger.var() called with multiple keys`,
    NULL_OBJECT: `${ERROR_PREFIX} Logger.var() called with null`,
    UNDEFINED_MESSAGE: `${ERROR_PREFIX} Logger.var() called with \`undefined\` message`,
  },
};

const FORMAT = {
  COLOR: "color",
  JSON: "json",
  TEXT: "text",
};

const LEVEL = {
  ALL: "all",
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
  SILENT: "silent",
};

const LEVEL_VALUES = {
  all: 100,
  trace: 90,
  debug: 70,
  info: 50,
  warn: 30,
  error: 10,
  fatal: 1,
  none: 0,
  silent: 0,
};

export { COLOR, DEFAULT, ERROR, FORMAT, LEVEL, LEVEL_VALUES };
