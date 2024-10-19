import { force } from "../arguments.lib.js";

import {
  COLOR,
  DEFAULT,
  ERROR,
  FORMAT,
  LEVEL,
  LEVEL_VALUES,
} from "./util/constants.js";
import logFunction from "./util/log.js";
import out from "./util/out.js";
import stringify from "./util/stringify.js";

//
//
// Constants
//

const PSEUDO_LEVELS = ["ALL", "SILENT"];

//
//
// Helper Functions
//

/** Only log `messages` if `logLevel` is below `checkLevel` */
function log(
  messages,
  logLevel,
  checkLevel = DEFAULT.LEVEL,
  { color = COLOR.PLAIN } = {},
) {
  if (LEVEL_VALUES[logLevel] <= LEVEL_VALUES[checkLevel]) {
    // TODO: replace log with out
    logFunction(messages, color);
  }
}

function outIfLogLevelCheck(
  message,
  logLevel,
  checkLevel = DEFAULT.LEVEL,
  { color = COLOR.PLAIN } = {},
) {
  if (LEVEL_VALUES[logLevel] <= LEVEL_VALUES[checkLevel]) {
    out(message, { color, level: logLevel });
  }
}

function parse(message) {
  if (typeof message !== "string") {
    return message;
  }
  // Now we know message is a string
  try {
    return JSON.parse(message);
  } catch (error) {
    return message;
  }
}

/**
 * Returns an object with `parses` if the message is parsable JSON and `message` with the parsed or original message
 * @param {string} message - The message to parse
 * @returns {object} - An object with `parses` and `message` properties
 * @example
 */
function parsesTo(message) {
  if (typeof message !== "string") {
    return {
      parses: false,
      message,
    };
  }
  // Now we know message is a string
  try {
    return {
      parses: true,
      message: JSON.parse(message),
    };
  } catch (error) {
    return {
      parses: false,
      message,
    };
  }
}

//
//
// Class Definition
//

class Logger {
  //
  //
  // Constructor
  //

  constructor({
    format = process.env.LOG_FORMAT || DEFAULT.FORMAT,
    level = process.env.LOG_LEVEL || DEFAULT.LEVEL,
    tags = {},
    varLevel = process.env.LOG_VAR_LEVEL || DEFAULT.VAR_LEVEL,
  } = {}) {
    //
    //
    // Validate
    //

    //
    //
    // Setup
    //

    // Set options
    this.options = {
      format,
      level,
      varLevel,
    };

    // Set tags
    this.tags = {};
    // Force the value of all the keys in this.tags to be strings
    Object.keys(tags).forEach((key) => {
      this.tags[key] = force.string(tags[key]);
    });

    //
    //
    // Preprocess
    //

    //

    //
    //
    // Process
    //

    // Build out the functions for each level
    const LEVEL_KEYS = Object.keys(LEVEL);
    LEVEL_KEYS.forEach((LEVEL_KEY) => {
      // Ignore the pseudo levels
      if (!PSEUDO_LEVELS.includes(LEVEL_KEY)) {
        switch (format) {
          case FORMAT.COLOR:
            this[LEVEL[LEVEL_KEY]] = (...messages) =>
              log(messages, LEVEL[LEVEL_KEY], level, {
                color: COLOR[LEVEL_KEY],
              });
            break;

          case FORMAT.JSON:
            this[LEVEL[LEVEL_KEY]] = (...messages) => {
              const message = stringify(...messages);
              const parses = parsesTo(message);
              const json = {
                log: LEVEL[LEVEL_KEY], // Do not use "level," reserved by Datadog
                message,
                ...this.tags,
              };
              if (parses.parses) {
                json.data = parses.message;
              }
              outIfLogLevelCheck(json, LEVEL[LEVEL_KEY], level, {
                color: COLOR[LEVEL_KEY],
              });
            };
            break;

          default:
            this[LEVEL[LEVEL_KEY]] = (...messages) =>
              log(messages, LEVEL[LEVEL_KEY], level, {
                color: COLOR.PLAIN,
              });
            break;
        } // switch format

        // Build var function
        this[LEVEL[LEVEL_KEY]].var = (messageObject, messageValue) => {
          // Log undefined warning
          if (messageObject === undefined) {
            this.warn(ERROR.VAR.UNDEFINED_MESSAGE);
          }

          // If passing two params
          if (typeof messageObject !== "object") {
            /* eslint-disable no-param-reassign */
            if (messageValue === undefined) messageValue = "undefined";
            messageObject = { [messageObject]: messageValue };
            /* eslint-enable no-param-reassign */
          }

          //* At this point we know this is an object or null

          // Log null object warning
          if (messageObject === null) {
            this.warn(ERROR.VAR.NULL_OBJECT);
            return this[LEVEL[LEVEL_KEY]](messageObject);
          }
          // Log empty object warning
          if (Object.keys(messageObject).length === 0) {
            this.warn(ERROR.VAR.EMPTY_OBJECT);
            return this[LEVEL[LEVEL_KEY]](messageObject);
          }
          // Log stuffed object warning
          if (Object.keys(messageObject).length > 1) {
            this.warn(ERROR.VAR.MULTIPLE_KEYS);
            return this[LEVEL[LEVEL_KEY]](messageObject);
          }

          //* At this point we know this is an object with one key

          // Log the real message
          if (format === FORMAT.JSON) {
            const messageKey = Object.keys(messageObject)[0];

            const json = {
              data: parse(messageObject[messageKey]), // will not be stringified
              dataType: typeof messageObject[messageKey],
              log: LEVEL[LEVEL_KEY], // Do not use "level," reserved by Datadog
              message: stringify(messageObject[messageKey]), // message: will be stringified
              var: messageKey,
              ...this.tags,
            };
            return outIfLogLevelCheck(json, LEVEL[LEVEL_KEY], level, {
              color: COLOR[LEVEL_KEY],
            });
          }
          return this[LEVEL[LEVEL_KEY]](messageObject);
        };
      } // if !PSEUDO_LEVELS
    }); // forEach LEVEL_KEYS

    //
    //
    // Postprocess
    //

    // Link var convenience function
    this.var = this[this.options.varLevel].var;

    //
    //
    // Return
    //

    // * We could expressly return `this` but it is implicit in JS
  } // END constructor

