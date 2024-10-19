/* eslint-disable no-console */
import { DEFAULT, LEVEL } from "./constants.js";
import stringify from "./stringify.js";

//
//
// Main
//

/**
 * Outputs the line by correct level (or default), optionally in a color
 * @param {string} line - The line to output. out will stringify
 */
export default (
  line,
  { color = DEFAULT.COLOR, level = DEFAULT.LEVEL } = {},
) => {
  // Validate

  if (typeof line !== "string") {
    // eslint-disable-next-line no-param-reassign
    line = stringify(line);
  }

  // Setup

  // Preprocess
  let outputFunction;

  // Choose the right console function
  switch (level) {
    case LEVEL.INFO:
      outputFunction = console.info;
      break;
    case LEVEL.WARN:
      outputFunction = console.warn;
      break;
    case LEVEL.ERROR:
    case LEVEL.FATAL:
      outputFunction = console.error;
      break;
    case LEVEL.TRACE:
    case LEVEL.DEBUG:
      outputFunction = console.debug;
      break;
    default:
      // This should never happen
      outputFunction = console.log;
      break;
  }

  // Process

  // Try a confusing set of attempts to output the line
  try {
    outputFunction(color(line));
  } catch (error) {
    try {
      console.warn(error);
      outputFunction(line);

      // eslint-disable-next-line no-shadow
    } catch (error) {
      console.warn(error);
      console.log(line);
    }
  }

  // Return
  // N/A
};
