import Logger from "../lib/log.lib.js";

import { ConfigurationError } from "../lib/errors.lib.js";
import { envBoolean } from "../lib/functions.lib.js";
import logTags from "./logTags.function.js";
import logVar from "./logVar.function.js";

//
//
// Constants
//

const LOG = {
  FORMAT: Logger.LOG_FORMAT,
  LEVEL: Logger.LOG_LEVEL,
};

//
//
// Jaypie Logger Chassis
//

class JaypieLogger {
  constructor({ level = process.env.LOG_LEVEL, tags = {} } = {}) {
    this._params = { level, tags };
    this._loggers = [];
    this.init();
  }

  init() {
    // Loop through this._loggers and call init() on each
    for (const logger of this._loggers) {
      if (logger.init && typeof logger.init === "function") {
        logger.init();
      }
    }
    const level = this._params.level;
    const tags = this._params.tags;
    this.level = level;
    this._tags = { ...logTags(), ...tags };
    this._logger = new Logger.Logger({
      format: LOG.FORMAT.JSON,
      level,
      tags: this._tags,
    });
    this._loggers = [];
    this._loggers.push(this._logger);
    this._withLoggers = {};

    const levels = ["debug", "error", "fatal", "info", "trace", "warn"];
    levels.forEach((lvl) => {
      this[lvl] = (...args) => {
        this._logger[lvl](...args);
      };
      this[lvl].var = (...args) => {
        this._logger[lvl].var(...args);
      };
    });
  }

  // @knowdev/log "classic" methods

  debug(...args) {
    return this._logger.debug(...args);
  }
  error(...args) {
    return this._logger.error(...args);
  }
  fatal(...args) {
    return this._logger.fatal(...args);
  }
  info(...args) {
    return this._logger.info(...args);
  }
  tag(tags) {
    for (const logger of this._loggers) {
      logger.tag(tags);
    }
    // Add args to this._tags
    Object.assign(this._tags, tags);
  }
  trace(...args) {
    return this._logger.trace(...args);
  }
  untag(...args) {
    for (const logger of this._loggers) {
      logger.untag(...args);
    }
    // Remove args from this._tags
    for (const key of Object.keys(args)) {
      delete this._tags[key];
    }
  }
  var(...args) {
    return this._logger.var(logVar(...args));
  }
  warn(...args) {
    return this._logger.warn(...args);
  }
  with(...args) {
    if (!args || typeof args !== "object") {
      throw new ConfigurationError();
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

  // Jaypie-specifics

  lib({ level, lib, tags = {} } = {}) {
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
        return LOG.LEVEL.SILENT;
      })(),
      tags: newTags,
    });
    this._loggers.push(logger);
    return logger;
  }
}

//
//
// Main
//

const init = (tags = {}) => {
  const jaypieLogger = new JaypieLogger({
    tags,
  });
  return jaypieLogger;
};

//
//
// Export
//

export default init;
