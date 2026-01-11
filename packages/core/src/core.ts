//
//
// Export
//

// Core
export { JAYPIE, PROJECT } from "./core/constants.js";

// Logger - re-export the singleton instance from @jaypie/logger
// so that tag() calls from handlers propagate to all consumers
export { log } from "@jaypie/logger";
