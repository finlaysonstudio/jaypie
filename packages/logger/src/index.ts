import Logger from "./Logger";
import { createLogger } from "./JaypieLogger";
import { FORMAT, LEVEL } from "./constants";
import {
  _resetDatadogTransport,
  isDatadogForwardingEnabled,
} from "./datadogTransport";

export {
  FORMAT,
  LEVEL,
  Logger,
  _resetDatadogTransport,
  createLogger,
  isDatadogForwardingEnabled,
};

export const log = createLogger();

export default log;
