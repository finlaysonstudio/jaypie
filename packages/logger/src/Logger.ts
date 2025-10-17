import { DEFAULT, ERROR, FORMAT, LEVEL, LEVEL_VALUES, PSEUDO_LEVELS } from "./constants";
import { forceString, out, parse, parsesTo, stringify } from "./utils";

type LogLevel = string;
type LogFormat = "json" | "text";
type Tags = Record<string, string>;

interface LoggerOptions {
  format?: LogFormat;
  level?: LogLevel;
  tags?: Tags;
  varLevel?: LogLevel;
}

interface LogJson {
  data?: unknown;
  dataType?: string;
  log: string;
  message: string;
  var?: string;
  [key: string]: unknown;
}

type LogMethod = {
  (...messages: unknown[]): void;
  var: (messageObject: unknown, messageValue?: unknown) => void;
};

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

  constructor({
    format = (process.env.LOG_FORMAT as LogFormat) || DEFAULT.LEVEL,
    level = process.env.LOG_LEVEL || DEFAULT.LEVEL,
    tags = {},
    varLevel = process.env.LOG_VAR_LEVEL || DEFAULT.VAR_LEVEL,
  }: LoggerOptions = {}) {
    this.options = {
      format,
      level,
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

    const varLevelMethod = this[varLevel as "debug" | "error" | "fatal" | "info" | "trace" | "warn"];
    this.var = (varLevelMethod as LogMethod)?.var || this.debug.var;
  }

  private createLogMethod(
    logLevel: string,
    format: LogFormat,
    checkLevel: string,
  ): LogMethod {
    const logFn = (...messages: unknown[]): void => {
      if (LEVEL_VALUES[logLevel] <= LEVEL_VALUES[checkLevel]) {
        if (format === FORMAT.JSON) {
          const message = stringify(...messages);
          const parses = parsesTo(message);
          const json: LogJson = {
            log: logLevel,
            message,
            ...this.tags,
          };
          if (parses.parses) {
            json.data = parses.message;
          }
          out(json, { level: logLevel });
        } else {
          const message = stringify(...messages);
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
        msgObj = messageObject as Record<string, unknown>;
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
        const messageVal = msgObj[messageKey];

        const json: LogJson = {
          data: parse(messageVal),
          dataType: typeof messageVal,
          log: logLevel,
          message: stringify(messageVal),
          var: messageKey,
          ...this.tags,
        };

        if (LEVEL_VALUES[logLevel] <= LEVEL_VALUES[checkLevel]) {
          out(json, { level: logLevel });
        }
      } else {
        return logFn(msgObj);
      }
    };

    return logFn as LogMethod;
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
