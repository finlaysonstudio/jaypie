import { FORMAT, LEVEL } from "./util/constants.js";
import Logger from "./Logger.js";

//
//
// Normalize environment
//

//
//
// Instance
//

const log = new Logger();

//
//
// Decorate
//

log.log = log.debug;
log.LOG_FORMAT = FORMAT;
log.LOG_LEVEL = LEVEL;
log.Logger = Logger;

//
//
// Export
//

export default log;
