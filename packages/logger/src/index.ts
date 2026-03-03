import Logger from "./Logger";
import { createLogger } from "./JaypieLogger";
import { FORMAT, LEVEL } from "./constants";
import {
  _resetDatadogTransport,
  isDatadogForwardingEnabled,
} from "./datadogTransport";
import { redactAuth, sanitizeAuth } from "./sanitizeAuth";

export {
  FORMAT,
  LEVEL,
  Logger,
  _resetDatadogTransport,
  createLogger,
  isDatadogForwardingEnabled,
  redactAuth,
  sanitizeAuth,
};

export const log = createLogger();

export default log;
