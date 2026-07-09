import Logger from "./Logger";
import { DEFAULT, FORMAT, LEVEL } from "./constants";
import { _resetDatadogTransport } from "./datadogTransport";
import { SerializationLimitOptions } from "./limits";
import { logTags } from "./logTags";
import { logVar } from "./logVar";
import { tallyMerge } from "./tallyMerge";

interface JaypieLoggerOptions extends SerializationLimitOptions {
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

export class JaypieLogger {
  public debug: Logger["debug"];
  public error: Logger["error"];
  public fatal: Logger["fatal"];
  public info: Logger["info"];
  public level: string;
  public trace: Logger["trace"];
  public var: Logger["var"];
  public warn: Logger["warn"];

  private _errorCount: number = 0;
  private _logger: Logger;
  private _loggers: Logger[];
  private _params: JaypieLoggerOptions;
  private _report: Record<string, unknown> = {};
  private _sessionActive: boolean = false;
  private _tags: Record<string, string>;
  private _tally: Record<string, unknown> = {};
  private _warnCount: number = 0;
  private _withLoggers: Record<string, JaypieLogger>;

  constructor({
    level = process.env.LOG_LEVEL,
    maxDepth,
    maxEntryBytes,
    maxStringLength,
    tags = {},
  }: JaypieLoggerOptions = {}) {
    this._params = { level, maxDepth, maxEntryBytes, maxStringLength, tags };
    this._loggers = [];
    this._tags = {};
    this._withLoggers = {};

    this.level = level || DEFAULT.LEVEL;

    this._tags = { ...logTags(), ...tags };
    this._logger = new Logger({
      format: FORMAT.JSON,
      level: this.level,
      maxDepth,
      maxEntryBytes,
      maxStringLength,
      tags: this._tags,
    });
    this._loggers = [this._logger];

    this.debug = ((...args: any[]) =>
      this._logger.debug(...args)) as Logger["debug"];
    this.debug.var = (messageObject: unknown, messageValue?: unknown) =>
      this._logger.debug.var(messageObject, messageValue);

    this.error = ((...args: any[]) => {
      if (this._sessionActive) this._errorCount++;
      this._logger.error(...args);
    }) as Logger["error"];
    this.error.var = (messageObject: unknown, messageValue?: unknown) => {
      if (this._sessionActive) this._errorCount++;
      this._logger.error.var(messageObject, messageValue);
    };

    this.fatal = ((...args: any[]) => {
      if (this._sessionActive) this._errorCount++;
      this._logger.fatal(...args);
    }) as Logger["fatal"];
    this.fatal.var = (messageObject: unknown, messageValue?: unknown) => {
      if (this._sessionActive) this._errorCount++;
      this._logger.fatal.var(messageObject, messageValue);
    };

    this.info = ((...args: any[]) =>
      this._logger.info(...args)) as Logger["info"];
    this.info.var = (messageObject: unknown, messageValue?: unknown) =>
      this._logger.info.var(messageObject, messageValue);

    this.trace = ((...args: any[]) =>
      this._logger.trace(...args)) as Logger["trace"];
    this.trace.var = (messageObject: unknown, messageValue?: unknown) =>
      this._logger.trace.var(messageObject, messageValue);

    this.warn = ((...args: any[]) => {
      if (this._sessionActive) this._warnCount++;
      this._logger.warn(...args);
    }) as Logger["warn"];
    this.warn.var = (messageObject: unknown, messageValue?: unknown) => {
      if (this._sessionActive) this._warnCount++;
      this._logger.warn.var(messageObject, messageValue);
    };

    this.var = (messageObject: unknown, messageValue?: unknown) =>
      this._logger.var(logVar(messageObject, messageValue));
  }

  /**
   * Update serialization limits at runtime for this logger and all loggers
   * derived from it (lib, with, flag). Pass a number to set a limit,
   * `false` to disable one; omitted keys are unchanged. Persists across
   * init().
   */
  public config(options: SerializationLimitOptions = {}): void {
    if (options.maxDepth !== undefined) {
      this._params.maxDepth = options.maxDepth;
    }
    if (options.maxEntryBytes !== undefined) {
      this._params.maxEntryBytes = options.maxEntryBytes;
    }
    if (options.maxStringLength !== undefined) {
      this._params.maxStringLength = options.maxStringLength;
    }
    for (const logger of this._loggers) {
      logger.config(options);
    }
    for (const key of Object.keys(this._withLoggers)) {
      this._withLoggers[key].config(options);
    }
  }

  public flag(flag?: string): JaypieLogger {
    if (typeof flag !== "string" || flag === "") {
      return this;
    }
    return this.with({ flag });
  }

  public init(): void {
    _resetDatadogTransport();
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
      maxDepth: this._params.maxDepth,
      maxEntryBytes: this._params.maxEntryBytes,
      maxStringLength: this._params.maxStringLength,
      tags: this._tags,
    });
    this._loggers = [this._logger];
    this._withLoggers = {};

    // Reset session state
    this._errorCount = 0;
    this._report = {};
    this._sessionActive = false;
    this._tally = {};
    this._warnCount = 0;

