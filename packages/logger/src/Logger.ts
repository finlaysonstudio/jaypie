import { DEFAULT, ERROR, FORMAT, LEVEL, LEVEL_VALUES } from "./constants";
import {
  applyValueLimits,
  enforceEntryLimit,
  hasValueLimits,
  resolveSerializationLimits,
  SerializationLimitOptions,
  SerializationLimits,
  truncateToBudget,
} from "./limits";
import { filterByType, pipelines } from "./pipelines";
import { sanitizeAuth } from "./sanitizeAuth";
import { forceString, out, parse, parsesTo, stringify } from "./utils";

type LogLevel = string;
type LogFormat = "json" | "text";
type Tags = Record<string, string>;

interface LoggerOptions extends SerializationLimitOptions {
  format?: LogFormat;
  level?: LogLevel;
  levelField?: boolean | string;
  tags?: Tags;
  varLevel?: LogLevel;
}

interface LogJson {
  data?: unknown;
  dataType?: string;
  message: string;
  var?: string;
  [key: string]: unknown;
}

type LogMethod = {
  (...messages: unknown[]): void;
  var: (messageObject: unknown, messageValue?: unknown) => void;
};

function resolveLevelField(value?: boolean | string): false | string {
  if (value === undefined) {
    const env = process.env.LOG_LEVEL_FIELD;
    if (env === undefined || env === "") return false;
    if (env === "false" || env === "0" || env === "no") return false;
    if (env === "true" || env === "1" || env === "yes") return "level";
    return env;
  }
  if (value === false) return false;
  if (value === true) return "level";
  return value;
}

class Logger {
  public debug: LogMethod;
  public error: LogMethod;
  public fatal: LogMethod;
  public info: LogMethod;
  public options: LoggerOptions;
  public tags: Tags;
  public trace: LogMethod;
  public var: (messageObject: unknown, messageValue?: unknown) => void;
  public warn: LogMethod;
  private levelField: false | string;
  private limits: SerializationLimits;

  constructor({
    format = (process.env.LOG_FORMAT as LogFormat) || DEFAULT.LEVEL,
    level = process.env.LOG_LEVEL || DEFAULT.LEVEL,
    levelField,
    maxDepth,
    maxEntryBytes,
    maxStringLength,
    tags = {},
    varLevel = process.env.LOG_VAR_LEVEL || DEFAULT.VAR_LEVEL,
  }: LoggerOptions = {}) {
    this.levelField = resolveLevelField(levelField);
    this.limits = resolveSerializationLimits({
      maxDepth,
      maxEntryBytes,
      maxStringLength,
    });
    this.options = {
      format,
      level,
      levelField: this.levelField || undefined,
      // Pin resolved limits (false = explicitly off) so child loggers
      // created via with() inherit this config instead of re-resolving
      maxDepth: this.limits.maxDepth ?? false,
      maxEntryBytes: this.limits.maxEntryBytes ?? false,
      maxStringLength: this.limits.maxStringLength ?? false,
      varLevel,
    };

    this.tags = {};
    Object.keys(tags).forEach((key) => {
      this.tags[key] = forceString(tags[key]);
    });

    this.debug = this.createLogMethod(LEVEL.DEBUG, format, level);
    this.error = this.createLogMethod(LEVEL.ERROR, format, level);
    this.fatal = this.createLogMethod(LEVEL.FATAL, format, level);
    this.info = this.createLogMethod(LEVEL.INFO, format, level);
    this.trace = this.createLogMethod(LEVEL.TRACE, format, level);
    this.warn = this.createLogMethod(LEVEL.WARN, format, level);

    const varLevelMethod =
      this[varLevel as "debug" | "error" | "fatal" | "info" | "trace" | "warn"];
    this.var = (varLevelMethod as LogMethod)?.var || this.debug.var;
  }

