import Logger from "./Logger";
import { DEFAULT, FORMAT, LEVEL } from "./constants";
import { logTags } from "./logTags";
import { logVar } from "./logVar";

interface JaypieLoggerOptions {
  level?: string;
  tags?: Record<string, string>;
}

function envBoolean(
  key: string,
  { defaultValue }: { defaultValue: boolean },
): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const lower = value.toLowerCase();
  return !(
    lower === "" ||
    lower === "0" ||
    lower === "f" ||
    lower === "false" ||
    lower === "n" ||
    lower === "no"
  );
}

class JaypieLogger {
  public debug: Logger["debug"];
  public error: Logger["error"];
  public fatal: Logger["fatal"];
  public info: Logger["info"];
  public level: string;
  public trace: Logger["trace"];
  public var: Logger["var"];
  public warn: Logger["warn"];

  private _logger: Logger;
  private _loggers: Logger[];
  private _params: JaypieLoggerOptions;
  private _tags: Record<string, string>;
  private _withLoggers: Record<string, JaypieLogger>;

  constructor({
    level = process.env.LOG_LEVEL,
    tags = {},
  }: JaypieLoggerOptions = {}) {
    this._params = { level, tags };
    this._loggers = [];
    this._tags = {};
    this._withLoggers = {};

    this.level = level || DEFAULT.LEVEL;

    this._tags = { ...logTags(), ...tags };
    this._logger = new Logger({
      format: FORMAT.JSON,
      level: this.level,
      tags: this._tags,
    });
    this._loggers = [this._logger];

    this.debug = ((...args: any[]) =>
      this._logger.debug(...args)) as Logger["debug"];
    this.debug.var = (...args: any[]) => this._logger.debug.var(...args);

    this.error = ((...args: any[]) =>
      this._logger.error(...args)) as Logger["error"];
    this.error.var = (...args: any[]) => this._logger.error.var(...args);

    this.fatal = ((...args: any[]) =>
      this._logger.fatal(...args)) as Logger["fatal"];
    this.fatal.var = (...args: any[]) => this._logger.fatal.var(...args);

    this.info = ((...args: any[]) =>
      this._logger.info(...args)) as Logger["info"];
    this.info.var = (...args: any[]) => this._logger.info.var(...args);

    this.trace = ((...args: any[]) =>
      this._logger.trace(...args)) as Logger["trace"];
    this.trace.var = (...args: any[]) => this._logger.trace.var(...args);

    this.warn = ((...args: any[]) =>
      this._logger.warn(...args)) as Logger["warn"];
    this.warn.var = (...args: any[]) => this._logger.warn.var(...args);

    this.var = (...args: any[]) => this._logger.var(logVar(...args));
  }

  public init(): void {
    for (const logger of this._loggers) {
      if ("init" in logger && typeof logger.init === "function") {
        (logger as Logger & { init: () => void }).init();
      }
    }
    const level = this._params.level;
    const tags = this._params.tags;
    this.level = level || DEFAULT.LEVEL;
    this._tags = { ...logTags(), ...tags };
    this._logger = new Logger({
      format: FORMAT.JSON,
      level: this.level,
      tags: this._tags,
    });
    this._loggers = [this._logger];
    this._withLoggers = {};

    const levels = [
      "debug",
      "error",
      "fatal",
      "info",
      "trace",
      "warn",
    ] as const;
    levels.forEach((lvl) => {
      this[lvl] = ((...args: any[]) => {
        this._logger[lvl](...args);
      }) as any;
      this[lvl].var = (...args: any[]) => {
        this._logger[lvl].var(...args);
      };
    });
  }

  public lib({
    level,
    lib,
    tags = {},
  }: {
    level?: string;
    lib?: string;
    tags?: Record<string, string>;
  } = {}): JaypieLogger {
    const newTags = Object.assign({}, this._tags, tags);
    if (lib) {
      newTags.lib = lib;
    }

    const logger = new JaypieLogger({
      level: (() => {
        if (level) {
          return level;
        }
        if (process.env.MODULE_LOG_LEVEL) {
          return process.env.MODULE_LOG_LEVEL;
        }
        if (envBoolean("MODULE_LOGGER", { defaultValue: false })) {
          return process.env.LOG_LEVEL;
        }
        return LEVEL.SILENT;
      })(),
      tags: newTags,
    });
    this._loggers.push(logger._logger);
    return logger;
  }

  public tag(tags: Record<string, unknown>): void {
    for (const logger of this._loggers) {
      logger.tag(tags);
    }
    Object.assign(this._tags, tags);
  }

  public untag(...args: any[]): void {
    for (const logger of this._loggers) {
      logger.untag(...args);
    }
    for (const key of Object.keys(args)) {
      delete this._tags[key];
    }
  }

  public with(...args: any[]): JaypieLogger {
    if (!args || typeof args !== "object") {
      throw new Error("ConfigurationError: with() requires an object argument");
    }
    const loggerKey = JSON.stringify(args);
    if (Object.keys(this._withLoggers).includes(loggerKey)) {
      return this._withLoggers[loggerKey];
    }
    const logger = new JaypieLogger({
      level: this.level,
      tags: { ...this._tags },
    });
    logger._logger = this._logger.with(...args);
    logger._loggers = [logger._logger];
    this._withLoggers[loggerKey] = logger;
    this._loggers.push(logger._logger);
    return logger;
  }
}

export function createLogger(tags: Record<string, string> = {}): JaypieLogger {
  const jaypieLogger = new JaypieLogger({
    tags,
  });
  return jaypieLogger;
}

export default JaypieLogger;