    const levels = [
      "debug",
      "error",
      "fatal",
      "info",
      "trace",
      "warn",
    ] as const;
    levels.forEach((lvl) => {
      if (lvl === "error") {
        this.error = ((...args: any[]) => {
          if (this._sessionActive) this._errorCount++;
          this._logger.error(...args);
        }) as any;
        this.error.var = (messageObject: unknown, messageValue?: unknown) => {
          if (this._sessionActive) this._errorCount++;
          this._logger.error.var(messageObject, messageValue);
        };
      } else if (lvl === "fatal") {
        this.fatal = ((...args: any[]) => {
          if (this._sessionActive) this._errorCount++;
          this._logger.fatal(...args);
        }) as any;
        this.fatal.var = (messageObject: unknown, messageValue?: unknown) => {
          if (this._sessionActive) this._errorCount++;
          this._logger.fatal.var(messageObject, messageValue);
        };
      } else if (lvl === "warn") {
        this.warn = ((...args: any[]) => {
          if (this._sessionActive) this._warnCount++;
          this._logger.warn(...args);
        }) as any;
        this.warn.var = (messageObject: unknown, messageValue?: unknown) => {
          if (this._sessionActive) this._warnCount++;
          this._logger.warn.var(messageObject, messageValue);
        };
      } else {
        this[lvl] = ((...args: any[]) => {
          this._logger[lvl](...args);
        }) as any;
        this[lvl].var = (messageObject: unknown, messageValue?: unknown) => {
          this._logger[lvl].var(messageObject, messageValue);
        };
      }
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
      maxDepth: this._params.maxDepth,
      maxEntryBytes: this._params.maxEntryBytes,
      maxStringLength: this._params.maxStringLength,
      tags: newTags,
    });
    this._loggers.push(logger._logger);
    return logger;
  }

  /**
   * Merge data into the current session's report. Requires an active
   * session (started via setup()); logs a warning and is a no-op otherwise.
   * Warns when overwriting an existing key. Emitted by teardown().
   */
  public report(data: Record<string, unknown>): void {
    if (!this._sessionActive) {
      this.warn("[logger] report() called without active session");
      return;
    }
    for (const key of Object.keys(data)) {
      if (key in this._report) {
        this.warn(`[logger] Overwriting report key: ${key}`);
      }
    }
    Object.assign(this._report, data);
  }

  /**
   * Start a report session: resets warn/error counters and accumulated
   * report data, applies optional tags. Pair with teardown() to bookend a
   * request. Handlers call this automatically.
   */
  public setup(tags?: Record<string, unknown>): void {
    if (this._sessionActive) {
      this.warn("[logger] setup() called while session already active");
    }
    this._errorCount = 0;
    this._report = {};
    this._sessionActive = true;
    this._tally = {};
    this._warnCount = 0;
    if (tags) {
      this.tag(tags);
    }
  }

  public tag(tags: Record<string, unknown>): void {
    for (const logger of this._loggers) {
      logger.tag(tags);
    }
    Object.assign(this._tags, tags);
  }

  /**
   * Merge data into the current session's tally. Unlike report(), repeated
   * keys combine: numbers sum, strings collect into an array of strings,
   * booleans AND, and objects merge recursively. Requires an active session
   * (started via setup()); silently no-ops otherwise. Folded into the
   * report emitted by teardown().
   */
  public tally(data: Record<string, unknown>): void {
    if (!this._sessionActive) {
      this.trace("[logger] tally() called without active session");
      return;
    }
    this._tally = tallyMerge({
      existing: this._tally,
      incoming: data,
    }) as Record<string, unknown>;
  }

  /**
   * End the current report session: emits log.info.var({ report }) with
   * accumulated report() and tally() data plus
   * { log: { warn, warns, error, errors } } counts, then resets session
   * state. No-op if no session is active. Handlers call this automatically.
   */
  public teardown(): void {
    if (!this._sessionActive) {
      return;
    }
    const finalReport = {
      ...(tallyMerge({
        existing: this._report,
        incoming: this._tally,
      }) as Record<string, unknown>),
      log: {
        error: this._errorCount > 0,
        errors: this._errorCount,
        warn: this._warnCount > 0,
        warns: this._warnCount,
      },
    };
    this.info.var({ report: finalReport });
    this._errorCount = 0;
    this._report = {};
    this._sessionActive = false;
    this._tally = {};
    this._warnCount = 0;
  }

  public untag(key: unknown): void {
    for (const logger of this._loggers) {
      logger.untag(key);
    }
    if (Array.isArray(key)) {
      key.forEach((k) => {
        delete this._tags[String(k)];
      });
    } else if (typeof key === "object" && key !== null) {
      Object.keys(key).forEach((k) => {
        delete this._tags[k];
      });
    } else {
      delete this._tags[String(key)];
    }
  }

  public with(key: unknown, value?: unknown): JaypieLogger {
    if (!key || (typeof key !== "object" && value === undefined)) {
      throw new Error(
        "ConfigurationError: with() requires an object argument or key-value pair",
      );
    }
    const loggerKey = JSON.stringify([key, value]);
    if (Object.keys(this._withLoggers).includes(loggerKey)) {
      return this._withLoggers[loggerKey];
    }
    const logger = new JaypieLogger({
      level: this.level,
      maxDepth: this._params.maxDepth,
      maxEntryBytes: this._params.maxEntryBytes,
      maxStringLength: this._params.maxStringLength,
      tags: { ...this._tags },
    });
    logger._logger = this._logger.with(key, value);
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
