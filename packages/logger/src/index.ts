import Logger from "./Logger";
import { createLogger } from "./JaypieLogger";
import { FORMAT, LEVEL } from "./constants";
import {
  _resetDatadogTransport,
  getDatadogTransport,
  isDatadogForwardingEnabled,
} from "./datadogTransport";
import {
  createRedactor,
  isSecret,
  looksSecret,
  redactAuth,
  sanitizeAuth,
  secret,
} from "./redact";

export {
  FORMAT,
  LEVEL,
  Logger,
  _resetDatadogTransport,
  createLogger,
  createRedactor,
  getDatadogTransport,
  isDatadogForwardingEnabled,
  isSecret,
  looksSecret,
  redactAuth,
  sanitizeAuth,
  secret,
};
export type { SerializationLimitOptions, SerializationLimits } from "./limits";
export type {
  RedactContext,
  RedactHook,
  RedactionOptions,
  Redactor,
} from "./redact";
export { JaypieLogger } from "./JaypieLogger";

export const log = createLogger();

export default log;