  private createLogMethod(
    logLevel: string,
    format: LogFormat,
    checkLevel: string,
  ): LogMethod {
    const logFn = (...messages: unknown[]): void => {
      if (LEVEL_VALUES[logLevel] <= LEVEL_VALUES[checkLevel]) {
        let sanitized = messages.map(sanitizeAuth);
        if (hasValueLimits(this.limits)) {
          sanitized = sanitized.map((item) =>
            applyValueLimits(item, this.limits),
          );
        }
        if (format === FORMAT.JSON) {
          let message = stringify(...sanitized);
          let parses = parsesTo(message);
          // When data comes from the full message they mirror each other;
          // entry-limit truncation must keep them in sync
          let syncMessageToData = parses.parses;
          const last = sanitized[sanitized.length - 1];
          if (
            sanitized.length > 1 &&
            typeof last === "object" &&
            last !== null &&
            sanitized
              .slice(0, -1)
              .every((item) => typeof item !== "object" || item === null)
          ) {
            const lastParses = parsesTo(stringify(last));
            if (lastParses.parses) {
              message = stringify(...sanitized.slice(0, -1));
              parses = lastParses;
              syncMessageToData = false;
            }
          }
          const json: LogJson = {
            message,
            ...this.tags,
          };
          if (parses.parses) {
            json.data = parses.message;
          }
          if (this.levelField) {
            json[this.levelField] = logLevel;
          }
          let entry: LogJson = json;
          if (this.limits.maxEntryBytes !== undefined) {
            entry = enforceEntryLimit(json, {
              maxEntryBytes: this.limits.maxEntryBytes,
              syncMessageToData,
            }) as LogJson;
          }
          out(entry, { level: logLevel });
        } else {
          let message = stringify(...sanitized);
          if (this.limits.maxEntryBytes !== undefined) {
            message = truncateToBudget(message, this.limits.maxEntryBytes);
          }
          out(message, { level: logLevel });
        }
      }
    };

    logFn.var = (messageObject: unknown, messageValue?: unknown): void => {
      if (messageObject === undefined) {
        this.warn(ERROR.VAR.UNDEFINED_MESSAGE);
      }

      let msgObj: Record<string, unknown>;

      if (typeof messageObject !== "object" || messageObject === null) {
        if (typeof messageObject !== "object") {
          if (messageValue === undefined) messageValue = "undefined";
          msgObj = { [String(messageObject)]: messageValue };
        } else {
          this.warn(ERROR.VAR.NULL_OBJECT);
          return logFn(messageObject);
        }
      } else {
        msgObj = sanitizeAuth(messageObject) as Record<string, unknown>;
      }

      const keys = Object.keys(msgObj);
      if (keys.length === 0) {
        this.warn(ERROR.VAR.EMPTY_OBJECT);
        return logFn(msgObj);
      }

      if (keys.length > 1) {
        this.warn(ERROR.VAR.MULTIPLE_KEYS);
        return logFn(msgObj);
      }

      if (format === FORMAT.JSON) {
        const messageKey = keys[0];
        let messageVal = msgObj[messageKey];

        for (const pipeline of pipelines) {
          if (messageKey === pipeline.key) {
            messageVal = pipeline.filter(messageVal);
          }
        }
        messageVal = filterByType(messageVal);
        if (hasValueLimits(this.limits)) {
          messageVal = applyValueLimits(messageVal, this.limits);
        }

        const json: LogJson = {
          data: parse(messageVal),
          dataType: typeof messageVal,
          message: stringify(messageVal),
          var: messageKey,
          ...this.tags,
        };
        if (this.levelField) {
          json[this.levelField] = logLevel;
        }

        if (LEVEL_VALUES[logLevel] <= LEVEL_VALUES[checkLevel]) {
          let entry: LogJson = json;
          if (this.limits.maxEntryBytes !== undefined) {
            entry = enforceEntryLimit(json, {
              maxEntryBytes: this.limits.maxEntryBytes,
              syncMessageToData: true,
            }) as LogJson;
          }
          out(entry, { level: logLevel });
        }
      } else {
        return logFn(msgObj);
      }
    };

    return logFn as LogMethod;
  }

  /**
   * Update serialization limits at runtime. Pass a number to set a limit,
   * `false` to disable one; omitted keys are unchanged.
   */
  public config(options: SerializationLimitOptions = {}): void {
    this.limits = resolveSerializationLimits({
      maxDepth: options.maxDepth ?? this.limits.maxDepth ?? false,
      maxEntryBytes:
        options.maxEntryBytes ?? this.limits.maxEntryBytes ?? false,
      maxStringLength:
        options.maxStringLength ?? this.limits.maxStringLength ?? false,
    });
    this.options.maxDepth = this.limits.maxDepth ?? false;
    this.options.maxEntryBytes = this.limits.maxEntryBytes ?? false;
    this.options.maxStringLength = this.limits.maxStringLength ?? false;
  }

  public tag(key: unknown, value?: unknown): void {
    if (value) {
      this.tags[forceString(key)] = forceString(value);
      return;
    }

    if (Array.isArray(key)) {
      key.forEach((k) => {
        this.tags[forceString(k)] = "";
      });
      return;
    }

    if (key === null) {
      this.tags.null = "";
      return;
    }

    if (typeof key === "object") {
      Object.keys(key).forEach((k) => {
        this.tags[forceString(k)] = forceString(
          (key as Record<string, unknown>)[k],
        );
      });
    } else {
      this.tags[forceString(key)] = "";
    }
  }

  public untag(key: unknown): void {
    if (Array.isArray(key)) {
      key.forEach((k) => {
        delete this.tags[forceString(k)];
      });
      return;
    }

    if (key === null) {
      delete this.tags.null;
      return;
    }

    if (typeof key === "object") {
      Object.keys(key as object).forEach((k) => {
        delete this.tags[forceString(k)];
      });
    } else {
      delete this.tags[forceString(key)];
    }
  }

  public with(key: unknown, value?: unknown): Logger {
    const logger = new Logger(this.options);
    logger.tag(this.tags);
    logger.tag(key, value);
    return logger;
  }
}

export default Logger;
