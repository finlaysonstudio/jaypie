import Logger from "./Logger";
import { createLogger } from "./JaypieLogger";
import { FORMAT, LEVEL } from "./constants";

export { FORMAT, LEVEL, Logger, createLogger };

export const log = createLogger();

export default log;