  //
  //
  // Placeholder Methods
  //

  // * Helps with autocomplete in IDEs
  // All these methods are overwritten in the constructor

  /* eslint-disable class-methods-use-this */
  trace() {}

  debug() {}

  info() {}

  warn() {}

  error() {}

  fatal() {}

  var() {}
  /* eslint-enable class-methods-use-this */

  //
  //
  // Methods
  //

  tag(key, value) {
    // If value is present, we assume it is key:value
    if (value) {
      this.tags[force.string(key)] = force.string(value);
      return;
    }
    // value = undefined

    // If key is an array...
    if (Array.isArray(key)) {
      // ...we assume it is an array of strings
      key.forEach((k) => {
        this.tags[force.string(k)] = "";
      });
      return;
    }
    // key is not an array

    // If key is null, tag it null:""
    if (key === null) {
      this.tags.null = "";
      return;
    }

    // If key is an object, we merge in those values
    if (typeof key === "object") {
      Object.keys(key).forEach((k) => {
        this.tags[force.string(k)] = force.string(key[k]);
      });
    } else {
      // If key is not an object, we make it the key and set it to empty
      this.tags[force.string(key)] = "";
    }
  }

  untag(key) {
    // If key is an array...
    if (Array.isArray(key)) {
      // ...we assume it is an array of strings
      key.forEach((k) => {
        delete this.tags[force.string(k)];
      });
      return;
    }
    // key is not an array

    // If key is null, tag it null:""
    if (key === null) {
      delete this.tags.null;
      return;
    }

    // If key is an object, we merge in those values
    if (typeof key === "object") {
      Object.keys(key).forEach((k) => {
        delete this.tags[force.string(k)];
      });
    } else {
      // If key is not an object, we make it the key and set it to empty
      delete this.tags[force.string(key)];
    }
  }

  with(key, value) {
    const logger = new Logger(this.options);
    logger.tag(this.tags);
    logger.tag(key, value);
    return logger;
  }
}

//
//
// Export
//

export default Logger;
