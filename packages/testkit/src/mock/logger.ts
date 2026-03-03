import { vi } from "vitest";

import { createMockWrappedFunction } from "./utils";
import {
  FORMAT,
  LEVEL,
  Logger,
  createLogger as originalCreateLogger,
  redactAuth,
  sanitizeAuth,
} from "@jaypie/logger";
import { mockLogFactory } from "../mockLog.module.js";

const mockLog = mockLogFactory();

export const createLogger = createMockWrappedFunction(
  originalCreateLogger as any,
  mockLog,
);

export const _resetDatadogTransport = vi.fn();
export const isDatadogForwardingEnabled = vi.fn().mockReturnValue(false);

export { FORMAT, LEVEL, Logger, redactAuth, sanitizeAuth };

export default mockLog;
