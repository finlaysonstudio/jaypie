import { JAYPIE } from "@jaypie/kit";
import { createLogger, log as defaultLog } from "@jaypie/logger";

export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });
