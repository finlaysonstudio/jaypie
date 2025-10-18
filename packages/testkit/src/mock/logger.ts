import { createMockWrappedFunction } from "./utils";
import {
  FORMAT,
  LEVEL,
  Logger,
  createLogger as originalCreateLogger,
} from "@jaypie/logger";
import { mockLogFactory } from "../mockLog.module.js";

const mockLog = mockLogFactory();

export const createLogger = createMockWrappedFunction(
  originalCreateLogger,
  mockLog,
);

export { FORMAT, LEVEL, Logger };

export default mockLog;
