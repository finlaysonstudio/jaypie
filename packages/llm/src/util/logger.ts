import { JAYPIE, log as defaultLog } from "@jaypie/core";

export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

export const log = getLogger();
