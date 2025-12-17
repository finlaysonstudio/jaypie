//
//
// Export
//

// Errors - from @jaypie/errors
export * from "@jaypie/errors";
export { jaypieErrorFromStatus as errorFromStatusCode } from "@jaypie/errors";

// Backwards compatibility aliases for errors
export { InternalError as ProjectError } from "@jaypie/errors";
export { InternalError as MultiError } from "@jaypie/errors";
export { InternalError as ProjectMultiError } from "@jaypie/errors";

// ERROR constant
export { ERROR } from "./error.constant.js";

// Kit exports
export * from "@jaypie/kit";

// Logger
export { log } from "@jaypie/logger";

// Optional packages - lazy loaded wrappers
export * from "./aws.js";
export * from "./datadog.js";
export * from "./express.js";
export * from "./lambda.js";
export * from "./llm.js";
export * from "./mongoose.js";
