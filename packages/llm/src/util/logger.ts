import { JAYPIE } from "@jaypie/kit";
import { log as defaultLog } from "@jaypie/logger";

export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

export const log = getLogger();
